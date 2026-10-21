<p align="center">
  <img src="docs/assets/banner.svg" alt="LES: Living Engineering System" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@hakienit/les"><img src="https://img.shields.io/npm/dm/@hakienit/les" alt="npm downloads per month"></a>
</p>

<h3 align="center">One engineering discipline for every AI coding CLI.</h3>

<p align="center">
Classify the risk. Load only the context the task needs. Prove the result.<br>
Stop for a human wherever a human must decide.
</p>

~~~sh
npx -y @hakienit/les     # once per machine
cd my-project
les connect              # once per repository
~~~

Run `npx` outside a checkout of this repository, then open a new terminal so
`les` is on your `PATH`. Works on macOS, Linux, and Windows.

## Why LES

- **Every CLI, same rules.** Codex, Claude Code, Gemini CLI, and Antigravity read one bootstrap.
- **Evidence, not claims.** Every task ends in `COMPLETE`, `BLOCKED`, `PENDING_USER_ACTION`, `FAILED`, or `SKIPPED`, backed by the checks that ran.
- **Humans keep authority.** Risk levels `R0` to `R3` decide what needs approval. Push, history rewrite, and destructive cleanup are `R3`.
- **A team, priced by risk.** Small work stays with one agent. Larger work goes to departments with their own skills and model tier, and a writer never reviews its own change.
- **No footprint.** A repository gets `LES-AGENT.md` plus one pointer file per CLI. The LES source stays in `~/.les-agents`.

<p align="center">
  <img src="docs/assets/flow.svg" alt="A request passes through the provider pointer, LES-AGENT.md, the bootstrap, and one skill. R3 work waits at an approval gate. The work is done and verified, looping back to fix defects, and ends in a terminal status that returns to the human." width="100%">
</p>

## Commands

| Command | What it does |
| --- | --- |
| `les` | Install or update `~/.les-agents`. |
| `les connect [provider...] [--all]` | Create `LES-AGENT.md` and the pointer files for detected CLIs. |
| `les on`, `les off [provider]` | Enable or disable routing. |
| `les doctor` | Check the install, the repository pointers, and for updates. |
| `les guard on`, `les guard off` | Claude Code hooks: block secret reads, deletes outside the project, and force pushes to protected branches, and gate edits until the bootstrap is read. The session-start hook injects the bootstrap (under the 10,000-character hook cap) so nothing needs reading. A Stop hook sends back, once, a reply that used tools but lacks the LES status footer. The guard fails closed (Claude Code 2.1.295+): if its script is missing or crashes, tool calls are blocked until you run `les guard off` in a normal terminal. A guardrail, not a sandbox. |
| `les guard on codex`, `les guard off codex` | Same risky-call blocks for Codex shell commands in `.codex/hooks.json`, without the bootstrap read gate. Trust the hooks with `/hooks` in Codex. |
| `les guard on gemini`, `les guard off gemini` | Same for Gemini CLI shell and file reads in `.gemini/settings.json`, without the read gate. |
| `les team on`, `les team off` | Claude Code subagents: one per LES department (Product, Architecture, Engineering, Frontend, QA, Security, Review, DevOps, Scout), each on a model sized to its job. The Lead dispatches only when the work needs it. |
| `les lint FILE...` | Flag placeholders and unmeasurable acceptance criteria in a spec. |

Add `--dry-run` to any repository command to preview it. LES never overwrites a
pointer file you own, and it never writes to `~/.codex`, `~/.claude`, `~/.gemini`,
or other provider directories.

## Update

~~~sh
npx -y @hakienit/les
~~~

Every repository points at the user store, so one update covers all of them.
`les doctor` reports new versions. LES never updates itself.

## Contributing

~~~sh
npm test && npm run verify-inventory && npm run verify-release
~~~

Release history is in `CHANGELOG.md`. MIT license, see `LICENSE`.
