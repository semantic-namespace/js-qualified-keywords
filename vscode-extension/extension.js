const path = require('path');
const { workspace } = require('vscode');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

/** @type {LanguageClient} */
let client;

function activate(context) {
  // When running from the monorepo (development), the server is at ../lsp-server/.
  // When packaged as a VSIX, it's bundled at ./lsp-server/ inside the extension.
  const devPath = context.asAbsolutePath(path.join('..', 'lsp-server', 'server.js'));
  const bundledPath = context.asAbsolutePath(path.join('lsp-server', 'server.js'));

  let serverModule;
  try {
    require.resolve(devPath);
    serverModule = devPath;
  } catch {
    serverModule = bundledPath;
  }

  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  const clientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'javascript' },
      { scheme: 'file', language: 'javascriptreact' },
      { scheme: 'file', language: 'typescript' },
      { scheme: 'file', language: 'typescriptreact' },
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.{js,jsx,ts,tsx}'),
    },
  };

  client = new LanguageClient(
    'clojureKeywords',
    'Clojure Keywords',
    serverOptions,
    clientOptions
  );

  client.start();
}

function deactivate() {
  if (client) return client.stop();
}

module.exports = { activate, deactivate };
