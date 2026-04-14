#!/usr/bin/env bash
#
# Generate the C function manifest from CodeQL queries.
# Output: docs/analysis/c-manifest.json
#
# Requires: codeql on PATH, codeql/databases/brogue-c extracted.
# Run from repo root: tools/analysis/generate-c-manifest.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="$REPO_ROOT/docs/analysis"
RUNNER="$REPO_ROOT/codeql/run-query.sh"
MERGER="$SCRIPT_DIR/merge-codeql-results.mjs"

mkdir -p "$OUT_DIR"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[1/3] Querying all functions (definition, location, return type)..."
"$RUNNER" brogue-c 'import cpp

from Function f
where f.hasDefinition()
  and f.getFile().getRelativePath().matches("src/brogue/%")
select f.getName() as name,
       f.getFile().getRelativePath() as file,
       f.getLocation().getStartLine() as startLine,
       f.getLocation().getEndLine() as endLine,
       f.getNumberOfParameters() as paramCount,
       f.getType().toString() as returnType
order by file, startLine' > "$TMP/functions.txt"

echo "[2/3] Querying call graph edges..."
"$RUNNER" brogue-c 'import cpp

from FunctionCall call, Function caller, Function callee
where caller.hasDefinition()
  and caller.getFile().getRelativePath().matches("src/brogue/%")
  and call.getEnclosingFunction() = caller
  and callee = call.getTarget()
  and callee.hasDefinition()
  and callee.getFile().getRelativePath().matches("src/brogue/%")
select caller.getName() as callerName, callee.getName() as calleeName
order by callerName, calleeName' > "$TMP/callgraph.txt"

echo "[3/3] Querying parameter signatures..."
"$RUNNER" brogue-c 'import cpp

from Function f, Parameter p
where f.hasDefinition()
  and f.getFile().getRelativePath().matches("src/brogue/%")
  and p = f.getAParameter()
select f.getName() as func,
       p.getIndex() as paramIndex,
       p.getName() as paramName,
       p.getType().toString() as paramType
order by func, paramIndex' > "$TMP/params.txt"

echo "Merging results..."
node "$MERGER" "$TMP/functions.txt" "$TMP/callgraph.txt" "$TMP/params.txt" "$OUT_DIR/c-manifest.json"

FUNC_COUNT=$(node -e "const m=JSON.parse(require('fs').readFileSync('$OUT_DIR/c-manifest.json','utf8')); console.log(m.stats.totalFunctions)")
EDGE_COUNT=$(node -e "const m=JSON.parse(require('fs').readFileSync('$OUT_DIR/c-manifest.json','utf8')); console.log(m.stats.totalCallEdges)")
echo "Done: $FUNC_COUNT functions, $EDGE_COUNT call edges -> $OUT_DIR/c-manifest.json"
