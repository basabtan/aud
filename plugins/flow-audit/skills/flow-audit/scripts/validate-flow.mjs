#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const inputArg = args.find(arg => !arg.startsWith('--'));
const outIndex = args.indexOf('--out');

if (!inputArg) {
  console.error('Usage: node validate-flow.mjs <journey-model.json> [--out analysis.json]');
  process.exit(2);
}

const inputPath = resolve(inputArg);
const outputPath = outIndex >= 0 && args[outIndex + 1] ? resolve(args[outIndex + 1]) : null;
const model = JSON.parse(readFileSync(inputPath, 'utf8'));
const issues = [];

function issue(level, code, subject, message) {
  issues.push({ level, code, subject, message });
}

function requireField(object, field, subject) {
  if (!(field in object) || object[field] === '' || object[field] === undefined) {
    issue('error', 'MISSING_FIELD', subject, `Missing required field: ${field}`);
  }
}

for (const field of ['version', 'persona', 'scope', 'contexts', 'nodes', 'edges', 'scenarios']) {
  requireField(model, field, 'model');
}

const nodes = Array.isArray(model.nodes) ? model.nodes : [];
const edges = Array.isArray(model.edges) ? model.edges : [];
const scenarios = Array.isArray(model.scenarios) ? model.scenarios : [];
const nodeMap = new Map();
const nodeFields = [
  'id', 'stage', 'userQuestion', 'userAction', 'systemResponse', 'resultingState',
  'contextRetained', 'contextLost', 'nextLikelyQuestion', 'branchingChoices',
  'returnPath', 'interactionCost', 'cognitiveCost', 'failureRisk',
];

for (const node of nodes) {
  const subject = `node:${node.id ?? '<unknown>'}`;
  for (const field of nodeFields) requireField(node, field, subject);
  if (node.id && nodeMap.has(node.id)) issue('error', 'DUPLICATE_NODE', subject, 'Node id is duplicated.');
  if (node.id) nodeMap.set(node.id, node);
  for (const field of ['contextRetained', 'contextLost', 'branchingChoices']) {
    if (field in node && !Array.isArray(node[field])) issue('error', 'INVALID_TYPE', subject, `${field} must be an array.`);
  }
  for (const field of ['interactionCost', 'cognitiveCost']) {
    if (field in node && (!Number.isInteger(node[field]) || node[field] < 0 || node[field] > 4)) {
      issue('error', 'INVALID_COST', subject, `${field} must be an integer from 0 to 4.`);
    }
  }
  if (node.failureRisk && (!Number.isInteger(node.failureRisk.level) || node.failureRisk.level < 0 || node.failureRisk.level > 4 || !node.failureRisk.reason)) {
    issue('error', 'INVALID_FAILURE_RISK', subject, 'failureRisk requires level 0..4 and a reason.');
  }
}

const allowedKinds = new Set(['forward', 'branch', 'return', 'direct', 'recovery']);
const adjacency = new Map(nodes.map(node => [node.id, []]));

for (const [index, edge] of edges.entries()) {
  const subject = `edge:${index}`;
  for (const field of ['from', 'to', 'trigger', 'kind', 'reversible', 'historyBehavior', 'contextDelta']) requireField(edge, field, subject);
  if (!nodeMap.has(edge.from)) issue('error', 'UNKNOWN_FROM', subject, `Unknown from node: ${edge.from}`);
  if (!nodeMap.has(edge.to)) issue('error', 'UNKNOWN_TO', subject, `Unknown to node: ${edge.to}`);
  if (!allowedKinds.has(edge.kind)) issue('error', 'INVALID_EDGE_KIND', subject, `Unsupported edge kind: ${edge.kind}`);
  if (typeof edge.reversible !== 'boolean') issue('error', 'INVALID_REVERSIBILITY', subject, 'reversible must be boolean.');
  if (!edge.contextDelta || !Array.isArray(edge.contextDelta.retained) || !Array.isArray(edge.contextDelta.lost)) {
    issue('error', 'INVALID_CONTEXT_DELTA', subject, 'contextDelta requires retained and lost arrays.');
  }
  if (adjacency.has(edge.from) && nodeMap.has(edge.to)) adjacency.get(edge.from).push(edge.to);
}

