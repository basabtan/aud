# Persistent findings ledger

The canonical ledger is `<application-root>/audits/findings-ledger.jsonl`. Each
non-empty line is one `aud-finding-v1` record with a stable finding ID.

## Merge rules

1. Validate the existing ledger and incoming `findings.jsonl` before writing.
2. Reject duplicate IDs within either input.
3. Add new IDs without changing existing records.
4. For an existing ID, require an allowed lifecycle transition; preserve the
   union of evidence, task, persona, affected-area, and relationship references.
5. Preserve all ledger records absent from the incoming run. This is the rule
   that prevents a later audit from erasing unresolved work.
6. Require explicit `reopened` status before a verified or waived finding can
   become active again.
7. Keep status history and require its last entry to agree with current status.
8. Sort the snapshot by stable ID and replace it atomically only after the full
   merged snapshot validates.

Run the merge with:

```text
npm run merge:ledger -- <application-root>/audits/findings-ledger.jsonl <run>/findings.jsonl
```

The merge tool does not synthesize duplicates, assign priority, or infer that two
different IDs describe the same root cause. Those remain Phase 4 responsibilities.
