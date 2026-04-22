'use strict';

/**
 * Parse Codex CLI runtime token telemetry from stdout/stderr text.
 *
 * This is CLI-reported runtime usage only. It is not provider billing telemetry,
 * not a provider cost source, and not sufficient for public billing-token claims.
 */
function parseCodexRuntimeTokens(...chunks) {
  const usage = parseCodexRuntimeUsage(...chunks);
  return usage.totalTokens;
}

/**
 * Parse the strongest structured Codex CLI runtime-token telemetry available.
 *
 * `totalTokens` is the only comparable runtime-token aggregate used by the
 * repeated L1 gate. `inputTokens` and `outputTokens` are retained when the CLI
 * prints them, but they are optional because older/terser Codex output may only
 * include "tokens used".
 */
function parseCodexRuntimeUsage(...chunks) {
  const text = chunks.filter((chunk) => typeof chunk === 'string' && chunk.length > 0).join('\n');
  const empty = {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    source: null,
    claimBoundary: 'Codex CLI runtime-reported tokens are not provider billing tokens or costs.',
  };
  if (!text) return empty;

  const inputTokens = lastNumber([
    /(?:input|prompt)\s+tokens\s*:?\s*([0-9][0-9,]*)/gi,
    /(?:input|prompt)_tokens["']?\s*[:=]\s*([0-9][0-9,]*)/gi,
  ], text);
  const outputTokens = lastNumber([
    /(?:output|completion)\s+tokens\s*:?\s*([0-9][0-9,]*)/gi,
    /(?:output|completion)_tokens["']?\s*[:=]\s*([0-9][0-9,]*)/gi,
  ], text);
  const explicitTotalTokens = lastNumber([
    /tokens\s+used\s*:?\s*\n\s*([0-9][0-9,]*)/gi,
    /tokens\s+used\s*:?\s*([0-9][0-9,]*)/gi,
    /total\s+tokens\s*:?\s*([0-9][0-9,]*)/gi,
    /total_tokens["']?\s*[:=]\s*([0-9][0-9,]*)/gi,
  ], text);

  const totalTokens = explicitTotalTokens !== null
    ? explicitTotalTokens
    : inputTokens !== null && outputTokens !== null
      ? inputTokens + outputTokens
      : null;

  return {
    ...empty,
    inputTokens,
    outputTokens,
    totalTokens,
    source: totalTokens === null ? null : 'codex-cli-output',
  };
}

function lastNumber(patterns, text) {
  const candidates = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = Number.parseInt(match[1].replace(/,/g, ''), 10);
      if (Number.isFinite(value)) candidates.push(value);
    }
  }
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

module.exports = { parseCodexRuntimeTokens, parseCodexRuntimeUsage };
