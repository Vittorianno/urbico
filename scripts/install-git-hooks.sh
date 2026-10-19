#!/usr/bin/env bash
# Ativa os hooks do Git deste repositório (pre-commit e pre-push com a guarda
# de segredos). Rode UMA vez em cada clone / Codespace / Termux:
#   bash scripts/install-git-hooks.sh
set -euo pipefail
cd "$(dirname "$0")/.."
chmod +x .githooks/* scripts/check-secrets.mjs
git config core.hooksPath .githooks
echo "Hooks ativados (core.hooksPath=.githooks)."
echo "Teste agora:  node scripts/check-secrets.mjs"
