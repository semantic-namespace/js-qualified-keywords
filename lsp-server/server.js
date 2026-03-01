/**
 * LSP Server for Clojure-style Keywords in JavaScript.
 *
 * Features:
 *   - Completion   — type `:` to see known keywords; `:ns/` to filter by namespace
 *   - Hover        — shows namespace, name, and usage count
 *   - Definition   — jumps to first occurrence
 *   - References   — all usages across the workspace
 *   - Rename       — rename a keyword everywhere
 *   - Diagnostics  — hints for keywords used only once (possible typo)
 */

const {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  CompletionItemKind,
  DiagnosticSeverity,
  TextDocumentSyncKind,
  MarkupKind,
} = require('vscode-languageserver/node');
const { TextDocument } = require('vscode-languageserver-textdocument');
const { scanKeywords, computeLineOffsets, offsetToPosition } = require('../lib/scan');

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// ─── Keyword Index ────────────────────────────────────────────────────

/** @type {Map<string, Array<{uri:string, line:number, character:number, endCharacter:number}>>} */
const keywordIndex = new Map();

/** @type {Map<string, Set<string>>} namespace -> set of names */
const namespaceIndex = new Map();

/**
 * Per-document scan cache.  Avoids re-scanning the full document on every
 * hover / definition / references / rename request.
 * @type {Map<string, {version: number, keywords: Array<{ns:string|null, name:string, fqn:string, index:number, length:number}>, lineOffsets: number[]}>}
 */
const docCache = new Map();

function indexDocument(doc) {
  const uri = doc.uri;
  const text = doc.getText();

  const keywords = scanKeywords(text);
  const lineOffsets = computeLineOffsets(text);

  // Cache scan results so getKeywordAtPosition / validateDocument don't re-scan.
  docCache.set(uri, { version: doc.version, keywords, lineOffsets });

  // Remove stale entries for this file.
  for (const [fqn, locs] of keywordIndex) {
    const filtered = locs.filter(l => l.uri !== uri);
    if (filtered.length === 0) keywordIndex.delete(fqn);
    else keywordIndex.set(fqn, filtered);
  }

  // Insert new entries.
  for (const { ns, name, fqn, index, length } of keywords) {
    const { line, character } = offsetToPosition(lineOffsets, index);
    const loc = { uri, line, character, endCharacter: character + length };

    if (!keywordIndex.has(fqn)) keywordIndex.set(fqn, []);
    keywordIndex.get(fqn).push(loc);
  }

  // Rebuild namespaceIndex from scratch (avoids ghost namespaces).
  namespaceIndex.clear();
  for (const [fqn] of keywordIndex) {
    const slashIdx = fqn.indexOf('/');
    if (slashIdx !== -1) {
      const ns = fqn.slice(0, slashIdx);
      const name = fqn.slice(slashIdx + 1);
      if (!namespaceIndex.has(ns)) namespaceIndex.set(ns, new Set());
      namespaceIndex.get(ns).add(name);
    }
  }
}

/**
 * Find the keyword that covers `position` in `doc`, if any.
 * Uses the cached scan results from indexDocument.
 */
function getKeywordAtPosition(doc, position) {
  const cache = docCache.get(doc.uri);
  if (!cache) return null;

  const { keywords, lineOffsets } = cache;
  const offset = lineOffsets[position.line] + position.character;

  for (const kw of keywords) {
    if (offset >= kw.index && offset <= kw.index + kw.length) {
      const lineStart = lineOffsets[position.line];
      return {
        ns: kw.ns,
        name: kw.name,
        fqn: kw.fqn,
        start: kw.index - lineStart,
        end: kw.index + kw.length - lineStart,
      };
    }
  }
  return null;
}

// ─── LSP Capabilities ─────────────────────────────────────────────────

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    completionProvider: { triggerCharacters: [':', '/'], resolveProvider: false },
    hoverProvider: true,
    definitionProvider: true,
    referencesProvider: true,
    renameProvider: { prepareProvider: true },
  },
}));

// ─── Document Sync ────────────────────────────────────────────────────

documents.onDidChangeContent(({ document }) => {
  indexDocument(document);
  validateDocument(document);
});

documents.onDidClose(({ document }) => {
  docCache.delete(document.uri);
});

// ─── Completion ───────────────────────────────────────────────────────

