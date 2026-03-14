# CodeQL Query Cheat Sheet

Use this before writing any inline query via `codeql_run_query_text`.

---

## Query skeleton

```ql
import cpp          -- or: import javascript  (for TypeScript)

from <Type> var [, <Type> var2]
where <condition>
  and <condition>
select <expr>, <expr>, <expr>
```

`from` and `where` are optional. `select` is required.

---

## order by rule

`order by` requires **simple identifiers** — alias all select expressions with `as` first.

```ql
-- WRONG: expressions in order by → compile error
select f.getName(), f.getFile().getRelativePath()
  order by f.getFile().getRelativePath()

-- CORRECT: alias first, order by alias
select f.getName() as name, f.getFile().getRelativePath() as path
  order by path, name
```

Add `asc` or `desc` after the identifier: `order by path desc`.

---

## C predicates (`import cpp`)

| Class | Useful predicates |
|---|---|
| `Function` | `getName()`, `hasDefinition()`, `getFile()`, `getLocation()` |
| `FunctionCall` | `getTarget()`, `getEnclosingFunction()`, `getFile()`, `getLocation()` |
| `File` | `getRelativePath()`, `getBaseName()` |
| `Location` | `getStartLine()`, `getEndLine()` |
| `Parameter` | `getName()`, `getType()` |
| `Variable` | `getName()`, `getType()` |

**Pattern:** `call.getTarget().getName()` — chain predicates freely in `where`; only alias in `select` if using `order by`.

---

## TypeScript predicates (`import javascript`)

| Class | Useful predicates |
|---|---|
| `Function` | `getName()`, `getFile()`, `getLocation()` |
| `CallExpr` | `getCallee()`, `getEnclosingFunction()`, `getFile()`, `getLocation()` |
| `Identifier` | `getName()` |
| `DotExpr` | `getPropertyName()` |
| `File` | `getRelativePath()`, `getBaseName()` |
| `Location` | `getStartLine()` |

**TS call matching:** a call can be `f()` (Identifier) or `obj.f()` (DotExpr) — check both with `or`:

```ql
where call.getCallee().(Identifier).getName() = "foo"
   or call.getCallee().(DotExpr).getPropertyName() = "foo"
```

The `.(Type)` syntax is a cast — it restricts the expression to that type and fails silently if the cast doesn't match.

---

## Worked examples

**Find C function definition:**
```ql
import cpp
from Function f
where f.getName() = "attack" and f.hasDefinition()
select f.getFile().getRelativePath(), f.getLocation().getStartLine(), f.getName()
```

**Find all callers of a C function:**
```ql
import cpp
from FunctionCall call
where call.getTarget().getName() = "attack"
select call.getEnclosingFunction().getName(),
       call.getFile().getRelativePath(),
       call.getLocation().getStartLine()
```

**Find all callees of a TS function:**
```ql
import javascript
from Function caller, CallExpr call
where caller.getName() = "buildCombatAttackContext"
  and call.getEnclosingFunction() = caller
select call.getFile().getRelativePath(),
       call.getLocation().getStartLine(),
       call.getCallee().(Identifier).getName()
```

---

## Gotchas

- **No semicolons** inside QL expressions — conditions are separated by `and` / `or`, not `;`
- **`or` binds loosely** — parenthesise when mixing with `and`: `(a or b) and c`
- **Multiple results per row are normal** — a function defined in a header included multiple times will appear multiple times; use `f.hasDefinition()` to filter to the canonical definition
- **`import cpp` for C, `import javascript` for TypeScript** — wrong import silently returns no results
- **Databases**: `brogue-c` for C source, `rogue-ts` for TypeScript port
