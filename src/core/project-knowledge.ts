import fs from "node:fs";
import path from "node:path";

export const PROJECT_KNOWLEDGE_VERSION = "project-knowledge.v1" as const;
export const DEFAULT_PROJECT_KNOWLEDGE_RULES_PATH = path.join("docs", "project-knowledge", "claim-boundary-rules.json");

export type ProjectKnowledgeAuthority = "tracked" | "local-opt-in";
export type ProjectKnowledgeMode = "advisory";

export type ProjectKnowledgeRule = {
  id: string;
  family: "claim-boundary";
  summary: string;
  appliesWhen?: {
    keywords?: string[];
    paths?: string[];
  };
  evidence: string[];
  severity?: "info" | "warning";
  authority?: ProjectKnowledgeAuthority;
};

export type ProjectKnowledgeRuleFile = {
  version?: typeof PROJECT_KNOWLEDGE_VERSION;
  rules: ProjectKnowledgeRule[];
};

export type ProjectKnowledgeMetadata = {
  appliedRuleIds: string[];
  family: "claim-boundary";
  matchReasons: string[];
  evidencePaths: string[];
  authority: ProjectKnowledgeAuthority;
  rulesPath: string;
  mode: ProjectKnowledgeMode;
};

export type LoadedProjectKnowledgeRules = {
  exists: boolean;
  rulesPath: string;
  authority: ProjectKnowledgeAuthority;
  rules: ProjectKnowledgeRule[];
  errors: string[];
};

export type ResolvedProjectKnowledgeContext = {
  block: string;
  metadata: ProjectKnowledgeMetadata;
};

type ProjectKnowledgeMatch = {
  rule: ProjectKnowledgeRule;
  matchReasons: string[];
};

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function normalizeText(value: string): string {
  return value.toLowerCase();
}

