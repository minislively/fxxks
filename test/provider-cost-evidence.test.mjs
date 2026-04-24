import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const {
  buildProviderCostEvidence,
  normalizeUsageArtifact,
  renderProviderCostEvidenceMarkdown,
} = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "provider-cost-evidence.js"));
const {
  summarizeProviderCostCampaign,
  shouldStartNextPair,
} = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "provider-cost-repeated-summary.js"));
const {
  findPricingEntry,
  pricingAssumptionFromLiteLLMCatalog,
} = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "provider-pricing.js"));
const {
  DEFAULT_OPENAI_MODEL,
  resolveOpenAIModel,
} = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "model-resolution.js"));
const {
  resolveOpenAILiveAuth,
} = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "openai-live-auth.js"));
const {
  buildBillingImportReconciliation,
  renderBillingReconciliationMarkdown,
  writeBillingImportArtifacts,
} = require(path.join(repoRoot, "benchmarks", "layer2-frontend-task", "billing-import-evidence.js"));

const pricing = {
  provider: "openai",
  model: "test-model",
  currency: "USD",
  inputPer1MTokens: 2.5,
  outputPer1MTokens: 10,
  sourceUrl: "https://openai.com/api/pricing/",
  checkedDate: "2026-04-22",
};

function sampleEvidence(overrides = {}) {
  return buildProviderCostEvidence({
    baselineArtifact: {
      provider: "openai",
      model: "test-model",
      inputTokens: 100_000,
      outputTokens: 10_000,
      timestamp: "2026-04-22T00:00:00.000Z",
    },
    fooksArtifact: {
      provider: "openai",
      model: "test-model",
      inputTokens: 40_000,
      outputTokens: 8_000,
      timestamp: "2026-04-22T00:01:00.000Z",
    },
    pricing,
    sourceKind: "fixture",
    ...overrides,
  });
}

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

test("provider cost evidence computes usage-token and estimated API cost deltas", () => {
  const evidence = sampleEvidence();

  assert.equal(evidence.schemaVersion, "provider-cost-evidence.v1");
  assert.equal(evidence.evidenceTier, "L2-provider-usage-estimated-cost");
  assert.equal(evidence.claimBoundary, "estimated-api-cost-only");
  assert.equal(evidence.sourceKind, "fixture");
  assert.equal(evidence.status, "estimated-cost-reduction");
  assert.equal(evidence.deltas.inputTokens.absolute, 60_000);
  assert.equal(evidence.deltas.inputTokens.reductionPct, 60);
  assert.equal(evidence.deltas.outputTokens.absolute, 2_000);
  assert.equal(evidence.deltas.outputTokens.reductionPct, 20);
  assert.equal(evidence.deltas.totalTokens.absolute, 62_000);
  assert.equal(evidence.deltas.estimatedApiCostInput.absolute, 0.15);
  assert.equal(evidence.deltas.estimatedApiCostOutput.absolute, 0.02);
  assert.equal(evidence.deltas.estimatedApiCostTotal.absolute, 0.17);
  assert.equal(evidence.deltas.estimatedApiCostTotal.reductionPct, 48.571);
  assert.equal(evidence.pricingAssumption.sourceUrl, "https://openai.com/api/pricing/");
  assert.equal(evidence.pricingAssumption.checkedDate, "2026-04-22");
});



test("provider cost evidence uses artifact model and requires explicit pricing rates", () => {
  const evidence = buildProviderCostEvidence({
    baselineArtifact: { provider: "openai", model: "actual-model", inputTokens: 100_000, outputTokens: 10_000 },
    fooksArtifact: { provider: "openai", model: "actual-model", inputTokens: 40_000, outputTokens: 8_000 },
    pricing: {
      inputPer1MTokens: 1.23,
      outputPer1MTokens: 4.56,
      sourceUrl: "https://example.test/pricing",
      checkedDate: "2026-04-22",
    },
  });

  assert.equal(evidence.model, "actual-model");
  assert.equal(evidence.provider, "openai");
  assert.equal(evidence.status, "estimated-cost-reduction");
});

test("provider cost evidence is inconclusive without explicit pricing rates", () => {
  const evidence = buildProviderCostEvidence({
    baselineArtifact: { provider: "openai", model: "actual-model", inputTokens: 100_000, outputTokens: 10_000 },
    fooksArtifact: { provider: "openai", model: "actual-model", inputTokens: 40_000, outputTokens: 8_000 },
  });

  assert.equal(evidence.model, "actual-model");
  assert.equal(evidence.status, "inconclusive");
  assert.match(evidence.statusReasons.join("\n"), /pricing input rate is missing/);
  assert.match(evidence.statusReasons.join("\n"), /pricing output rate is missing/);
});

test("OpenAI model resolution prioritizes CLI, then OPENAI_MODEL, then the current default", () => {
  assert.equal(DEFAULT_OPENAI_MODEL, "gpt-5.4");
  assert.deepEqual(resolveOpenAIModel({ modelArg: "gpt-custom", env: { OPENAI_MODEL: "gpt-env" } }), {
    provider: "openai",
    model: "gpt-custom",
    modelSource: "cli --model",
    defaultModel: "gpt-5.4",
  });
  assert.equal(resolveOpenAIModel({ env: { OPENAI_MODEL: "gpt-env" } }).model, "gpt-env");
  assert.equal(resolveOpenAIModel({ env: {} }).model, "gpt-5.4");
});

