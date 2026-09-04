# Deterministic audit selection

After specialist selection, multi-specialist diagnose/redesign plans select a
Phase 4 synthesis stage depending on completed specialist findings, shared
evidence, and the persistent ledger. Specialist mode and single-specialist plans
skip synthesis explicitly.

The canonical specialists are content, place, flow, visual, and functional.
Every plan records one disposition for each.

| Requested aspect | Specialist selection |
|---|---|
| Broad, all, product, UX, or empty scope | All five |
| Content, information, duplication | Content |
| Placement or prominence | Place plus content when no current contract exists |
| Flow, journey, navigation | Flow plus content when no current contract exists |
| Visual, styling, hierarchy | Visual |
| Functional, behavior, runtime, performance | Functional |
| Accessibility | Functional and visual |

High/critical security, privacy, correctness, or data-loss risk adds functional.
High/critical information density adds content, place, and flow. High/critical
visual/design risk adds visual.

Redesign selects content, place, flow, and visual; functional is deferred until
implementation. Verify selects functional plus producing specialists for ledger
records in implemented, partial, failed, or reopened state, but only plans the
Phase 5 work. Specialist mode selects exactly the named specialist.

Content is wave 1 when selected. Place and flow are in the same following wave.
Independent visual and functional work may share wave 1. A current accepted
content contract can satisfy the dependency without rerunning content.
