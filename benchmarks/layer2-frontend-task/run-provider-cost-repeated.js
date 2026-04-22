#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const { spawnSync } = require('child_process');
const {
  buildProviderCostEvidence,
} = require('./provider-cost-evidence.js');
const {
  summarizeProviderCostCampaign,
  shouldStartNextPair,
  renderProviderCostCampaignMarkdown,
} = require('./provider-cost-repeated-summary.js');
const {
  evidencePaths,
  timestampRunId,
} = require('./evidence-paths.js');
const {
  LITELLM_PRICING_URL,
  fetchPricingCatalog,
  pricingAssumptionFromLiteLLMCatalog,
  readPricingCatalog,
} = require('./provider-pricing.js');
const {
  resolveOpenAIModel,
} = require('./model-resolution.js');
const {
  resolveOpenAILiveAuth,
  publicAuthSummary,
} = require('./openai-live-auth.js');

function parseRepeatedArgs(argv) {
  const args = { _: [] };
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      args._.push(arg);
      continue;
    }
    const index = arg.indexOf('=');
    const key = index === -1 ? arg.slice(2) : arg.slice(2, index);
    const value = index === -1 ? true : arg.slice(index + 1);
    if (['pair-evidence', 'pair'].includes(key)) {
      if (!Array.isArray(args[key])) args[key] = [];
      args[key].push(value);
    } else {
      args[key] = value;
    }
  }
  return args;
}

