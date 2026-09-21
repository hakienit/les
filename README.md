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

Invoke `skills/bootstrap/SKILL.md` explicitly, or route a supported host
through its file in `adapters/`. `inventory.yaml` is the canonical registry and
`routes.yaml` selects task and touchpoint contracts. The bootstrap loads the kernel, project context,
activated rules, one workflow, risk gates, and verification requirements.
The public catalog contains 39 distinct operational entrypoints, including a
frontend-first track for design, interaction, accessibility, performance,
experience review, and browser verification. The frontend track also carries
progressively disclosed visual-quality, browser-protocol, and React/Next
performance references synthesized from the strongest local systems.

The CLI can stage a pinned, collision-safe copy under `.les-agents`:

~~~sh
npx -y github:hakienit/les
npx -y github:hakienit/les on codex
npx -y github:hakienit/les off codex
~~~

The default install is repo-local and never touches global agent directories.
`on` and `off` manage provider pointers without overwriting project-owned files;
omit the provider to toggle all configured providers. The old `adapter` command
remains an alias for `on`.

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
