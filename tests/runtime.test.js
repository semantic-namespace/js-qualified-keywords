/**
 * Tests for runtime/keyword.js and runtime/keyword-map.js
 */

const { Keyword, kw, KeywordMap } = require('../runtime');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ─── Keyword ──────────────────────────────────────────────────────────

section('Keyword — construction');
{
  Keyword.clearCache();
  const k = kw('user', 'name');
  assert(k.ns === 'user', 'ns is set');
  assert(k.name === 'name', 'name is set');
  assert(k.fqn === 'user/name', 'fqn is ns/name');
  assert(k.toString() === ':user/name', 'toString returns :ns/name');
  assert(JSON.stringify(k) === '":user/name"', 'toJSON returns string');
}

section('Keyword — simple (unqualified)');
{
  const k = kw(null, 'active');
  assert(k.ns === null, 'ns is null');
  assert(k.name === 'active', 'name is set');
  assert(k.fqn === 'active', 'fqn is just the name');
  assert(k.toString() === ':active', 'toString returns :name');
}

section('Keyword — interning');
{
  Keyword.clearCache();
  const a = kw('user', 'name');
  const b = kw('user', 'name');
  assert(a === b, 'same args → same instance');
  const c = kw(null, 'active');
  const d = kw(null, 'active');
  assert(c === d, 'same simple keyword → same instance');
  const e = kw('user', 'name');
  const f = kw('user', 'email');
  assert(e !== f, 'different name → different instance');
}

section('Keyword — parse from string');
{
  Keyword.clearCache();
  const a = Keyword.of(':user/name');
  assert(a.ns === 'user' && a.name === 'name', 'parse :ns/name');
  const b = Keyword.of('user/name');
  assert(b.ns === 'user' && b.name === 'name', 'parse ns/name without colon');
  const c = Keyword.of(':active');
  assert(c.ns === null && c.name === 'active', 'parse :name');
}

section('Keyword — parse validation');
{
  let caught = false;
  try { Keyword.of(''); } catch (e) { caught = true; }
  assert(caught, 'empty string throws');

  caught = false;
  try { Keyword.of(':'); } catch (e) { caught = true; }
  assert(caught, 'bare colon throws');

  caught = false;
  try { Keyword.of('/name'); } catch (e) { caught = true; }
  assert(caught, 'empty namespace throws');

  caught = false;
  try { Keyword.of('ns/'); } catch (e) { caught = true; }
  assert(caught, 'empty name after slash throws');
}

section('Keyword — equals');
{
  Keyword.clearCache();
  const a = kw('user', 'name');
  const b = kw('user', 'name');
  assert(a.equals(b), 'equal keywords');
  assert(!a.equals(kw('user', 'email')), 'different keywords not equal');
  assert(!a.equals('not a keyword'), 'non-keyword not equal');
}

// ─── KeywordMap ───────────────────────────────────────────────────────

section('KeywordMap — basic get/set/has/delete');
{
  Keyword.clearCache();
  const m = new KeywordMap();
  m.set(kw('user', 'name'), 'Alice');
  assert(m.has(kw('user', 'name')), 'has key');
  assert(m.get(kw('user', 'name')) === 'Alice', 'get value');
  assert(m.size === 1, 'size is 1');
  m.delete(kw('user', 'name'));
  assert(!m.has(kw('user', 'name')), 'deleted key gone');
  assert(m.size === 0, 'size is 0 after delete');
}

section('KeywordMap — string key coercion');
{
  Keyword.clearCache();
  const m = new KeywordMap();
  m.set(':user/name', 'Bob');
  assert(m.get(kw('user', 'name')) === 'Bob', 'string key resolved to keyword');
  assert(m.get(':user/name') === 'Bob', 'string key retrieves by string too');
}

section('KeywordMap — forEach signature');
{
  Keyword.clearCache();
  const m = new KeywordMap();
  m.set(kw('user', 'name'), 'Alice');
  let receivedThird = null;
  m.forEach((v, k, map) => { receivedThird = map; });
  assert(receivedThird === m, 'forEach passes KeywordMap as third arg');
}

section('KeywordMap — fromObject / toObject');
{
  Keyword.clearCache();
  const m = KeywordMap.fromObject({ ':user/name': 'Carol', ':user/email': 'carol@example.com' });
  assert(m.get(':user/name') === 'Carol', 'fromObject sets values');
  assert(m.get(':user/email') === 'carol@example.com', 'fromObject sets multiple values');
  const obj = m.toObject();
  assert(obj[':user/name'] === 'Carol', 'toObject round-trips');
}

// ─── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
