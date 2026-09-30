# Deterministic audit selection

After specialist selection, multi-specialist diagnose/redesign plans select a
Phase 4 synthesis stage depending on completed specialist findings, shared
evidence, and the persistent ledger. Specialist mode and single-specialist plans
skip synthesis explicitly.

The interface specialists are content, place, flow, visual, and functional.
Architecture/maintainability is a selective repository specialist. Every plan
records a disposition for all six.

| Requested aspect | Specialist selection |
|---|---|
| Broad product, UX, or empty scope | Five interface specialists |
| All scope | Five interface specialists plus architecture/maintainability |
| Content, information, duplication | Content |
| Placement or prominence | Place plus content when no current contract exists |
| Flow, journey, navigation | Flow plus content when no current contract exists |
| Visual, styling, hierarchy | Visual |
| Functional, behavior, runtime, performance | Functional |
| Accessibility | Functional and visual |
| Architecture, maintainability, coupling, dependencies | Architecture/maintainability |

High/critical security, privacy, correctness, or data-loss risk adds functional.
High/critical information density adds content, place, and flow. High/critical
visual/design risk adds visual.
High/critical architecture, maintainability, coupling, or technical-debt risk
adds architecture/maintainability. Security/privacy risk continues to add
functional only; Phase 7 does not claim a security specialist without a threat
model and data-classification foundation.

Redesign selects content, place, flow, and visual; functional is deferred until
implementation. Verify derives targeted re-audits from each selected remediation
and affected finding: content may select content/place/flow, flow selects flow/
functional, visual selects visual plus accessibility coverage, and functional
selects functional plus affected flows. It never reruns all specialists unless
full regression was explicitly requested. Specialist mode selects exactly the
named specialist.

Content is wave 1 when selected. Place and flow are in the same following wave.
Independent visual and functional work may share wave 1. A current accepted
content contract can satisfy the dependency without rerunning content.
