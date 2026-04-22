'use strict';

/**
 * Parse Codex CLI runtime token telemetry from stdout/stderr text.
 *
 * This is CLI-reported runtime usage only. It is not provider billing telemetry,
 * not a provider cost source, and not sufficient for public billing-token claims.
 */
function parseCodexRuntimeTokens(...chunks) {
  const text = chunks.filter((chunk) => typeof chunk === 'string' && chunk.length > 0).join('\n');
  if (!text) return null;

  const candidates = [];
  const patterns = [
    /tokens\s+used\s*:?\s*\n\s*([0-9][0-9,]*)/gi,
    /tokens\s+used\s*:?\s*([0-9][0-9,]*)/gi,
    /total\s+tokens\s*:?\s*([0-9][0-9,]*)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = Number.parseInt(match[1].replace(/,/g, ''), 10);
      if (Number.isFinite(value)) candidates.push(value);
    }
  }

  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

module.exports = { parseCodexRuntimeTokens };
