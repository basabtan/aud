# UX Heuristics and Walkthrough

Converts "looks right to me" into scored findings. Run after the screenshots exist
(SKILL.md step 8) and before the report.

## Severity scale

| Score | Meaning | Action |
|---|---|---|
| 0 | Not a problem | — |
| 1 | Cosmetic | Fix if already touching the file |
| 2 | Minor — slows or mildly confuses | Fix in this audit if local |
| 3 | Major — users will fail or abandon the task sometimes | Fix or escalate now |
| 4 | Critical — task impossible, data loss, leak, or blocks a core flow | Stop and fix |

Frequency multiplier: if the issue sits on a core path or every page, raise by 1
(cap at 4).

## Cognitive walkthrough

For each core task (the user names them; default to the three most-used flows),
list the steps. At each step answer four questions. Any "no" is a finding.

1. **Will the user know this action exists?** The control is visible on this
   screen without scrolling or hovering.
2. **Will they find it?** It sits where they'd look — near the thing it acts on,
   in the expected region (nav top/left, primary action bottom-right of a form).
3. **Will they recognize it as the right action?** Label names the outcome
   ("Save entry", not "Submit"); icon has a label; no two controls compete.
4. **Will they know it worked?** Feedback within 100 ms; the next screen or
   state confirms the result; errors say what to do next.

Record as: Task · Step · Question failed · Severity · Screenshot.

## Heuristic scorecard

Score each page 0–4 per heuristic. Anything ≥ 2 becomes a finding with the
specific screen, element, and fix.

| # | Heuristic | What to look for in this repo |
|---|---|---|
| 1 | Visibility of system status | Loading indicators, selected state on rail buttons, "saved" confirmation, globe rotation feedback |
| 2 | Match with the real world | Topic and source names in human form — never `isl-tafsir`; dates and coordinates formatted |
| 3 | User control and freedom | Undo or confirm on delete; Escape closes overlays; back returns to prior state |
| 4 | Consistency and standards | Same verb for the same action everywhere; same corner radius, spacing, and control height; nav in one place |
| 5 | Error prevention | Inline validation before submit; disabled submit until valid; destructive actions separated from common ones |
| 6 | Recognition over recall | Current filter visible, not remembered; breadcrumbs or page title; recently used items surfaced |
| 7 | Flexibility and efficiency | Keyboard shortcuts on frequent actions; bulk operations where lists exist |
| 8 | Aesthetic and minimalist design | One primary action per screen; no competing accents; dead space and crowding balanced |
| 9 | Help users recover from errors | Error text says what happened and what to do; input preserved after failure |
| 10 | Help and documentation | Empty states teach; first-use hints where a concept is non-obvious (contested placements) |

## Microcopy pass

Flag each:

- Labels that name the mechanism instead of the outcome ("Submit" → "Save entry")
- Jargon without a hover or inline definition
- Inconsistent verbs for one action ("Remove" / "Delete" / "Clear")
- Placeholder text used as the only label
- Errors in developer voice ("Request failed with status 500")
- Truncated text without a title or tooltip
- Title case and sentence case mixed in the same region

## Visual hierarchy checklist (per screenshot)

- Eye lands on the primary action or the content, not on chrome
- Three or fewer type sizes visible at once
- Filled inputs and placeholders are distinguishable at a glance
- Grouping by proximity matches grouping by meaning
- Selected and hovered states differ from rest state by more than color alone
- Nothing important is below the fold at 360×800

## Output

Append the scorecard and walkthrough findings to the report findings table with
Instrument = "Heuristic" or "Walkthrough".
