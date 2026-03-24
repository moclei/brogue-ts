/**
 * Find all accesses to a specific struct field in C code.
 * Change fieldName() to target a different field.
 *
 * Useful for tracing how struct fields like pcell.layers, creature.xLoc
 * are read and written across the codebase.
 *
 * Columns: enclosing function | file | line | qualifying type
 */
import cpp

string fieldName() { result = "layers" }

from FieldAccess fa
where fa.getTarget().getName() = fieldName()
select fa.getEnclosingFunction().getName() as func,
       fa.getFile().getRelativePath() as file,
       fa.getLocation().getStartLine() as line,
       fa.getTarget().getDeclaringType().getName() as structName
order by file, line
