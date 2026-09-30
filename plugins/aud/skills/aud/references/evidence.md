# Shared evidence baseline

The baseline signature hashes the repository revision and sorted routes, named
states, fixtures, viewports, and environment metadata. Evidence reuse requires
an exact baseline signature and matching artifact fingerprint.

The capture manifest indexes:

- fixture and environment metadata
- screenshots and optional traces
- console/browser/page/network failures
- repository observations, measurements, and tests
- route, state, viewport, timestamp, hash, producer, and evidence strength

An evidence ID is stable for the same baseline and artifact identity. Reused
artifacts retain their evidence IDs and are listed in `reused_evidence_refs`.
Missing required artifact keys remain in `capture_needed` and make the baseline
degraded or planned rather than silently complete.

A revision mismatch forbids reuse. Scope, state, fixture, viewport, or
environment change creates a different baseline signature and new evidence IDs.