function readJson(filePath, label) {
  if (!filePath) throw new Error(`Missing --${label}=<json>`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonWithBaseDir(filePath, label) {
  const absolutePath = path.resolve(filePath);
  return {
    value: readJson(absolutePath, label),
    baseDir: path.dirname(absolutePath),
  };
}

function optionalNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid non-negative number: ${value}`);
  return parsed;
}

function relativePath(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join('/');
}

function firstArtifactField(artifacts, field) {
  const artifact = artifacts.find((item) => item && item[field]);
  return artifact ? artifact[field] : undefined;
}

async function pricingFromArgs(args, artifacts) {
  const pricing = args.pricing ? readJson(args.pricing, 'pricing') : {};
  const merged = {
    ...pricing,
    provider: args.provider || pricing.provider || firstArtifactField(artifacts, 'provider') || 'openai',
    model: args.model || pricing.model || firstArtifactField(artifacts, 'model'),
    currency: args.currency || pricing.currency,
    inputPer1MTokens: optionalNumber(args['input-rate-per-1m'], pricing.inputPer1MTokens),
    outputPer1MTokens: optionalNumber(args['output-rate-per-1m'], pricing.outputPer1MTokens),
    cachedInputPer1MTokens: optionalNumber(args['cached-input-rate-per-1m'], pricing.cachedInputPer1MTokens),
    sourceUrl: args['pricing-source-url'] || pricing.sourceUrl,
    checkedDate: args['pricing-checked-date'] || pricing.checkedDate,
    endpoint: args.endpoint || pricing.endpoint || 'chat.completions',
    serviceTier: args['service-tier'] || pricing.serviceTier || 'standard',
    pricingTreatment: pricing.pricingTreatment || {
      longContextApplies: args['long-context-applies'] === 'true' || false,
      regionalProcessingApplies: args['regional-processing-applies'] === 'true' || false,
    },
  };

  const shouldUseCatalog = args['pricing-catalog'] || args['pricing-catalog-url'] || args['fetch-pricing'];
  const hasManualRates = merged.inputPer1MTokens !== undefined && merged.outputPer1MTokens !== undefined;
  if (!shouldUseCatalog || hasManualRates) return merged;

  const sourceUrl = args['pricing-catalog-url'] || LITELLM_PRICING_URL;
  const catalog = args['pricing-catalog']
    ? readPricingCatalog(args['pricing-catalog'])
    : await fetchPricingCatalog(sourceUrl);
  const fromCatalog = pricingAssumptionFromLiteLLMCatalog({
    dataset: catalog,
    provider: merged.provider,
    model: merged.model,
    sourceUrl,
    checkedDate: merged.checkedDate,
    currency: merged.currency,
  });

  return {
    ...fromCatalog.pricing,
    ...Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined && value !== null)),
    catalogLookupReasons: fromCatalog.reasons,
  };
}

function normalizePairEvidenceArgs(values) {
  return values.flatMap((value) => String(value).split(',').filter(Boolean)).map((evidencePath) => ({ evidencePath }));
}

function resolveRelative(baseDir, value) {
  if (!value) return value;
  return path.isAbsolute(value) ? value : path.join(baseDir, value);
}

function loadImportManifest(filePath) {
  const absolutePath = path.resolve(filePath);
  const baseDir = path.dirname(absolutePath);
  const manifest = readJson(absolutePath, 'import-manifest');
  const pairEvidence = Array.isArray(manifest.pairEvidence)
    ? manifest.pairEvidence.map((entry) => {
        if (typeof entry === 'string') return { evidencePath: resolveRelative(baseDir, entry) };
        return {
          ...entry,
          evidencePath: resolveRelative(baseDir, entry.evidencePath),
        };
      })
    : [];
  return {
    manifest,
    campaignManifest: manifest.campaignManifestPath
      ? readJson(resolveRelative(baseDir, manifest.campaignManifestPath), 'campaign-manifest')
      : manifest.campaignManifest,
    attemptedPairLedger: manifest.attemptedPairLedgerPath
      ? readJson(resolveRelative(baseDir, manifest.attemptedPairLedgerPath), 'attempted-pair-ledger')
      : manifest.attemptedPairLedger,
    pairEvidence,
  };
}

function normalizeTaskManifestTasks(taskManifest) {
  const rawTasks = Array.isArray(taskManifest?.tasks)
    ? taskManifest.tasks
    : Array.isArray(taskManifest?.taskClasses)
      ? taskManifest.taskClasses
      : [];
  return rawTasks.map((task, index) => {
    const id = task.id || task.taskClass || task.taskId || task.name || `task-${index + 1}`;
    return {
      ...task,
      id,
      targetPairCount: optionalNumber(task.targetPairCount ?? task.requiredAcceptedPairs ?? task.pairs ?? task.repetitions, 1),
      repetitions: optionalNumber(task.repetitions ?? task.targetPairCount ?? task.requiredAcceptedPairs ?? task.pairs, 1),
      qualityGate: task.qualityGate || task.quality_gate || task.gate,
    };
  });
}

function readTextRelative(baseDir, value, label) {
  if (!value) return null;
  const filePath = resolveRelative(baseDir, value);
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${value}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function buildCorrectedPayloadPrompt({ task, role, payload }) {
  const instruction = task.instruction || task.taskInstruction || task.promptInstruction || task.prompt || [
    'Analyze the supplied frontend payload and return a concise, behavior-preserving answer.',
    'Cover responsibilities, extraction/refactor boundaries, risks, and tests when relevant.',
  ].join(' ');
  const targetFile = task.targetFile || task.target || 'unknown-target';
  const payloadKind = role === 'baseline' ? 'full-source' : 'fooks-model-facing-payload';
  const format = role === 'baseline' ? (task.baselineContextFormat || 'source') : (task.fooksContextFormat || 'json');
  return [
    instruction,
    '',
    'STRICT EVIDENCE RULES:',
    '- Answer only from the payload in this prompt.',
    '- Do not inspect the filesystem, run shell commands, search the workspace, or use external files.',
    '- If the payload lacks information needed for a claim, say what is missing instead of looking it up.',
    '- Keep the answer compact and comparable across baseline/fooks variants.',
    '',
    `TARGET_FILE: ${targetFile}`,
    `PAYLOAD_KIND: ${payloadKind}`,
    `PAYLOAD_FORMAT: ${format}`,
    'BEGIN_PAYLOAD',
    payload,
    'END_PAYLOAD',
  ].join('\n');
}

function hydrateTaskManifest(taskManifest, baseDir = process.cwd()) {
  if (!taskManifest) return taskManifest;
  const rawTasks = Array.isArray(taskManifest.tasks)
    ? taskManifest.tasks
    : Array.isArray(taskManifest.taskClasses)
      ? taskManifest.taskClasses
      : [];
  const tasks = rawTasks.map((task) => {
    const baselinePayload = readTextRelative(baseDir, task.baselineContextPath || task.baselinePayloadPath, 'baseline context');
    const fooksPayload = readTextRelative(baseDir, task.fooksContextPath || task.fooksPayloadPath, 'fooks context');
    if (!baselinePayload && !fooksPayload) return task;
    if (!baselinePayload || !fooksPayload) {
      throw new Error(`Task ${task.id || task.taskClass || task.name || '<unknown>'} must provide both baseline and fooks context paths`);
    }
    return {
      ...task,
      baselinePrompt: task.baselinePrompt || buildCorrectedPayloadPrompt({ task, role: 'baseline', payload: baselinePayload }),
      fooksPrompt: task.fooksPrompt || buildCorrectedPayloadPrompt({ task, role: 'fooks', payload: fooksPayload }),
      setupIdentity: task.setupIdentity || 'corrected-real-payload-no-tool',
    };
  });
  if (Array.isArray(taskManifest.tasks)) return { ...taskManifest, tasks };
  if (Array.isArray(taskManifest.taskClasses)) return { ...taskManifest, taskClasses: tasks };
  return taskManifest;
}

function plannedPairsFromTasks(tasks) {
  return tasks.reduce((sum, task) => sum + optionalNumber(task.repetitions ?? task.targetPairCount, 1), 0);
}

function pairFromArg(value) {
  const [baselinePath, fooksPath, taskClass] = String(value).split(':');
  if (!baselinePath || !fooksPath || !taskClass) {
    throw new Error('--pair must be <baseline.json>:<fooks.json>:<task-class>');
  }
  return { baselinePath, fooksPath, taskClass };
}

function createDefaultManifest({ runId, model, taskClasses, tasks = [], args, pricing }) {
  const uniqueTasks = [...new Set(taskClasses.filter(Boolean))];
  const manifestTasks = tasks.length > 0
    ? tasks
    : uniqueTasks.map((id) => ({
        id,
        targetPairCount: optionalNumber(args['required-accepted-pairs-per-task'], 5),
        qualityGate: {
          id: args['quality-gate-id'] || 'provider-cost-import-smoke',
          version: args['quality-gate-version'] || 'v1',
          command: args['quality-gate-command'] || 'imported-artifact-quality-gate',
        },
      }));
  return {
    campaignId: runId,
    model,
    endpoint: args.endpoint || pricing.endpoint || 'chat.completions',
    serviceTier: args['service-tier'] || pricing.serviceTier || 'standard',
    reasoning: args.reasoning || null,
    maxOutputTokens: optionalNumber(args['max-output-tokens'], null),
    pricingSourceUrl: pricing.sourceUrl,
    pricingCheckedDate: pricing.checkedDate,
    taskClasses: manifestTasks.map((task) => ({
      id: task.id,
      targetPairCount: optionalNumber(task.targetPairCount ?? args['required-accepted-pairs-per-task'], 5),
      qualityGate: task.qualityGate || {
        id: args['quality-gate-id'] || 'provider-cost-import-smoke',
        version: args['quality-gate-version'] || 'v1',
        command: args['quality-gate-command'] || 'imported-artifact-quality-gate',
      },
    })),
    caps: {
      maxEstimatedUsd: optionalNumber(args['max-estimated-usd'], 5),
      campaignMaxEstimatedUsd: optionalNumber(args['campaign-max-estimated-usd'], optionalNumber(args['max-estimated-usd'], 5)),
      maxMatchedPairs: optionalNumber(args['max-matched-pairs'], 10),
      maxBatches: optionalNumber(args['max-batches'], 1),
    },
  };
}

function createLedgerFromPairs({ pairs, plannedPairCount }) {
  return {
    plannedPairCount: plannedPairCount || pairs.length,
    attemptedPairCount: pairs.length,
    acceptedPairCount: pairs.filter((pair) => pair.evidence?.status !== 'inconclusive').length,
    failedPairCount: pairs.filter((pair) => pair.evidence?.status === 'inconclusive').length,
    rejectedPairCount: 0,
    missingUsagePairCount: pairs.filter((pair) => pair.evidence?.status === 'inconclusive').length,
    neutralPairCount: pairs.filter((pair) => pair.evidence?.deltas?.estimatedApiCostTotal?.absolute === 0).length,
    regressedPairCount: pairs.filter((pair) => pair.evidence?.deltas?.estimatedApiCostTotal?.absolute < 0).length,
    omittedPairs: [],
    attemptedPairs: pairs.map((pair, index) => ({
      pairId: pair.evidence?.runId || pair.pairId || `pair-${index + 1}`,
      taskClass: pair.taskClass || pair.evidence?.taskClass,
      status: pair.evidence?.status || 'unknown',
    })),
  };
}

function createLiveLedger({ pairs, attemptedPairs, plannedPairCount, failedPairCount = 0, missingUsagePairCount = 0 }) {
  return {
    plannedPairCount,
    attemptedPairCount: attemptedPairs.length,
    acceptedPairCount: pairs.filter((pair) => pair.evidence?.status !== 'inconclusive').length,
    failedPairCount: failedPairCount || pairs.filter((pair) => pair.evidence?.status === 'inconclusive').length,
    rejectedPairCount: 0,
    missingUsagePairCount: missingUsagePairCount || pairs.filter((pair) => pair.evidence?.status === 'inconclusive').length,
    neutralPairCount: pairs.filter((pair) => pair.evidence?.deltas?.estimatedApiCostTotal?.absolute === 0).length,
    regressedPairCount: pairs.filter((pair) => pair.evidence?.deltas?.estimatedApiCostTotal?.absolute < 0).length,
    omittedPairs: [],
    attemptedPairs,
  };
}

function pairOrderFor({ args, task, repetition }) {
  const mode = task.pairOrder || task.pair_order || args['pair-order'] || 'baseline-first';
  if (mode === 'baseline-first' || mode === 'ab') return ['baseline', 'fooks'];
  if (mode === 'fooks-first' || mode === 'ba') return ['fooks', 'baseline'];
  if (mode === 'abba' || mode === 'alternating') {
    return repetition % 2 === 1 ? ['baseline', 'fooks'] : ['fooks', 'baseline'];
  }
  throw new Error(`Invalid --pair-order/task pairOrder: ${mode}`);
}

function resolveCodexWorkDirRoot({ args, outputDir }) {
  const explicitRoot = args['codex-workdir-root'];
  if (explicitRoot) return path.resolve(explicitRoot);
  const mode = args['codex-workdir'] || args['codex-workdir-mode'] || 'evidence';
  if (mode === 'evidence') return outputDir;
  if (mode === 'isolated') return path.join(os.tmpdir(), 'fooks-provider-cost-codex');
  throw new Error(`Invalid --codex-workdir: ${mode}`);
}

function countCodexCommandExecutions(events) {
  return events.filter((event) => event.item?.type === 'command_execution').length;
}

function qualityGateForArtifact({ baseGate, artifact, requireNoToolUse }) {
  if (!requireNoToolUse) return baseGate;
  const commandExecutionCount = artifact.commandExecutionCount || 0;
  const inherited = baseGate && typeof baseGate === 'object'
    ? baseGate
    : { id: baseGate || 'corrected-payload-validation' };
  const noToolStatus = commandExecutionCount === 0 ? 'passed' : 'failed';
  const command = [
    inherited.command || 'payload-only answer validation',
    `no-tool-use:${noToolStatus}`,
    `commandExecutionCount:${commandExecutionCount}`,
  ].join('; ');
  return {
    ...inherited,
    id: inherited.id || 'corrected-payload-validation',
    status: commandExecutionCount === 0 ? (inherited.status || noToolStatus) : 'failed',
    command,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function openAiChatCompletion({ auth, model, prompt, maxOutputTokens }) {
  const payload = JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
  });
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...auth.headers,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (error) { /* preserve body */ }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`OpenAI request failed: ${res.statusCode} ${body.slice(0, 200)}`));
          return;
        }
        const usage = parsed?.usage || {};
        resolve({
          provider: 'openai',
          model: parsed?.model || model,
          requestedModel: model,
          usageSource: 'live-openai-usage',
          authSource: auth.credentialKind,
          authCredentialSource: auth.source,
          usage,
          inputTokens: usage.prompt_tokens ?? usage.input_tokens ?? null,
          outputTokens: usage.completion_tokens ?? usage.output_tokens ?? null,
          totalTokens: usage.total_tokens ?? null,
          status: usage ? 'success' : 'usage-unavailable',
          latencyMs: Date.now() - started,
          timestamp: new Date().toISOString(),
        });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function parseCodexJsonEvents(stdout) {
  const events = String(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{'))
    .map((line) => {
      try { return JSON.parse(line); } catch (error) { return null; }
    })
    .filter(Boolean);
  const completed = [...events].reverse().find((event) => event.type === 'turn.completed' && event.usage);
  const message = [...events].reverse().find((event) => event.type === 'item.completed' && event.item?.type === 'agent_message');
  return { events, completed, message };
}

function codexExecCompletion({ model, prompt, maxOutputTokens, outputDir, workDirRoot, taskClass, side, repetition }) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(workDirRoot, { recursive: true });
  const workDir = fs.mkdtempSync(path.join(workDirRoot, `codex-${taskClass}-${side}-${repetition}-`));
  const args = [
    'exec',
    '--json',
    '--sandbox',
    'read-only',
    '--skip-git-repo-check',
    '--ephemeral',
    '-C',
    workDir,
    '--model',
    model,
  ];
  if (maxOutputTokens) {
    args.push('-c', `model_max_output_tokens=${JSON.stringify(maxOutputTokens)}`);
  }
  args.push(prompt);

  const started = Date.now();
  const result = spawnSync('codex', args, {
    cwd: workDir,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env },
  });
  const latencyMs = Date.now() - started;
  const jsonlPath = path.join(outputDir, 'codex-jsonl', `${taskClass}-${side}-${repetition}.jsonl`);
  writeJson(`${jsonlPath}.meta.json`, {
    command: 'codex exec --json --sandbox read-only --skip-git-repo-check --ephemeral',
    model,
    exitCode: result.status,
    signal: result.signal,
    latencyMs,
  });
  fs.mkdirSync(path.dirname(jsonlPath), { recursive: true });
  fs.writeFileSync(jsonlPath, result.stdout || '');

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`codex exec failed: exit ${result.status}; ${String(result.stderr || result.stdout).slice(0, 300)}`);
  }

  const parsed = parseCodexJsonEvents(result.stdout);
  const usage = parsed.completed?.usage || {};
  const commandExecutionCount = countCodexCommandExecutions(parsed.events);
  if (!parsed.completed) {
    throw new Error('codex exec completed without turn.completed usage event');
  }
  return {
    provider: 'openai',
    model,
    requestedModel: model,
    usageSource: 'live-openai-usage',
    authSource: 'codex-oauth',
    authCredentialSource: 'codex-auth-json',
    transport: 'codex-exec',
    usage: {
      input_tokens: usage.input_tokens ?? null,
      output_tokens: usage.output_tokens ?? null,
      total_tokens: usage.input_tokens !== undefined && usage.output_tokens !== undefined
        ? usage.input_tokens + usage.output_tokens
        : null,
      input_tokens_details: usage.cached_input_tokens !== undefined
        ? { cached_tokens: usage.cached_input_tokens }
        : undefined,
    },
    inputTokens: usage.input_tokens ?? null,
    cachedInputTokens: usage.cached_input_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    totalTokens: usage.input_tokens !== undefined && usage.output_tokens !== undefined
      ? usage.input_tokens + usage.output_tokens
      : null,
    status: usage.input_tokens !== undefined && usage.output_tokens !== undefined ? 'success' : 'usage-unavailable',
    latencyMs,
    timestamp: new Date().toISOString(),
    responseText: parsed.message?.item?.text || null,
    commandExecutionCount,
    noToolUse: commandExecutionCount === 0,
    rawEventPath: path.relative(process.cwd(), jsonlPath).split(path.sep).join('/'),
  };
}

async function collectLivePairs({ args, runId, pricing, outputDir, taskManifest }) {
  const tasks = normalizeTaskManifestTasks(taskManifest);
  const plannedPairCount = plannedPairsFromTasks(tasks);
  const auth = resolveOpenAILiveAuth({ args });
  if (!auth.ok) {
    return {
      blocker: `OpenAI live auth is required for --live-openai; no request was made (${auth.reasons.join('; ')})`,
      auth,
      pairs: [],
      ledger: {
        plannedPairCount,
        attemptedPairCount: 0,
        acceptedPairCount: 0,
        failedPairCount: 0,
        rejectedPairCount: 0,
        missingUsagePairCount: 0,
        neutralPairCount: 0,
        regressedPairCount: 0,
        omittedPairs: [],
        attemptedPairs: [],
      },
    };
  }

  const modelConfig = resolveOpenAIModel({ modelArg: args.model });
  const maxMatchedPairs = optionalNumber(args['max-matched-pairs'], 10);
  const maxEstimatedUsd = optionalNumber(args['max-estimated-usd'], 5);
  const campaignMaxEstimatedUsd = optionalNumber(args['campaign-max-estimated-usd'], maxEstimatedUsd);
  const worstCase = optionalNumber(args['worst-case-pair-estimated-usd'], maxEstimatedUsd / Math.max(maxMatchedPairs, 1));
  const maxOutputTokens = optionalNumber(args['max-output-tokens'], null);
  const pairs = [];
  const attemptedPairs = [];
  const transport = args.transport || args['live-transport'] || (auth.credentialKind === 'codex-oauth' ? 'codex-exec' : 'direct-api');
  const codexWorkDirRoot = resolveCodexWorkDirRoot({ args, outputDir });
  const requireNoToolUse = args['require-no-tool-use'] === 'true' || args['require-no-tool-use'] === true;
  let currentBatchEstimatedUsd = 0;
  let currentCampaignEstimatedUsd = 0;

  for (const task of tasks) {
    const taskClass = task.id || task.taskClass || task.name;
    const repetitions = Number(task.repetitions || task.targetPairCount || 1);
    for (let i = 0; i < repetitions; i += 1) {
      const gate = shouldStartNextPair({
        currentBatchEstimatedUsd,
        currentCampaignEstimatedUsd,
        nextWorstCaseEstimatedUsd: worstCase,
        maxEstimatedUsd,
        campaignMaxEstimatedUsd,
        attemptedMatchedPairs: pairs.length,
        maxMatchedPairs,
      });
      if (!gate.allowed) {
        return {
          pairs,
          auth,
          requestAttempted: attemptedPairs.length > 0,
          capState: { blocked: true, reasons: gate.reasons },
          stoppedBeforePair: { taskClass, repetition: i + 1 },
          ledger: createLiveLedger({ pairs, attemptedPairs, plannedPairCount }),
        };
      }
      const pairId = `${runId}-${taskClass}-${i + 1}`;
      const executionOrder = pairOrderFor({ args, task, repetition: i + 1 });
      attemptedPairs.push({ pairId, taskClass, status: 'started', executionOrder });
      let baselineArtifact;
      let fooksArtifact;
      try {
        const artifacts = {};
        for (const side of executionOrder) {
          const prompt = side === 'baseline'
            ? task.baselinePrompt || task.prompt
            : task.fooksPrompt || task.prompt;
          if (transport === 'codex-exec') {
            artifacts[side] = codexExecCompletion({
              model: modelConfig.model,
              prompt,
              maxOutputTokens,
              outputDir,
              workDirRoot: codexWorkDirRoot,
              taskClass,
              side,
              repetition: i + 1,
            });
          } else {
            artifacts[side] = await openAiChatCompletion({ auth, model: modelConfig.model, prompt, maxOutputTokens });
          }
        }
        baselineArtifact = artifacts.baseline;
        fooksArtifact = artifacts.fooks;
      } catch (error) {
        attemptedPairs[attemptedPairs.length - 1] = {
          pairId,
          taskClass,
          status: 'request-failed',
          reason: error.message,
        };
        return {
          pairs,
          auth,
          requestAttempted: true,
          blocker: `OpenAI live request failed; campaign stopped without claiming savings (${error.message})`,
          capState: { blocked: true, reasons: [error.message] },
          ledger: createLiveLedger({ pairs, attemptedPairs, plannedPairCount, failedPairCount: 1, missingUsagePairCount: 1 }),
        };
      }
      const evidence = buildProviderCostEvidence({
        baselineArtifact: {
          ...baselineArtifact,
          taskClass,
          setupIdentity: task.setupIdentity || 'live-openai-campaign',
          endpoint: 'chat.completions',
          serviceTier: args['service-tier'] || 'standard',
          qualityGate: qualityGateForArtifact({ baseGate: task.qualityGate, artifact: baselineArtifact, requireNoToolUse }),
        },
        fooksArtifact: {
          ...fooksArtifact,
          taskClass,
          setupIdentity: task.setupIdentity || 'live-openai-campaign',
          endpoint: 'chat.completions',
          serviceTier: args['service-tier'] || 'standard',
          qualityGate: qualityGateForArtifact({ baseGate: task.qualityGate, artifact: fooksArtifact, requireNoToolUse }),
        },
        pricing,
        sourceKind: 'live-openai-usage',
        runId: pairId,
      });
      const pairPath = path.join(outputDir, 'pairs', `${taskClass}-${i + 1}.json`);
      writeJson(pairPath, evidence);
      pairs.push({ pairId: evidence.runId, taskClass, evidence, evidencePath: pairPath, qualityGate: task.qualityGate });
      attemptedPairs[attemptedPairs.length - 1] = {
        pairId,
        taskClass,
        executionOrder,
        status: evidence.status,
        commandExecutionCount: {
          baseline: baselineArtifact.commandExecutionCount || 0,
          fooks: fooksArtifact.commandExecutionCount || 0,
        },
      };
      currentBatchEstimatedUsd += evidence.runs.baseline.estimatedApiCost.total || 0;
      currentBatchEstimatedUsd += evidence.runs.fooks.estimatedApiCost.total || 0;
      currentCampaignEstimatedUsd = currentBatchEstimatedUsd;
    }
  }
  return {
    pairs,
    auth,
    requestAttempted: attemptedPairs.length > 0,
    capState: { blocked: false, reasons: [] },
    ledger: createLiveLedger({ pairs, attemptedPairs, plannedPairCount }),
  };
}

async function main() {
  const args = parseRepeatedArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log([
      'Usage:',
      '  node benchmarks/layer2-frontend-task/run-provider-cost-repeated.js --pair-evidence=<json> --campaign-manifest=<json> --attempted-pair-ledger=<json> [options]',
      '  node benchmarks/layer2-frontend-task/run-provider-cost-repeated.js --import-manifest=<json> [options]',
      '  node benchmarks/layer2-frontend-task/run-provider-cost-repeated.js --pair=<baseline.json>:<fooks.json>:<task-class> [options]',
      '  node benchmarks/layer2-frontend-task/run-provider-cost-repeated.js --live-openai --task-manifest=<json> [capped live options]',
      '',
      'Options:',
      '  --output=<json> / --markdown-output=<md>',
      '  --run-id=<id>',
      '  --source-kind=validated-provider-import|fixture-mechanics|live-openai-usage',
      '  --auth-mode=auto|codex-oauth|api-key --codex-auth-json=<path> --codex-home=<dir>',
      '  --transport=codex-exec|direct-api (default: codex-exec for Codex OAuth, direct-api for API keys)',
      '  --codex-workdir=evidence|isolated --pair-order=baseline-first|fooks-first|abba --require-no-tool-use=true',
      '  Corrected manifests may use baselineContextPath/fooksContextPath + instruction to compare real full-source vs real fooks payloads.',
      '  --max-estimated-usd=5 --max-matched-pairs=10 --campaign-max-estimated-usd=5 --max-batches=1',
      '  Launch-grade live template: benchmarks/layer2-frontend-task/provider-cost-live-campaign-tasks.json (3 tasks × 5 pairs)',
      '  --dry-run-live',
    ].join('\n'));
    return;
  }

  const runId = args['run-id'] || timestampRunId('provider-cost-campaign');
  const defaultPaths = args.output ? null : evidencePaths({ tier: 'provider-cost', runId, jsonName: 'summary.json', markdownName: 'summary.md' });
  const outputPath = args.output || defaultPaths.json;
  const markdownPath = args['markdown-output'] || (defaultPaths ? defaultPaths.markdown : null);
  const outputDir = defaultPaths ? defaultPaths.dir : path.dirname(outputPath);
  const sourceKind = args['source-kind'] || (args['live-openai'] ? 'live-openai-usage' : 'validated-provider-import');
  const importBundle = args['import-manifest'] ? loadImportManifest(args['import-manifest']) : null;
  const taskManifestBundle = args['task-manifest'] ? readJsonWithBaseDir(args['task-manifest'], 'task-manifest') : null;
  const taskManifest = taskManifestBundle
    ? hydrateTaskManifest(taskManifestBundle.value, taskManifestBundle.baseDir)
    : null;
  const taskManifestTasks = normalizeTaskManifestTasks(taskManifest);
  const rawPairEvidencePaths = [
    ...(importBundle ? importBundle.pairEvidence : []),
    ...normalizePairEvidenceArgs(Array.isArray(args['pair-evidence']) ? args['pair-evidence'] : []),
  ];
  const rawPairSpecs = (Array.isArray(args.pair) ? args.pair : []).map(pairFromArg);
  const pairArtifacts = [];
  for (const spec of rawPairSpecs) {
    pairArtifacts.push(readJson(spec.baselinePath, 'pair baseline'));
    pairArtifacts.push(readJson(spec.fooksPath, 'pair fooks'));
  }
  const pricing = await pricingFromArgs(args, pairArtifacts);

  if (args['dry-run-live']) {
    const maxMatchedPairs = optionalNumber(args['max-matched-pairs'], 10);
    const maxEstimatedUsd = optionalNumber(args['max-estimated-usd'], 5);
    const campaignMaxEstimatedUsd = optionalNumber(args['campaign-max-estimated-usd'], maxEstimatedUsd);
    const worstCase = optionalNumber(args['worst-case-pair-estimated-usd'], maxEstimatedUsd / Math.max(maxMatchedPairs, 1));
    const gate = shouldStartNextPair({
      nextWorstCaseEstimatedUsd: worstCase,
      maxEstimatedUsd,
      campaignMaxEstimatedUsd,
      maxMatchedPairs,
    });
    console.log(JSON.stringify({
      dryRun: true,
      liveOpenAI: Boolean(args['live-openai']),
      requestMade: false,
      runId,
      authPlan: publicAuthSummary(resolveOpenAILiveAuth({ args })),
      transport: args.transport || args['live-transport'] || 'auto',
      capPlan: { maxEstimatedUsd, campaignMaxEstimatedUsd, maxMatchedPairs, worstCasePairEstimatedUsd: worstCase, firstPairGate: gate },
    }, null, 2));
    return;
  }

  let pairs = rawPairEvidencePaths;
  for (const spec of rawPairSpecs) {
    const baselineArtifact = readJson(spec.baselinePath, 'pair baseline');
    const fooksArtifact = readJson(spec.fooksPath, 'pair fooks');
    const evidence = buildProviderCostEvidence({
      baselineArtifact: { ...baselineArtifact, taskClass: spec.taskClass },
      fooksArtifact: { ...fooksArtifact, taskClass: spec.taskClass },
      pricing,
      sourceKind,
      runId: `${runId}-${spec.taskClass}-${pairs.length + 1}`,
    });
    const pairPath = path.join(outputDir, 'pairs', `${spec.taskClass}-${pairs.length + 1}.json`);
    writeJson(pairPath, evidence);
    pairs.push({ pairId: evidence.runId, taskClass: spec.taskClass, evidence, evidencePath: pairPath });
  }

  let capState = null;
  let liveBlocker = null;
  let liveLedger = null;
  let liveAuth = null;
  let liveRequestMade = false;
  let liveRequestAttempted = false;
  if (args['live-openai']) {
    const liveResult = await collectLivePairs({ args, runId, pricing, outputDir, taskManifest });
    pairs = pairs.concat(liveResult.pairs || []);
    capState = liveResult.capState || null;
    liveBlocker = liveResult.blocker || null;
    liveLedger = liveResult.ledger || null;
    liveAuth = liveResult.auth || null;
    liveRequestAttempted = Boolean(liveResult.requestAttempted);
    liveRequestMade = liveRequestAttempted;
  }

  const manifest = args['campaign-manifest']
    ? readJson(args['campaign-manifest'], 'campaign-manifest')
    : importBundle?.campaignManifest
      ? importBundle.campaignManifest
    : createDefaultManifest({
        runId,
        model: args.model || pricing.model,
        taskClasses: pairs.map((pair) => pair.taskClass || pair.evidence?.taskClass),
        tasks: taskManifestTasks,
        args,
        pricing,
      });
  const ledger = args['attempted-pair-ledger']
    ? readJson(args['attempted-pair-ledger'], 'attempted-pair-ledger')
    : importBundle?.attemptedPairLedger
      ? importBundle.attemptedPairLedger
    : liveLedger
      ? liveLedger
    : createLedgerFromPairs({ pairs, plannedPairCount: Math.max(pairs.length, liveLedger?.plannedPairCount || 0) });

  const ledgerPath = defaultPaths ? path.join(outputDir, 'campaign-ledger.json') : null;
  if (ledgerPath) writeJson(ledgerPath, ledger);

  let summary = summarizeProviderCostCampaign({
    runId,
    campaignManifest: manifest,
    attemptedPairLedger: ledger,
    pairEvidence: pairs,
    capState,
    requiredTaskClasses: optionalNumber(args['required-task-classes'], undefined),
    requiredAcceptedPairsPerTask: optionalNumber(args['required-accepted-pairs-per-task'], undefined),
  });
  if (liveBlocker) {
    const authMissing = !liveAuth || liveAuth.ok === false;
    summary = {
      ...summary,
      status: authMissing ? 'live-openai-credentials-missing' : 'live-openai-request-failed',
      statusReasons: [liveBlocker, ...summary.statusReasons],
      diagnostics: [
        authMissing
          ? 'Set OPENAI_API_KEY or use Codex OAuth via ~/.codex/auth.json; no live provider request was made.'
          : 'A live provider request was attempted but failed; inspect attempted-pair ledger before rerunning.',
        ...summary.diagnostics,
      ],
    };
  }
  if (liveAuth) {
    summary = {
      ...summary,
      liveAuth: publicAuthSummary(liveAuth),
    };
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  if (markdownPath) {
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(markdownPath, renderProviderCostCampaignMarkdown(summary));
  }

  console.log(JSON.stringify({
    output: relativePath(outputPath),
    markdownOutput: markdownPath ? relativePath(markdownPath) : null,
    ledgerOutput: ledgerPath ? relativePath(ledgerPath) : null,
    runId,
    status: summary.status,
    claimBoundary: summary.claimBoundary,
    requestMade: liveRequestMade,
    auth: liveAuth ? publicAuthSummary(liveAuth) : null,
  }, null, 2));
}

try {
  main().catch((error) => {
    console.error(`[provider-cost-repeated] ${error.message}`);
    process.exit(1);
  });
} catch (error) {
  console.error(`[provider-cost-repeated] ${error.message}`);
  process.exit(1);
}
