/**
 * babel-plugin-js-qualified-keywords
 *
 * Transforms Clojure-style keyword syntax in JavaScript:
 *
 *   :user/name   →  _kw("user", "name")
 *   :db/id       →  _kw("db", "id")
 *   :active      →  _kw(null, "active")
 *
 * Strategy:
 * 1. Pre-process source to replace keyword literals with `_kw(...)` calls
 *    before Babel's parser sees the code.
 * 2. Babel handles the resulting AST normally.
 * 3. A `require("js-qualified-keywords/runtime")` import is injected when needed.
 *
 * The scanner logic (strings, comments, template literals, regex literals)
 * is shared with lib/scan.js via `walkCode` — one state machine, two
 * consumers.
 *
 * NOTE: Source maps will have slightly wrong column offsets because the
 * preprocessing changes string lengths before Babel sees the source.
 *
 * Usage in .babelrc:
 *   { "plugins": ["js-qualified-keywords/babel-plugin"] }
 */

const { KEYWORD_RE, BEFORE_KW_RE, walkCode } = require('../lib/scan');

/**
 * Pre-process source code, replacing keyword literals outside strings,
 * comments, template string parts, and regex literals with `_kw(...)` calls.
 *
 * @param {string} code
 * @returns {string}
 */
function preprocess(code) {
  // Pass 1: collect code-context positions.
  const codeSet = new Set();
  walkCode(code, (i) => codeSet.add(i));

  // Pass 2: walk source, replacing keywords at code positions.
  const result = [];
  let i = 0;

  while (i < code.length) {
    if (!codeSet.has(i)) {
      // Not in code context — copy verbatim.
      result.push(code[i++]);
      continue;
    }

    if (code[i] === ':') {
      const before = i > 0 ? code[i - 1] : ' ';
      if (i === 0 || BEFORE_KW_RE.test(before)) {
        KEYWORD_RE.lastIndex = i;
        const match = KEYWORD_RE.exec(code);
        if (match && match.index === i) {
          const ns = match[2] ? match[1] : null;
          const name = match[2] || match[1];
          result.push(ns ? `_kw("${ns}", "${name}")` : `_kw(null, "${name}")`);
          i += match[0].length;
          continue;
        }
      }
    }

    result.push(code[i++]);
  }

  return result.join('');
}

/**
 * Babel plugin entry point.
 */
function clojureKeywordsPlugin({ types: t }) {
  return {
    name: 'js-qualified-keywords',

    parserOverride(code, opts, parse) {
      const processed = preprocess(code);
      // Store whether this file needs the import on the opts object
      // so it's per-file, not per-session.
      opts.__clojureKeywordsNeedsImport = processed !== code;
      return parse(processed, opts);
    },

    visitor: {
      Program: {
        exit(path, state) {
          const hasKw = path.scope.hasGlobal('_kw');
          const needsImport = state.opts.__clojureKeywordsNeedsImport;
          if (!hasKw && !needsImport) return;

          // const { kw: _kw } = require("js-qualified-keywords/runtime");
          const importDecl = t.variableDeclaration('const', [
            t.variableDeclarator(
              t.objectPattern([
                t.objectProperty(t.identifier('kw'), t.identifier('_kw')),
              ]),
              t.callExpression(t.identifier('require'), [
                t.stringLiteral('js-qualified-keywords/runtime'),
              ])
            ),
          ]);

          path.unshiftContainer('body', importDecl);
        },
      },
    },
  };
}

clojureKeywordsPlugin.preprocess = preprocess;
module.exports = clojureKeywordsPlugin;
