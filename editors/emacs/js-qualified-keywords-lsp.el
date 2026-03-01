;;; js-qualified-keywords-lsp.el --- lsp-mode client for js-qualified-keywords -*- lexical-binding: t -*-

;; Register the js-qualified-keywords LSP server with lsp-mode.
;;
;; Usage — add to your init.el:
;;
;;   (setq js-qualified-keywords-lsp-server-dir "/path/to/js-qualified-keywords/lsp-server")
;;   (load "/path/to/js-qualified-keywords/editors/emacs/js-qualified-keywords-lsp.el")
;;
;; Then open any .js / .ts file and run M-x lsp.

(require 'lsp-mode)

(defcustom js-qualified-keywords-lsp-server-dir nil
  "Absolute path to the js-qualified-keywords lsp-server/ directory.
Must contain server.js and a node_modules/ with vscode-languageserver installed."
  :type 'directory
  :group 'lsp-mode)

(defun js-qualified-keywords-lsp--server-command ()
  (unless js-qualified-keywords-lsp-server-dir
    (user-error "Set `js-qualified-keywords-lsp-server-dir` before loading this file"))
  (list "node"
        (expand-file-name "server.js" js-qualified-keywords-lsp-server-dir)
        "--stdio"))

(lsp-register-client
 (make-lsp-client
  :new-connection
  (lsp-stdio-connection #'js-qualified-keywords-lsp--server-command)

  :activation-fn
  (lsp-activate-on "javascript" "javascriptreact" "typescript" "typescriptreact")

  :server-id 'js-qualified-keywords

  :priority -1  ; yield to tsserver / other JS servers; raise if you want this first
  ))

(provide 'js-qualified-keywords-lsp)
;;; js-qualified-keywords-lsp.el ends here
