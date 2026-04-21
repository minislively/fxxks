# Security Policy

## Supported versions

`fooks` is pre-1.0 software. Security fixes are targeted at the latest release on `main` and the latest published npm version of `oh-my-fooks` when a package has been published.

## Reporting a vulnerability

Please do **not** publish exploit details, private tokens, local file contents, or machine-specific paths in a public issue.

Preferred path:

1. Use GitHub's private vulnerability reporting / security advisory flow for this repository when available.
2. If private reporting is not available, open a minimal public issue that says you need a private maintainer contact for a security report. Do not include sensitive details in that issue.

Useful report details once a private channel exists:

- fooks version or commit SHA
- operating system
- command or hook path involved (`fooks setup`, `fooks status`, `fooks codex-runtime-hook`, etc.)
- whether the issue involves local `.fooks/` state, `~/.codex/hooks.json`, generated `.opencode/` files, or packed npm contents
- a minimal reproduction that avoids real secrets

## Local state and hook boundary

`fooks setup` can write project-local `.fooks/` state, project-local opencode helper files, and Codex hook configuration. The package install alone should not mutate those files. Treat unexpected mutation outside those documented paths as security-relevant.
