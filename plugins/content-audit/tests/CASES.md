# Content-audit classification cases

These cases are intended as regression checks for the reasoning method.

## Case 1 — summary + same summary in a callout
Expected: `PARAPHRASE_DUPLICATE`; one owner.

## Case 2 — source essay + claim matrix
If matrix exposes source differences across shared questions:
Expected: `TRANSFORMATIVE_REP`; both may survive, but not necessarily simultaneously.

## Case 3 — source essay + "fuller picture" that retells each source
Expected: `DERIVED_RESTATEMENT`; rewrite synthesis around cross-source findings or remove.

## Case 4 — claim inline + claim repeated in side rail + same claim in ledger
Expected: cluster as `CROSS_REP_DUPLICATE`. Keep canonical contextual occurrence;
use links or comparison-only representation elsewhere.

## Case 5 — citation marker inline + citation details on hover/drawer
Expected: `TRACEABILITY_REPEAT`; beneficial if the second surface provides verification
without repeating the full citation everywhere.

## Case 6 — editing controls visible to a reader
Expected: `ROLE_LEAKAGE`; `HIDE_BY_ROLE` or `MOVE_TO_AUTHORING_MODE`.

## Case 7 — source coverage dots on topic card and source tabs after opening topic
Expected: likely beneficial across stages. Card coverage can orient before opening;
inside the detail view, tabs become the canonical source-presence surface and the
coverage dots may be redundant.

## Case 8 — same conflict count in header and synthesis stats on the same reading surface
Expected: `METADATA_REPEAT`; one canonical location unless the later count changes scope.
