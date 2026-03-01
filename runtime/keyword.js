/**
 * Clojure-style Keyword for JavaScript.
 * Supports both simple (:name) and qualified (:ns/name) keywords.
 * Keywords are interned — same ns/name always returns the same instance.
 */

const _intern = new Map();

class Keyword {
  #ns;
  #name;

  constructor(ns, name) {
    if (name === undefined) {
      const parsed = Keyword.parse(ns);
      this.#ns = parsed.ns;
      this.#name = parsed.name;
    } else {
      this.#ns = ns;
      this.#name = name;
    }
    Object.freeze(this);
  }

  get ns() { return this.#ns; }
  get name() { return this.#name; }
  get fqn() { return this.#ns ? `${this.#ns}/${this.#name}` : this.#name; }

  toString() { return `:${this.fqn}`; }
  toJSON() { return this.toString(); }

  equals(other) {
    return other instanceof Keyword && other.ns === this.#ns && other.name === this.#name;
  }

  valueOf() { return this.toString(); }

  /**
   * Intern a keyword — same ns/name always returns the same instance.
   * @param {string|null} ns  - namespace, or a full ":ns/name" string if name omitted
   * @param {string} [name]
   * @returns {Keyword}
   */
  static of(ns, name) {
    if (name === undefined) {
      const parsed = Keyword.parse(ns);
      ns = parsed.ns;
      name = parsed.name;
    }
    const key = ns ? `${ns}/${name}` : name;
    if (_intern.has(key)) return _intern.get(key);
    const k = new Keyword(ns, name);
    _intern.set(key, k);
    return k;
  }

  /**
   * Parse a keyword string like ":ns/name", "ns/name", or ":name".
   * @param {string} s
   * @returns {{ ns: string|null, name: string }}
   */
  static parse(s) {
    if (typeof s !== 'string') throw new TypeError(`Expected string, got ${typeof s}`);
    const str = s.startsWith(':') ? s.slice(1) : s;
    if (!str) throw new Error('Keyword name cannot be empty');
    const slashIdx = str.indexOf('/');
    if (slashIdx === -1) return { ns: null, name: str };
    const ns = str.slice(0, slashIdx);
    const name = str.slice(slashIdx + 1);
    if (!ns) throw new Error('Keyword namespace cannot be empty');
    if (!name) throw new Error('Keyword name cannot be empty');
    return { ns, name };
  }

  /** Clear the intern cache. Mainly useful for testing. */
  static clearCache() { _intern.clear(); }
}

/**
 * Shorthand factory. Used by the Babel plugin output.
 * @param {string|null} ns
 * @param {string} name
 * @returns {Keyword}
 */
function kw(ns, name) {
  return Keyword.of(ns, name);
}

module.exports = { Keyword, kw };
