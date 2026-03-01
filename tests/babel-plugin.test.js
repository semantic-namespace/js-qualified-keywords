/**
 * Tests for babel-plugin/index.js
 */

const { transformSync } = require('@babel/core');
const path = require('path');

const testCases = [
  {
    name: 'qualified keyword',
    input: 'const x = :user/name;',
    expected: '_kw("user", "name")',
  },
  {
    name: 'simple keyword',
    input: 'const x = :active;',
    expected: '_kw(null, "active")',
  },
  {
    name: 'keyword as computed property key',
    input: 'const o = { [:db/id]: 1 };',
    expected: '_kw("db", "id")',
  },
  {
    name: 'keyword inside string — no transform',
    input: 'const s = ":not/a-keyword";',
    notExpected: '_kw(',
  },
  {
    name: 'keyword inside single-quote string — no transform',
    input: "const s = ':not/a-keyword';",
    notExpected: '_kw(',
  },
  {
    name: 'keyword inside line comment — no transform',
    input: '// :not/a-keyword\nconst x = 1;',
    notExpected: '_kw(',
  },
  {
    name: 'multiple keywords',
    input: 'const a = :user/name; const b = :user/email;',
    expected: ['_kw("user", "name")', '_kw("user", "email")'],
  },
  {
    name: 'ternary operator colon — no transform',
    input: 'const x = cond ? a : b;',
    notExpected: '_kw(',
  },
  {
    name: 'runtime import injected',
    input: 'const x = :active;',
    expected: 'require("js-qualified-keywords/runtime")',
  },
  {
    name: 'no import when no keywords',
    input: 'const x = 1 + 2;',
    notExpected: 'require("js-qualified-keywords/runtime")',
  },

  // ── Template literal edge cases ────────────────────────────────────────

  {
    // The string part of a template is NOT transformed.
    name: 'keyword in template string part — no transform',
    input: 'const s = `:not/a-keyword`;',
    notExpected: '_kw(',
  },
  {
    // Keywords inside ${...} expressions ARE transformed.
    name: 'keyword in template expression — transform',
    input: 'const s = `hello ${db.get(:user/name)}`;',
    expected: '_kw("user", "name")',
  },
  {
    // The string part is skipped but the expression part is not.
    name: 'template with both string text and expression keyword',
    input: 'const s = `:skip ${:event/type} :skip`;',
    expected: '_kw("event", "type")',
  },
  {
    // Multiple keywords in a single template expression.
    name: 'multiple keywords in template expression',
    input: 'const s = `${m.get(:user/name)} <${m.get(:user/email)}>`;',
    expected: ['_kw("user", "name")', '_kw("user", "email")'],
  },
  {
    // Inner { } inside the expression must not prematurely close ${...}.
    name: 'object literal inside template expression',
    input: 'const s = `${JSON.stringify({ [:db/id]: 1 })}`;',
    expected: '_kw("db", "id")',
  },
  {
    // Nested template literals: inner template string parts are skipped,
    // inner template expression keywords are transformed.
    name: 'nested template literal — inner expression keyword transformed',
    input: 'const s = `outer ${`inner ${:ns/kw}`}`;',
    expected: '_kw("ns", "kw")',
  },
  {
    // Keyword appears after a nested template closes, still in outer expression.
    name: 'keyword after nested template in same expression',
    input: 'const s = `${`nested` + :event/type}`;',
    expected: '_kw("event", "type")',
  },

  // ── Regex literals ──────────────────────────────────────────────────────

  {
    name: 'keyword inside regex literal — no transform',
    input: 'const re = /:foo/g;',
    notExpected: '_kw(',
  },
  {
    name: 'keyword after regex — transform',
    input: 'x.replace(/:old/g, :new/val)',
    expected: '_kw("new", "val")',
  },
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  try {
    const result = transformSync(tc.input, {
      configFile: path.resolve(__dirname, '../.babelrc'),
      filename: 'test.js',
    });

    const code = result.code;
    let ok = true;

    for (const exp of [tc.expected].flat().filter(Boolean)) {
      if (!code.includes(exp)) {
        console.error(`✗ ${tc.name}`);
        console.error(`  expected: ${exp}`);
        console.error(`  got:      ${code}`);
        ok = false;
      }
    }

    if (tc.notExpected && code.includes(tc.notExpected)) {
      console.error(`✗ ${tc.name}`);
      console.error(`  did NOT expect: ${tc.notExpected}`);
      console.error(`  got:            ${code}`);
      ok = false;
    }

    if (ok) {
      console.log(`✓ ${tc.name}`);
      passed++;
    } else {
      failed++;
    }
  } catch (err) {
    console.error(`✗ ${tc.name}: ${err.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
