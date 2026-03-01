/**
 * Stack-based JavaScript source scanner.
 *
 * Correctly skips strings (single, double, template string parts),
 * comments, and regex literals — including arbitrarily nested template
 * literals.
 *
 * Shared by both the Babel plugin and the LSP server so they operate on
 * identical tokenization rules.
 */

// ─── Shared regexes ───────────────────────────────────────────────────

/** Matches a keyword literal starting at position lastIndex. */
const KEYWORD_RE = /:([a-zA-Z_][\w.-]*)(?:\/([a-zA-Z_][\w.-]*))?/g;

/** Characters that can legitimately appear immediately before a keyword. */
const BEFORE_KW_RE = /[\s\[({,;=!&|?:><%+\-^~]/;

/**
 * Characters that, when they precede a `/`, indicate the start of a
 * regex literal rather than a division operator.
 *
 * This is the standard heuristic used by linters and syntax highlighters:
 * a `/` is a regex when preceded by an operator, punctuator, or keyword
 * boundary — NOT by an identifier, number, or closing bracket.
 */
const REGEX_PREDECESSOR_RE = /[=!({[,;:?&|^~+\-*/%<>]\s*$/;

// ─── Low-level scanner ───────────────────────────────────────────────

/**
 * Walk `source` character-by-character, calling `onCode(i)` for every
 * character that falls in "code context" (where keyword literals can
 * appear).  Characters inside strings, comments, template string parts,
 * and regex literals are skipped.
 *
 * Returns nothing — side-effects happen through `onCode`.
 *
 * @param {string}       source
 * @param {(i: number) => void} onCode
 */
function walkCode(source, onCode) {
  let i = 0;

  // Stack: 'code' | 'template' | 'template-expr'
  const stack = ['code'];
  // Parallel to 'template-expr' frames: tracks inner { } depth.
  const exprDepth = [];

  while (i < source.length) {
    const ctx = stack[stack.length - 1];

    // ── Template string part — skip verbatim ─────────────────────────
    if (ctx === 'template') {
      if (source[i] === '\\') { i += 2; continue; }
      if (source[i] === '`') { stack.pop(); i++; continue; }
      if (source[i] === '$' && source[i + 1] === '{') {
        stack.push('template-expr');
        exprDepth.push(0);
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // ── Code / template-expr ─────────────────────────────────────────

    // Single-line comment
    if (source[i] === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end;
      continue;
    }

    // Multi-line comment
    if (source[i] === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }

    // Regex literal — must come before the `/` is treated as code.
    // We use a preceding-context heuristic: if the text before `/`
    // ends with an operator/punctuator, this is a regex, not division.
    if (source[i] === '/' && source[i + 1] !== '/' && source[i + 1] !== '*') {
      const preceding = source.slice(Math.max(0, i - 20), i);
      if (i === 0 || REGEX_PREDECESSOR_RE.test(preceding)) {
        // Skip the regex body.
        let j = i + 1;
        while (j < source.length) {
          if (source[j] === '\\') { j += 2; continue; }
          if (source[j] === '/') { j++; break; }
          if (source[j] === '[') {
            // Character class — skip until ]
            j++;
            while (j < source.length) {
              if (source[j] === '\\') { j += 2; continue; }
              if (source[j] === ']') { j++; break; }
              j++;
            }
            continue;
          }
          j++;
        }
        // Skip regex flags (gimsuvy)
        while (j < source.length && /[gimsuvyd]/.test(source[j])) j++;
        i = j;
        continue;
      }
    }

    // Single / double quoted string
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i++];
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }

    // Template literal start
    if (source[i] === '`') {
      stack.push('template');
      i++;
      continue;
    }

    // Brace tracking inside template expression
    if (ctx === 'template-expr') {
      if (source[i] === '{') { exprDepth[exprDepth.length - 1]++; onCode(i); i++; continue; }
      if (source[i] === '}') {
        if (exprDepth[exprDepth.length - 1] === 0) { exprDepth.pop(); stack.pop(); }
        else { exprDepth[exprDepth.length - 1]--; onCode(i); }
        i++;
        continue;
      }
    }

    onCode(i);
    i++;
  }
}

// ─── scanKeywords ─────────────────────────────────────────────────────

/**
 * Scan JS source for keyword literals, returning their positions.
 *
 * @param {string} source
 * @returns {Array<{ns: string|null, name: string, fqn: string, index: number, length: number}>}
 */
function scanKeywords(source) {
  const results = [];
  const codePositions = new Set();

  walkCode(source, (i) => codePositions.add(i));

  // Now walk code positions looking for keyword starts.
  for (const i of codePositions) {
    if (source[i] !== ':') continue;

    const before = i > 0 ? source[i - 1] : ' ';
    if (i !== 0 && !BEFORE_KW_RE.test(before)) continue;

    KEYWORD_RE.lastIndex = i;
    const match = KEYWORD_RE.exec(source);
    if (!match || match.index !== i) continue;

    const ns = match[2] ? match[1] : null;
    const name = match[2] || match[1];
    results.push({
      ns, name,
      fqn: ns ? `${ns}/${name}` : name,
      index: i,
      length: match[0].length,
    });
  }

  return results;
}

// ─── Position helpers ─────────────────────────────────────────────────

/**
 * Build an array of character offsets, one per line.
 * lineOffsets[n] is the index of the first character on line n.
 *
 * @param {string} text
 * @returns {number[]}
 */
function computeLineOffsets(text) {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') offsets.push(i + 1);
  }
  return offsets;
}

/**
 * Convert a character offset to a { line, character } LSP position.
 *
 * @param {number[]} lineOffsets
 * @param {number} offset
 * @returns {{ line: number, character: number }}
 */
function offsetToPosition(lineOffsets, offset) {
  let low = 0, high = lineOffsets.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (lineOffsets[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return { line: low, character: offset - lineOffsets[low] };
}

module.exports = {
  KEYWORD_RE,
  BEFORE_KW_RE,
  walkCode,
  scanKeywords,
  computeLineOffsets,
  offsetToPosition,
};
