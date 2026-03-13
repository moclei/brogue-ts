/**
 * Find all call sites of a named C function.
 * Change funcName() below to target a different function.
 * For MCP use: substitute the name directly in codeql_run_query_text.
 *
 * Columns: caller function name | file | line
 */
import cpp

string funcName() { result = "attack" }

from FunctionCall call
where call.getTarget().getName() = funcName()
select call.getEnclosingFunction().getName(),
       call.getFile().getRelativePath(),
       call.getLocation().getStartLine()
