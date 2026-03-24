/**
 * List all functions defined in a specific TypeScript source file.
 * Change the file pattern in fileMatch() to target a different file.
 *
 * Columns: function name | start line | end line | parameter count
 */
import javascript

string fileMatch() { result = "%grid.ts" }

from Function f
where f.getFile().getRelativePath().matches(fileMatch())
  and f.getName() != ""
select f.getName() as name,
       f.getLocation().getStartLine() as startLine,
       f.getLocation().getEndLine() as endLine,
       f.getNumParameter() as params
order by startLine
