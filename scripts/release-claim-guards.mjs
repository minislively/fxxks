export function assertNoForbiddenPublicClaims(label, text) {
  const forbidden = [
    /provider usage\/billing-token reduction/i,
    /billing-token savings/i,
    /provider cost savings/i,
    /Claude Read interception is enabled/i,
    /Claude runtime-token savings are enabled/i,
    /automatic Claude runtime-token savings/i,
  ];
  const negatedClaimBoundary = /(?:not|no|without|nor|never|does not prove|do not claim|must not claim|cannot support|blocks?|excluded?|out of scope|is not|stayed false|claimability flags stayed false)[^\n]{0,160}$/i;

  let previousLine = "";
  for (const line of text.split(/\r?\n/)) {
    for (const pattern of forbidden) {
      const match = pattern.exec(line);
      if (match) {
        const beforeMatch = `${previousLine.trim()} ${line.slice(0, match.index)}`;
        assertClaimBoundary(negatedClaimBoundary.test(beforeMatch), `${label} contains forbidden positive claim ${pattern}: ${line}`);
      }
    }
    if (/ccusage replacement/i.test(line)) {
      assertClaimBoundary(/not (?:a )?ccusage replacement|not provider usage\/billing tokens[^.]*ccusage replacement/i.test(line), `${label} contains unbounded ccusage replacement wording: ${line}`);
    }
    if (/\.omx\//i.test(line) || /\.omx\/state/i.test(line)) {
      assertClaimBoundary(/internal|harness|planning/i.test(line), `${label} exposes .omx as product state: ${line}`);
    }
    previousLine = line;
  }
}

export function assertPublicSurfaceClaimBoundaries(surfaces) {
  for (const [label, text] of Object.entries(surfaces)) {
    assertNoForbiddenPublicClaims(label, text);
  }
}

function assertClaimBoundary(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
