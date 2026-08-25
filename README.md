# Auditing skills

Claude Code skills for auditing running interfaces, distributed as a plugin
marketplace.

Each skill is a different instrument pointed at the same running app. They are
designed to be complementary rather than redundant — run `visual-audit` first,
apply changes, then run `audit`, since restyling routinely breaks click targets,
focus order, overflow and pointer behaviour.

## Skills

| Plugin | Command | What it asks |
|---|---|---|
| `visual-audit` | `/visual-audit:visual-audit` | Did anyone decide how this should look? |
| `audit` | `/audit:audit` | Does this work, and is it good to use? |

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

### `audit`

Fifteen instruments across a sixteen-step loop: gate, error capture, browser
drive, route crawl and control matrix, required states, accessibility (axe plus
manual), responsive/zoom/touch/RTL matrix, screenshot reading, UX heuristic
scorecard and cognitive walkthrough, measurement, visual regression, performance
probe, data layer against real rows, and deployed config.

Depth is user-controlled: quick pass, standard, or full. It always reports which
instruments it used **and which it skipped**, on the principle that an audit which
quietly skipped screenshots is worse than no audit.

> **Not portable as-is.** This skill is coupled to the `zeal` repository. It names
> real paths, a real Supabase schema and table list, host deploy rules, and ten
> repo-specific traps that have each bitten once. Roughly half of each reference
> file is transferable method and half is repo fact.
>
> To reuse it elsewhere, keep the instrument table, depth levels, the sixteen-step
> loop, the severity scale, the walkthrough and scorecard, and the report template
> — and replace `references/repo-traps.md`, `scripts/pg-scratch.sh`, and the
> "make it drivable" section wholesale. Until that split is done, installing it in
> a non-`zeal` project will produce guidance that references files which do not
> exist.

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
        "repo": "basabtan/Auditing-skills",
        "ref": "main"
      }
    }
  },
  "enabledPlugins": {
    "visual-audit@auditing-skills": true
  }
}
```

Commit that file. The plugin installs when the workspace is trusted.

### In a local session

```
/plugin marketplace add basabtan/Auditing-skills
/plugin install visual-audit@auditing-skills
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
