# Flow model

Model the journey as intent-led nodes and transitions. The graph records what
the user is trying to answer and what state survives; it does not prescribe
screens or layout.

## JSON topology

```json
{
  "version": "1.0",
  "persona": { "id": "research-reader", "experience": "novice|expert|mixed" },
  "scope": ["topic browsing", "comparison", "verification"],
  "contexts": ["topic", "filter", "facet", "source", "claim", "scroll-anchor"],
  "nodes": [],
  "edges": [],
  "scenarios": []
}
```

## Node

Every node requires:

```json
{
  "id": "compare-topic",
  "stage": "compare",
  "userQuestion": "How do the traditions differ?",
  "userAction": "Open comparison for the selected topic",
  "systemResponse": "Show aligned answers and explicit gaps",
  "resultingState": "Topic comparison with the triggering facet retained",
  "contextRetained": ["topic", "filters", "facet"],
  "contextLost": [],
  "nextLikelyQuestion": "What supports this difference?",
  "branchingChoices": ["inspect-source", "verify-claim", "return-overview"],
  "returnPath": {
    "target": "topic-overview",
    "method": "browser-back-or-equivalent",
    "restores": ["topic", "filters", "scroll-anchor"]
  },
  "interactionCost": 1,
  "cognitiveCost": 1,
  "failureRisk": { "level": 1, "reason": "Comparison is optional" }
}
```

`returnPath` may be `null` only for a terminal completion state or an observed
dead end. Do not use empty strings as unknown values; use `null` and record the
evidence limit.

### Interaction cost

- `0` — no action; answer already available
- `1` — one direct, recognizable action
- `2` — two deliberate actions or one disclosure plus selection
- `3` — multi-step navigation, search, or manual recovery
- `4` — repeated backtracking, re-entry, or abandonment-prone path

### Cognitive cost

- `0` — same question and context; no reconstruction
- `1` — small representation shift with anchors preserved
- `2` — some selection or relationship must be remembered
- `3` — topic/source/facet position must be reconstructed
- `4` — mental model resets or prior work becomes unusable

### Failure risk

Use `0..4`: none, low, moderate, major, blocking. State the concrete failure,
not a generic label.

## Edge

```json
{
  "from": "compare-topic",
  "to": "verify-claim",
  "trigger": "Inspect evidence for selected claim",
  "kind": "branch",
  "reversible": true,
  "historyBehavior": "pushes an addressable state; Back restores comparison",
  "contextDelta": {
    "retained": ["topic", "facet", "claim", "filters", "scroll-anchor"],
    "lost": []
  }
}
```

Allowed `kind` values: `forward`, `branch`, `return`, `direct`, `recovery`.

An edge is reversible only when observation proves the user can return with the
relevant context restored. A visible Back control is not proof.

## Scenario

```json
{
  "id": "verify-from-compare",
  "intent": "Where does this difference come from?",
  "variant": "novice|expert|sparse|mature|baseline",
  "startNode": "compare-topic",
  "goalNodes": ["evidence-understood"],
  "observedPath": ["compare-topic", "verify-claim", "evidence-understood"],
  "shortestReasonablePath": ["compare-topic", "evidence-understood"],
  "completionSignal": "Citation, passage, provenance, and strength are understood",
  "evidence": ["browser observation 2026-08-27"]
}
```

## Context ledger

Track context explicitly across transitions:

| Context | Examples | Loss symptom |
|---|---|---|
| Intent | quick answer, compare, verify | destination answers a different question |
| Topic | selected topic | user must locate/reopen it |
| Collection/filter | source family, collection | browse position changes on return |
| Comparison | selected facet, row, POVs | user must rediscover the difference |
| Source | selected tradition/source | destination defaults elsewhere |
| Evidence | triggering claim/citation | evidence opens without claim linkage |
| Spatial | scroll anchor, expanded item | return starts at top or closes context |
| History | addressable state | reload/share/Back cannot reproduce state |

Context may be deliberately discarded only when the new intent supersedes it;
record that decision.

## Structural validation

Run:

```bash
node scripts/validate-flow.mjs flow-audit/journey-model.json \
  --out flow-audit/evidence/graph-analysis.json
```

The validator checks required fields, references, reachability, terminal states,
return paths, explicit context loss, scenario paths, and cycles. Its warnings are
evidence prompts, not automatic UX verdicts.
