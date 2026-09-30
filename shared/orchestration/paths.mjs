import { existsSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

export function normalizePortablePath(value) {
  const source = String(value).replaceAll('\\', '/');
  const drive = source.match(/^([A-Za-z]:)(\/.*)?$/);
  const absolute = source.startsWith('/') || Boolean(drive);
  const prefix = drive ? `${drive[1].toUpperCase()}/` : absolute ? '/' : '';
  const body = drive ? (drive[2] ?? '/').slice(1) : absolute ? source.slice(1) : source;
  const segments = [];
  for (const segment of body.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length && segments.at(-1) !== '..') segments.pop();
      else if (!absolute) segments.push(segment);
    } else segments.push(segment);
  }
  return `${prefix}${segments.join('/')}` || (absolute ? prefix : '.');
}

function comparisonPath(value) {
  const normalized = normalizePortablePath(value).replace(/\/$/, '');
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}

export function isWithinPortable(parent, candidate) {
  const root = comparisonPath(parent);
  const target = comparisonPath(candidate);
  return target === root || target.startsWith(`${root}/`);
}

export function assertAuditArtifactPath(applicationRoot, candidate) {
  const auditRoot = resolve(applicationRoot, 'audits');
  const target = resolve(candidate);
  if (!isWithinPortable(auditRoot, target)) throw new Error(`MUTATION_PROHIBITED: audit output ${target} is outside ${auditRoot}`);
  return target;
}

export function canonicalRunDirectory(applicationRoot, date, type) {
  const auditRoot = resolve(applicationRoot, 'audits');
  for (let attempt = 1; attempt < 100; attempt += 1) {
    const suffix = attempt === 1 ? '' : `-${String(attempt).padStart(2, '0')}`;
    const candidate = join(auditRoot, `${date}-${type}${suffix}`);
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`RUN_DIRECTORY_EXHAUSTED: ${date}-${type}`);
}

export function portableRelative(from, to) {
  const left = normalizePortablePath(from);
  const right = normalizePortablePath(to);
  const leftDrive = left.match(/^([A-Za-z]:)\//)?.[1]?.toLowerCase();
  const rightDrive = right.match(/^([A-Za-z]:)\//)?.[1]?.toLowerCase();
  if (leftDrive || rightDrive) {
    if (leftDrive !== rightDrive) return right;
    const leftParts = left.slice(3).split('/').filter(Boolean);
    const rightParts = right.slice(3).split('/').filter(Boolean);
    while (leftParts.length && rightParts.length && leftParts[0].toLowerCase() === rightParts[0].toLowerCase()) {
      leftParts.shift();
      rightParts.shift();
    }
    return [...leftParts.map(() => '..'), ...rightParts].join('/') || '.';
  }
  if (isAbsolute(left) && isAbsolute(right)) return relative(left, right).replaceAll('\\', '/');
  const leftParts = left.split('/').filter(Boolean);
  const rightParts = right.split('/').filter(Boolean);
  while (leftParts.length && rightParts.length && leftParts[0] === rightParts[0]) {
    leftParts.shift();
    rightParts.shift();
  }
  return [...leftParts.map(() => '..'), ...rightParts].join('/') || '.';
}
