# Auditing skills

Current framework release: **0.2.0**. See [CHANGELOG.md](CHANGELOG.md), the
[v0.2.0 release notes](docs/releases/v0.2.0.md), and the
[compatibility guide](docs/compatibility.md).

Claude Code skills for auditing running interfaces, distributed as a plugin
marketplace.

Each skill is a different instrument pointed at the same running app. They are
designed to be complementary rather than redundant. The repository is currently
at the AUD v2 Phase 7 baseline: `aud` is the primary entry for broad requests,
builds deterministic dependency-aware plans, coordinates a reusable evidence
baseline, runs supplied specialist observation packets, and preserves the
persistent ledger. Multi-specialist runs now synthesize duplicates,
relationships, contradictions, root causes, priorities, and dependency-aware
remediation waves without modifying the audited application. Verify mode now
builds finding-specific cases, executes only supplied adapter results, compares
baseline and candidate evidence, detects targeted regressions, and applies legal
evidence-backed lifecycle transitions.
The framework itself now has a versioned synthetic calibration corpus,
reliability metrics, drift reporting, and explicit hard/warning quality gates;
calibration stays separate from product audit runs.
Phase 7 selectively adds architecture/maintainability coverage for dependency
direction, ownership, coupling, and change safety; the formal review rejects or
defers broader module growth where existing owners or missing foundations make
another specialist unjustified.

Broad or ambiguous audits route through:

`/aud:aud`

The orchestrator applies this dependency sequence when relevant:

`content-audit → place-audit → flow-audit → first-principles redesign`

After explicitly authorized implementation, use:

`visual-audit → functional-audit`

Run an individual skill alone when its question is already isolated—for
example, `place-audit` when approved information feels buried, or `flow-audit`
when a known journey loses context or forces unnecessary transitions.

All pipeline audit stages are report-only. A standalone visual or functional
specialist may apply a narrow change only after the user explicitly authorizes
fix mode or a visual dose.

## Where audit runs belong

This repository contains the reusable audit tools only. Product-specific
reports, screenshots, task models, and evidence belong in the repository of the
application being audited:

```text
<application-root>/audits/
  YYYY-MM-DD-content/
  YYYY-MM-DD-place/
  YYYY-MM-DD-flow/
  YYYY-MM-DD-visual/
  YYYY-MM-DD-functional/
  YYYY-MM-DD-architecture-maintainability/
  latest.md
```

Use the nearest application root that owns the runtime/build configuration. In
a monorepo, do not put every app's audits at the repository root. Preserve prior
runs; if the same audit type runs twice on one date, append `-02`, `-03`, and so
on. Update `audits/latest.md` to link the newest run of every completed type.
Do not commit application audit results to `basabtan/aud`.

Use [`shared/templates/latest.md`](shared/templates/latest.md) as the canonical
index and follow [`shared/protocols/run-artifacts.md`](shared/protocols/run-artifacts.md)
for immutable runs and carry-forward behavior. Validate structured artifacts with
`npm run validate:schema -- <schema-name> <path>` and merge findings with
`npm run merge:ledger -- <ledger> <incoming-findings>`.

Each specialist emits `evidence.jsonl`, `findings.jsonl`, and an explicit
`input-status.json`. Content additionally emits `content-contract.json`; flow
emits `flow-contract.json`. See
[`docs/phase-2-migration.md`](docs/phase-2-migration.md) for the adapter interface
and the temporary `audit` compatibility alias. Native-to-shared verdict mapping
is defined in
[`shared/protocols/specialist-mappings.md`](shared/protocols/specialist-mappings.md).
Phase 3 orchestration and evidence behavior is documented in
[`docs/phase-3-orchestration.md`](docs/phase-3-orchestration.md). Phase 4
synthesis and remediation policy is documented in
[`docs/phase-4-synthesis.md`](docs/phase-4-synthesis.md).
Phase 5 readiness, verification, regression, and lifecycle behavior is in
[`docs/phase-5-verification.md`](docs/phase-5-verification.md). Phase 6 corpus,
metric, gate, and baseline policy is in
[`docs/phase-6-calibration.md`](docs/phase-6-calibration.md).
The Phase 7 coverage decision is in
[`docs/phase-7-coverage-review.md`](docs/phase-7-coverage-review.md), with the
selected capability documented in
[`docs/phase-7-architecture-maintainability.md`](docs/phase-7-architecture-maintainability.md).

Upgrade guidance, including the temporary `audit` compatibility alias and the
five-to-six specialist plan transition, is documented in
[`docs/phase-2-migration.md`](docs/phase-2-migration.md).

Run the normal calibration gate with `npm run calibrate:fast`; run the complete
corpus with `npm run calibrate:full`. `npm run calibrate -- --out <directory>`
writes the structured results and derived Markdown reports. The accepted
baseline can only be replaced with an explicit rationale, and expectation or
threshold changes additionally require explicit policy-change approval.

## Skills

