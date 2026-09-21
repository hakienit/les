# LES Strict Normalization Design

**Status:** Implemented locally; awaiting maintainer review  
**Parent:** HBA-10  
**Date:** 2026-09-18

## Objective

Rebuild LES as a strict, provider-neutral engineering methodology whose public
package is operational after installation. Policies define authority, skills
provide discoverable entrypoints, profiles add optional domain guidance, and
adapters translate the same package into each supported host.

The rebuild replaces the current passive skill catalog and incomplete Core.
It does not preserve legacy file counts for their own sake. Every retained
artifact must own a named capability and be reachable through a validated
runtime path.

## Non-negotiable constraints

- LES content is independently authored and owned by LES.
- External research, donor names, source URLs, source revisions, comparison
  notes, and provenance records do not live in the repository or package.
- Content requiring third-party attribution is rejected rather than included
  without its required notice.
- Project code, real ADRs, knowledge, team ownership, credentials, work state,
  and personal settings are never distributed.
- A public skill must be discoverable and runnable; a nested Markdown file is
  not sufficient.
- Policies have one canonical owner. Skills and adapters link to policy rather
  than duplicating it.
- No migration step may publish, install globally, alter a real provider
  configuration, commit, or contact an external service.

## Canonical package model

~~~text
LES/
  README.md
  LICENSE
  CHANGELOG.md
  package.json
  inventory.yaml

  policies/
    README.md
    principles.md
    precedence.md
    lifecycle.md
    risk-model.md
    memory-model.md
    verification.md
    rules/
    workflows/

  skills/
    les-bootstrap/SKILL.md
    engineering/<skill>/SKILL.md
    governance/<skill>/SKILL.md

  profiles/
    frontend/
      README.md
      rules/
      skills/

  templates/
    project/

  adapters/
    codex/
    claude-code/
    gemini-cli/
    antigravity/

  bin/
  tools/
~~~

Repository-only specifications, tests, handoffs, and release evidence remain
outside the package allowlist. Temporary research material remains outside the
repository and is destroyed after requirements are extracted.

## Authority and loading order

LES resolves instructions in this order:

1. Runtime and platform constraints.
2. LES principles and precedence policy.
3. Universal LES rules.
4. Selected profile rules.
5. Project decisions and repository conventions.
6. Team governance supplied by the project.
7. Active task scope and work state.

Higher levels win. An unresolved contradiction stops dependent work and is
reported to the human. Adapters cannot weaken this order, and a project may
only add stricter constraints unless a higher-level policy explicitly allows
an override.

## Policy inventory

### Kernel

The always-loaded kernel contains:

- principles;
- precedence and conflict resolution;
- the full task lifecycle and context-loading rules;
- risk classification and approval gates;
- memory ownership and promotion rules; and
- verification tiers and completion truthfulness.

The kernel stays compact. Detailed execution guidance is conditionally loaded
from rules and workflows.

### Universal rules

The initial rule registry covers these named capabilities:

- AI authority and behavior;
- architecture and module boundaries;
- coding quality;
- testing;
- security and sensitive data;
- Git safety and commit authority;
- dependencies;
- technical decision-making;
- folder and file organization;
- documentation;
- error handling;
- context loading;
- definition of done; and
- change scope and cleanliness.

The registry, not a directory count, is canonical. Every rule declares its
name, owner, status, activation condition, and policy path in `inventory.yaml`.

### Workflows

The initial workflow registry provides operational playbooks for:

- task lifecycle;
- feature delivery;
- bug fixing;
- refactoring;
- investigation;
- incident and hotfix work;
- review;
- verification;
- handoff and recovery; and
- knowledge promotion.

Each workflow names its trigger, required policy inputs, risk behavior,
outputs, and verification evidence. Workflows must not redefine policy.

### Frontend profile

The optional frontend profile owns web-specific rules for component design,
state management, UI completeness, API integration, accessibility,
performance, and frontend verification. It is inactive unless selected by the
adopting project.

Technology choices that belong to one project remain in that project's ADRs;
the public profile expresses constraints and inspection procedures without
mandating a project-specific library.

## Skill contract

`skills/` and selected profile skill roots form the public operational catalog.
The first release contains 27 entrypoints:

- five lifecycle and planning skills, including the mandatory bootstrap;
- nine engineering execution skills;
- five assurance skills;
- three repository and release skills;
- two governance skills; and
- three frontend profile skills.

Each skill contains:

- a unique `les-` name;
- a trigger-only description;
- an invocation class: `bootstrap`, `user`, or `model`;
- the LES-owned policy and workflow paths it loads;
- explicit inputs, outputs, stop conditions, and verification; and
- no external source or provenance metadata.

