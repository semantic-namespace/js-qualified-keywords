# js-qualified-keywords

Clojure-style qualified keywords (`:ns/name`) as a first-class data type in JavaScript.

```js
const status = :active;
const schema = {
  [:user/name]:  { type: 'string' },
  [:user/email]: { type: 'string' },
};
```

## Install

```bash
npm install js-qualified-keywords
```

## Runtime

```js
const { kw, Keyword, KeywordMap } = require('js-qualified-keywords');

const k = kw('user', 'name');
k.ns        // "user"
k.name      // "name"
k.fqn       // "user/name"
k.toString() // ":user/name"

// Interned — same args, same instance
kw('user', 'name') === kw('user', 'name') // true

// Parse from string
Keyword.of(':user/name')  // same as kw('user', 'name')

// KeywordMap: like Map but keyed by keyword identity
const m = new KeywordMap();
m.set(kw('user', 'name'), 'Alice');
m.get(kw('user', 'name'))  // "Alice"
m.get(':user/name')        // "Alice" — string keys work too

KeywordMap.fromObject({ ':user/name': 'Alice' })  // build from plain object
m.toObject()                                       // back to plain object
```

## Babel Plugin

Transforms `:ns/name` syntax into runtime calls so you can write keywords directly in `.js` files.

**.babelrc**
```json
{ "plugins": ["js-qualified-keywords/babel-plugin"] }
```

Input:
```js
const x = :user/name;
const o = { [:db/id]: 1 };
```

Output:
```js
const { kw: _kw } = require('js-qualified-keywords/runtime');
const x = _kw('user', 'name');
const o = { [_kw('db', 'id')]: 1 };
```

Keywords inside strings and comments are left untouched. The ternary `: ` is not mistaken for a keyword.

## LSP Server

Provides completion, hover, go-to-definition, find-references, rename, and diagnostics for keyword literals in JS/TS files.

```bash
cd lsp-server && npm install
node lsp-server/server.js --stdio
```

Point your editor's LSP client at that command, scoped to `javascript`, `javascriptreact`, `typescript`, `typescriptreact`.

## Emacs (lsp-mode)

**1. Install server dependencies (once):**
```bash
cd lsp-server && npm install
```

**2. Add to your `init.el` / config:**
```elisp
(setq js-qualified-keywords-lsp-server-dir "/path/to/js-qualified-keywords/lsp-server")
(load "/path/to/js-qualified-keywords/editors/emacs/js-qualified-keywords-lsp.el")
(add-hook 'js-mode-hook #'lsp)   ; skip if lsp already starts automatically
```

**3. Open any `.js` file** — lsp-mode connects automatically.

| Feature | Key |
|---|---|
| Hover | `K` |
| Completion | type `:` or `:ns/` |
| Go to definition | `M-.` |
| Find references | `M-?` |
| Rename | `C-c l r r` |
| Server status | `M-x lsp-describe-session` |

If the server doesn't connect, check the `*lsp-log*` buffer. Most common cause: `node` not on Emacs's `exec-path` — fix with `(add-to-list 'exec-path "/usr/local/bin")`.

If you run multiple LSP servers on JS files (e.g. `ts-ls`), both activate independently. To make js-qualified-keywords take priority, raise `:priority` above `-1` in the `.el` file.

## VS Code Extension

Bundles the LSP server as a VS Code extension.

```bash
cd vscode-extension && npm install
# Press F5 in VS Code to launch the Extension Development Host
```

To package for distribution:
```bash
npx vsce package
```

## Conventions

| Style | Example | Use for |
|---|---|---|
| Qualified | `:user/name` | domain attributes, schema keys |
| Simple | `:active` | enums, flags, modes |

## Limitations

- **Source maps**: The Babel plugin pre-processes source text before parsing, which changes string lengths (`:user/name` becomes `_kw("user", "name")`). Babel's source maps are generated from the transformed source, so column offsets may be slightly off. Line numbers remain correct.
- No TypeScript type-level support yet.