test("OpenAI live auth resolution prefers env API key before Codex OAuth in auto mode", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-auth-"));
  try {
    const authJson = path.join(tempRoot, "auth.json");
    fs.writeFileSync(authJson, JSON.stringify({
      auth_mode: "chatgpt",
      tokens: { access_token: "oauth-token", account_id: "account-1" },
    }));
    const auth = resolveOpenAILiveAuth({
      args: { "codex-auth-json": authJson },
      env: { OPENAI_API_KEY: "sk-test", CODEX_HOME: tempRoot },
    });

    assert.equal(auth.ok, true);
    assert.equal(auth.credentialKind, "openai-api-key");
    assert.equal(auth.source, "env:OPENAI_API_KEY");
    assert.equal(auth.headers.Authorization, "Bearer sk-test");
    assert.equal(auth.headers["chatgpt-account-id"], undefined);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("OpenAI live auth resolution reads Codex OAuth auth.json with account header", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-codex-oauth-"));
  try {
    fs.writeFileSync(path.join(tempRoot, "auth.json"), JSON.stringify({
      auth_mode: "chatgpt",
      tokens: { access_token: "oauth-token", account_id: "account-1" },
    }));
    const auth = resolveOpenAILiveAuth({
      args: { "auth-mode": "codex-oauth" },
      env: { CODEX_HOME: tempRoot, OPENAI_API_KEY: "sk-ignored" },
    });

    assert.equal(auth.ok, true);
    assert.equal(auth.credentialKind, "codex-oauth");
    assert.equal(auth.source, "codex-auth-json");
    assert.equal(auth.accountId, "account-1");
    assert.equal(auth.authMode, "chatgpt");
    assert.equal(auth.headers.Authorization, "Bearer oauth-token");
    assert.equal(auth.headers["chatgpt-account-id"], "account-1");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("LiteLLM-shaped pricing catalog resolves current OpenAI model rates without hardcoded runner pricing", () => {
  const catalog = {
    "openai/gpt-5.4": {
      input_cost_per_token: 2.5e-6,
      output_cost_per_token: 15e-6,
      cache_read_input_token_cost: 0.25e-6,
    },
  };

  const entry = findPricingEntry(catalog, { provider: "openai", model: "gpt-5.4" });
  assert.equal(entry.modelKey, "openai/gpt-5.4");

  const resolved = pricingAssumptionFromLiteLLMCatalog({
    dataset: catalog,
    provider: "openai",
    model: "gpt-5.4",
    sourceUrl: "https://example.test/litellm-pricing.json",
    checkedDate: "2026-04-22",
  });

  assert.deepEqual(resolved.reasons, []);
  assert.equal(resolved.pricing.inputPer1MTokens, 2.5);
  assert.equal(resolved.pricing.outputPer1MTokens, 15);
  assert.equal(resolved.pricing.cachedInputPer1MTokens, 0.25);

  const evidence = buildProviderCostEvidence({
    baselineArtifact: { provider: "openai", model: "gpt-5.4", inputTokens: 100_000, outputTokens: 10_000 },
    fooksArtifact: { provider: "openai", model: "gpt-5.4", inputTokens: 40_000, outputTokens: 8_000 },
    pricing: resolved.pricing,
  });

  assert.equal(evidence.status, "estimated-cost-reduction");
  assert.equal(evidence.model, "gpt-5.4");
  assert.equal(evidence.pricingAssumption.catalogModelKey, "openai/gpt-5.4");
  assert.equal(evidence.deltas.estimatedApiCostTotal.absolute, 0.18);
});

test("provider cost evidence keeps input, output, and total cost separate", () => {
  const evidence = sampleEvidence({
    baselineArtifact: { provider: "openai", model: "test-model", inputTokens: 100_000, outputTokens: 1_000 },
    fooksArtifact: { provider: "openai", model: "test-model", inputTokens: 20_000, outputTokens: 50_000 },
  });

  assert.equal(evidence.status, "estimated-cost-regression");
  assert.equal(evidence.deltas.estimatedApiCostInput.absolute, 0.2);
  assert.equal(evidence.deltas.estimatedApiCostOutput.absolute, -0.49);
  assert.equal(evidence.deltas.estimatedApiCostTotal.absolute, -0.29);
  assert.equal(evidence.deltas.inputTokens.reductionPct, 80);
  assert.ok(evidence.deltas.estimatedApiCostTotal.reductionPct < 0);
});

test("provider cost evidence is inconclusive for zero or missing token data", () => {
  const zeroBaseline = sampleEvidence({
    baselineArtifact: { provider: "openai", model: "test-model", inputTokens: 0, outputTokens: 0 },
    fooksArtifact: { provider: "openai", model: "test-model", inputTokens: 0, outputTokens: 0 },
  });
  assert.equal(zeroBaseline.status, "inconclusive");
  assert.equal(zeroBaseline.deltas.estimatedApiCostTotal.reductionPct, null);
  assert.match(zeroBaseline.statusReasons.join("\n"), /baseline usage tokens are zero/);

  const missing = sampleEvidence({
    baselineArtifact: { provider: "openai", model: "test-model", inputTokens: 10_000 },
    fooksArtifact: { provider: "openai", model: "test-model", inputTokens: 5_000, outputTokens: 100 },
  });
  assert.equal(missing.status, "inconclusive");
  assert.match(missing.statusReasons.join("\n"), /baseline output tokens are missing/);
});

test("provider cost evidence normalizes direct OpenAI usage-shaped artifacts", () => {
  const normalized = normalizeUsageArtifact({
    usage: {
      prompt_tokens: 12_345,
      completion_tokens: 678,
      total_tokens: 13_023,
    },
    model: "test-model",
    provider: "openai",
  }, "baseline");

  assert.equal(normalized.status, "usage-available");
  assert.equal(normalized.inputTokens, 12_345);
  assert.equal(normalized.outputTokens, 678);
  assert.equal(normalized.totalTokens, 13_023);
  assert.equal(normalized.model, "test-model");
});

test("provider cost evidence exposes estimate-only claimability and avoids misleading cost field names", () => {
  const evidence = sampleEvidence();
  const keys = collectKeys(evidence);

  assert.equal(evidence.claimability.estimatedApiCostDelta, true);
  assert.equal(evidence.claimability.providerInvoiceOrBillingSavings, false);
  assert.equal(evidence.claimability.providerBillingTokenSavings, false);
  assert.equal(evidence.claimability.stableRuntimeTokenSavings, false);
  assert.equal(evidence.claimability.stableTimeOrLatencySavings, false);
  for (const forbidden of ["billingSavings", "invoiceSavings", "chargedCostSavings", "billingCost", "invoiceCost", "chargedCost"]) {
    assert.equal(keys.includes(forbidden), false, `${forbidden} should not appear as an evidence field name`);
  }
});



test("provider cost evidence treats live artifacts with missing usage as inconclusive", () => {
  const evidence = sampleEvidence({
    baselineArtifact: { provider: "openai", model: "test-model", inputTokens: 100_000, outputTokens: 10_000 },
    fooksArtifact: {
      provider: "openai",
      model: "test-model",
      usageSource: "live-openai-usage",
      status: "usage-unavailable",
      inputTokens: null,
      outputTokens: null,
    },
    sourceKind: "live-openai-usage",
  });

  assert.equal(evidence.status, "inconclusive");
  assert.match(evidence.statusReasons.join("\n"), /fooks input tokens are missing/);
  assert.match(evidence.statusReasons.join("\n"), /fooks output tokens are missing/);
  assert.equal(evidence.deltas.estimatedApiCostTotal.reductionPct, null);
});

test("provider cost evidence bounds sourceKind to the L2 schema enum", () => {
  const evidence = sampleEvidence({ sourceKind: "dashboard-export" });

  assert.equal(evidence.sourceKind, "invalid-source-kind");
  assert.equal(evidence.status, "inconclusive");
  assert.match(evidence.statusReasons.join("\n"), /sourceKind must be one of/);
});

test("provider cost evidence CLI writes JSON and Markdown without requiring credentials", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-cost-"));
  try {
    const baselinePath = path.join(tempRoot, "baseline.json");
    const fooksPath = path.join(tempRoot, "fooks.json");
    const outputPath = path.join(tempRoot, "evidence.json");
    const markdownPath = path.join(tempRoot, "evidence.md");
    fs.writeFileSync(baselinePath, JSON.stringify({ provider: "openai", model: "test-model", inputTokens: 100_000, outputTokens: 10_000 }));
    fs.writeFileSync(fooksPath, JSON.stringify({ provider: "openai", model: "test-model", inputTokens: 40_000, outputTokens: 8_000 }));

    execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-provider-cost-evidence.js"),
      `--baseline=${baselinePath}`,
      `--fooks=${fooksPath}`,
      `--output=${outputPath}`,
      `--markdown-output=${markdownPath}`,
      "--provider=openai",
      "--model=test-model",
      "--input-rate-per-1m=2.5",
      "--output-rate-per-1m=10",
      "--pricing-source-url=https://openai.com/api/pricing/",
      "--pricing-checked-date=2026-04-22",
    ], { cwd: repoRoot, env: { ...process.env, OPENAI_API_KEY: "" } });

    const evidence = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const markdown = fs.readFileSync(markdownPath, "utf8");
    assert.equal(evidence.status, "estimated-cost-reduction");
    assert.equal(evidence.claimBoundary, "estimated-api-cost-only");
    assert.match(markdown, /estimated API cost evidence only/i);
    assert.match(markdown, /not provider invoice\/billing savings/i);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("provider cost evidence CLI defaults generated evidence into project-local .fooks", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-default-"));
  try {
    const baselinePath = path.join(tempRoot, "baseline.json");
    const fooksPath = path.join(tempRoot, "fooks.json");
    const catalogPath = path.join(tempRoot, "pricing.json");
    fs.writeFileSync(baselinePath, JSON.stringify({ provider: "openai", model: "gpt-5.4", inputTokens: 100_000, outputTokens: 10_000 }));
    fs.writeFileSync(fooksPath, JSON.stringify({ provider: "openai", model: "gpt-5.4", inputTokens: 40_000, outputTokens: 8_000 }));
    fs.writeFileSync(catalogPath, JSON.stringify({
      "gpt-5.4": {
        input_cost_per_token: 2.5e-6,
        output_cost_per_token: 15e-6,
      },
    }));

    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-provider-cost-evidence.js"),
      `--baseline=${baselinePath}`,
      `--fooks=${fooksPath}`,
      `--pricing-catalog=${catalogPath}`,
      "--run-id=default-path-smoke",
      "--source-kind=fixture",
    ], { cwd: tempRoot, encoding: "utf8", env: { ...process.env, OPENAI_API_KEY: "" } });

    const summary = JSON.parse(stdout);
    const outputPath = path.join(tempRoot, ".fooks", "evidence", "provider-cost", "default-path-smoke", "evidence.json");
    const markdownPath = path.join(tempRoot, ".fooks", "evidence", "provider-cost", "default-path-smoke", "evidence.md");
    assert.equal(summary.output, ".fooks/evidence/provider-cost/default-path-smoke/evidence.json");
    assert.equal(summary.markdownOutput, ".fooks/evidence/provider-cost/default-path-smoke/evidence.md");
    assert.equal(fs.existsSync(outputPath), true);
    assert.equal(fs.existsSync(markdownPath), true);

    const evidence = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(evidence.status, "estimated-cost-reduction");
    assert.equal(evidence.claimability.providerInvoiceOrBillingSavings, false);
    assert.equal(evidence.claimability.providerBillingTokenSavings, false);
    assert.equal(evidence.claimability.stableRuntimeTokenSavings, false);
    assert.equal(evidence.claimability.stableTimeOrLatencySavings, false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("provider cost evidence explicit output does not create default .fooks evidence", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-explicit-"));
  try {
    const baselinePath = path.join(tempRoot, "baseline.json");
    const fooksPath = path.join(tempRoot, "fooks.json");
    const outputPath = path.join(tempRoot, "custom", "evidence.json");
    fs.writeFileSync(baselinePath, JSON.stringify({ provider: "openai", model: "test-model", inputTokens: 100_000, outputTokens: 10_000 }));
    fs.writeFileSync(fooksPath, JSON.stringify({ provider: "openai", model: "test-model", inputTokens: 40_000, outputTokens: 8_000 }));

    execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-provider-cost-evidence.js"),
      `--baseline=${baselinePath}`,
      `--fooks=${fooksPath}`,
      `--output=${outputPath}`,
      "--input-rate-per-1m=2.5",
      "--output-rate-per-1m=10",
      "--run-id=explicit-path-smoke",
    ], { cwd: tempRoot, env: { ...process.env, OPENAI_API_KEY: "" } });

    assert.equal(fs.existsSync(outputPath), true);
    assert.equal(fs.existsSync(path.join(tempRoot, ".fooks")), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("billing manual import artifacts stay local and do not unlock billing claims", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-billing-import-"));
  try {
    const result = writeBillingImportArtifacts({ cwd: tempRoot, runId: "billing-smoke" });
    assert.equal(result.schemaPath, path.join(tempRoot, ".fooks", "evidence", "billing-import", "billing-smoke", "import.schema.json"));
    assert.equal(result.readmePath, path.join(tempRoot, ".fooks", "evidence", "billing-import", "billing-smoke", "README.md"));
    assert.equal(result.claimability.providerInvoiceOrBillingSavings, false);

    const schema = JSON.parse(fs.readFileSync(result.schemaPath, "utf8"));
    assert.equal(schema.properties.claimability.properties.providerInvoiceOrBillingSavings.const, false);
    assert.deepEqual(schema.properties.source.properties.type.enum, ["invoice", "dashboard-export", "usage-export", "manual-entry"]);
    assert.match(fs.readFileSync(result.readmePath, "utf8"), /does not prove provider invoice or billing savings/i);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("billing import reconciliation links redacted billing data beside estimated evidence without unlocking billing claims", () => {
  const reconciliation = buildBillingImportReconciliation({
    runId: "billing-reconciliation-smoke",
    billingImportArtifact: {
      schemaVersion: "billing-import-evidence.v1",
      provider: "openai",
      account: { id: "acct-redacted", redacted: true },
      period: { start: "2026-04-22", end: "2026-04-23" },
      model: "test-model",
      currency: "USD",
      usage: { inputTokens: 140_000, outputTokens: 18_000 },
      billedAmount: 0.42,
      source: { type: "dashboard-export", timestamp: "2026-04-23T00:00:00.000Z", redacted: true },
      claimability: {
        providerInvoiceOrBillingSavings: false,
        providerBillingTokenSavings: false,
      },
    },
    estimatedEvidence: sampleEvidence(),
  });

  assert.equal(reconciliation.schemaVersion, "billing-import-reconciliation.v1");
  assert.equal(reconciliation.status, "reconciliation-ready");
  assert.equal(reconciliation.claimBoundary, "billing-import-reconciliation-only");
  assert.equal(reconciliation.claimability.providerInvoiceOrBillingSavings, false);
  assert.equal(reconciliation.claimability.providerBillingTokenSavings, false);
  assert.equal(reconciliation.claimability.estimatedApiCostDelta, true);
  assert.equal(reconciliation.billingImport.claimability.providerInvoiceOrBillingSavings, false);
  assert.equal(reconciliation.estimatedEvidence.claimBoundary, "estimated-api-cost-only");

  const checks = Object.fromEntries(reconciliation.checks.map((item) => [item.id, item.status]));
  assert.equal(checks["provider-match"], "pass");
  assert.equal(checks["model-match"], "pass");
  assert.equal(checks["billed-amount-present"], "pass");
  assert.equal(checks["billing-claimability-blocked"], "pass");

  const markdown = renderBillingReconciliationMarkdown(reconciliation);
  assert.match(markdown, /Billing import reconciliation evidence/i);
  assert.match(markdown, /not provider invoice\/billing savings proof/i);
  assert.match(markdown, /does not unlock provider billing-token savings claims/i);
});

test("billing import reconciliation reports provider/model mismatches as non-claimable blockers", () => {
  const reconciliation = buildBillingImportReconciliation({
    billingImportArtifact: {
      schemaVersion: "billing-import-evidence.v1",
      provider: "anthropic",
      period: { start: "2026-04-22", end: "2026-04-23" },
      model: "claude-test",
      currency: "USD",
      usage: { inputTokens: 10_000, outputTokens: 1_000 },
      billedAmount: 0.10,
      source: { type: "manual-entry", timestamp: "2026-04-23T00:00:00.000Z", redacted: true },
      claimability: {
        providerInvoiceOrBillingSavings: true,
        providerBillingTokenSavings: true,
      },
    },
    estimatedEvidence: sampleEvidence(),
  });

  assert.equal(reconciliation.status, "mismatch");
  assert.equal(reconciliation.claimability.providerInvoiceOrBillingSavings, false);
  assert.equal(reconciliation.claimability.providerBillingTokenSavings, false);
  assert.match(reconciliation.statusReasons.join("\n"), /anthropic vs openai/);
  assert.match(reconciliation.statusReasons.join("\n"), /claude-test vs test-model/);
  assert.match(reconciliation.warnings.join("\n"), /force-disabled/);
});

test("billing import reconciliation accepts provider-cost campaign summaries", () => {
  const reconciliation = buildBillingImportReconciliation({
    billingImportArtifact: {
      schemaVersion: "billing-import-evidence.v1",
      provider: "openai",
      account: { redacted: true },
      period: { start: "2026-04-22", end: "2026-04-23" },
      model: "gpt-5.4",
      currency: "USD",
      usage: { inputTokens: 376_104, outputTokens: 40_000 },
      billedAmount: 0.59,
      source: { type: "invoice", timestamp: "2026-04-23T00:00:00.000Z", redacted: true },
      claimability: {
        providerInvoiceOrBillingSavings: false,
        providerBillingTokenSavings: false,
      },
    },
    estimatedEvidence: {
      schemaVersion: "provider-cost-repeated-summary.v1",
      claimBoundary: "estimated-api-cost-only",
      runId: "campaign-summary-smoke",
      status: "launch-grade-estimated-cost-evidence",
      campaignManifest: {
        model: "gpt-5.4",
        pricingSourceUrl: "https://openai.com/api/pricing/",
        pricingCheckedDate: "2026-04-22",
      },
      medians: {
        estimatedApiCostDelta: 0.001362,
        estimatedApiCostReductionPct: 4.171,
      },
      pairs: [{
        sourceKind: "live-openai-usage",
        identity: { provider: "openai", model: "gpt-5.4" },
        pricingAssumption: { provider: "openai", model: "gpt-5.4", currency: "USD" },
      }],
      claimability: {
        estimatedApiCostPositiveEvidence: true,
        providerInvoiceOrBillingSavings: false,
        providerBillingTokenSavings: false,
      },
    },
  });

  assert.equal(reconciliation.status, "reconciliation-ready");
  assert.equal(reconciliation.estimatedEvidence.evidenceKind, "campaign-summary");
  assert.equal(reconciliation.estimatedEvidence.deltas.aggregation, "median");
  assert.equal(reconciliation.claimability.providerInvoiceOrBillingSavings, false);
});

test("billing import CLI writes reconciliation JSON and Markdown under project-local .fooks", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-billing-reconcile-"));
  try {
    const importPath = path.join(tempRoot, "billing-import.json");
    const evidencePath = path.join(tempRoot, "estimated-evidence.json");
    fs.writeFileSync(importPath, JSON.stringify({
      schemaVersion: "billing-import-evidence.v1",
      provider: "openai",
      account: { redacted: true },
      period: { start: "2026-04-22", end: "2026-04-23" },
      model: "test-model",
      currency: "USD",
      usage: { inputTokens: 140_000, outputTokens: 18_000 },
      billedAmount: 0.42,
      source: { type: "usage-export", timestamp: "2026-04-23T00:00:00.000Z", redacted: true },
      claimability: {
        providerInvoiceOrBillingSavings: false,
        providerBillingTokenSavings: false,
      },
    }));
    fs.writeFileSync(evidencePath, JSON.stringify(sampleEvidence()));

    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "billing-import-evidence.js"),
      `--import=${importPath}`,
      `--estimated-evidence=${evidencePath}`,
      "--run-id=billing-reconcile-smoke",
    ], { cwd: tempRoot, encoding: "utf8" });

    const summary = JSON.parse(stdout);
    assert.equal(summary.reconciliationStatus, "reconciliation-ready");
    assert.equal(summary.reconciliationPath, ".fooks/evidence/billing-import/billing-reconcile-smoke/reconciliation.json");
    assert.equal(summary.reconciliationMarkdownPath, ".fooks/evidence/billing-import/billing-reconcile-smoke/reconciliation.md");

    const reconciliationPath = path.join(tempRoot, summary.reconciliationPath);
    const markdownPath = path.join(tempRoot, summary.reconciliationMarkdownPath);
    const reconciliation = JSON.parse(fs.readFileSync(reconciliationPath, "utf8"));
    assert.equal(reconciliation.claimability.providerInvoiceOrBillingSavings, false);
    assert.equal(reconciliation.status, "reconciliation-ready");
    assert.match(fs.readFileSync(markdownPath, "utf8"), /not provider invoice\/billing savings proof/i);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("billing import example fixture reconciles against matching estimated evidence", () => {
  const fixturePath = path.join(
    repoRoot,
    "benchmarks",
    "layer2-frontend-task",
    "fixtures",
    "billing-import",
    "redacted-openai-dashboard-export.example.json",
  );
  const billingImportArtifact = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const estimatedEvidence = buildProviderCostEvidence({
    baselineArtifact: { provider: "openai", model: "gpt-5.4", inputTokens: 100_000, outputTokens: 10_000 },
    fooksArtifact: { provider: "openai", model: "gpt-5.4", inputTokens: 40_000, outputTokens: 8_000 },
    pricing: {
      ...pricing,
      model: "gpt-5.4",
    },
  });

  const reconciliation = buildBillingImportReconciliation({ billingImportArtifact, estimatedEvidence });
  assert.equal(reconciliation.status, "reconciliation-ready");
  assert.equal(reconciliation.billingImport.source.redacted, true);
  assert.equal(reconciliation.claimability.providerInvoiceOrBillingSavings, false);
  assert.equal(reconciliation.claimability.providerBillingTokenSavings, false);
});

test("provider cost evidence CLI can read a LiteLLM-shaped pricing catalog", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-catalog-"));
  try {
    const baselinePath = path.join(tempRoot, "baseline.json");
    const fooksPath = path.join(tempRoot, "fooks.json");
    const catalogPath = path.join(tempRoot, "pricing.json");
    const outputPath = path.join(tempRoot, "evidence.json");
    fs.writeFileSync(baselinePath, JSON.stringify({ provider: "openai", model: "gpt-5.4", inputTokens: 100_000, outputTokens: 10_000 }));
    fs.writeFileSync(fooksPath, JSON.stringify({ provider: "openai", model: "gpt-5.4", inputTokens: 40_000, outputTokens: 8_000 }));
    fs.writeFileSync(catalogPath, JSON.stringify({
      "openai/gpt-5.4": {
        input_cost_per_token: 2.5e-6,
        output_cost_per_token: 15e-6,
      },
    }));

    execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-provider-cost-evidence.js"),
      `--baseline=${baselinePath}`,
      `--fooks=${fooksPath}`,
      `--output=${outputPath}`,
      `--pricing-catalog=${catalogPath}`,
      "--pricing-checked-date=2026-04-22",
    ], { cwd: repoRoot, env: { ...process.env, OPENAI_API_KEY: "" } });

    const evidence = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(evidence.status, "estimated-cost-reduction");
    assert.equal(evidence.provider, "openai");
    assert.equal(evidence.model, "gpt-5.4");
    assert.equal(evidence.pricingAssumption.catalogModelKey, "openai/gpt-5.4");
    assert.equal(evidence.pricingAssumption.pricingSourceKind, "litellm-pricing-catalog");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});



test("provider cost evidence rejects placeholder artifacts as inconclusive", () => {
  const placeholder = {
    provider: "openai",
    model: "test-model",
    status: "implementation-in-progress",
    inputTokens: 1_000,
    outputTokens: 0,
  };
  const evidence = sampleEvidence({ baselineArtifact: placeholder, fooksArtifact: placeholder });

  assert.equal(evidence.status, "inconclusive");
  assert.match(evidence.statusReasons.join("\n"), /implementation-in-progress/);
});

test("provider cost evidence requires live provider usage provenance for live sourceKind", () => {
  const evidence = sampleEvidence({
    baselineArtifact: { provider: "openai", model: "test-model", status: "success", inputTokens: 100_000, outputTokens: 10_000 },
    fooksArtifact: { provider: "openai", model: "test-model", status: "success", inputTokens: 40_000, outputTokens: 8_000 },
    sourceKind: "live-openai-usage",
  });

  assert.equal(evidence.status, "inconclusive");
  assert.match(evidence.statusReasons.join("\n"), /lacks live provider usage provenance/);
});

test("provider cost evidence ignores local prompt approximations for live sourceKind", () => {
  const evidence = sampleEvidence({
    baselineArtifact: {
      provider: "openai",
      model: "test-model",
      status: "success",
      metrics: { promptTokensApprox: 100_000, outputTokens: 10_000 },
    },
    fooksArtifact: {
      provider: "openai",
      model: "test-model",
      status: "success",
      metrics: { promptTokensApprox: 40_000, outputTokens: 8_000 },
    },
    sourceKind: "live-openai-usage",
  });

  assert.equal(evidence.status, "inconclusive");
  assert.match(evidence.statusReasons.join("\n"), /input tokens are missing/);
});

test("provider cost evidence accepts successful live usage artifacts", () => {
  const evidence = sampleEvidence({
    baselineArtifact: {
      provider: "openai",
      model: "test-model",
      status: "success",
      usageSource: "live-openai-usage",
      inputTokens: 100_000,
      outputTokens: 10_000,
    },
    fooksArtifact: {
      provider: "openai",
      model: "test-model",
      status: "success",
      usageSource: "live-openai-usage",
      inputTokens: 40_000,
      outputTokens: 8_000,
    },
    sourceKind: "live-openai-usage",
  });

  assert.equal(evidence.status, "estimated-cost-reduction");
  assert.equal(evidence.sourceKind, "live-openai-usage");
});

test("provider cost evidence markdown surfaces split input and output deltas without overclaiming", () => {
  const markdown = renderProviderCostEvidenceMarkdown(sampleEvidence());

  assert.match(markdown, /Input tokens reduction: 60% \(60000 tokens\)/i);
  assert.match(markdown, /Output tokens reduction: 20% \(2000 tokens\)/i);
  assert.match(markdown, /Total tokens reduction: 56\.364% \(62000 tokens\)/i);
  assert.match(markdown, /Estimated input API cost reduction: 60% \(0\.15 USD\)/i);
  assert.match(markdown, /Estimated output API cost reduction: 20% \(0\.02 USD\)/i);
  assert.match(markdown, /Estimated total API cost reduction: 48\.571% \(0\.17 USD\)/i);
  assert.match(markdown, /not provider invoice\/billing savings evidence/i);
  assert.match(markdown, /not stable runtime-token, wall-clock, or latency savings evidence/i);
  assert.doesNotMatch(markdown, /reduces provider billing cost/i);
  assert.doesNotMatch(markdown, /invoice savings proven/i);
});

function campaignPricing(overrides = {}) {
  return {
    provider: "openai",
    model: "gpt-5.4",
    currency: "USD",
    inputPer1MTokens: 2.5,
    outputPer1MTokens: 15,
    cachedInputPer1MTokens: 0.25,
    sourceUrl: "https://openai.com/api/pricing/",
    checkedDate: "2026-04-22",
    endpoint: "chat.completions",
    serviceTier: "standard",
    pricingTreatment: {
      longContextApplies: false,
      regionalProcessingApplies: false,
    },
    ...overrides,
  };
}

function taskManifest(taskClasses = ["extract", "refactor", "summarize"]) {
  return {
    campaignId: "campaign-positive",
    model: "gpt-5.4",
    endpoint: "chat.completions",
    serviceTier: "standard",
    pricingSourceUrl: "https://openai.com/api/pricing/",
    pricingCheckedDate: "2026-04-22",
    taskClasses: taskClasses.map((id) => ({
      id,
      targetPairCount: 5,
      qualityGate: { id: "applied-validation", version: "v1", command: "node validate.js" },
    })),
    caps: { maxEstimatedUsd: 5, campaignMaxEstimatedUsd: 15, maxMatchedPairs: 20, maxBatches: 3 },
  };
}

function providerPair({ taskClass, index = 1, sourceKind = "validated-provider-import", baselineInput = 100_000, fooksInput = 50_000, baselineOutput = 10_000, fooksOutput = 8_000, pricing: pricingOverride = campaignPricing(), qualityGate = { id: "applied-validation", status: "passed" } } = {}) {
  const evidence = buildProviderCostEvidence({
    baselineArtifact: {
      provider: "openai",
      model: "gpt-5.4",
      usageSource: sourceKind,
      usage: { prompt_tokens: baselineInput, completion_tokens: baselineOutput, total_tokens: baselineInput + baselineOutput },
      taskClass,
      setupIdentity: "same-setup",
      endpoint: "chat.completions",
      serviceTier: "standard",
      qualityGate,
    },
    fooksArtifact: {
      provider: "openai",
      model: "gpt-5.4",
      usageSource: sourceKind,
      usage: { prompt_tokens: fooksInput, completion_tokens: fooksOutput, total_tokens: fooksInput + fooksOutput },
      taskClass,
      setupIdentity: "same-setup",
      endpoint: "chat.completions",
      serviceTier: "standard",
      qualityGate,
    },
    pricing: pricingOverride,
    sourceKind,
    runId: `${taskClass}-${index}`,
  });
  return { pairId: `${taskClass}-${index}`, taskClass, evidence, qualityGate };
}

function positiveCampaignPairs(sourceKind = "validated-provider-import") {
  return ["extract", "refactor", "summarize"].flatMap((taskClass) => (
    Array.from({ length: 5 }, (_, index) => providerPair({ taskClass, index: index + 1, sourceKind }))
  ));
}

function ledgerForPairs(pairs, overrides = {}) {
  return {
    plannedPairCount: pairs.length,
    attemptedPairCount: pairs.length,
    acceptedPairCount: pairs.length,
    failedPairCount: 0,
    rejectedPairCount: 0,
    missingUsagePairCount: 0,
    neutralPairCount: 0,
    regressedPairCount: pairs.filter((pair) => pair.evidence.deltas.estimatedApiCostTotal.absolute < 0).length,
    omittedPairs: [],
    attemptedPairs: pairs.map((pair) => ({ pairId: pair.pairId, taskClass: pair.taskClass, status: pair.evidence.status })),
    ...overrides,
  };
}

test("provider cost repeated summary reaches launch-grade from validated provider import campaign", () => {
  const pairs = positiveCampaignPairs("validated-provider-import");
  const summary = summarizeProviderCostCampaign({
    runId: "positive-import",
    campaignManifest: taskManifest(),
    attemptedPairLedger: ledgerForPairs(pairs),
    pairEvidence: pairs,
  });

  assert.equal(summary.status, "launch-grade-estimated-cost-evidence");
  assert.equal(summary.claimability.estimatedApiCostPositiveEvidence, true);
  assert.equal(summary.claimability.providerInvoiceOrBillingSavings, false);
  assert.equal(summary.claimability.providerBillingTokenSavings, false);
  assert.equal(summary.claimability.stableRuntimeTokenSavings, false);
  assert.equal(summary.claimability.stableTimeOrLatencySavings, false);
  assert.equal(summary.counts.acceptedPairCount, 15);
  assert.equal(summary.taskSummaries.length, 3);
  assert.ok(summary.medians.estimatedApiCostDelta > 0);
});

test("provider cost repeated summary classifies one positive task as narrow candidate", () => {
  const pairs = Array.from({ length: 5 }, (_, index) => providerPair({ taskClass: "extract", index: index + 1 }));
  const summary = summarizeProviderCostCampaign({
    runId: "narrow",
    campaignManifest: taskManifest(["extract"]),
    attemptedPairLedger: ledgerForPairs(pairs),
    pairEvidence: pairs,
  });

  assert.equal(summary.status, "narrow-estimated-cost-candidate");
  assert.equal(summary.claimability.estimatedApiCostPositiveEvidence, false);
  assert.match(summary.statusReasons.join("\n"), /accepted task classes 1\/3/);
});

test("provider cost repeated summary keeps fixture mechanics out of public launch-grade claimability", () => {
  const pairs = positiveCampaignPairs("fixture-mechanics");
  const summary = summarizeProviderCostCampaign({
    runId: "fixture-mechanics",
    campaignManifest: taskManifest(),
    attemptedPairLedger: ledgerForPairs(pairs),
    pairEvidence: pairs,
  });

  assert.equal(summary.status, "fixture-launch-grade-mechanics");
  assert.equal(summary.claimability.estimatedApiCostPositiveEvidence, false);
  assert.equal(summary.claimability.providerInvoiceOrBillingSavings, false);
});

test("provider cost repeated summary rejects mixed identity", () => {
  const pairs = positiveCampaignPairs("validated-provider-import");
  pairs[0] = providerPair({ taskClass: "extract", index: 99, sourceKind: "validated-provider-import", pricing: campaignPricing({ model: "gpt-5.4-mini" }) });
  pairs[0].evidence.model = "gpt-5.4-mini";

  const summary = summarizeProviderCostCampaign({
    runId: "mixed",
    campaignManifest: taskManifest(),
    attemptedPairLedger: ledgerForPairs(pairs),
    pairEvidence: pairs,
  });

  assert.equal(summary.status, "mixed-identity");
  assert.match(summary.statusReasons.join("\n"), /mixed identity/);
});

test("provider cost repeated summary blocks cherry-picked imports without a ledger", () => {
  const pairs = positiveCampaignPairs("validated-provider-import");
  const summary = summarizeProviderCostCampaign({
    runId: "missing-ledger",
    campaignManifest: taskManifest(),
    pairEvidence: pairs,
  });

  assert.equal(summary.status, "narrow-estimated-cost-candidate");
  assert.equal(summary.claimability.estimatedApiCostPositiveEvidence, false);
  assert.match(summary.statusReasons.join("\n"), /ledger is missing/);
});

test("provider cost repeated summary preserves regression and diagnostic visibility", () => {
  const pairs = Array.from({ length: 5 }, (_, index) => providerPair({
    taskClass: "extract",
    index: index + 1,
    baselineInput: 50_000,
    fooksInput: 90_000,
    baselineOutput: 8_000,
    fooksOutput: 12_000,
  }));
  const summary = summarizeProviderCostCampaign({
    runId: "regression",
    campaignManifest: taskManifest(["extract"]),
    attemptedPairLedger: ledgerForPairs(pairs, { regressedPairCount: 5 }),
    pairEvidence: pairs,
  });

  assert.notEqual(summary.status, "launch-grade-estimated-cost-evidence");
  assert.equal(summary.counts.regressedPairCount, 5);
  assert.match(summary.diagnostics.join("\n"), /negative|neutral|median/i);
});

test("provider cost repeated cap enforcement stops before exceeding pair or spend caps", () => {
  const spendGate = shouldStartNextPair({
    currentBatchEstimatedUsd: 4.75,
    currentCampaignEstimatedUsd: 4.75,
    nextWorstCaseEstimatedUsd: 0.5,
    maxEstimatedUsd: 5,
    campaignMaxEstimatedUsd: 5,
    attemptedMatchedPairs: 4,
    maxMatchedPairs: 10,
  });
  assert.equal(spendGate.allowed, false);
  assert.match(spendGate.reasons.join("\n"), /batch estimated spend cap/);

  const pairGate = shouldStartNextPair({ attemptedMatchedPairs: 10, maxMatchedPairs: 10, nextWorstCaseEstimatedUsd: 0.01 });
  assert.equal(pairGate.allowed, false);
  assert.match(pairGate.reasons.join("\n"), /matched pair cap/);
});

test("provider cost evidence prices cached input tokens with cached input rate", () => {
  const evidence = buildProviderCostEvidence({
    baselineArtifact: {
      provider: "openai",
      model: "gpt-5.4",
      usageSource: "validated-provider-import",
      usage: {
        prompt_tokens: 100_000,
        completion_tokens: 10_000,
        total_tokens: 110_000,
        input_tokens_details: { cached_tokens: 40_000 },
      },
    },
    fooksArtifact: {
      provider: "openai",
      model: "gpt-5.4",
      usageSource: "validated-provider-import",
      usage: {
        prompt_tokens: 50_000,
        completion_tokens: 8_000,
        total_tokens: 58_000,
        input_tokens_details: { cached_tokens: 10_000 },
      },
    },
    pricing: campaignPricing(),
    sourceKind: "validated-provider-import",
  });

  assert.equal(evidence.status, "estimated-cost-reduction");
  assert.equal(evidence.runs.baseline.cachedInputTokens, 40_000);
  assert.equal(evidence.runs.baseline.estimatedApiCost.inputStandard, 0.15);
  assert.equal(evidence.runs.baseline.estimatedApiCost.inputCached, 0.01);
  assert.equal(evidence.runs.baseline.estimatedApiCost.input, 0.16);
});

test("provider cost repeated summary blocks launch-grade when cached pricing treatment is unknown", () => {
  const pairs = positiveCampaignPairs("validated-provider-import");
  pairs[0] = providerPair({
    taskClass: "extract",
    index: 1,
    sourceKind: "validated-provider-import",
    pricing: campaignPricing({ cachedInputPer1MTokens: undefined }),
  });
  pairs[0].evidence.runs.baseline.cachedInputTokens = 10_000;
  pairs[0].evidence.pricingAssumption.cachedInputPer1MTokens = null;

  const summary = summarizeProviderCostCampaign({
    runId: "cached-unknown",
    campaignManifest: taskManifest(),
    attemptedPairLedger: ledgerForPairs(pairs),
    pairEvidence: pairs,
  });

  assert.notEqual(summary.status, "launch-grade-estimated-cost-evidence");
  assert.match(summary.statusReasons.join("\n"), /cached input rate missing/);
});

test("provider cost repeated CLI writes import-only summary and ledger into project-local .fooks", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-repeated-"));
  try {
    const pairPath = path.join(tempRoot, "pair.json");
    const pair = providerPair({ taskClass: "extract", sourceKind: "validated-provider-import" });
    fs.writeFileSync(pairPath, JSON.stringify(pair.evidence));

    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-provider-cost-repeated.js"),
      `--pair-evidence=${pairPath}`,
      "--run-id=repeated-smoke",
      "--required-task-classes=1",
      "--required-accepted-pairs-per-task=1",
      "--quality-gate-id=applied-validation",
    ], { cwd: tempRoot, encoding: "utf8", env: { ...process.env, OPENAI_API_KEY: "" } });

    const result = JSON.parse(stdout);
    const summaryPath = path.join(tempRoot, ".fooks", "evidence", "provider-cost", "repeated-smoke", "summary.json");
    const markdownPath = path.join(tempRoot, ".fooks", "evidence", "provider-cost", "repeated-smoke", "summary.md");
    const ledgerPath = path.join(tempRoot, ".fooks", "evidence", "provider-cost", "repeated-smoke", "campaign-ledger.json");
    assert.equal(result.output, ".fooks/evidence/provider-cost/repeated-smoke/summary.json");
    assert.equal(fs.existsSync(summaryPath), true);
    assert.equal(fs.existsSync(markdownPath), true);
    assert.equal(fs.existsSync(ledgerPath), true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("provider cost repeated CLI explicit output avoids default .fooks", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-repeated-explicit-"));
  try {
    const pairPath = path.join(tempRoot, "pair.json");
    const outputPath = path.join(tempRoot, "custom", "summary.json");
    const pair = providerPair({ taskClass: "extract", sourceKind: "validated-provider-import" });
    fs.writeFileSync(pairPath, JSON.stringify(pair.evidence));

    execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-provider-cost-repeated.js"),
      `--pair-evidence=${pairPath}`,
      `--output=${outputPath}`,
      "--required-task-classes=1",
      "--required-accepted-pairs-per-task=1",
    ], { cwd: tempRoot, env: { ...process.env, OPENAI_API_KEY: "" } });

    assert.equal(fs.existsSync(outputPath), true);
    assert.equal(fs.existsSync(path.join(tempRoot, ".fooks")), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("provider cost repeated CLI dry-run live mode does not require credentials or write requests", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-repeated-dry-"));
  try {
    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-provider-cost-repeated.js"),
      "--live-openai",
      "--dry-run-live",
      "--auth-mode=api-key",
      "--run-id=dry-live",
      "--max-estimated-usd=5",
      "--max-matched-pairs=10",
    ], { cwd: tempRoot, encoding: "utf8", env: { ...process.env, OPENAI_API_KEY: "" } });
    const result = JSON.parse(stdout);
    assert.equal(result.dryRun, true);
    assert.equal(result.requestMade, false);
    assert.equal(result.capPlan.maxEstimatedUsd, 5);
    assert.equal(fs.existsSync(path.join(tempRoot, ".fooks")), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("provider cost repeated CLI dry-run reports Codex OAuth auth plan without making requests", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-repeated-oauth-dry-"));
  try {
    fs.writeFileSync(path.join(tempRoot, "auth.json"), JSON.stringify({
      auth_mode: "chatgpt",
      tokens: { access_token: "oauth-token", account_id: "account-1" },
    }));
    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-provider-cost-repeated.js"),
      "--live-openai",
      "--dry-run-live",
      "--auth-mode=codex-oauth",
      "--run-id=dry-live-oauth",
    ], { cwd: tempRoot, encoding: "utf8", env: { ...process.env, CODEX_HOME: tempRoot, OPENAI_API_KEY: "" } });
    const result = JSON.parse(stdout);
    assert.equal(result.dryRun, true);
    assert.equal(result.requestMade, false);
    assert.equal(result.authPlan.ok, true);
    assert.equal(result.authPlan.credentialKind, "codex-oauth");
    assert.equal(result.authPlan.hasAccountId, true);
    assert.deepEqual(result.authPlan.headerNames.sort(), ["Authorization", "chatgpt-account-id"].sort());
    assert.equal(fs.existsSync(path.join(tempRoot, ".fooks")), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("provider cost repeated CLI can collect Codex OAuth exec usage through codex transport", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-repeated-codex-"));
  try {
    const binDir = path.join(tempRoot, "bin");
    fs.mkdirSync(binDir, { recursive: true });
    const fakeCodex = path.join(binDir, "codex");
    fs.writeFileSync(fakeCodex, `#!/usr/bin/env node
const argv = process.argv.join(" ");
const isFooks = argv.includes("compact prepared context");
const usage = isFooks
  ? { input_tokens: 500, cached_input_tokens: 100, output_tokens: 40 }
  : { input_tokens: 1000, cached_input_tokens: 100, output_tokens: 50 };
console.log(JSON.stringify({ type: "thread.started", thread_id: "test-thread" }));
console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "OK" } }));
console.log(JSON.stringify({ type: "turn.completed", usage }));
`);
    fs.chmodSync(fakeCodex, 0o755);
    fs.writeFileSync(path.join(tempRoot, "auth.json"), JSON.stringify({
      auth_mode: "chatgpt",
      tokens: { access_token: "oauth-token", account_id: "account-1" },
    }));
    const taskManifestPath = path.join(tempRoot, "tasks.json");
    fs.writeFileSync(taskManifestPath, JSON.stringify({
      tasks: [{
        id: "component",
        targetPairCount: 1,
        qualityGate: { id: "applied-validation", status: "passed", command: "fake" },
        baselinePrompt: "baseline full context",
        fooksPrompt: "compact prepared context",
      }],
    }));

    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-provider-cost-repeated.js"),
      "--live-openai",
      "--auth-mode=codex-oauth",
      "--transport=codex-exec",
      `--task-manifest=${taskManifestPath}`,
      "--run-id=codex-transport",
      "--model=gpt-5.4",
      "--input-rate-per-1m=1",
      "--output-rate-per-1m=1",
      "--cached-input-rate-per-1m=0.1",
      "--required-task-classes=1",
      "--required-accepted-pairs-per-task=1",
    ], {
      cwd: tempRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
        CODEX_HOME: tempRoot,
        OPENAI_API_KEY: "",
      },
    });

    const result = JSON.parse(stdout);
    const summaryPath = path.join(tempRoot, ".fooks", "evidence", "provider-cost", "codex-transport", "summary.json");
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    assert.equal(result.requestMade, true);
    assert.equal(result.auth.credentialKind, "codex-oauth");
    assert.equal(summary.status, "launch-grade-estimated-cost-evidence");
    assert.equal(summary.counts.acceptedPairCount, 1);
    assert.equal(summary.pairs[0].evidencePath.includes("pairs/component-1.json"), true);
    assert.ok(summary.medians.estimatedApiCostDelta > 0);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("provider cost repeated CLI hydrates corrected payload manifests with ABBA order and isolated Codex workdirs", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-corrected-abba-"));
  try {
    const binDir = path.join(tempRoot, "bin");
    fs.mkdirSync(binDir, { recursive: true });
    const fakeCodex = path.join(binDir, "codex");
    fs.writeFileSync(fakeCodex, `#!/usr/bin/env node
const fs = require("fs");
const argv = process.argv;
const prompt = argv[argv.length - 1] || "";
const isFooks = prompt.includes("PAYLOAD_KIND: fooks-model-facing-payload");
fs.appendFileSync(process.env.FAKE_CODEX_LOG, JSON.stringify({ cwd: process.cwd(), isFooks }) + "\\n");
const usage = isFooks
  ? { input_tokens: 400, cached_input_tokens: 0, output_tokens: 25 }
  : { input_tokens: 900, cached_input_tokens: 0, output_tokens: 30 };
console.log(JSON.stringify({ type: "thread.started", thread_id: "test-thread" }));
console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "OK" } }));
console.log(JSON.stringify({ type: "turn.completed", usage }));
`);
    fs.chmodSync(fakeCodex, 0o755);
    fs.writeFileSync(path.join(tempRoot, "auth.json"), JSON.stringify({
      auth_mode: "chatgpt",
      tokens: { access_token: "oauth-token", account_id: "account-1" },
    }));
    const baselineContextPath = path.join(tempRoot, "baseline.txt");
    const fooksContextPath = path.join(tempRoot, "fooks.json");
    fs.writeFileSync(baselineContextPath, "export function Example() { return <button>Full source</button>; }");
    fs.writeFileSync(fooksContextPath, JSON.stringify({ mode: "compressed", componentName: "Example" }));
    const taskManifestPath = path.join(tempRoot, "corrected-tasks.json");
    fs.writeFileSync(taskManifestPath, JSON.stringify({
      tasks: [{
        id: "corrected-component",
        targetPairCount: 2,
        targetFile: "src/Example.tsx",
        instruction: "Summarize the supplied component.",
        baselineContextPath: "baseline.txt",
        fooksContextPath: "fooks.json",
        pairOrder: "abba",
        setupIdentity: "corrected-real-payload-no-tool",
        qualityGate: { id: "corrected-payload-validation", status: "passed", command: "fake" },
      }],
    }));
    const logPath = path.join(tempRoot, "codex-log.jsonl");
    const isolatedRoot = path.join(tempRoot, "isolated");
    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-provider-cost-repeated.js"),
      "--live-openai",
      "--auth-mode=codex-oauth",
      "--transport=codex-exec",
      "--codex-workdir=isolated",
      `--codex-workdir-root=${isolatedRoot}`,
      "--require-no-tool-use=true",
      `--task-manifest=${taskManifestPath}`,
      "--run-id=corrected-abba",
      "--model=gpt-5.4",
      "--input-rate-per-1m=1",
      "--output-rate-per-1m=1",
      "--cached-input-rate-per-1m=0.1",
      "--required-task-classes=1",
      "--required-accepted-pairs-per-task=2",
    ], {
      cwd: tempRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
        CODEX_HOME: tempRoot,
        OPENAI_API_KEY: "",
        FAKE_CODEX_LOG: logPath,
      },
    });

    const result = JSON.parse(stdout);
    const summaryPath = path.join(tempRoot, ".fooks", "evidence", "provider-cost", "corrected-abba", "summary.json");
    const ledgerPath = path.join(tempRoot, ".fooks", "evidence", "provider-cost", "corrected-abba", "campaign-ledger.json");
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    const fakeRuns = fs.readFileSync(logPath, "utf8").trim().split(/\n/).map((line) => JSON.parse(line));

    assert.equal(result.requestMade, true);
    assert.equal(summary.status, "launch-grade-estimated-cost-evidence");
    assert.equal(summary.counts.acceptedPairCount, 2);
    assert.deepEqual(ledger.attemptedPairs[0].executionOrder, ["baseline", "fooks"]);
    assert.deepEqual(ledger.attemptedPairs[1].executionOrder, ["fooks", "baseline"]);
    const realIsolatedRoot = fs.realpathSync(isolatedRoot);
    assert.equal(fakeRuns.every((run) => fs.realpathSync(run.cwd).startsWith(realIsolatedRoot)), true);
    assert.equal(summary.campaignManifest.taskClasses[0].qualityGate.id, "corrected-payload-validation");
    assert.ok(summary.medians.estimatedApiCostDelta > 0);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("provider cost repeated CLI can fail corrected no-tool quality gate on Codex command events", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-corrected-tools-"));
  try {
    const binDir = path.join(tempRoot, "bin");
    fs.mkdirSync(binDir, { recursive: true });
    const fakeCodex = path.join(binDir, "codex");
    fs.writeFileSync(fakeCodex, `#!/usr/bin/env node
const usage = { input_tokens: 400, cached_input_tokens: 0, output_tokens: 25 };
console.log(JSON.stringify({ type: "thread.started", thread_id: "test-thread" }));
console.log(JSON.stringify({ type: "item.completed", item: { type: "command_execution", command: "ls" } }));
console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "OK" } }));
console.log(JSON.stringify({ type: "turn.completed", usage }));
`);
    fs.chmodSync(fakeCodex, 0o755);
    fs.writeFileSync(path.join(tempRoot, "auth.json"), JSON.stringify({
      auth_mode: "chatgpt",
      tokens: { access_token: "oauth-token", account_id: "account-1" },
    }));
    fs.writeFileSync(path.join(tempRoot, "baseline.txt"), "full source");
    fs.writeFileSync(path.join(tempRoot, "fooks.json"), "{}");
    const taskManifestPath = path.join(tempRoot, "corrected-tasks.json");
    fs.writeFileSync(taskManifestPath, JSON.stringify({
      tasks: [{
        id: "corrected-component",
        targetPairCount: 1,
        instruction: "Summarize.",
        baselineContextPath: "baseline.txt",
        fooksContextPath: "fooks.json",
        qualityGate: { id: "corrected-payload-validation", status: "passed", command: "fake" },
      }],
    }));

    execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-provider-cost-repeated.js"),
      "--live-openai",
      "--auth-mode=codex-oauth",
      "--transport=codex-exec",
      "--require-no-tool-use=true",
      `--task-manifest=${taskManifestPath}`,
      "--run-id=corrected-tool-gate",
      "--model=gpt-5.4",
      "--input-rate-per-1m=1",
      "--output-rate-per-1m=1",
      "--required-task-classes=1",
      "--required-accepted-pairs-per-task=1",
    ], {
      cwd: tempRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
        CODEX_HOME: tempRoot,
        OPENAI_API_KEY: "",
      },
    });

    const summaryPath = path.join(tempRoot, ".fooks", "evidence", "provider-cost", "corrected-tool-gate", "summary.json");
    const pairPath = path.join(tempRoot, ".fooks", "evidence", "provider-cost", "corrected-tool-gate", "pairs", "corrected-component-1.json");
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    const pair = JSON.parse(fs.readFileSync(pairPath, "utf8"));
    assert.equal(summary.counts.acceptedPairCount, 0);
    assert.equal(summary.pairs[0].qualityGate.passed, false);
    assert.equal(summary.taskSummaries[0].pairs[0].qualityGatePassed, false);
    assert.match(pair.runs.baseline.qualityGate.command, /commandExecutionCount:1/);
    assert.equal(pair.runs.baseline.qualityGate.status, "failed");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("corrected provider cost manifest builder writes real source and fooks payload contexts", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-corrected-builder-"));
  try {
    const outputPath = path.join(tempRoot, "corrected-task-manifest.json");
    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "build-provider-cost-corrected-manifest.js"),
      `--output=${outputPath}`,
      "--target-pair-count=1",
    ], { cwd: repoRoot, encoding: "utf8", env: { ...process.env, OPENAI_API_KEY: "" } });
    const result = JSON.parse(stdout);
    const manifest = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(result.taskCount, 3);
    assert.equal(manifest.tasks.length, 3);
    assert.equal(manifest.recommendedRunnerArgs.codexWorkdir, "isolated");
    assert.equal(manifest.tasks.every((task) => fs.existsSync(path.join(tempRoot, task.baselineContextPath))), true);
    assert.equal(manifest.tasks.every((task) => fs.existsSync(path.join(tempRoot, task.fooksContextPath))), true);
    assert.equal(manifest.tasks.every((task) => task.payloadStats.promptPayloadReductionPct > 0), true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("corrected provider cost manifest builder supports large external profiles without pricing fields", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-large-builder-"));
  try {
    const nextRoot = path.join(tempRoot, "nextjs");
    const tailwindRoot = path.join(tempRoot, "tailwindcss");
    const nextComponents = path.join(nextRoot, "packages", "next", "src", "client", "components");
    const tailwindSrc = path.join(tailwindRoot, "packages", "tailwindcss", "src");
    fs.mkdirSync(nextComponents, { recursive: true });
    fs.mkdirSync(tailwindSrc, { recursive: true });

    fs.writeFileSync(path.join(nextComponents, "app-router.tsx"), `
      import React from "react";
      export function AppRouter({ tree, cache, navigate }) {
        const [state, setState] = React.useState(tree);
        React.useEffect(() => {
          if (cache?.pendingPush) navigate(cache.pendingPush);
        }, [cache, navigate]);
        return <main data-tree={JSON.stringify(state)}>{state?.children}</main>;
      }
    `);
    fs.writeFileSync(path.join(nextComponents, "layout-router.tsx"), `
      import React from "react";
      export function LayoutRouter({ segmentPath, loading, error, template }) {
        if (error) return <section role="alert">{error.message}</section>;
        if (loading) return <section aria-busy="true">loading</section>;
        return <section data-segment={segmentPath.join("/")}>{template}</section>;
      }
    `);
    fs.writeFileSync(path.join(tailwindSrc, "utilities.ts"), `
      export function createUtilities(theme) {
        const utilities = new Map();
        utilities.set("flex", () => ({ display: "flex" }));
        utilities.set("text", (value) => ({ color: theme.resolve(value) }));
        return utilities;
      }
    `);

    const outputPath = path.join(tempRoot, "large", "corrected-task-manifest.json");
    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "build-provider-cost-corrected-manifest.js"),
      "--profile=nextjs-tailwind-large",
      `--nextjs-root=${nextRoot}`,
      `--tailwindcss-root=${tailwindRoot}`,
      `--output=${outputPath}`,
      "--target-pair-count=1",
    ], { cwd: repoRoot, encoding: "utf8", env: { ...process.env, OPENAI_API_KEY: "" } });

    const result = JSON.parse(stdout);
    const manifest = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(result.profile, "nextjs-tailwind-large");
    assert.equal(manifest.profile, "nextjs-tailwind-large");
    assert.equal(manifest.tasks.length, 3);
    assert.deepEqual(manifest.tasks.map((task) => task.sourceRootLabel), ["nextjs", "nextjs", "tailwindcss"]);
    assert.equal(manifest.tasks.every((task) => fs.existsSync(path.join(path.dirname(outputPath), task.baselineContextPath))), true);
    assert.equal(manifest.tasks.every((task) => fs.existsSync(path.join(path.dirname(outputPath), task.fooksContextPath))), true);
    assert.equal(Object.prototype.hasOwnProperty.call(manifest, "pricing"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(manifest, "inputPer1MTokens"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(manifest, "outputPer1MTokens"), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("provider cost repeated CLI live mode without credentials writes controlled blocker", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-repeated-nokey-"));
  try {
    const taskManifestPath = path.join(tempRoot, "live-campaign-tasks.json");
    fs.writeFileSync(taskManifestPath, JSON.stringify({
      tasks: ["component", "refactor", "tests"].map((id) => ({
        id,
        targetPairCount: 5,
        qualityGate: { id: "applied-validation", version: "v1", command: "manual review" },
      })),
    }));
    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-provider-cost-repeated.js"),
      "--live-openai",
      "--auth-mode=api-key",
      `--task-manifest=${taskManifestPath}`,
      "--run-id=no-key",
    ], { cwd: tempRoot, encoding: "utf8", env: { ...process.env, CODEX_HOME: tempRoot, OPENAI_API_KEY: "" } });
    const result = JSON.parse(stdout);
    const summaryPath = path.join(tempRoot, ".fooks", "evidence", "provider-cost", "no-key", "summary.json");
    const ledgerPath = path.join(tempRoot, ".fooks", "evidence", "provider-cost", "no-key", "campaign-ledger.json");
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    assert.equal(result.status, "live-openai-credentials-missing");
    assert.equal(result.requestMade, false);
    assert.equal(result.auth.ok, false);
    assert.equal(result.auth.credentialKind, null);
    assert.equal(summary.status, "live-openai-credentials-missing");
    assert.match(summary.statusReasons.join("\n"), /OpenAI live auth is required/);
    assert.equal(summary.campaignManifest.taskClasses.length, 3);
    assert.equal(summary.counts.plannedPairCount, 15);
    assert.equal(summary.counts.attemptedPairCount, 0);
    assert.equal(ledger.plannedPairCount, 15);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("provider cost import manifest fixture kit runs as mechanics-only evidence", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fooks-provider-import-kit-"));
  try {
    const fixtureRoot = path.join(repoRoot, "benchmarks", "layer2-frontend-task", "fixtures", "provider-cost-import-kit");
    const localFixtureRoot = path.join(tempRoot, "kit");
    fs.cpSync(fixtureRoot, localFixtureRoot, { recursive: true });
    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, "benchmarks", "layer2-frontend-task", "run-provider-cost-repeated.js"),
      `--import-manifest=${path.join(localFixtureRoot, "import-manifest.json")}`,
      "--run-id=import-kit-smoke",
    ], { cwd: tempRoot, encoding: "utf8", env: { ...process.env, OPENAI_API_KEY: "" } });

    const result = JSON.parse(stdout);
    const summaryPath = path.join(tempRoot, ".fooks", "evidence", "provider-cost", "import-kit-smoke", "summary.json");
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    assert.equal(result.status, "fixture-launch-grade-mechanics");
    assert.equal(summary.status, "fixture-launch-grade-mechanics");
    assert.equal(summary.claimability.estimatedApiCostPositiveEvidence, false);
    assert.equal(summary.claimability.providerInvoiceOrBillingSavings, false);
    assert.equal(summary.claimability.stableRuntimeTokenSavings, false);
    assert.equal(summary.counts.acceptedPairCount, 15);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
