# Runtime Capabilities

LES assumes only filesystem access and a project-approved command runner. Git is
recommended for diff and recovery. Browser automation and external connectors
are optional project choices; LES does not install, configure, or authenticate
them.

`behavior-eval.mjs --dry-run` checks the deterministic scenario catalog. The
approved live host command is `npm run smoke:codex:medium`; it stages LES in a
disposable repository and runs only Codex `gpt-5.6-luna/medium` smoke scenarios.
