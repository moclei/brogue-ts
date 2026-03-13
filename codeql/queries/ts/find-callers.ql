/**
 * Find all call sites of a named TypeScript function.
 * Change funcName() below to target a different function.
 * For MCP use: substitute the name directly in codeql_run_query_text.
 *
 * Matches both direct calls (f()) and method calls (obj.f()).
 * Columns: file | line | enclosing function name
 */
import javascript

string funcName() { result = "buildCombatAttackContext" }

from CallExpr call
where call.getCallee().(Identifier).getName() = funcName()
   or call.getCallee().(DotExpr).getPropertyName() = funcName()
select call.getFile().getRelativePath(),
       call.getLocation().getStartLine(),
       call.getEnclosingFunction().getName()
