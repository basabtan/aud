# Data-check adapter required

The former portable core contained only a placeholder shell script that exited
with status 1. It was removed rather than represented as a working PostgreSQL or
Supabase adapter.

The target application must provide a safe, disposable database recipe and its
own negative authorization assertions before this instrument can run.
