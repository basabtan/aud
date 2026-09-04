# Legacy repository traps

Validate every item against the target revision before treating it as current.

- `html { zoom }` can make `getBoundingClientRect()` disagree with layout and
  canvas dimensions.
- React Strict Mode mounts effects twice; cleanup must reset handles as well as
  cancel them.
- Immediate pointer capture can steal clicks from child controls.
- Row-level security historically required owner policies, public/anonymous
  revocation, authenticated grants, and complete backup-table registration.
- Queries against newly introduced tables should degrade safely before migration.
- A broad Netlify SPA fallback can answer data requests with HTML.
- CSS `text-transform` changes rendered `innerText` casing.
- Duplicate accessible button names need stable semantic disambiguation.
- Marker collision may intentionally hide elements; assert the collision state.
- Development harness requests may include documented benign 404s; keep the
  allowlist exact and target-owned.
