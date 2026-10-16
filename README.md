# LES: Living Engineering System

**A provider-neutral engineering methodology for human-directed AI delivery.**

Install LES once, point a repository at it, and every AI coding CLI follows the
same discipline: classify the risk, load only the context the task needs, prove
the result with evidence, and stop for a human wherever a human must decide.

~~~sh
npx -y @hakienit/les     # once per machine
cd my-project
les connect              # once per repository
~~~

## Why LES

- **One discipline, every CLI.** Codex, Claude Code, Gemini CLI, and
  Antigravity read the same bootstrap, so switching tools does not change how
  work is done.
- **Evidence, not claims.** Every task ends in a status (`COMPLETE`, `BLOCKED`,
  `PENDING_USER_ACTION`, `FAILED`, or `SKIPPED`) backed by the checks that were
  actually run.
- **Humans keep authority.** Risk levels `R0` to `R3` decide what needs
  approval. Push, history rewrite, force operations, and destructive cleanup
  are `R3`. A handoff never grants authority.
- **Almost no footprint.** A repository gets `LES-AGENT.md` and one small
  pointer file per provider. The LES source never enters your repository.

## Quick start

**1. Install.** Run this from any directory except a checkout of this
repository, where `npx` runs the local package instead of the published one.

~~~sh
npx -y @hakienit/les
~~~

Open a new terminal afterwards, or run the `source` command the installer
prints, so `les` is on your `PATH`.

**2. Connect a repository.**

~~~sh
cd my-project
les connect
~~~

LES detects the AI CLIs on your machine and preselects them all. Press Enter to
accept, or skip the prompt:

~~~sh
les connect --all                  # every detected CLI
les connect codex claude-code      # exactly these
~~~

**3. Work as usual.** Your AI CLI now loads LES before it starts. Check the
setup any time with `les doctor`.

## How it works

~~~text
your request
   -> provider pointer (AGENTS.md, CLAUDE.md, GEMINI.md, or agent.md)
   -> LES-AGENT.md
   -> bootstrap: precedence, route, risk, profile, verification tier
   -> one skill, with only the rules and workflows it activates
   -> evidence and a terminal status
~~~

| Layer | Role |
| --- | --- |
| `policies/` | The kernel: principles, precedence, a 17-phase lifecycle, 14 rules, and 10 workflows. |
| `skills/` | Operational entrypoints, each with a trigger, steps with completion criteria, and guardrails. |
| `profiles/` | Optional domain rules. The frontend profile covers design, accessibility, performance, and browser proof. |
| `adapters/` | Thin host routing so each CLI reaches the same bootstrap. |
| `templates/project/` | Project-owned context, decision, and handoff templates. |

Skills cover the whole delivery path: discovery, planning, specification, task
decomposition, feature delivery, bug fixing, refactoring, migration, incident
hotfix, review, verification, security review, release readiness, and handoff.
Frontend work adds a preview gate for Figma or wireframe input, design,
accessibility, performance, and verification skills.

## Commands

| Command | What it does |
| --- | --- |
| `les` | Install or update the user-local store in `~/.les-agents`. |
| `les connect [provider...] [--all]` | Set up the current repository: create `LES-AGENT.md` and enable providers. |
| `les on [provider]`, `les off [provider]` | Enable or disable routing for one or all configured providers. |
| `les doctor` | Check the install, store integrity, repository pointers, and updates. |
| `les lint FILE...` | Flag placeholders and unverifiable acceptance criteria in a spec. |
| `les guard on`, `les guard off` | Block risky commands in Claude Code. |
| `les init` | Create `LES-AGENT.md` only. |

Add `--dry-run` to any repository command to see its plan without writing.

### Provider pointers

| Provider | Pointer file |
| --- | --- |
| Codex | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Gemini CLI | `GEMINI.md` |
| Antigravity | `.agents/agents/les/agent.md` |

LES never overwrites a project-owned pointer. If one exists, it prints the
pointer to merge by hand. Which providers are configured and active is stored in
a managed comment inside `LES-AGENT.md`, so there is no extra state file.

## Safety nets

### Guard risky commands (Claude Code)

~~~sh
les guard on
~~~

Adds a `PreToolUse` hook to `.claude/settings.local.json`, your personal
settings file, and lists that file in `.git/info/exclude` so it stays out of
`git status`. The hook blocks, before they run:

- reading `.env` files, SSH keys, and cloud credentials;
- `rm` or `find -delete` aimed outside the project, at `~`, or at `/`;
- force pushes to `main`, `master`, `trunk`, `develop`, `release*`, or with no
  branch named.

Other hooks and settings are preserved, and `les guard off` removes only the
LES entry. The guard catches common mistakes through pattern matching. It is
not a sandbox, and a determined command can still get around it.

### Lint a spec

~~~sh
les lint docs/specs/my-feature.md
~~~

Reports placeholders (`TBD`, `TODO`), acceptance criteria that use unmeasurable
words such as "fast" or "works properly", criteria with no observable check,
and files with no acceptance section. It exits 1 when it finds anything. It is
a heuristic aid for `les-specification`, not a replacement for review.

## Keep it current

Every repository points at the stable user store, so updating the store updates
all of them. No repository needs to be initialized again.

~~~sh
npx -y @hakienit/les
les doctor
~~~

`les doctor` also verifies that managed files still match the install manifest
and that `LES-AGENT.md` points at paths that exist. It compares the installed
version with npm at most once a day and prints:

~~~text
[UPDATE_AVAILABLE] les: 1.0.0 -> 1.0.1; run npx -y @hakienit/les
~~~

The check is informational. LES never updates itself, and it installs no shell
hook or background process.

Repositories initialized before the `les-*` skill-path migration may still point
at the old bootstrap path. `les doctor` reports it. Change the `LES-AGENT.md`
pointer to `~/.les-agents/skills/les-bootstrap/SKILL.md`.

<details>
<summary>What the installer changes</summary>

The installer copies the CLI and LES source into `~/.les-agents` and puts its
`bin` directory on your `PATH`:

- macOS and Linux: `.profile` and the rc file of your login shell (zsh, bash, or
  fish). Other known profiles are refreshed only if they already exist.
  `ZDOTDIR` is honored.
- PowerShell: your PowerShell profile.
- Windows: the user `PATH`, plus a `les.cmd` shim.

It never writes to `~/.agents`, `~/.codex`, `~/.claude`, `~/.gemini`, or any
other provider directory. A child process cannot change its parent shell's
`PATH`, so the terminal that ran `npx` needs one `source` of its profile, such
as `source ~/.zshrc`.

</details>

<details>
<summary>Legacy repo-local payload</summary>

Older installations can still be maintained explicitly:

~~~sh
les add --scope repo
les diff --scope repo
les update --scope repo
les rollback --scope repo --backup <backup-path>
~~~

This path copies only Markdown payload files and adds `.les-agents/` to
`.gitignore`. `les active <provider>` also remains as an alias for enabling one
provider. New installations should use the user-local flow above.

</details>

## Contributing

~~~sh
npm test
npm run verify-inventory
npm run verify-release
~~~

These are local checks. Publication, installation, provider activation,
committing, and external mutation remain separate human decisions. Release
history is in `CHANGELOG.md`.

## License

MIT. See `LICENSE`.
