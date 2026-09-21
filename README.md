# Living Engineering System

LES is a provider-neutral engineering methodology for human-directed AI
delivery. Policies own behavior, skills expose operational entrypoints, profiles
add optional domain rules, and adapters route hosts to the same bootstrap.

## Install once per user

Run from any directory:

~~~sh
npx -y @hakienit/les
export PATH="$HOME/.les-agents/bin:$PATH"
~~~

The installer stores the CLI and LES source in `~/.les-agents`. Add the `PATH`
line to the shell profile if the `les` command should persist across terminals.
It does not write to `~/.agents`, `~/.codex`, `~/.claude`, `~/.gemini`, or any
other provider directory.

The user store intentionally contains the package source. Repositories never
receive that source tree.

## Initialize a repository

~~~sh
cd my-project
les init
les active codex
~~~

`les init` creates one tracked Markdown entrypoint:

~~~text
LES-AGENT.md
~~~

It points the AI CLI to `~/.les-agents`. `les active <provider>` then creates a
small native pointer to `LES-AGENT.md`:

| Provider | Pointer |
| --- | --- |
| Codex | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Gemini CLI | `GEMINI.md` |
| Antigravity | `.agents/agents/les/agent.md` |

LES never overwrites a project-owned native pointer. If one already exists,
merge the printed pointer manually. The pointer and `LES-AGENT.md` are the only
LES files created in the repository; no `.les-agents/` source tree is created.

Enable or disable routing later:

~~~sh
les on                 # enable configured providers
les off                # disable active providers
les on codex
les off codex
~~~

The provider state is stored in the managed comment inside `LES-AGENT.md`, so
there is no extra repo-local state file.

## Updates and status

No repository needs to be initialized again after an update. Every initialized
repository points to the stable user store, so updating that store updates all
repositories:

~~~sh
npx -y @hakienit/les
les doctor
~~~

`les doctor` checks the installed version and, at most once per day, compares it
with the current GitHub package version. When a newer version exists it prints:

~~~text
[UPDATE_AVAILABLE] les: 1.0.0 -> 1.0.1; run npx -y @hakienit/les
~~~

The check is informational and never updates automatically. If `les` is never
run, LES does not install a shell hook or background process to show notices.

## Legacy repo-local payload

Older installations can still be maintained explicitly:

~~~sh
les add --scope repo
les diff --scope repo
les update --scope repo
les rollback --scope repo --backup <backup-path>
~~~

This compatibility path copies only Markdown payload files and adds
`.les-agents/` to `.gitignore`. New installations should use the user-local
flow above.

## Structure

| Path | Authority |
| --- | --- |
| `policies/` | Canonical kernel, universal rules, and workflows. |
| `skills/` | Operational entrypoints and capability catalog. |
| `profiles/` | Optional domain constraints. |
| `templates/project/` | Project-owned context and governance templates. |
| `adapters/` | Host routing and machine-readable discovery metadata. |
| `inventory.yaml` | Exact public payload registry. |

## Local gates

~~~sh
npm test
npm run verify-inventory
npm run verify-release
~~~

These commands are local checks. Publication, installation, provider activation,
committing, and external mutation remain separate human decisions.
