/**
 * Find all functions that access a specific global variable.
 * Change varName() to target a different global.
 *
 * Useful for tracing data flow through globals like pmap, tmap, scentMap.
 *
 * Columns: function name | file | line | access kind (read/write)
 */
import cpp

string varName() { result = "pmap" }

from VariableAccess va, GlobalVariable gv
where gv.getName() = varName()
  and va.getTarget() = gv
select va.getEnclosingFunction().getName() as func,
       va.getFile().getRelativePath() as file,
       va.getLocation().getStartLine() as line
order by file, line
