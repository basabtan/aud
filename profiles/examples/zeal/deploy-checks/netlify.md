# Legacy Netlify check

The historical deployment served a nested build directory behind Netlify rules.
Runtime data paths needed explicit rules before the SPA catch-all or they could
receive HTML and fail JSON parsing.

The target-owned version of this adapter must name the current build directory,
base path, runtime endpoints, asset rules, and fallback order, then verify each
against the deployed environment.
