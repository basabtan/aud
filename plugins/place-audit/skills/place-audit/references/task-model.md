# Task model and blind demand protocol

The task model is human-owned. Every task has provenance and evidence strength;
Claude may score relevance but must not invent goals.

## Schema

```json
{
  "persona": { "id": "operator", "role": "line operator", "experience": "expert" },
  "stages": [
    { "id": "orient", "goal": "understand current operating position" }
  ],
  "tasks": [
    {
      "id": "T1",
      "stage": "orient",
      "verb": "identify",
      "object": "the line requiring intervention",
      "successCriterion": "line and cause are located",
      "frequency": 0.9,
      "criticality": 0.8,
      "timeSensitivity": 0.7,
      "userCoverage": 0.9,
      "requiredInformation": ["current status", "downtime", "cause"],
      "source": "designer walkthrough",
      "evidenceStrength": 0.6
    }
  ]
}
```

Weights and `evidenceStrength` are `0..1`. Select one persona and one stage per
MVP run. Hash the normalized JSON and record the hash in the report.

## Elicitation script

When no model exists, ask in this order:

1. Who is the persona, and are they novice or expert?
2. What are the three to five stages of their journey on this page?
3. In the selected stage, what must they do (verb + object)?
4. What observable result means each task succeeded?
5. Which information is required for that task?
6. For each task, rate frequency, criticality, time sensitivity, and user
   coverage from 0 to 1.
7. What evidence supports this task definition?

Store elicited models at `place-audit/task-model.json`. Use
`source: "session elicitation"` and `evidenceStrength: 0.5`; do not upgrade the
evidence because an answer sounds confident.

## Demand weight

`W_t = 0.40*Criticality + 0.25*Frequency + 0.20*UserCoverage +
0.15*TimeSensitivity`

Claude supplies only ordinal relevance `0..4`, mapped to
`r ∈ {0, .25, .5, .75, 1}`. Aggregate tasks with:

`D = 100 * (1 - product_t(1 - W_t*r_t))`

Necessity is separate: `Must`, `Should`, `Nice`, or `Noise`. A rare warning can
be Must because safety/correctness establishes a criticality floor.

## Rubric — use verbatim

> Evaluate only against the declared tasks. Never invent another user goal or
> requirement. Ignore the item's current position, size, color, and styling.
> 0 None — no declared task uses this information.
> 1 Contextual — may help orientation; not needed for progress.
> 2 Useful — directly helps a declared task; task executable without it.
> 3 Required — directly needed for an important/frequent task; absence causes
> significant searching, delay, or error risk.
> 4 Indispensable — the task cannot be completed correctly/safely without it.
> Return only: score, task IDs, necessity class, confidence, one-line reason
> grounded exclusively in task-model fields. No task ID = score 0.

## Variance protections

1. Strip position, style, access, prominence, FIT, screenshots, and opinion.
2. Use only ordinal 0–4.
3. Require task IDs for nonzero scores.
4. Score uncertain items twice more; retain median and dispersion.
5. Pairwise-rank borderline items in A/B and B/A order.
6. Include obvious-noise and obvious-must calibration atoms; drift invalidates
   and reruns the batch.

Record model id/version, prompt version, task-model hash, shuffled batch order,
run number, raw scores, median, confidence, and dispersion.
