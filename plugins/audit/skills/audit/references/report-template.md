# Report Template

## Audit report — <feature> — <date>

**Depth**: quick / standard / full

**Instruments**

| Instrument | Used | Skipped — why |
|---|---|---|
| Gate (typecheck, lint, build) | | |
| Error capture | | |
| Browser drive | | |
| Route crawl | | |
| Control matrix | | |
| Required states | | |
| Accessibility (axe + manual) | | |
| Viewport matrix / zoom / touch / RTL | | |
| Screenshots read | | |
| Heuristic scorecard + walkthrough | | |
| Measurement | | |
| Visual regression | | |
| Performance probe | | |
| Data layer (pg-scratch, anon negative) | | |
| Deployed config | | |

**Findings**

| # | Issue | Page / element | Instrument | Sev | Status | Evidence |
|---|---|---|---|---|---|---|
| 1 | | | | | Fixed / Deferred / Out of scope | `shots/…png` or test name |

**Verification status**

- Tested and passing: …
- Looks right to me (screenshot only, no assertion): …
- Could not verify — and why: …

**Deferred / needs decision**

- Item, reason it's out of scope, suggested owner or next step.

---

## `audits/latest.md` functional summary

Update the Functional row to link the newest timestamped run. Under the table,
keep a compact carry-forward block so regressions and repeat offenders remain
visible without replacing the immutable run report.

```
## Functional carry-forward — 2026-08-22 — Atlas contested markers — full
Found: 9 (4 fixed, 3 deferred, 2 out of scope)
Repeat offenders: no-op rail buttons (3rd audit), overflow at 360 on /topics
Deferred carried forward: #5 routing of /zeal/data/* in netlify.toml
Baselines updated: atlas-360, atlas-1280
```

Before each new audit, read the current Functional run and its carry-forward
block: re-check every deferred item and every repeat offender first.
