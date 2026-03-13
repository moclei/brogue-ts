/**
 * Find all functions called by a named C function.
 * Change funcName() below to target a different function.
 * For MCP use: substitute the name directly in codeql_run_query_text.
 *
 * Columns: callee name | file | line
 */
import cpp

string funcName() { result = "attack" }

from Function caller, FunctionCall call
where caller.getName() = funcName()
  and call.getEnclosingFunction() = caller
select call.getTarget().getName(),
       call.getFile().getRelativePath(),
       call.getLocation().getStartLine()
