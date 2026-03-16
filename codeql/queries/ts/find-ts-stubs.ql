/**
 * Find stub arrow functions assigned as property values in object literals.
 *
 * Detects context builder slots that return trivial constant values, which may
 * indicate unimplemented wiring in rogue-ts/src/. Excludes rogue-ts/tests/.
 *
 * Stub patterns detected:
 *   () => false / () => true     — BooleanLiteral body
 *   () => null                   — NullLiteral body
 *   () => undefined              — Identifier body named "undefined"
 *   () => 0                      — NumberLiteral body with value "0"
 *   () => []                     — empty ArrayExpr body
 *   () => ({})                   — empty ObjectExpr body
 *   () => {}                     — empty BlockStmt body (no statements)
 *
 * Re-run via MCP:
 *   codeql_run_query_file  database: "rogue-ts"  query_path: "codeql/queries/ts/find-ts-stubs.ql"
 *
 * Or from the CLI (repo root):
 *   codeql query run --database=codeql/databases/rogue-ts codeql/queries/ts/find-ts-stubs.ql
 */
import javascript

/**
 * True when the arrow function has a stub-like body.
 */
predicate isStubArrow(ArrowFunctionExpr arrow) {
  // Empty block body: () => {}
  (
    arrow.getBody() instanceof BlockStmt and
    arrow.getBody().(BlockStmt).getNumStmt() = 0
  )
  or
  // Expression body returning a trivial constant
  (
    not arrow.getBody() instanceof BlockStmt and
    (
      arrow.getBody() instanceof BooleanLiteral
      or
      arrow.getBody() instanceof NullLiteral
      or
      arrow.getBody().(Identifier).getName() = "undefined"
      or
      arrow.getBody().(NumberLiteral).getValue() = "0"
      or
      (arrow.getBody() instanceof ArrayExpr and
       arrow.getBody().(ArrayExpr).getSize() = 0)
      or
      (arrow.getBody() instanceof ObjectExpr and
       arrow.getBody().(ObjectExpr).getNumProperty() = 0)
    )
  )
}

/**
 * Human-readable label for the stub body.
 */
string stubLabel(ArrowFunctionExpr arrow) {
  arrow.getBody() instanceof BlockStmt and result = "() => {}"
  or
  not arrow.getBody() instanceof BlockStmt and result = "() => " + arrow.getBody().toString()
}

from Property prop, ArrowFunctionExpr arrow
where
  prop.getInit() = arrow and
  prop.getParent() instanceof ObjectExpr and
  isStubArrow(arrow) and
  prop.getFile().getRelativePath().matches("src/%") and
  not prop.getFile().getRelativePath().matches("%test%")
select prop.getFile().getRelativePath() as file,
       prop.getLocation().getStartLine() as line,
       prop.getName() as property,
       stubLabel(arrow) as stub
order by file, line
