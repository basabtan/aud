# Architecture audit boundaries

The architecture specialist owns structural change safety: dependency
direction, package/module responsibilities, coupling, ownership, public
interfaces, state ownership, change amplification, and the seams needed to test
or migrate structural changes.

It does not own:

- which product content should exist (`content-audit`);
- where information belongs (`place-audit`);
- user journey design (`flow-audit`);
- visual treatment (`visual-audit`);
- runtime behavior, accessibility, or performance execution
  (`functional-audit`);
- threat likelihood, exploitability, privacy law, or compliance decisions
  (a future security/privacy capability requiring explicit foundations).

An architecture finding may reinforce another specialist finding, but must not
overwrite it. For example, a shared state owner may be a root-cause hypothesis
for a flow symptom; preserve both facts and let synthesis record the
relationship. Security-sensitive structure should be described only as a
handoff with the observed boundary fact—not as a security verdict.

Recommendations describe a structural constraint or seam, not an implementation
patch. Priority remains synthesis-owned. Verification should use dependency
graph assertions, boundary/contract tests, focused build tests, or repository
inspection at a candidate revision.
