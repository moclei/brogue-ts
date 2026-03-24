/**
 * Find all accesses to a specific property name in TypeScript code.
 * Change propName() to target a different property.
 *
 * Useful for tracing how fields like .layers, .xLoc, .flags
 * are accessed across the TypeScript port.
 *
 * Columns: enclosing function | file | line
 */
import javascript

string propName() { result = "layers" }

from DotExpr dot
where dot.getPropertyName() = propName()
  and dot.getFile().getRelativePath().matches("src/%")
select dot.getEnclosingFunction().getName() as func,
       dot.getFile().getRelativePath() as file,
       dot.getLocation().getStartLine() as line
order by file, line
