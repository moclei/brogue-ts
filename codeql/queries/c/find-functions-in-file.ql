/**
 * List all functions defined in a specific C source file.
 * Change the file pattern in fileMatch() to target a different file.
 *
 * Columns: function name | start line | end line | parameter count
 */
import cpp

string fileMatch() { result = "%Grid.c" }

from Function f
where f.hasDefinition()
  and f.getFile().getRelativePath().matches(fileMatch())
select f.getName() as name,
       f.getLocation().getStartLine() as startLine,
       f.getLocation().getEndLine() as endLine,
       f.getNumberOfParameters() as params
order by startLine