for (const node of nodes) {
  if (node.returnPath && !nodeMap.has(node.returnPath.target)) {
    issue('error', 'UNKNOWN_RETURN_TARGET', `node:${node.id}`, `Unknown return target: ${node.returnPath.target}`);
  }
  if (node.returnPath && !Array.isArray(node.returnPath.restores)) {
    issue('error', 'INVALID_RETURN_PATH', `node:${node.id}`, 'returnPath.restores must be an array.');
  }
}

const goalIds = new Set();
for (const scenario of scenarios) {
  const subject = `scenario:${scenario.id ?? '<unknown>'}`;
  for (const field of ['id', 'intent', 'variant', 'startNode', 'goalNodes', 'observedPath', 'shortestReasonablePath', 'completionSignal', 'evidence']) {
    requireField(scenario, field, subject);
  }
  if (!nodeMap.has(scenario.startNode)) issue('error', 'UNKNOWN_SCENARIO_START', subject, `Unknown start node: ${scenario.startNode}`);
  for (const field of ['goalNodes', 'observedPath', 'shortestReasonablePath', 'evidence']) {
    if (field in scenario && !Array.isArray(scenario[field])) issue('error', 'INVALID_TYPE', subject, `${field} must be an array.`);
  }
  for (const goal of scenario.goalNodes ?? []) {
    goalIds.add(goal);
    if (!nodeMap.has(goal)) issue('error', 'UNKNOWN_SCENARIO_GOAL', subject, `Unknown goal node: ${goal}`);
  }
  for (const pathName of ['observedPath', 'shortestReasonablePath']) {
    for (const id of scenario[pathName] ?? []) {
      if (!nodeMap.has(id)) issue('error', 'UNKNOWN_PATH_NODE', subject, `${pathName} contains unknown node: ${id}`);
    }
  }
}

const starts = scenarios.map(scenario => scenario.startNode).filter(id => nodeMap.has(id));
const reachable = new Set();
const queue = [...new Set(starts)];
while (queue.length) {
  const id = queue.shift();
  if (reachable.has(id)) continue;
  reachable.add(id);
  for (const next of adjacency.get(id) ?? []) if (!reachable.has(next)) queue.push(next);
}

for (const node of nodes) {
  if (!reachable.has(node.id)) issue('warning', 'UNREACHABLE_NODE', `node:${node.id}`, 'Node is unreachable from every scenario start.');
  if ((adjacency.get(node.id) ?? []).length === 0 && !goalIds.has(node.id)) {
    issue('warning', 'POTENTIAL_DEAD_END', `node:${node.id}`, 'Non-goal node has no outgoing transition.');
  }
  if (!node.returnPath && !goalIds.has(node.id)) {
    issue('warning', 'MISSING_RETURN_PATH', `node:${node.id}`, 'Non-goal node has no declared return path.');
  }
}

const cycles = [];
const visited = new Set();
const active = new Set();
const stack = [];

function walk(id) {
  visited.add(id);
  active.add(id);
  stack.push(id);
  for (const next of adjacency.get(id) ?? []) {
    if (!visited.has(next)) walk(next);
    else if (active.has(next)) {
      const start = stack.indexOf(next);
      const cycle = [...stack.slice(start), next];
      const signature = cycle.join('>');
      if (!cycles.some(item => item.join('>') === signature)) cycles.push(cycle);
    }
  }
  stack.pop();
  active.delete(id);
}

for (const id of nodeMap.keys()) if (!visited.has(id)) walk(id);
for (const cycle of cycles) issue('info', 'CYCLE_TO_REVIEW', cycle[0], `Cycle detected: ${cycle.join(' -> ')}`);

const analysis = {
  model: inputPath,
  valid: !issues.some(item => item.level === 'error'),
  summary: {
    nodes: nodes.length,
    edges: edges.length,
    scenarios: scenarios.length,
    reachableNodes: reachable.size,
    cycles: cycles.length,
    errors: issues.filter(item => item.level === 'error').length,
    warnings: issues.filter(item => item.level === 'warning').length,
  },
  cycles,
  issues,
};

const rendered = `${JSON.stringify(analysis, null, 2)}\n`;
if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rendered);
}
process.stdout.write(rendered);
if (!analysis.valid) process.exit(1);
