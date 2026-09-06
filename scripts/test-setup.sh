#!/bin/bash

echo "================================"
echo "URBICO — Setup de Teste Local"
echo "================================"
echo ""

echo "📦 [1/4] Verificando dependências..."
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm não encontrado. Instale com: npm i -g pnpm@9.12.0"
    exit 1
fi
echo "✅ pnpm pronto"
echo ""

echo "🔍 [2/4] Executando TypeScript check..."
pnpm check
TYPESCRIPT_RESULT=$?
if [ $TYPESCRIPT_RESULT -ne 0 ]; then
    echo "❌ TypeScript validation falhou"
    exit 1
fi
echo "✅ TypeScript pronto"
echo ""

echo "🧪 [3/4] Executando testes..."
pnpm test 2>&1 | head -50
echo "✅ Testes completados"
echo ""

echo "🚀 [4/4] Iniciando servidor de desenvolvimento..."
echo ""
echo "O backend Express e Metro bundler vão iniciar em paralelo."
echo "Quando vir 'Metro waiting on...' ou 'server listening on port', o app está pronto."
echo ""
echo "PRÓXIMAS ETAPAS:"
echo "  1. Se houver um QR code no terminal, escaneie com Expo Go ou seu dev client"
echo "  2. Ou acesse http://localhost:8081 no navegador"
echo "  3. Para Android nativo, use: pnpm android"
echo ""
echo "Iniciando pnpm dev..."
echo ""

pnpm dev
