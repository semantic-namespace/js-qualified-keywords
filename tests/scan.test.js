/**
 * Tests for lib/scan.js
 *
 * Verifies that scanKeywords correctly finds keywords in code contexts
 * and correctly skips them in strings, comments, and template string parts.
 */

const { scanKeywords, computeLineOffsets, offsetToPosition } = require('../lib/scan');

let passed = 0;
let failed = 0;

function fqns(source) {
  return scanKeywords(source).map(k => k.fqn);
}

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else           { console.error(`  ✗ ${message}`); failed++; }
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function section(title) { console.log(`\n${title}`); }

// ─── Basic detection ──────────────────────────────────────────────────

section('Basic detection');
assert(deepEqual(fqns('const x = :user/name;'), ['user/name']), 'qualified keyword');
assert(deepEqual(fqns('const x = :active;'), ['active']), 'simple keyword');
assert(deepEqual(fqns('const o = { [:db/id]: 1 };'), ['db/id']), 'computed property key');
assert(deepEqual(fqns('const a = :ns/a; const b = :ns/b;'), ['ns/a', 'ns/b']), 'multiple keywords');

// ─── Positions ────────────────────────────────────────────────────────

section('Positions');
{
  const src = 'const x = :user/name;';
  const [kw] = scanKeywords(src);
  assert(kw.index === 10, 'correct character offset');
  assert(kw.length === ':user/name'.length, 'correct length');
  assert(kw.ns === 'user' && kw.name === 'name', 'ns and name');
}

// ─── Strings — skip ───────────────────────────────────────────────────

section('Strings — skip');
assert(deepEqual(fqns('const s = ":user/name";'), []), 'double-quoted string');
assert(deepEqual(fqns("const s = ':user/name';"), []), 'single-quoted string');
assert(deepEqual(fqns('const s = "has \\":user/name\\" inside";'), []), 'escaped quote in string');

// ─── Comments — skip ──────────────────────────────────────────────────

section('Comments — skip');
assert(deepEqual(fqns('// :user/name'), []), 'line comment');
assert(deepEqual(fqns('/* :user/name */'), []), 'block comment');
assert(deepEqual(fqns('const x = 1; // :user/name'), []), 'line comment at end of line');
assert(deepEqual(fqns('const x = /* :user/name */ 1;'), []), 'block comment inline');

// ─── Template literals ────────────────────────────────────────────────

section('Template literals — string part skipped');
assert(deepEqual(fqns('const s = `:user/name`;'), []), 'keyword in template string part');
assert(deepEqual(fqns('const s = `hello :user/name world`;'), []), 'keyword embedded in template text');

section('Template literals — expression part scanned');
assert(deepEqual(fqns('const s = `${:user/name}`;'), ['user/name']), 'keyword in template expression');
assert(deepEqual(fqns('const s = `hello ${db.get(:user/name)} world`;'), ['user/name']), 'keyword in template expression with text around it');
assert(deepEqual(fqns('const s = `${:ns/a} and ${:ns/b}`;'), ['ns/a', 'ns/b']), 'multiple expressions');
assert(deepEqual(fqns('const s = `skip ${:ev/type} skip`;'), ['ev/type']), 'mixed skip and scan');

section('Template literals — inner object braces');
assert(deepEqual(fqns('const s = `${JSON.stringify({ [:db/id]: 1 })}`;'), ['db/id']), 'object literal in expression');

section('Template literals — nested');
assert(deepEqual(fqns('const s = `${`inner ${:ns/kw}`}`;'), ['ns/kw']), 'keyword in inner template expression');
assert(deepEqual(fqns('const s = `outer ${`inner :skip`} ${:ev/type}`;'), ['ev/type']), 'outer expression scanned, inner string skipped');
assert(deepEqual(fqns('const s = `${`nested` + :ns/kw}`;'), ['ns/kw']), 'keyword after nested template in same expression');

// ─── Regex literals — skip ────────────────────────────────────────────

section('Regex literals — skip');
assert(deepEqual(fqns('const re = /:foo/g;'), []), 'keyword in regex literal');
assert(deepEqual(fqns('const re = /:[a-z]+\\/bar/;'), []), 'keyword in regex with escape');
assert(deepEqual(fqns('if (/:ns/.test(s)) {}'), []), 'regex in conditional');
assert(deepEqual(fqns('const re = /[:foo]/;'), []), 'keyword in regex character class');
assert(deepEqual(fqns('x.replace(/:old/g, :new/val)'), ['new/val']), 'regex arg skipped, keyword arg scanned');

section('Division vs regex');
assert(deepEqual(fqns('const x = a / b;'), []), 'division — no false match');
assert(deepEqual(fqns('const x = a / b + :active;'), ['active']), 'division then keyword');

// ─── Ternary — no false positive ─────────────────────────────────────

section('Ternary operator');
assert(deepEqual(fqns('const x = a ? b : c;'), []), 'ternary colon not matched');
assert(deepEqual(fqns('const x = a ? :active : :inactive;'), ['active', 'inactive']), 'keywords in ternary branches');

// ─── offsetToPosition ─────────────────────────────────────────────────

section('offsetToPosition');
{
  const text = 'line0\nline1\nline2';
  const lo = computeLineOffsets(text);
  assert(deepEqual(offsetToPosition(lo, 0),  { line: 0, character: 0 }), 'start of file');
  assert(deepEqual(offsetToPosition(lo, 5),  { line: 0, character: 5 }), 'end of line 0');
  assert(deepEqual(offsetToPosition(lo, 6),  { line: 1, character: 0 }), 'start of line 1');
  assert(deepEqual(offsetToPosition(lo, 11), { line: 1, character: 5 }), 'end of line 1');
  assert(deepEqual(offsetToPosition(lo, 12), { line: 2, character: 0 }), 'start of line 2');
}

// ─── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
