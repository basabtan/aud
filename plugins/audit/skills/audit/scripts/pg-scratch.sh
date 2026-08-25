#!/usr/bin/env bash
# REPLACE THIS FILE with your existing scripts/pg-scratch.sh
# (throwaway Postgres, Supabase stubs for auth.jwt() and anon/authenticated roles,
#  applies zeal/supabase/migrations/*.sql in order; 009_backup_bucket.sql is expected to fail).
#
# Addition for the anon negative test — append after migrations are applied:
#
#   psql "$DB" -c "SET ROLE anon;" -c "SELECT count(*) FROM <table>;"   # must be 0 for every table in ZEAL_TABLES
echo "Replace with existing pg-scratch.sh" >&2; exit 1
