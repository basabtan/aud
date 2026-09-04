import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { assertValidRecord } from '../validators/schema-registry.mjs';
import { canonicalJson, stableId } from '../validators/stable-ids.mjs';

function sorted(values = []) {
  return [...new Set(values)].sort();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileHash(path) {
  return path && existsSync(path) ? sha256(readFileSync(path)) : null;
}

export function captureBaseline(projectRevision, capture = {}) {
  const descriptor = {
    project_revision: projectRevision,
    routes: sorted(capture.routes),
    states: sorted(capture.states),
    fixtures: sorted(capture.fixtures),
    viewports: sorted(capture.viewports),
    environment: capture.environment ?? {},
  };
  return { descriptor, signature: sha256(canonicalJson(descriptor)) };
}

function artifactFingerprint(artifact) {
  return canonicalJson({
    key: artifact.key,
    type: artifact.type,
    artifact_ref: artifact.artifact_ref,
    route: artifact.route ?? null,
    state: artifact.state ?? null,
    fixture: artifact.fixture ?? null,
    viewport: artifact.viewport ?? null,
    hash: artifact.hash ?? null,
  });
}

function normalizeArtifact(raw, baselineSignature, createdAt) {
  const hash = raw.hash ?? fileHash(raw.local_path);
  const artifact = {
    key: raw.key,
    evidence_id: '',
    type: raw.type,
    artifact_ref: raw.artifact_ref,
    exact_observation: raw.exact_observation,
    strength: raw.strength ?? 'direct',
    producer: raw.producer ?? 'aud',
    route: raw.route ?? null,
    state: raw.state ?? null,
    fixture: raw.fixture ?? null,
    viewport: raw.viewport ?? null,
    captured_at: raw.captured_at ?? createdAt,
    hash,
    reused: false,
  };
  artifact.evidence_id = stableId('EV', baselineSignature, JSON.parse(artifactFingerprint(artifact)));
  return artifact;
}

export function buildCaptureManifest({ runId, projectRevision, createdAt, capture = {}, previous = null }) {
  const baseline = captureBaseline(projectRevision, capture);
  let reusable = false;
  if (previous) {
    const validation = assertValidRecord(previous, 'capture-manifest');
    reusable = validation.project_revision === projectRevision && validation.baseline_signature === baseline.signature;
  }
  const priorByKey = new Map(reusable ? previous.artifacts.map(item => [item.key, item]) : []);
  const artifacts = [];
  const suppliedKeys = new Set();
  for (const raw of capture.artifacts ?? []) {
    if (suppliedKeys.has(raw.key)) throw new Error(`DUPLICATE_CAPTURE_KEY: ${raw.key}`);
    suppliedKeys.add(raw.key);
    const candidate = normalizeArtifact(raw, baseline.signature, createdAt);
    const prior = priorByKey.get(raw.key);
    if (prior && artifactFingerprint(prior) === artifactFingerprint(candidate)) {
      artifacts.push({ ...prior, reused: true });
      priorByKey.delete(raw.key);
    } else artifacts.push(candidate);
  }
  for (const prior of priorByKey.values()) artifacts.push({ ...prior, reused: true });
  artifacts.sort((left, right) => left.key.localeCompare(right.key));
  const available = new Set(artifacts.map(item => item.key));
  const captureNeeded = sorted(capture.required_artifact_keys).filter(key => !available.has(key));
  const manifest = {
    schema_version: 'aud-capture-manifest-v1',
    capture_id: stableId('CAP', runId, { baseline_signature: baseline.signature }),
    run_id: runId,
    project_revision: projectRevision,
    created_at: createdAt,
    baseline_signature: baseline.signature,
    routes: baseline.descriptor.routes,
    states: baseline.descriptor.states,
    fixtures: baseline.descriptor.fixtures,
    viewports: baseline.descriptor.viewports,
    environment: baseline.descriptor.environment,
    artifacts,
    reused_evidence_refs: artifacts.filter(item => item.reused).map(item => item.evidence_id),
    capture_needed: captureNeeded,
    status: captureNeeded.length ? (artifacts.length ? 'degraded' : 'planned') : 'complete',
  };
  assertValidRecord(manifest, 'capture-manifest');
  return manifest;
}

const evidenceType = Object.freeze({
  browser_error: 'observation',
  network_error: 'observation',
  page_error: 'observation',
  environment: 'observation',
});

export function captureEvidenceRecords(manifest) {
  assertValidRecord(manifest, 'capture-manifest');
  return manifest.artifacts.map(artifact => {
    const evidence = {
      schema_version: 'aud-evidence-v1',
      id: artifact.evidence_id,
      run_id: manifest.run_id,
      type: evidenceType[artifact.type] ?? artifact.type,
      artifact_ref: artifact.artifact_ref,
      exact_observation: artifact.exact_observation,
      provenance: {
        source: `capture-manifest:${manifest.capture_id}`,
        captured_by: artifact.producer,
        source_revision: manifest.project_revision,
      },
      strength: artifact.strength,
      environment: manifest.environment,
      route: artifact.route,
      state: artifact.state,
      viewport: artifact.viewport,
      data_fixture: artifact.fixture,
      timestamp: artifact.captured_at,
      hash: artifact.hash,
    };
    assertValidRecord(evidence, 'evidence');
    return evidence;
  });
}
