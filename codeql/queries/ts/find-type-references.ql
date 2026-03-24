/**
 * Find all references to a named TypeScript type or interface.
 * Change typeName() to target a different type.
 *
 * Useful for understanding where types like Creature, Item, CellGrid
 * are used across the codebase.
 *
 * Columns: file | line | enclosing context
 */
import javascript

string typeName() { result = "Creature" }

from TypeAccess ta
where ta.getTypeName().(LocalTypeName).getName() = typeName()
  and ta.getFile().getRelativePath().matches("src/%")
select ta.getFile().getRelativePath() as file,
       ta.getLocation().getStartLine() as line
order by file, line
