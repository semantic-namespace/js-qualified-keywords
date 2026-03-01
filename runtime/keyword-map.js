/**
 * KeywordMap — a Map that accepts Keyword instances as keys with value equality.
 *
 * Regular JS Maps use reference equality for object keys, so two Keyword
 * instances with the same ns/name would be treated as different keys.
 * Because Keywords are interned, reference equality IS value equality —
 * but KeywordMap also accepts plain strings like ":user/name" as keys.
 */

const { Keyword } = require('./keyword');

class KeywordMap {
  #map = new Map();

  #resolve(key) {
    if (key instanceof Keyword) return key;
    if (typeof key === 'string') return Keyword.of(key);
    throw new TypeError(`KeywordMap key must be a Keyword or string, got ${typeof key}`);
  }

  set(key, value) {
    this.#map.set(this.#resolve(key), value);
    return this;
  }

  get(key) {
    return this.#map.get(this.#resolve(key));
  }

  has(key) {
    return this.#map.has(this.#resolve(key));
  }

  delete(key) {
    return this.#map.delete(this.#resolve(key));
  }

  get size() { return this.#map.size; }

  entries() { return this.#map.entries(); }
  keys() { return this.#map.keys(); }
  values() { return this.#map.values(); }
  [Symbol.iterator]() { return this.#map[Symbol.iterator](); }

  forEach(cb, thisArg) {
    this.#map.forEach((v, k) => cb.call(thisArg, v, k, this));
  }

  toObject() {
    const obj = {};
    for (const [k, v] of this.#map) obj[k.toString()] = v;
    return obj;
  }

  toJSON() { return this.toObject(); }

  /**
   * Build a KeywordMap from a plain object whose keys are keyword strings.
   * @param {Record<string, any>} obj
   * @returns {KeywordMap}
   */
  static fromObject(obj) {
    const m = new KeywordMap();
    for (const [k, v] of Object.entries(obj)) m.set(k, v);
    return m;
  }
}

module.exports = { KeywordMap };
