#!/usr/bin/env bash
# Start the clojure-keywords LSP server over stdio.
exec node "$(dirname "$0")/server.js" --stdio
