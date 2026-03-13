/**
 * Find the definition location of a named TypeScript function.
 * Change funcName() below to target a different function.
 * For MCP use: substitute the name directly in codeql_run_query_text.
 *
 * Note: returns all matching definitions (overloads, re-declarations).
 * Columns: file | line | function name
 */
import javascript

string funcName() { result = "buildCombatAttackContext" }

from Function f
where f.getName() = funcName()
select f.getFile().getRelativePath(),
       f.getLocation().getStartLine(),
       f.getName()
