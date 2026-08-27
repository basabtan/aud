# Observation protocol

## Evidence labels

Label every claim with one of:

- `OBSERVED_LIVE` — exercised in the live interface
- `OBSERVED_FIXTURE` — exercised in a schema-faithful fixture
- `INFERRED_REPOSITORY` — derived from routes, components, or state code
- `INFERRED_DATA` — derived from live/read-only data shape
- `UPSTREAM_AUDIT` — inherited from content/place evidence
- `RECOMMENDED` — logical flow contract, not current behavior
- `DEFERRED` — not exercised, with reason

Do not upgrade inference to observation.

## Before each trace

Record:

- scenario and active user question
- starting URL/state
- topic, source, facet/row, claim, filters, scroll anchor
- novice/expert and sparse/mature variant
- expected completion signal

## During each transition

Record:

1. visible trigger and its wording
2. whether the trigger predicts the destination
3. URL/history change
4. system response and useful progress
5. context retained/lost
6. next likely question and available branches
7. interaction cost and cognitive cost
8. loading, empty, error, or role-gated state

Inspect the least expensive evidence that proves each point. DOM/semantic state
is usually enough for discoverability and content; screenshots help with spatial
orientation; repository state explains history and persistence but does not
replace observed behavior.

## Return-path test

At a drill-down destination:

1. use the interface-provided return action, if any;
2. verify exact topic, filter, selected row/facet, expansion, and scroll anchor;
3. repeat with browser Back when the transition changed addressable state;
4. reload or deep-link only when shareability/direct entry is in scope;
5. record any divergence between the two return methods.

Do not call a return path successful when it reaches the right route but resets
the user's conceptual position.

## Sparse-state distinctions

Keep these separate:

- `N/A` — the perspective genuinely has no answer in the domain
- `NOT_RESEARCHED` — research has not been entered/reviewed
- `UNAVAILABLE` — data failed to load or access is blocked
- `NO_CONSENSUS` — several answers exist without a defensible synthesis

Only domain evidence can justify `N/A`. Empty database rows cannot.

## Expert path

Test direct URLs, search, deep links, and shortcuts that are actually exposed.
An expert shortcut is valid when it reaches the goal without requiring the
introductory path and remains understandable on arrival.

## Evidence minimum for `standard`

- topic-browsing start
- opened topic
- comparison
- one source investigation path
- one evidence path
- one exercised return path
- one sparse topic
- one mature/contested topic
- novice and expert traces
- explicit list of untested behaviors
