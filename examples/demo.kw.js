/**
 * Example: Clojure-style keywords in JavaScript.
 *
 * Run through Babel with the js-qualified-keywords plugin:
 *   npx babel examples/demo.kw.js --out-file examples/demo.compiled.js
 */

// Qualified keywords — :namespace/name
const schema = {
  [:db/id]:      { type: 'long',    unique: true },
  [:db/ident]:   { type: 'keyword' },
  [:user/name]:  { type: 'string',  required: true },
  [:user/email]: { type: 'string',  required: true },
  [:user/role]:  { type: 'keyword' },
  [:user/active]:{ type: 'boolean', default: true },
};

// Simple (unqualified) keywords
const status = :active;
const mode   = :development;

// Use in conditionals
function getUsers(db, filter) {
  if (filter === :active) {
    return db.query({ where: { [:user/active]: true } });
  }
  return db.query({});
}

// Use in a switch (compare .toString())
function handleEvent(event) {
  const type = event.get(:event/type);
  switch (type.toString()) {
    case ':event/create': return onCreate(event);
    case ':event/update': return onUpdate(event);
    case ':event/delete': return onDelete(event);
    default: console.warn('Unknown event type:', type);
  }
}

// Composing data with KeywordMap
function createUser(name, email) {
  const { KeywordMap } = require('js-qualified-keywords/runtime');
  const user = new KeywordMap();
  user.set(:db/id,       generateId());
  user.set(:user/name,   name);
  user.set(:user/email,  email);
  user.set(:user/role,   :user);
  user.set(:user/active, true);
  return user;
}

console.log('Status:', status);
console.log('Mode:',   mode);
