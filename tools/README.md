# Runtime Capabilities

LES assumes only filesystem access and a project-approved command runner. Git is
recommended for diff and recovery. Browser automation and external connectors
are optional project choices; LES does not install, configure, or authenticate
them.

`behavior-eval.mjs --dry-run` checks the deterministic scenario catalog. The
approved live host command is `npm run smoke:codex:medium`; it stages LES in a
disposable repository and runs only Codex `gpt-5.6-luna/medium` smoke scenarios.

The Claude Code smoke is `node tools/behavior-eval.mjs --host-smoke --provider
claude --model claude-haiku-4-5-20251001 --report
test/evidence/claude-host-smoke-haiku.json`. It refuses any other model. The
host gets file tools only (`Read,Glob,Grep`: no shell, no write tools) with
`--permission-mode dontAsk`; the staged change is supplied as
`staged-change.diff`.

Hosts run with an allowlisted environment (`PATH`, `HOME`, `USER`, `LOGNAME`,
`LES_HOME`, and a few locale/temp names), so a subscription login is used and
`ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` are not forwarded. Set
`LES_EVAL_ENV=NAME,NAME` (no spaces) to forward extra names on purpose, for
example an API key.

The run exercises the installed store, not this working tree. The report's
`store` records the installed version and whether it matches `package.json`;
`declared` lists harness policy, not measurements.
