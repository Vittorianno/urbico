# Autenticação, perfil e notificações do passageiro

Estado da implementação da especificação "Autenticação, Perfil e Preferências do Passageiro".
Tudo abaixo foi escrito sem acesso a um ambiente de execução: **nenhum teste, lint ou `tsc` foi rodado**.

## Login: Google direto (sem Supabase Auth)

Decisão de produto: a autenticação é o Google Auth direto; o Supabase fica reservado à inteligência do Norby e não participa do login.

Fluxo (igual no web e no app nativo), em `server/_core/google-auth-routes.ts`:

1. O app abre `GET /api/auth/google/start?return_to=...` (web: `<origem>/login`; nativo: `urbico://login`). O servidor valida o `return_to` (anti open redirect), grava um nonce em cookie e redireciona ao Google.
2. O Google volta em `GET /api/auth/google/callback`. O servidor confere o `state` assinado e o nonce, troca o `code` pelo `id_token` (com o client secret, que nunca sai do servidor), valida assinatura/emissor/audiência/e-mail verificado, cria ou atualiza o usuário e devolve o usuário ao app com um `login_code` de uso único (60 s).
3. O app chama `POST /api/auth/google/exchange {code}` e recebe a sessão do Urbico (cookie no web; token no nativo).

Contas antigas: se o e-mail verificado do Google já existe na tabela `users` (contas criadas pelo Supabase), o login reaproveita aquele `openId`, então favoritos e agenda do backup continuam. Contas novas usam `google:<sub>`. O login por e-mail e senha e a rota `/api/auth/session` (Supabase) foram removidos; sessões já emitidas continuam valendo até expirar.

### Configuração necessária (fora do repositório)

No Google Cloud Console, no cliente OAuth do tipo "Aplicativo da Web":

- **URIs de redirecionamento autorizados:** `http://localhost:3000/api/auth/google/callback` (desenvolvimento) e a URL pública do seu servidor `.../api/auth/google/callback` (produção).

No `.env` do servidor:

- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (o mesmo cliente do Google Agenda serve);
- `GOOGLE_AUTH_REDIRECT_URI` = exatamente uma das URLs acima;
- `JWT_SECRET` (assina a sessão e o `state`);
- `AUTH_ALLOWED_RETURN_ORIGINS` = origens web do app em produção, separadas por vírgula (`http://localhost:8081` já é aceito fora de produção; `urbico://login` é sempre aceito).

Limites: os códigos de login ficam em memória (com mais de uma instância do servidor seria preciso um armazenamento compartilhado) e não há limite de tentativas nessas rotas.

## Como funciona o resto

- **Modo visitante:** o app não exige login. `AuthGuard` (`app/_layout.tsx`) só tira da tela de login quem já está autenticado. Perfil → "Entrar ou criar conta" abre `/login`, que tem "X" e "Continuar sem conta".
- **Estados do Perfil:** carregando, autenticado, erro ao verificar a sessão (com "Tentar novamente") e visitante.
- **Foto de perfil:** vem do claim `picture` do Google, validada em `server/_core/avatar.ts` (https, sem credenciais, ≤ 1024 caracteres) e gravada em `users.avatarUrl`. A imagem nunca é baixada nem copiada. Sem foto ou com falha de carregamento, `components/user-avatar.tsx` mostra iniciais (ou ícone).
- **Preferências:** chave geral (`notificationsEnabled`), categorias (`notificationPreferences`) e voz do Norby ficam no estado local (`lib/urbico-context.tsx`) e, com conta, no backup por usuário (`userData.pull/push`, isolado por `ctx.user.openId`).
- **Notificações:** categorias reais hoje — `departureAlerts` ("Hora de sair") e `tripUpdates` (avisos durante a viagem). Ambas são notificações **locais**; não existe push remoto. A tela `/notifications` separa a preferência do app da permissão do sistema.
- **Logout / troca de conta:** logout encerra a sessão Urbico e limpa os dados pessoais locais (`resetPrivateData`). Uma troca de conta sem logout é detectada pelo dono gravado no aparelho (`urbico.local-data-owner`). Erro de rede ou sessão expirada **não** limpam nada.

## Pendências e limites

- **Migração:** rodar `pnpm db:push` (gera e aplica a migração da coluna `avatarUrl`) **antes** de subir o servidor novo. Sem a coluna, as consultas de usuário falham.
- Instalações antigas não têm "dono" gravado: os dados locais são adotados pela primeira conta que entrar (uma única vez).
- Não há opção de tema nem de idioma: as telas usam a paleta fixa de `components/urbico-ui.tsx`, então a opção não teria efeito.
- Sem categorias para interrupções de linha, linhas/paradas favoritas e lembretes pessoais: não há fonte de eventos nem entrega push.
- Foto na aba de navegação e troca/upload de foto: não implementados.
- `server/_core/supabaseAuth.ts` e `lib/_core/supabase.ts` ficaram no repositório, sem uso no login (o logout ainda limpa uma sessão antiga do Supabase guardada no aparelho). Podem ser removidos quando o Norby deixar claro o que usa do Supabase.
- `/api/auth/me` não devolve `role`, então o painel admin nunca aparece no Perfil (pré-existente, não alterado).
- O texto "Plano Free" do Perfil é fixo (pré-existente).

## Roteiro de validação manual

1. **Visitante:** abrir o app sem conta (mapa, rotas e Norby abrem); Perfil mostra "Entrar ou criar conta".
2. **Login:** entrar com Google; nome, e-mail e foto vêm da sessão; cancelar no Google mostra "Login cancelado" na tela.
3. **Preferências:** alterar a voz do Norby, fechar e reabrir; conferir em outro aparelho após novo login.
4. **Notificações:** ligar/desligar a chave geral e cada categoria; conferir o estado da permissão do sistema; com permissão bloqueada, a tela explica e oferece abrir as configurações.
5. **Segurança:** logout → favoritos/agenda locais somem; entrar com outra conta → nada da anterior aparece; `GET /api/auth/google/start?return_to=https://evil.com` responde 400.
6. **Compatibilidade:** `pnpm check && pnpm lint && pnpm test`.
