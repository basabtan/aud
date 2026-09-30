function escape(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function renderSynthesisReport(synthesis) {
  const highImpact = synthesis.clusters
    .filter(cluster => cluster.finding_refs.length > 1 || cluster.root_cause_confidence.score >= 0.7)
    .slice(0, 10);
  const contradictions = synthesis.contradictions.length
    ? synthesis.contradictions.map(item => `- **${item.contradiction_id}** (${item.conflict_type}, ${item.resolution.status}): ${item.claims.map(claim => `${claim.finding_id} — ${escape(claim.claim)}`).join(' ↔ ')}`).join('\n')
    : '- None recorded.';
  const clusters = synthesis.clusters.map(cluster => {
    const cause = cluster.inferred_root_cause
      ? `${escape(cluster.inferred_root_cause.statement)} (${cluster.inferred_root_cause.provisional ? 'provisional' : 'supported'}, confidence ${cluster.root_cause_confidence.score})`
      : 'No root cause inferred.';
    return `### ${cluster.cluster_id}\n\n- Representative: \`${cluster.representative_finding_id}\`\n- Findings: ${cluster.finding_refs.map(id => `\`${id}\``).join(', ')}\n- Specialists: ${cluster.specialist_coverage.join(', ')}\n- Root cause: ${cause}\n- Evidence: ${cluster.supporting_evidence_refs.map(id => `\`${id}\``).join(', ') || 'none supplied'}`;
  }).join('\n\n');
  const reinforcing = synthesis.relationships.filter(item => item.type === 'reinforces');
  return `# AUD synthesis report\n\nSynthesis ID: \`${synthesis.synthesis_id}\`  \nRun: \`${synthesis.run_id}\`  \nRevision: \`${synthesis.project_revision}\`  \nStatus: ${synthesis.degraded ? 'degraded' : 'complete'}\n\n## Executive system diagnosis\n\n${synthesis.source_finding_refs.length} source findings were preserved as ${synthesis.canonical_findings.length} canonical issues and ${synthesis.clusters.length} traceable issue clusters. ${synthesis.contradictions.length} contradiction(s) remain visible. This report is analysis only and does not verify or close findings.\n\n## Highest-impact issues\n\n${highImpact.length ? highImpact.map(cluster => `- **${cluster.cluster_id}** — ${escape(cluster.observed_symptoms[0].claim)} (${cluster.finding_refs.length} source finding(s))`).join('\n') : '- No multi-finding or high-confidence cluster was established.'}\n\n## Root-cause clusters\n\n${clusters}\n\n## Reinforcing findings\n\n${reinforcing.length ? reinforcing.map(item => `- \`${item.source_finding_id}\` → \`${item.target_id}\`: ${escape(item.rationale)}`).join('\n') : '- None recorded.'}\n\n## Contradictions and unresolved questions\n\n${contradictions}\n\n## Coverage limitations\n\n${synthesis.coverage_limitations.length ? synthesis.coverage_limitations.map(item => `- ${escape(item)}`).join('\n') : '- None recorded.'}\n\n## Evidence limitations\n\n${synthesis.evidence_limitations.length ? synthesis.evidence_limitations.map(item => `- ${escape(item)}`).join('\n') : '- None recorded.'}\n\n## Deferred findings\n\n${synthesis.deferred_finding_refs.length ? synthesis.deferred_finding_refs.map(id => `- \`${id}\``).join('\n') : '- None.'}\n`;
}

export function renderRemediationReport(plan) {
  const byId = new Map(plan.items.map(item => [item.remediation_id, item]));
  const waves = plan.waves.map(wave => {
    const rows = wave.remediation_refs.map(id => {
      const item = byId.get(id);
      return `| \`${id}\` | ${escape(item.title)} | ${item.action_type} | ${item.priority.band} / ${item.priority.level} | ${item.parallel_ready ? 'yes' : 'no'} |`;
    });
    return `### Wave ${wave.wave}\n\nParallel-ready: ${wave.parallel_ready ? 'yes' : 'no'}\n\n| ID | Item | Action | Priority | Parallel-ready |\n|---|---|---|---|---|\n${rows.join('\n')}`;
  }).join('\n\n');
  const details = plan.items.map(item => `### ${item.remediation_id} — ${escape(item.title)}\n\n- Status: ${item.status}\n- Priority: ${item.priority.band} / ${item.priority.level} — ${escape(item.priority.rationale)}\n- Action type: ${item.action_type}\n- Problem: ${escape(item.problem_statement)}\n- Recommended action: ${escape(item.recommended_action)}\n- Expected outcome: ${escape(item.expected_outcome)}\n- Findings: ${item.finding_refs.map(id => `\`${id}\``).join(', ')}\n- Prerequisites: ${item.dependencies.map(id => `\`${id}\``).join(', ') || 'none'}\n- Blocks: ${item.blockers.map(id => `\`${id}\``).join(', ') || 'none'}\n- Owner capability: ${escape(item.owner_capability)}\n- Implementation risk: ${item.implementation_risk.level} — ${escape(item.implementation_risk.rationale)}\n- Acceptance criteria:\n${item.acceptance_criteria.map(criterion => `  - \`${criterion.id}\`: ${escape(criterion.statement)}`).join('\n')}\n- Verification requirements:\n${item.verification_method.map(method => `  - ${escape(method.instrument)}: ${escape(method.procedure)}`).join('\n')}`).join('\n\n');
  const cycles = plan.cycle_detection.detected
    ? plan.cycle_detection.cycles.map(cycle => `- ${cycle.map(id => `\`${id}\``).join(' → ')}`).join('\n')
    : '- None.';
  const decisions = plan.human_decisions.length
    ? plan.human_decisions.map(item => `- **${item.decision_id}**: ${escape(item.question)}`).join('\n')
    : '- None.';
  return `# AUD remediation plan\n\nPlan ID: \`${plan.plan_id}\`  \nSynthesis: \`${plan.synthesis_id}\`  \nRevision: \`${plan.project_revision}\`\n\n> Analysis and planning only. This plan does not authorize implementation or mark findings verified.\n\n## Ordered implementation waves\n\n${waves || 'No valid wave can be produced until dependency cycles are resolved.'}\n\n## Dependency cycles\n\n${cycles}\n\n## Human decisions\n\n${decisions}\n\n## Remediation items\n\n${details}\n\n## Explicitly deferred or accepted risks\n\n${plan.items.filter(item => ['deferred', 'risk_accepted'].includes(item.status)).map(item => `- \`${item.remediation_id}\` — ${escape(item.title)}`).join('\n') || '- None.'}\n`;
}
