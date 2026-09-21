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

1. `.les-agents/` contains the pinned Markdown-only LES payload: policies,
   skills, profiles, adapters, and its manifest.
2. A provider pointer tells one AI CLI to read the adapter from `.les-agents/`.

The payload is repo-local and automatically added to `.gitignore`. The installer
does not write to `~/.agents`, `~/.codex`,
`~/.claude`, `~/.gemini`, or any other global agent directory.

### Install

Run this from the project root:

~~~sh
npx -y github:hakienit/les#v1.0.0
~~~

The command is equivalent to `npx -y github:hakienit/les#v1.0.0 add --scope repo
--root .les-agents`. It creates:

~~~text
.les-agents/
├── adapters/
├── policies/
├── profiles/
├── skills/
└── les-manifest.md
~~~

Every file under `.les-agents/` is Markdown. The CLI implementation, release
tools, JSON/YAML metadata, and package files stay in the package runner and are
not copied into the repository payload.

The installer also adds this rule to the project `.gitignore`:

~~~sh
.les-agents/
~~~

Run later commands through the same pinned package version:

~~~sh
npx -y github:hakienit/les#v1.0.0 doctor
~~~

The install is collision-safe. An existing `.les-agents/` or project-owned
manifest stops the command instead of overwriting files.

To preview the install:

~~~sh
npx -y github:hakienit/les#v1.0.0 add --scope repo --root .les-agents --dry-run
~~~

To pin an exact Git tag:

~~~sh
npx -y github:hakienit/les#v1.0.0
~~~

### Enable routing

Register and enable only the CLI you want:

~~~sh
npx -y github:hakienit/les#v1.0.0 active codex
npx -y github:hakienit/les#v1.0.0 active claude-code
npx -y github:hakienit/les#v1.0.0 active gemini-cli
npx -y github:hakienit/les#v1.0.0 active antigravity
~~~

`active` writes only the selected repo-local provider pointer. It does not
modify global agent directories. The pointer tells the provider to prefer the
local `.les-agents` adapter, policy, and skill payload over global LES copies.

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
npx -y github:hakienit/les#v1.0.0 off codex
~~~

Disable all providers currently enabled:

~~~sh
npx -y github:hakienit/les#v1.0.0 off
~~~

`off` removes only an unchanged pointer created by LES. It leaves
`.les-agents/` installed, so routing can be restored later:

~~~sh
npx -y github:hakienit/les#v1.0.0 on
~~~

The no-provider form toggles all providers previously configured with `on
<provider>`. On a fresh install, use the provider form once first.

### Maintain an installation

~~~sh
# Show managed differences
npx -y github:hakienit/les#v1.0.0 diff

# Check installation and provider status
npx -y github:hakienit/les#v1.0.0 doctor

# Update the payload; project-owned files are preserved
npx -y github:hakienit/les#v1.0.0 update

# Preview an update
npx -y github:hakienit/les#v1.0.0 update --dry-run
~~~

`update` creates a sibling backup and refuses to proceed when unmanaged files
are present inside `.les-agents/`. Restore a backup with:

~~~sh
npx -y github:hakienit/les#v1.0.0 rollback --backup <backup-path>
~~~

The older `adapter <provider>` command remains an alias for `active <provider>`.

### Uninstall

LES does not currently provide an `uninstall` command. Remove it safely from a
repo with:

~~~sh
npx -y github:hakienit/les#v1.0.0 off
rm -rf .les-agents
~~~

`off` removes only unchanged provider pointers created by LES. If a pointer was
edited or belongs to the project, LES stops instead of deleting it.

### Custom repo-local root

`.les-agents` is the default. A different relative directory can be selected:

~~~sh
npx -y github:hakienit/les#v1.0.0 add --root .team-les
npx -y github:hakienit/les#v1.0.0 on codex --root .team-les
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
