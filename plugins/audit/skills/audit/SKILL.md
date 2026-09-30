---
name: audit
description: Temporary compatibility alias for functional-audit. Use when an existing workflow invokes audit for functional QA; delegate unchanged to functional-audit and preserve its report-only and structured-output behavior. Do not use for content, placement, flow, or visual redesign.
---

# `audit` compatibility alias

This command is deprecated. Delegate the complete request and arguments to the
canonical `functional-audit` skill. Do not add behavior, reinterpret scope, or
change output names in this alias.

The delegated run writes to
`<application-root>/audits/YYYY-MM-DD-functional/`, updates
`<application-root>/audits/latest.md`, consumes the same shared run and accepted
contracts, and emits the same schema-valid `evidence.jsonl`, `findings.jsonl`,
and `input-status.json` as `functional-audit`.

Pipeline mode is report-only. Never store product-specific audit results in the
repository that distributes this skill.
