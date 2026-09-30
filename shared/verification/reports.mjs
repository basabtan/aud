function escape(value) { return String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' '); }

export function renderVerificationReport(summary, results) {
  const rows = results.results.map(item => `| \`${item.case_id}\` | \`${item.finding_id}\` | ${item.outcome} | ${escape(item.comparison)} | ${item.lifecycle_transition.applied ? item.lifecycle_transition.requested_status : 'unchanged'} | ${escape(item.rationale)} |`);
  const transitions = summary.transitions.map(item => `| \`${item.finding_id}\` | ${item.from} | ${item.requested ?? 'none'} | ${item.applied ? 'applied' : 'rejected/not applicable'} | ${escape(item.reason)} |`);
  return `# Remediation verification report

Generated: ${summary.generated_at}
Verification plan: \`${summary.verification_plan_id}\`

## Outcome summary

| Passed | Partial | Failed | Blocked | Inconclusive | Not run |
|---:|---:|---:|---:|---:|---:|
| ${summary.counts.passed} | ${summary.counts.partially_passed} | ${summary.counts.failed} | ${summary.counts.blocked} | ${summary.counts.inconclusive} | ${summary.counts.not_run} |

## Cases

| Case | Finding | Outcome | Baseline comparison | Lifecycle | Rationale |
|---|---|---|---|---|---|
${rows.length ? rows.join('\n') : '| — | — | — | — | — | No cases |'}

## Newly introduced regressions

${summary.new_regression_finding_refs.length ? summary.new_regression_finding_refs.map(id => `- \`${id}\``).join('\n') : '- None recorded.'}

## Lifecycle transitions

| Finding | From | Requested | Decision | Reason |
|---|---|---|---|---|
${transitions.length ? transitions.join('\n') : '| — | — | — | — | No transitions requested. |'}

## Remaining risk

${summary.remaining_risk.length ? summary.remaining_risk.map(item => `- ${escape(item)}`).join('\n') : '- None established by executed verification.'}

## Required follow-up

${summary.required_follow_up.length ? summary.required_follow_up.map(item => `- ${escape(item)}`).join('\n') : '- None.'}
`;
}

export function renderRegressionReport(summary, regressions) {
  const rows = regressions.results.map(item => `| \`${item.regression_id}\` | \`${item.case_id}\` | ${item.classification} | ${item.outcome} | ${item.comparison} | ${item.new_finding_id ? `\`${item.new_finding_id}\`` : '—'} | ${escape(item.rationale)} |`);
  return `# Targeted regression report

Generated: ${summary.generated_at}
Regression set: \`${regressions.regression_set_id}\`

| Regression | Case | Classification | Outcome | Comparison | New finding | Rationale |
|---|---|---|---|---|---|---|
${rows.length ? rows.join('\n') : '| — | — | — | — | — | — | No regression observations supplied; untested scope is not a pass. |'}

New regression findings: ${summary.new_regression_finding_refs.length ? summary.new_regression_finding_refs.map(id => `\`${id}\``).join(', ') : 'none'}.
`;
}
