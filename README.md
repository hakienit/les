# Living Engineering System

LES is a provider-neutral engineering methodology for human-directed AI
delivery. Policies own behavior, skills expose operational entrypoints, profiles
add optional domain rules, and adapters route hosts to the same bootstrap.

## Install once per user

Run from any directory:

~~~sh
npx -y @hakienit/les
~~~

The installer stores the CLI and LES source in `~/.les-agents` and persists its
`bin` directory in the user PATH. On macOS and Linux it updates common shell
profiles; on Windows it updates the user PATH and installs a `les.cmd` shim.
Open a new terminal after the first install. It does not write to `~/.agents`,
`~/.codex`, `~/.claude`, `~/.gemini`, or any other provider directory.

The user store intentionally contains the package source. Repositories never
receive that source tree.

## Initialize a repository

~~~sh
cd my-project
les init
les connect
~~~

`les init` creates one tracked Markdown entrypoint:

~~~text
LES-AGENT.md
~~~

It points the AI CLI to `~/.les-agents`. `les connect` detects the supported AI
CLIs installed on the machine, lets you select one or more with Space and
Enter, then lets you choose which connected providers are default-on. `Select
all` is available in both steps. A connected provider that is not default-on
can be enabled later with `les on <provider>`.

LES creates a small native pointer to `LES-AGENT.md` for each default-on
provider:

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
there is no extra repo-local state file. `les active <provider>` remains a
legacy compatibility alias for directly enabling one provider.

## Updates and status

No repository needs to be initialized again after an update. Every initialized
repository points to the stable user store, so updating that store updates all
repositories:

~~~sh
npx -y @hakienit/les
les doctor
~~~

Repositories initialized before the `les-*` skill-path migration may still
point to the old bootstrap path. After an update, follow the printed notice and
change their `LES-AGENT.md` pointer to
`~/.les-agents/skills/les-bootstrap/SKILL.md`.

`les doctor` checks the installed version against the current npm package
version. Known update results are cached for at most one day; a cache that only
contains the installed version is rechecked so a newly published version is
not hidden. When a newer version exists it prints:

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
