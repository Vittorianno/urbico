# Codespaces — ambiente de desenvolvimento

Este documento descreve apenas a **preparação do ambiente** (Codespaces/devcontainer).
Nenhuma tela, funcionalidade ou dependência do Urbico foi alterada por isso.

## Abrir o Codespace

1. No GitHub, em `Vittorianno/urbico` → botão **Code** → aba **Codespaces** → **Create codespace on main**.
2. Aguarde o build do container (`postCreateCommand` roda `corepack enable` + `pnpm install` automaticamente).

## Iniciar o Urbico dentro do Codespace

```bash
cp .env.example .env   # preencha com seus próprios valores (ou use Codespaces Secrets, abaixo)
pnpm dev
```

Isso sobe o backend (Express + tRPC, porta 3000) e o Metro/Expo Web (porta 8081).
O Codespace encaminha as duas portas automaticamente (ver `forwardPorts` em
`.devcontainer/devcontainer.json`); a aba **Ports** do VS Code mostra os links.

Para Android, use `pnpm android` como no `README.md` — a emulação de dispositivo
em si não roda dentro do Codespace, mas o Metro bundler sim (conecte um
dispositivo físico ou emulador local ao endereço público da porta 8081).

## Variáveis de ambiente / Secrets

O repositório **não** versiona nenhum `.env` (está no `.gitignore` — um `.env`
chegou a ser commitado por engano em 2026-09-06 e foi removido; nenhum segredo
real chegou a vazar, só um `JWT_SECRET` de exemplo, que não deve ser
reaproveitado). Copie `.env.example` para `.env` dentro do Codespace e
preencha com seus próprios valores de desenvolvimento.

Para qualquer valor real (banco de dados, `SPTRANS_TOKEN`, OAuth, etc.),
prefira **Codespaces Secrets** em vez de editar o `.env` local:

GitHub → Settings do repositório (ou da conta) → **Codespaces** → **Secrets**
→ adicionar cada variável listada em `.env.example`.

Secrets configurados assim ficam disponíveis como variáveis de ambiente dentro
de qualquer Codespace deste repositório, sem nunca tocar o código versionado.

## GitHub MCP Server (agentes de IA)

`.vscode/mcp.json` registra o **GitHub MCP Server remoto e oficial**
(`https://api.githubcopilot.com/mcp/`) para uso por agentes compatíveis com MCP
dentro do editor (Copilot Chat, Claude Code, etc.). Não há token no arquivo:
a autenticação é feita por OAuth, iniciada pelo próprio agente/editor ao
conectar pela primeira vez — o GitHub pedirá para autorizar o acesso e quais
permissões conceder (leitura do repositório, criação de branches/commits/PRs).

Para **ChatGPT**, a conexão com este repositório é configurada do lado do
ChatGPT (conector/integração do GitHub nas configurações da própria conta
ChatGPT), autorizando acesso ao repositório `Vittorianno/urbico` — isso não
depende de nenhum arquivo deste repositório, só da autorização OAuth
concedida na hora de conectar.

> Nota para quem for revisar relatórios de auditoria gerados por outro
> agente: confirme sempre contra o conteúdo atual do arquivo antes de agir —
> já houve pelo menos um caso (`docs/AUDIT-REPORT.md`, 06/09) que apontou como
> "quebrado" algo que já estava corrigido em um commit anterior. Ferramentas
> de busca/análise remota podem ficar desatualizadas; o arquivo em si é a
> fonte da verdade.

## Verificação rápida do ambiente

```bash
git status
pnpm install
pnpm check   # tsc --noEmit
pnpm lint    # expo lint
pnpm test    # vitest run
```