connection.onCompletion(({ textDocument, position }) => {
  const doc = documents.get(textDocument.uri);
  if (!doc) return [];

  const lineText = doc.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line, character: position.character },
  });

  const kwMatch = lineText.match(/:([\w.-]*(?:\/[\w.-]*)?)$/);
  if (!kwMatch) return [];

  const partial = kwMatch[1];
  const replaceStart = position.character - kwMatch[0].length; // includes the ':'
  const items = [];

  if (partial.includes('/')) {
    const [nsPrefix, namePrefix] = partial.split('/', 2);
    const names = namespaceIndex.get(nsPrefix);
    if (names) {
      for (const name of names) {
        if (name.startsWith(namePrefix || '')) {
          const fqn = `${nsPrefix}/${name}`;
          items.push({
            label: `:${fqn}`,
            kind: CompletionItemKind.Constant,
            detail: `Keyword in namespace ${nsPrefix}`,
            textEdit: {
              range: {
                start: { line: position.line, character: replaceStart },
                end: { line: position.line, character: position.character },
              },
              newText: `:${fqn}`,
            },
            documentation: {
              kind: MarkupKind.Markdown,
              value: `**Keyword** \`:${fqn}\`\n\nUsages: ${(keywordIndex.get(fqn) || []).length}`,
            },
          });
        }
      }
    }
  } else {
    for (const [fqn, locs] of keywordIndex) {
      if (fqn.startsWith(partial)) {
        items.push({
          label: `:${fqn}`,
          kind: CompletionItemKind.Constant,
          detail: `${locs.length} usage(s)`,
          textEdit: {
            range: {
              start: { line: position.line, character: replaceStart },
              end: { line: position.line, character: position.character },
            },
            newText: `:${fqn}`,
          },
        });
      }
    }
    for (const ns of namespaceIndex.keys()) {
      if (ns.startsWith(partial)) {
        items.push({
          label: `:${ns}/`,
          kind: CompletionItemKind.Module,
          detail: `Namespace (${namespaceIndex.get(ns).size} keywords)`,
          textEdit: {
            range: {
              start: { line: position.line, character: replaceStart },
              end: { line: position.line, character: position.character },
            },
            newText: `:${ns}/`,
          },
          command: { title: 'Trigger Suggest', command: 'editor.action.triggerSuggest' },
        });
      }
    }
  }

  return items;
});

// ─── Hover ────────────────────────────────────────────────────────────

connection.onHover(({ textDocument, position }) => {
  const doc = documents.get(textDocument.uri);
  if (!doc) return null;

  const kw = getKeywordAtPosition(doc, position);
  if (!kw) return null;

  const locs = keywordIndex.get(kw.fqn) || [];
  const nsInfo = kw.ns
    ? `**Namespace:** \`${kw.ns}\`\n\n**Name:** \`${kw.name}\``
    : `**Name:** \`${kw.name}\` *(unqualified)*`;

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: [
        `### Keyword \`:${kw.fqn}\``, '',
        nsInfo, '',
        `**Usages:** ${locs.length} across ${new Set(locs.map(l => l.uri)).size} file(s)`,
      ].join('\n'),
    },
    range: {
      start: { line: position.line, character: kw.start },
      end: { line: position.line, character: kw.end },
    },
  };
});

// ─── Go to Definition ─────────────────────────────────────────────────

connection.onDefinition(({ textDocument, position }) => {
  const doc = documents.get(textDocument.uri);
  if (!doc) return null;

  const kw = getKeywordAtPosition(doc, position);
  if (!kw) return null;

  const locs = keywordIndex.get(kw.fqn);
  if (!locs || locs.length === 0) return null;

  const first = locs[0];
  return {
    uri: first.uri,
    range: {
      start: { line: first.line, character: first.character },
      end: { line: first.line, character: first.endCharacter },
    },
  };
});

// ─── Find References ──────────────────────────────────────────────────

connection.onReferences(({ textDocument, position }) => {
  const doc = documents.get(textDocument.uri);
  if (!doc) return [];

  const kw = getKeywordAtPosition(doc, position);
  if (!kw) return [];

  return (keywordIndex.get(kw.fqn) || []).map(loc => ({
    uri: loc.uri,
    range: {
      start: { line: loc.line, character: loc.character },
      end: { line: loc.line, character: loc.endCharacter },
    },
  }));
});

// ─── Rename ───────────────────────────────────────────────────────────

connection.onPrepareRename(({ textDocument, position }) => {
  const doc = documents.get(textDocument.uri);
  if (!doc) return null;

  const kw = getKeywordAtPosition(doc, position);
  if (!kw) return null;

  return {
    range: {
      start: { line: position.line, character: kw.start },
      end: { line: position.line, character: kw.end },
    },
    placeholder: `:${kw.fqn}`,
  };
});

connection.onRenameRequest(({ textDocument, position, newName }) => {
  const doc = documents.get(textDocument.uri);
  if (!doc) return null;

  const kw = getKeywordAtPosition(doc, position);
  if (!kw) return null;

  const newKw = newName.startsWith(':') ? newName : `:${newName}`;
  const changes = {};

  for (const loc of (keywordIndex.get(kw.fqn) || [])) {
    if (!changes[loc.uri]) changes[loc.uri] = [];
    changes[loc.uri].push({
      range: {
        start: { line: loc.line, character: loc.character },
        end: { line: loc.line, character: loc.endCharacter },
      },
      newText: newKw,
    });
  }

  return { changes };
});

// ─── Diagnostics ──────────────────────────────────────────────────────

function validateDocument(doc) {
  const cache = docCache.get(doc.uri);
  if (!cache) return;

  const { keywords, lineOffsets } = cache;
  const diagnostics = [];

  for (const { ns, fqn, index, length } of keywords) {
    if (!ns) continue;
    const locs = keywordIndex.get(fqn) || [];
    if (locs.length !== 1) continue;

    const { line, character } = offsetToPosition(lineOffsets, index);
    diagnostics.push({
      severity: DiagnosticSeverity.Information,
      range: {
        start: { line, character },
        end: { line, character: character + length },
      },
      message: `Keyword :${fqn} is used only once. Possible typo?`,
      source: 'js-qualified-keywords',
    });
  }

  connection.sendDiagnostics({ uri: doc.uri, diagnostics });
}

// ─── Start ────────────────────────────────────────────────────────────

documents.listen(connection);
connection.listen();
connection.console.log('Clojure Keywords LSP server started');
