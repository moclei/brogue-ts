/**
 * Find all C functions that take a parameter of a given type.
 * Change typeName() to target a different type.
 *
 * Useful for finding all functions that operate on grids, creatures, items, etc.
 *
 * Columns: function name | file | line | param name | full param type
 */
import cpp

string typeName() { result = "creature" }

from Function f, Parameter p
where f.hasDefinition()
  and p = f.getAParameter()
  and p.getType().getUnspecifiedType().(PointerType).getBaseType().getName() = typeName()
select f.getName() as func,
       f.getFile().getRelativePath() as file,
       f.getLocation().getStartLine() as line,
       p.getName() as param,
       p.getType().toString() as paramType
order by file, line
