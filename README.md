# Living Engineering System

LES is a strict, provider-neutral engineering methodology for human-directed AI
delivery. Policies own behavior, skills expose operational entrypoints, profiles
add optional domain rules, and adapters route hosts to the same bootstrap.

## Structure

| Path | Authority |
| --- | --- |
| `policies/` | Canonical kernel, universal rules, and workflows. |
| `skills/` | Operational entrypoints and a human-readable capability catalog. |
| `profiles/` | Optional domain constraints selected by a project. |
| `templates/project/` | Empty project-owned context and governance templates. |
| `adapters/` | Host routing and machine-readable discovery metadata. |
| `inventory.yaml` | Exact public payload registry. |

## Use

LES has two layers:

1. `.les-agents/` contains the pinned LES payload: policies, skills, profiles,
   adapters, templates, and its manifest.
2. A provider pointer tells one AI CLI to read the adapter from `.les-agents/`.

The installer is repo-local. It does not write to `~/.agents`, `~/.codex`,
`~/.claude`, `~/.gemini`, or any other global agent directory.

### Install

Run this from the project root:

~~~sh
npx -y github:hakienit/les
~~~

The short command is equivalent to `les add --scope repo --root .les-agents`.
It creates:

~~~text
.les-agents/
├── adapters/
├── bin/
├── policies/
├── profiles/
├── skills/
├── templates/
├── tools/
├── package.json
├── les-manifest.json
└── les-manifest.yaml
~~~

The bundled launcher is repo-local. Add it to the current shell once:

~~~sh
export PATH="$PWD/.les-agents/bin:$PATH"
~~~

After that, use the short `les` command. This changes only the current shell's
PATH; it does not install a global command or modify global agent directories.

The install is collision-safe. An existing `.les-agents/` or project-owned
manifest stops the command instead of overwriting files.

To preview the install:

~~~sh
npx -y github:hakienit/les add --scope repo --root .les-agents --dry-run
~~~

To pin an exact Git tag:

~~~sh
npx -y github:hakienit/les#v0.1.0
~~~

### Enable routing

Install does not modify provider entrypoints. Enable only the CLI you want:

~~~sh
les on codex
les on claude-code
les on gemini-cli
les on antigravity
~~~

The repo-local pointer locations are:

| Provider | Pointer |
| --- | --- |
| Codex | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Gemini CLI | `GEMINI.md` |
| Antigravity | `.agents/agents/les/agent.md` |

Each pointer routes the provider to the matching adapter under
`.les-agents/adapters/`. LES never overwrites an existing project-owned pointer.
If a pointer already exists, review the suggested pointer and add it manually.

### Disable routing

Disable one provider:

~~~sh
les off codex
~~~

Disable all providers currently enabled:

~~~sh
les off
~~~

`off` removes only an unchanged pointer created by LES. It leaves
`.les-agents/` installed, so routing can be restored later:

~~~sh
les on
~~~

The no-provider form toggles all providers previously configured with `on
<provider>`. On a fresh install, use the provider form once first.

### Maintain an installation

~~~sh
# Show managed differences
les diff

# Check installation and provider status
les doctor

# Update the payload; project-owned files are preserved
npx -y github:hakienit/les update

# Preview an update
npx -y github:hakienit/les update --dry-run
~~~

`update` creates a sibling backup and refuses to proceed when unmanaged files
are present inside `.les-agents/`. Restore a backup with:

~~~sh
les rollback --backup <backup-path>
~~~

The older `adapter <provider>` command remains an alias for `on <provider>`.

### Custom repo-local root

`.les-agents` is the default. A different relative directory can be selected:

~~~sh
npx -y github:hakienit/les add --root .team-les
npx -y github:hakienit/les on codex --root .team-les
~~~

The root must stay inside the current repository; absolute paths and `..` are
rejected.

### Direct LES usage

Without installing the CLI, an agent can start at `skills/bootstrap/SKILL.md`.
`inventory.yaml` is the canonical registry and `routes.yaml` selects task and
touchpoint contracts. The bootstrap loads the kernel, project context,
activated rules, one workflow, risk gates, and verification requirements.
The public catalog contains 39 operational entrypoints, including frontend
design, interaction, accessibility, performance, experience review, and browser
verification.

## Local gates

~~~sh
npm test
npm run verify-inventory
npm run verify-release
~~~

These commands are local checks. Publishing, installing, provider activation,
committing, and external mutation remain separate human decisions.

After explicit approval, the bounded Codex host smoke is:

~~~sh
npm run smoke:codex:medium
~~~

It uses only `gpt-5.6-luna` with Medium reasoning in disposable workspaces;
other providers remain `PENDING_HOST_SMOKE` until separately proven.