| Plugin | Command | What it asks |
|---|---|---|
| `aud` | `/aud:aud` | Which audits should run, in what order, against which shared evidence? |
| `visual-audit` | `/visual-audit:visual-audit` | Did anyone decide how this should look? |
| `functional-audit` | `/functional-audit:functional-audit` | Does the implementation satisfy functional and accepted contract behavior? |
| `audit` | `/audit:audit` | Temporary compatibility alias for `functional-audit`. |
| `place-audit` | `/place-audit:place-audit` | Is approved information in the right place and at the right prominence? |
| `content-audit` | `/content-audit:content-audit` | What information deserves to exist, once, and at what stage? |
| `flow-audit` | `/flow-audit:flow-audit` | Can users move from intent to understanding or completion without unnecessary steps or context loss? |
| `architecture-maintainability-audit` | `/architecture-maintainability-audit:architecture-maintainability-audit` | Can the system be changed safely without violating ownership or dependency boundaries? |

### `visual-audit`

Renders every route in a real browser, inventories computed styles against a
default-tier rubric (Tier 0 browser-default through Tier 3 crafted), reads the
screenshots at three distances, then ranks findings by visual impact and offers
to apply the top 20%, 50%, or all of them.

Its premise: "basic" is not a matter of taste, it is a decision nobody made. An
element that was decided and came out plain is finished — `KEEP` is a successful
finding.

Portable. It reads a project's own rules at runtime (`.cursorrules`, `CLAUDE.md`,
`AGENTS.md`, tokens, Tailwind config) rather than hardcoding a design language,
so it works in any repository unmodified.

Needs `playwright` as a dev dependency in the project being audited.

### `functional-audit` (`audit` remains a compatibility alias)

Fifteen instruments across a sixteen-step loop: gate, error capture, browser
drive, route crawl and control matrix, required states, accessibility (axe plus
manual), responsive/zoom/touch/RTL matrix, screenshot reading, UX heuristic
scorecard and cognitive walkthrough, measurement, visual regression, performance
probe, data layer against real rows, and deployed config.

Depth is user-controlled: quick pass, standard, or full. It always reports which
instruments it used **and which it skipped**, on the principle that an audit which
quietly skipped screenshots is worse than no audit.

The portable core no longer contains application-specific paths, database rules,
or deployment assumptions. Target repositories may provide
`audits/project-profile/` with verified harness, fixture, trap, data-check, and
deploy-check adapters. Historical Zeal material is retained under
`profiles/examples/zeal/` as non-runnable migration evidence, not as core policy.

### `content-audit`

Audits information architecture before layout. It inventories content blocks,
traces their provenance, detects semantic and cross-representation duplication,
defines a unique job for each view, and produces a minimum first-read plus a
progressive-disclosure plan.

Use it when a page feels overloaded or repetitive, or before redesigning an
information-dense reader or analytical interface. It deliberately leaves final
placement, visual polish, and functional correctness to the other audit skills.

### `flow-audit`

Models real user journeys as intent-led graphs and audits progress efficiency,
discoverability, context preservation, reversibility, branch clarity, cognitive
continuity, representation switching, premature complexity, repeated traversal,
and completion confidence.

Use it after content and placement responsibilities are known but before
first-principles redesign. It treats the current interface as evidence rather
than as the required workflow, exercises return paths and browser Back, and
separates novice/expert and sparse/mature behavior. Its output is a logical flow
contract, never a screen, tab, component, or layout specification.

## Installing

### In a repository (works in cloud sessions)

Cloud sessions do not read `~/.claude/skills/` from any machine, and plugins
enabled only in user settings do not transfer to them. A plugin has to be declared
in the repository itself to install at session start.

Add to the repo's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "auditing-skills": {
      "source": {
        "source": "github",
        "repo": "basabtan/aud",
        "ref": "main"
      }
    }
  },
  "enabledPlugins": {
    "aud@auditing-skills": true
  }
}
```

Commit that file. The plugin installs when the workspace is trusted.

### In a local session

```
/plugin marketplace add basabtan/aud
/plugin install aud@auditing-skills
```

### As a plain project skill

If the plugin route is more machinery than a project needs, copy the skill
directory straight into the repo instead:

```
cp -r plugins/visual-audit/skills/visual-audit <repo>/.claude/skills/
```

It then loads as `/visual-audit` with no marketplace involved. This is what
`concord` currently does.

## Layout

```
.claude-plugin/marketplace.json      marketplace manifest
plugins/<name>/
  .claude-plugin/plugin.json         plugin manifest
  skills/<name>/
    SKILL.md                         frontmatter name + description, then the method
    references/*.md                  loaded on demand, not on every trigger
    scripts/*                        deterministic work the model should not do by hand
```

## Adding a skill

1. Create `plugins/<name>/skills/<name>/SKILL.md` with `name` and `description`
   frontmatter. Set `name` explicitly — for marketplace-installed plugins the
   install directory is renamed on update, and the frontmatter name is what keeps
   the command stable.
2. Add `plugins/<name>/.claude-plugin/plugin.json` with at least `name`.
3. Add an entry to `.claude-plugin/marketplace.json`.
4. Put long reference material in `references/` rather than `SKILL.md`. A skill's
   body loads only when used, so reference files cost nothing until needed.
5. Write the `description` defensively against the skills already here. Auto-invocation
   is driven by the description, and `visual-audit` already claims broad territory
   including "design review" and "improve the design, visuals, styling, or look of a
   page". A new skill whose triggers overlap will lose and look broken.

## Why this repository exists

`visual-audit` was built inside a Claude Code cloud container and installed to
`~/.claude/skills/`. That path belongs to the container, the container was
reclaimed, and the skill was lost — the only surviving copy was a packaged file in
a chat attachment. `audit` was in the same position.

Skills are source code. They belong in version control.
