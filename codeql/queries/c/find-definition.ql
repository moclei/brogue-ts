/**
 * Find the definition location of a named C function.
 * Change funcName() below to target a different function.
 * For MCP use: substitute the name directly in codeql_run_query_text.
 */
import cpp

string funcName() { result = "attack" }

from Function f
where f.getName() = funcName()
  and f.hasDefinition()
select f.getFile().getRelativePath(),
       f.getLocation().getStartLine(),
       f.getName()
