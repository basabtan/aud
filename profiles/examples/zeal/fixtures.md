# Legacy fixture notes

The historical functional audit expected realistic application-shaped rows plus
`empty`, `single`, `large`, `longStrings`, `rtl`, and `unicode` variants. Write
flows used an injected, non-destructive API.

The target repository must own the fixture implementation and must pass fixtures
through the same derivation functions used in production.
