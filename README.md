# Urbico

App de mobilidade urbana focado em rotina e pontualidade, com o assistente de
voz **Norby**. Integra dados oficiais da SPTrans (Olho Vivo) para calcular
rotas, acompanhar veículos em tempo real e avisar a melhor hora de sair de
casa para chegar a um compromisso.

Stack: **Expo (React Native + Web)**, **Expo Router**, **tRPC**, **Drizzle
ORM / MySQL**, **MapLibre**.

## Sumário

- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Execução local](#execução-local)
- [Banco de dados](#banco-de-dados)
- [Mapas, geocodificação e rotas (MapLibre / Pelias / Valhalla)](#mapas-geocodificação-e-rotas-maplibre--pelias--valhalla)
- [SPTrans (Olho Vivo)](#sptrans-olho-vivo)
- [Norby / Ollama](#norby--ollama)
- [Autenticação — leia antes de publicar](#autenticação--leia-antes-de-publicar)
- [Execução Web](#execução-web)
- [Execução Android (Expo Go / dev client)](#execução-android-expo-go--dev-client)
- [EAS Build e geração de APK](#eas-build-e-geração-de-apk)
- [Testes e qualidade](#testes-e-qualidade)
- [Dependências legadas do template Manus](#dependências-legadas-do-template-manus)

## Requisitos

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+ (`corepack enable` já resolve a versão certa via `packageManager` no `package.json`)
- Um banco MySQL acessível (local via Docker, ou um serviço gerenciado) — opcional para rodar o app, obrigatório para persistência real
- Para build Android: conta na [Expo/EAS](https://expo.dev/) e `eas-cli` (`npm i -g eas-cli` ou `npx eas-cli`)

## Instalação

```bash
pnpm install
cp .env.example .env
# edite .env com seus valores (veja a seção abaixo)
```

## Variáveis de ambiente

Todas as variáveis estão documentadas com comentários em `.env.example`.
Resumo por categoria:

| Variável | Obrigatória? | Efeito se ausente |
|---|---|---|
| `PORT` | Não | Usa 3000, ou a próxima porta livre |
| `DATABASE_URL` | Não* | App inicia sem persistência: sem login salvo, sem alertas de saída, sem relatos de lotação |
| `JWT_SECRET` | Sim, para autenticação funcionar | Sessões não podem ser assinadas/verificadas |
| `OAUTH_SERVER_URL`, `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, `OWNER_NAME` | Sim, para login | Ver [Autenticação](#autenticação--leia-antes-de-publicar) — hoje dependem de um servidor OAuth específico do Manus |
| `SPTRANS_TOKEN` | Sim, para dados de ônibus | Consultas de linha/parada/veículo falham com erro tratado (não derruba o app) |
| `PELIAS_BASE_URL` | Não | Busca automática de endereço fica indisponível; endereço pode ser digitado manualmente |
| `VALHALLA_BASE_URL` | Não | Cálculo de rota a pé fica indisponível |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Não | Norby usa respostas locais por regras em vez de um modelo de linguagem |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Não | Só afeta recursos legados do Manus não usados pelo Urbico hoje (ver seção final) |
| `EXPO_PUBLIC_API_BASE_URL` | Recomendado para build nativo/produção | Em dev web é derivada do hostname; sem valor explícito, builds nativos não sabem onde está a API |

*Tecnicamente opcional (o servidor não derruba sem ela), mas praticamente
obrigatória — sem banco a maior parte dos recursos do produto fica inerte.

## Execução local

```bash
pnpm dev
```

Isso sobe **duas coisas em paralelo**:
- `dev:server` — o backend Express + tRPC (`server/_core/index.ts`), porta 3000 por padrão
- `dev:metro` — o Metro bundler do Expo em modo web, porta 8081 por padrão

Para abrir no Android/iOS durante o desenvolvimento, veja [Execução Android](#execução-android-expo-go--dev-client).

## Banco de dados

Drizzle ORM + MySQL. O schema fica em `drizzle/schema.ts`.

```bash
# gera a migração SQL a partir do schema.ts e aplica no banco de DATABASE_URL
pnpm db:push
```

Isso executa `drizzle-kit generate` (cria os arquivos SQL em `drizzle/`) e em
seguida `drizzle-kit migrate` (aplica no banco). Rode isso sempre que
`drizzle/schema.ts` mudar — por exemplo, depois de puxar mudanças que
adicionam uma tabela nova.

Sem `DATABASE_URL` configurado, todas as funções em `server/db.ts` degradam
graciosamente (retornam vazio/null ou avisam no console) em vez de derrubar o
processo.

## Mapas, geocodificação e rotas (MapLibre / Pelias / Valhalla)

- **Mapa**: [MapLibre](https://maplibre.org/) nativo (`@maplibre/maplibre-react-native`) e web (estilo aberto [OpenFreeMap](https://openfreemap.org/), sem chave de API). Não há dependência do Google Maps.
- **Geocodificação / busca de endereço**: uma instância própria do [Pelias](https://pelias.io/) apontada por `PELIAS_BASE_URL`. Sem isso, a busca automática de endereço fica indisponível, mas o compromisso ainda pode ser salvo com endereço digitado manualmente.
- **Rota a pé**: uma instância própria do [Valhalla](https://valhalla.github.io/valhalla/) apontada por `VALHALLA_BASE_URL`. Sem isso, o app usa uma estimativa simples de distância/velocidade em vez de uma rota real.

Ambos os serviços rodam fora deste repositório (você precisa hospedá-los ou
usar um provedor gerenciado); o app só consome as APIs HTTP deles.

## SPTrans (Olho Vivo)

1. Peça um token de desenvolvedor em <http://www.sptrans.com.br/desenvolvedores/>.
2. Configure `SPTRANS_TOKEN` no `.env` do **backend** — o token nunca deve
   estar no app cliente, e o código já garante isso (`server/integrations/sptrans.ts`
   é o único lugar que o lê, e roda só no servidor).
3. A sessão autenticada é cacheada por alguns minutos e reaproveitada entre
   requisições, para não estourar o limite de autenticações da API oficial.

## Norby / Ollama

O Norby tenta, nesta ordem:
1. Um modelo local via [Ollama](https://ollama.com/) (`OLLAMA_BASE_URL` + `OLLAMA_MODEL`), se configurado.
2. Se o Ollama não estiver configurado ou a chamada falhar por qualquer motivo, cai para respostas locais baseadas em regras (`lib/urbico-logic.ts`) — o app nunca fica sem resposta, e nunca depende de um provedor de IA hospedado externo.

## Autenticação — leia antes de publicar

**Importante**: a autenticação atual (`server/_core/sdk.ts`,
`server/_core/oauth.ts`) fala com um servidor OAuth que segue o protocolo
específico da plataforma Manus (endpoints como
`/webdev.v1.WebDevAuthPublicService/ExchangeToken`) — **não** é OAuth padrão
do Google, Apple ou GitHub. Isso significa que, para o login funcionar fora
do ambiente onde esse servidor existir, uma de duas coisas precisa acontecer:

- você mantém acesso a um servidor compatível com esse protocolo (por
  exemplo, se sua conta/projeto no Manus continuar ativo e você só estiver
  hospedando o **app** em outro lugar); ou
- a autenticação é substituída por um provedor independente (e-mail/senha
  próprio, ou OAuth padrão de Google/Apple/GitHub).

Essa substituição não foi feita neste momento porque é uma decisão de
produto (qual provedor, qual fluxo de cadastro) que precisa ser sua — não
algo para eu escolher unilateralmente em nome do projeto. O restante do
sistema (banco, tRPC, telas) não depende de detalhes do Manus e funciona
igual com qualquer backend de auth que emita um cookie/token de sessão
compatível com o formato já usado (`shared/const.ts` → `COOKIE_NAME`).

O modo de desenvolvimento não expõe nenhum atalho de autenticação sem
segurança: sem `OAUTH_SERVER_URL`/`JWT_SECRET` configurados, o login
simplesmente não funciona (falha de forma controlada, sem abrir uma porta
insegura).

## Execução Web

```bash
pnpm dev
```

O Metro sobe o app em modo web em `http://localhost:8081` (ou a porta de
`EXPO_PORT`). O backend precisa estar rodando (`dev:server`, incluso no
`pnpm dev`) na porta 3000 para as chamadas de API funcionarem.

## Execução Android (Expo Go / dev client)

Para desenvolvimento rápido sem gerar um build nativo completo:

```bash
pnpm android
```

Isso abre o Expo CLI, que tenta abrir no Android conectado/emulado. Como o
projeto usa módulos nativos que exigem um **dev client** (localização em
segundo plano, reconhecimento de fala, MapLibre), o Expo Go padrão da loja
pode não suportar tudo — gere um dev client próprio se necessário:

```bash
eas build --profile development --platform android
```

Instale o `.apk` gerado no aparelho/emulador e rode `pnpm dev:metro` para
conectar.

## EAS Build e geração de APK

1. Instale a CLI e faça login (uma vez):
   ```bash
   npm i -g eas-cli
   eas login
   ```
2. Vincule o projeto à sua conta Expo (gera um `projectId` e grava em `app.config.ts`/`extra.eas`):
   ```bash
   eas init
   ```
3. Ajuste em `eas.json` a URL de `EXPO_PUBLIC_API_BASE_URL` de cada perfil
   (`development`, `preview`, `production`) para apontar ao backend
   correspondente.
4. Gere o **APK instalável diretamente** (build de desenvolvimento ou de
   distribuição interna, sem precisar da Play Store):
   ```bash
   eas build --platform android --profile preview
   ```
   ou, para um dev client com hot reload:
   ```bash
   eas build --platform android --profile development
   ```
5. Para publicar na Play Store, gere o `.aab` de produção:
   ```bash
   eas build --platform android --profile production
   ```

O comando exato pedido no objetivo 16 é:

```bash
eas build --platform android --profile preview
```

(gera um `.apk` de distribuição interna, instalável diretamente no
aparelho via link/QR code que o EAS fornece ao final do build).

## Testes e qualidade

```bash
pnpm check   # tsc --noEmit
pnpm lint    # expo lint
pnpm test    # vitest run
```

Alguns testes (`tests/external-integrations.test.ts`,
`tests/server-integrations.test.ts`) fazem chamadas de rede reais à API
pública da SPTrans e exigem `SPTRANS_TOKEN` configurado no ambiente de teste
para passar.

## Dependências legadas do template Manus

O projeto foi originalmente criado a partir de um template da plataforma
Manus. Os arquivos abaixo, em `server/_core/`, implementam recursos
específicos dessa plataforma (Forge API) que **nenhuma tela ou rota do
Urbico usa hoje**:

- `storage.ts` / `storageProxy.ts` — upload/proxy de arquivos via S3 do Manus
- `imageGeneration.ts` — geração de imagem por IA
- `voiceTranscription.ts` — transcrição de áudio por IA
- `dataApi.ts` — chamadas genéricas à "Web Dev Service" do Manus
- `heartbeat.ts` — agendamento de cron jobs via Manus (substituído, para os
  alertas de saída, pelo agendador interno em `server/_core/index.ts`)
- `notification.ts` (+ o endpoint `system.notifyOwner` em `server/_core/systemRouter.ts`) — notificação ao dono do projeto via Manus

Nenhum deles foi removido nesta rodada: uma tentativa anterior de remover um
arquivo aparentemente não utilizado (`lib/transit-engine.ts`) quebrou um
teste que a busca de código não havia detectado, então a remoção dos
arquivos acima ficou para você confirmar localmente (`grep -rn "nome-do-arquivo"`
é mais confiável que ferramentas de busca remota) antes de apagar.
