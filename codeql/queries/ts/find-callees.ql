/**
 * Find all functions called by a named TypeScript function.
 * Change funcName() below to target a different function.
 * For MCP use: substitute the name directly in codeql_run_query_text.
 *
 * Matches both direct calls (f()) and method calls (obj.f()).
 * Columns: file | line | callee name
 */
import javascript

string funcName() { result = "buildCombatAttackContext" }

string calleeName(CallExpr call) {
  result = call.getCallee().(Identifier).getName()
  or
  result = call.getCallee().(DotExpr).getPropertyName()
}

from Function caller, CallExpr call
where caller.getName() = funcName()
  and call.getEnclosingFunction() = caller
select call.getFile().getRelativePath(),
       call.getLocation().getStartLine(),
       calleeName(call)