Skills own explicit orchestration: inputs, ordered completion criteria, output,
guardrails, and verification. Rules and workflows retain universal meaning;
skills link to them rather than duplicating them. `les-bootstrap` must work through
explicit invocation without a provider hook. A provider may inject it as a
convenience, but injection is never the only usable path.

## Adapter and discovery contract

Every supported adapter declares, in machine-readable metadata:

- the public `skills/` root or an explicit list of promoted skills;
- the bootstrap entrypoint;
- optional profile skill roots;
- host-specific hooks and display metadata; and
- unsupported capabilities that must remain pending.

Adapter pointers may direct a host to canonical policy, but prose pointers do
not satisfy skill discovery. Validation resolves every declared path, confirms
that the target has valid metadata, and proves the bootstrap is reachable.

Provider-specific hook code and picker metadata remain inside the owning
adapter. Portable skill instructions never name a host tool.

## Project template contract

`templates/project/` supplies empty, project-owned structure for:

- entrypoint and commands;
- context and shared terminology;
- decisions and an ADR template;
- knowledge indices;
- team governance;
- active work and handoffs; and
- selected profiles and adapter metadata.

Installation never writes these paths into an existing project automatically.
An explicit initialization command may create missing template paths only
after printing a plan and passing collision checks.

## Copyright-clean boundary

The repository validator blocks:

- named external methodology or skill donors;
- external source-repository URLs outside approved LES-owned package metadata;
- source revision or provenance fields in public content;
- research, comparison, or migration-source notes;
- foreign copyright notices; and
- the temporary normalization input document.

This gate supplements independent authorship; it is not a license workaround.
Review must reject text that is substantially similar to an external source
even when names and URLs have been removed.

The top-level LES license, LES-owned repository metadata, and URLs required for
the LES package itself remain allowed.

## Migration strategy

1. Freeze the next delivery phase until normalization passes.
2. Add `inventory.yaml` and the validator with failing checks for the current
   incomplete layout.
3. Build the kernel and precedence model using independently authored LES
   language.
4. Add registered universal rules, workflows, and the frontend profile.
5. Replace the legacy passive skills with the new operational catalog and
   bootstrap.
6. Add adapter manifests and discovery tests.
7. Move the project README into `templates/project/` and add empty templates.
8. Update the CLI payload, update/rollback behavior, and package allowlist.
9. Remove legacy external-reference artifacts, the temporary normalization
   input, and obsolete phase evidence from the distributed source tree.
10. Run the full acceptance suite and create a new clean handoff for the
    normalized baseline.

Migration is replacement, not compatibility layering. The package is still
unpublished and has no adopted consumers, so keeping two policy layouts would
add ambiguity without protecting a real user.

## Failure behavior

- Missing or duplicate inventory entries: `BLOCKED`.
- Broken policy, workflow, skill, template, or adapter path: `BLOCKED`.
- Adapter with unavailable host evidence: `PENDING_USER_ACTION`; never ready.
- Existing project path collision: stop before writing and print the exact
  conflict.
- External-reference gate finding: `BLOCKED` with file and line, without
  copying the offending text into generated reports.
- Verification command unavailable: report it as unrun; never convert it into
  a passing result.

## Acceptance checks

The normalized baseline is ready for review only when:

1. `inventory.yaml` enumerates every public kernel document, rule, workflow,
   skill, profile, template, adapter, validator, and CLI entrypoint.
2. Every inventory path exists exactly once and every unregistered public
   payload file is rejected.
3. All internal links resolve and no authority cycle exists.
4. Every skill has valid metadata and resolves its declared policies and
   workflow.
5. Every adapter resolves its skill root and bootstrap path.
6. The bootstrap passes a provider-neutral fixture test through explicit
   invocation.
7. Project initialization dry-run writes nothing; collision tests preserve
   existing project files byte-for-byte.
8. Copyright-clean validation reports no forbidden references or temporary
   research artifacts.
9. The package dry-run contains only the declared public payload and executes
   no lifecycle hook.
10. CLI integration, update, diff, rollback, doctor, syntax, and release checks
    all pass with fresh evidence.

## Out of scope

- Publishing or installing LES.
- Modifying a real provider configuration.
- Importing project-specific ADRs, knowledge, team ownership, or work state.
- Backward compatibility with the incomplete, unpublished layout.
- Adding dependencies when the standard library is sufficient.

## Implementation stop condition

Implementation stops when the canonical layout, discovery path, clean-room
gate, migration cleanup, and acceptance suite above pass locally. Publishing,
installation, provider activation, commit, and release remain separate human
decisions.
