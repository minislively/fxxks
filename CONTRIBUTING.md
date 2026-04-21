# Contributing

Thanks for helping improve `fooks`.

## Local development

```bash
npm install
npm run lint
npm test
npm run bench:gate
npm run release:smoke
```

Run the smaller checks first while iterating (`npm run lint`, then targeted tests). Run `npm run release:smoke` before any release-readiness PR because it verifies the built package contents and a disposable install/setup path.

## Claim and benchmark rules

Keep public wording conservative:

- Prepared-context estimates are not provider billing-token savings.
- Bare `fooks status` reports local estimated context-size telemetry only; it is not provider billing data, provider cost data, or a `ccusage` replacement.
- Claude and opencode support are handoff/tool paths unless a future bridge proves otherwise.
- Do not claim stable runtime-token/time wins or applied-code benchmark wins without a committed benchmark artifact and matching documentation update.

## Package boundary

The npm package is `oh-my-fooks`; the installed CLI command is `fooks`. Do not document `npm install -g fooks` for this project unless package ownership and release planning change.

## Pull request checklist

- [ ] Source changes are tracked; generated `dist/` is ignored and rebuilt by scripts.
- [ ] Docs match the current claim boundary.
- [ ] `npm run lint` passes.
- [ ] `npm test` passes.
- [ ] `npm run bench:gate` passes when benchmark-affecting code or claims changed.
- [ ] `npm run release:smoke` passes when package contents or release docs changed.