function normalizeKeywordText(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizePathHint(value: string): string {
  return value.replaceAll("\\", "/").toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function promptContainsKeyword(prompt: string, keyword: string): boolean {
  const normalizedPrompt = normalizeKeywordText(prompt);
  const normalizedKeyword = normalizeKeywordText(keyword);
  if (!normalizedPrompt || !normalizedKeyword) return false;
  const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(normalizedKeyword).replace(/\\ /g, "\\\\s+")}(?=\\s|$)`);
  return pattern.test(normalizedPrompt);
}

function validateRule(candidate: unknown, index: number): { rule?: ProjectKnowledgeRule; errors: string[] } {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== "object") {
    return { errors: [`rule[${index}] must be an object`] };
  }

  const rule = candidate as Record<string, unknown>;
  const id = typeof rule.id === "string" ? rule.id.trim() : "";
  const family = rule.family;
  const summary = typeof rule.summary === "string" ? rule.summary.trim() : "";
  const evidence = Array.isArray(rule.evidence) ? rule.evidence.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
  const severity = rule.severity === "info" || rule.severity === "warning" ? rule.severity : undefined;
  const authority = rule.authority === "tracked" || rule.authority === "local-opt-in" ? rule.authority : undefined;
  const appliesWhen = rule.appliesWhen && typeof rule.appliesWhen === "object" ? (rule.appliesWhen as Record<string, unknown>) : undefined;
  const keywords = Array.isArray(appliesWhen?.keywords)
    ? appliesWhen?.keywords.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const paths = Array.isArray(appliesWhen?.paths)
    ? appliesWhen?.paths.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];

  if (!id) errors.push(`rule[${index}].id must be a non-empty string`);
  if (family !== "claim-boundary") errors.push(`rule[${index}].family must be \"claim-boundary\"`);
  if (!summary) errors.push(`rule[${index}].summary must be a non-empty string`);
  if (evidence.length === 0) errors.push(`rule[${index}].evidence must contain at least one string`);
  if (severity !== undefined && severity !== "info" && severity !== "warning") {
    errors.push(`rule[${index}].severity must be \"info\" or \"warning\" when provided`);
  }
  if (authority !== undefined && authority !== "tracked" && authority !== "local-opt-in") {
    errors.push(`rule[${index}].authority must be \"tracked\" or \"local-opt-in\" when provided`);
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    rule: {
      id,
      family: "claim-boundary",
      summary,
      appliesWhen: keywords.length > 0 || paths.length > 0 ? { ...(keywords.length > 0 ? { keywords } : {}), ...(paths.length > 0 ? { paths } : {}) } : undefined,
      evidence,
      ...(severity ? { severity } : {}),
      ...(authority ? { authority } : {}),
    },
    errors,
  };
}

export function loadProjectKnowledgeRules(
  cwd = process.cwd(),
  options: { rulesPath?: string; authority?: ProjectKnowledgeAuthority } = {},
): LoadedProjectKnowledgeRules {
  const authority = options.authority ?? "tracked";
  const rulesPath = options.rulesPath ?? DEFAULT_PROJECT_KNOWLEDGE_RULES_PATH;
  const resolvedRulesPath = path.isAbsolute(rulesPath) ? rulesPath : path.join(cwd, rulesPath);
  if (!fs.existsSync(resolvedRulesPath)) {
    return { exists: false, rulesPath, authority, rules: [], errors: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(resolvedRulesPath, "utf8"));
  } catch (error) {
    return {
      exists: true,
      rulesPath,
      authority,
      rules: [],
      errors: [`project-knowledge parse failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { rules?: unknown }).rules)) {
    return {
      exists: true,
      rulesPath,
      authority,
      rules: [],
      errors: ["project-knowledge file must be an object with a rules array"],
    };
  }

  const file = parsed as ProjectKnowledgeRuleFile;
  const errors: string[] = [];
  const rules: ProjectKnowledgeRule[] = [];
  for (const [index, candidate] of file.rules.entries()) {
    const result = validateRule(candidate, index);
    errors.push(...result.errors);
    if (result.rule) rules.push(result.rule);
  }

  return {
    exists: true,
    rulesPath,
    authority,
    rules,
    errors,
  };
}

function matchProjectKnowledgeRule(rule: ProjectKnowledgeRule, prompt: string, filePaths: string[]): ProjectKnowledgeMatch | null {
  const normalizedFilePaths = filePaths.map((filePath) => normalizePathHint(filePath));
  const reasons: string[] = [];

  for (const keyword of rule.appliesWhen?.keywords ?? []) {
    if (promptContainsKeyword(prompt, keyword)) {
      reasons.push(`prompt-keyword:${keyword}`);
    }
  }

  for (const hint of rule.appliesWhen?.paths ?? []) {
    const normalizedHint = normalizePathHint(hint);
    if (normalizedFilePaths.some((filePath) => filePath.includes(normalizedHint))) {
      reasons.push(`path:${hint}`);
    }
  }

  if (reasons.length === 0) return null;
  return {
    rule,
    matchReasons: uniqueStrings(reasons),
  };
}

function formatProjectKnowledgeBlock(matches: ProjectKnowledgeMatch[], metadata: ProjectKnowledgeMetadata): string {
  const commentMetadata = {
    ...metadata,
    version: PROJECT_KNOWLEDGE_VERSION,
  };
  const lines = [
    "# PROJECT KNOWLEDGE CONTEXT",
    "",
    `<!-- fooks-project-knowledge ${JSON.stringify(commentMetadata)} -->`,
    "",
    `## ${metadata.family}`,
  ];

  for (const match of matches) {
    lines.push(`- Rule \`${match.rule.id}\`: ${match.rule.summary}`);
    lines.push(`  Match reasons: ${match.matchReasons.join(", ")}`);
    lines.push(`  Evidence: ${match.rule.evidence.join(", ")}`);
  }

  return `${lines.join("\n")}\n`;
}

export function resolveProjectKnowledgeContext(
  prompt: string,
  filePaths: string[],
  cwd = process.cwd(),
  options: { rulesPath?: string; authority?: ProjectKnowledgeAuthority } = {},
): ResolvedProjectKnowledgeContext | null {
  const loaded = loadProjectKnowledgeRules(cwd, options);
  if (loaded.errors.length > 0 || loaded.rules.length === 0) {
    return null;
  }

  const matches = loaded.rules.map((rule) => matchProjectKnowledgeRule(rule, prompt, filePaths)).filter((match): match is ProjectKnowledgeMatch => Boolean(match));
  if (matches.length === 0) {
    return null;
  }

  const metadata: ProjectKnowledgeMetadata = {
    appliedRuleIds: matches.map((match) => match.rule.id),
    family: matches[0].rule.family,
    matchReasons: uniqueStrings(matches.flatMap((match) => match.matchReasons)),
    evidencePaths: uniqueStrings(matches.flatMap((match) => match.rule.evidence)),
    authority: loaded.authority,
    rulesPath: loaded.rulesPath,
    mode: "advisory",
  };

  return {
    metadata,
    block: formatProjectKnowledgeBlock(matches, metadata),
  };
}

export function appendProjectKnowledgeBlock(base: string, block: string | undefined): string {
  if (!block) return base;
  const separator = base.endsWith("\n\n") ? "" : base.endsWith("\n") ? "\n" : "\n\n";
  return `${base}${separator}${block}`;
}
