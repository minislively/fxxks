/**
 * Lightweight token estimator used by the benchmark v2 extractor.
 * It intentionally stays dependency-free so comparisons can run from this repo
 * without pulling in a tokenizer package.
 */

export function countTokens(content: string): number {
  const withoutComments = content
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const tokens = withoutComments.match(
    /[a-zA-Z_][a-zA-Z0-9_]*|[0-9]+|"[^"]*"|'[^']*'|`[^`]*`|[^\s\w]/g,
  ) ?? [];

  let tokenCount = 0;

  for (const token of tokens) {
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
      tokenCount += token.length > 8 ? 2 : 1;
      continue;
    }

    if (/^"[^"]*"$|^'[^']*'$|^`[^`]*`$/.test(token)) {
      tokenCount += Math.max(1, Math.ceil((token.length - 2) / 3.5));
      continue;
    }

    tokenCount += 1;
  }

  return Math.ceil(tokenCount);
}

export function calculateTokenMetrics(rawContent: string, extractedContent: string): {
  rawTokens: number;
  extractedTokens: number;
  tokenDelta: number;
  savingsRatio: number;
} {
  const rawTokens = countTokens(rawContent);
  const extractedTokens = countTokens(extractedContent);
  const tokenDelta = Math.max(0, rawTokens - extractedTokens);
  const savingsRatio = rawTokens > 0 ? tokenDelta / rawTokens : 0;

  return {
    rawTokens,
    extractedTokens,
    tokenDelta,
    savingsRatio,
  };
}
