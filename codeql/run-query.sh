#!/usr/bin/env bash
#
# Run an inline CodeQL query against a project database.
#
# Usage:
#   codeql/run-query.sh <database> <query-text>
#
# Examples:
#   codeql/run-query.sh brogue-c 'import cpp
#   from Function f
#   where f.getName() = "attack" and f.hasDefinition()
#   select f.getFile().getRelativePath(), f.getLocation().getStartLine(), f.getName()'
#
#   codeql/run-query.sh rogue-ts 'import javascript
#   from Function f
#   where f.getName() = "buildCombatAttackContext"
#   select f.getFile().getRelativePath(), f.getLocation().getStartLine()'
#
# For committed query files, use codeql query run directly:
#   codeql query run --database=codeql/databases/brogue-c codeql/queries/c/find-callers.ql

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_DIR="$SCRIPT_DIR/databases"

if [ $# -lt 2 ]; then
  echo "Usage: codeql/run-query.sh <database> <query-text>" >&2
  echo "  database: brogue-c | rogue-ts" >&2
  exit 1
fi

DATABASE="$1"
QUERY_TEXT="$2"
DB_PATH="$DB_DIR/$DATABASE"

if [ ! -d "$DB_PATH" ]; then
  echo "Error: Database '$DATABASE' not found at $DB_PATH" >&2
  echo "Available databases:" >&2
  ls "$DB_DIR" 2>/dev/null || echo "  (none — run extraction commands from codeql/CONTEXT.md)" >&2
  exit 1
fi

PACK_DEP="codeql/cpp-all"
if [[ "$DATABASE" == *ts* ]] || [[ "$QUERY_TEXT" == *"import javascript"* ]]; then
  PACK_DEP="codeql/javascript-all"
fi

TMPDIR_Q="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_Q"' EXIT

cat > "$TMPDIR_Q/qlpack.yml" <<EOF
name: brogue-inline-query
version: 0.0.1
dependencies:
  $PACK_DEP: "*"
EOF

printf '%s' "$QUERY_TEXT" > "$TMPDIR_Q/query.ql"

codeql pack install "$TMPDIR_Q" >/dev/null 2>&1
codeql query run \
  --database="$DB_PATH" \
  --output="$TMPDIR_Q/result.bqrs" \
  "$TMPDIR_Q/query.ql" >/dev/null 2>&1

codeql bqrs decode --format=text "$TMPDIR_Q/result.bqrs"
