# Autenticação, perfil e notificações do passageiro

Estado da implementação da especificação "Autenticação, Perfil e Preferências do Passageiro".
Tudo abaixo foi escrito sem acesso a um ambiente de execução: **nenhum teste, lint ou `tsc` foi rodado**.

## Como funciona

- **Modo visitante:** o app não exige login. `AuthGuard` (`app/_layout.tsx`) só tira da tela de login quem já está autenticado. Perfil → "Entrar ou criar conta" abre `/login`, que tem "X" e "Continuar sem conta".
- **Estados do Perfil:** carregando, autenticado, erro ao verificar a sessão (com "Tentar novamente") e visitante.
- **Foto de perfil:** vem do `user_metadata` do Supabase (`avatar_url`/`picture`), validada em `server/_core/avatar.ts` (https, sem credenciais, ≤ 1024 caracteres) e gravada em `users.avatarUrl`. A imagem nunca é baixada nem copiada. Sem foto ou com falha de carregamento, `components/user-avatar.tsx` mostra iniciais (ou ícone).
- **Preferências:** chave geral (`notificationsEnabled`), categorias (`notificationPreferences`) e voz do Norby ficam no estado local (`lib/urbico-context.tsx`) e, com conta, no backup por usuário (`userData.pull/push`, isolado por `ctx.user.openId`).
- **Notificações:** categorias reais hoje — `departureAlerts` ("Hora de sair") e `tripUpdates` (avisos durante a viagem). Ambas são notificações **locais**; não existe push remoto. A tela `/notifications` separa a preferência do app da permissão do sistema.
- **Logout / troca de conta:** logout encerra a sessão Urbico e a do Supabase e limpa os dados pessoais locais (`resetPrivateData`). Uma troca de conta sem logout é detectada pelo dono gravado no aparelho (`urbico.local-data-owner`). Erro de rede ou sessão expirada **não** limpam nada.

## Pendências e limites

- **Migração:** rodar `pnpm db:push` (gera e aplica a migração da coluna `avatarUrl`) **antes** de subir o servidor novo. Sem a coluna, as consultas de usuário falham.
- Instalações antigas não têm "dono" gravado: os dados locais são adotados pela primeira conta que entrar (uma única vez).
- Não há opção de tema nem de idioma: as telas usam a paleta fixa de `components/urbico-ui.tsx`, então a opção não teria efeito.
- Sem categorias para interrupções de linha, linhas/paradas favoritas e lembretes pessoais: não há fonte de eventos nem entrega push.
- Foto na aba de navegação e troca/upload de foto: não implementados.
- `/api/auth/me` não devolve `role`, então o painel admin nunca aparece no Perfil (pré-existente, não alterado).
- O texto "Plano Free" do Perfil é fixo (pré-existente).

## Roteiro de validação manual

1. **Visitante:** abrir o app sem conta (mapa, rotas e Norby abrem); Perfil mostra "Entrar ou criar conta".
2. **Login:** entrar com Google; nome, e-mail e foto vêm da sessão; conta sem foto mostra iniciais.
3. **Preferências:** alterar a voz do Norby, fechar e reabrir; conferir em outro aparelho após novo login.
4. **Notificações:** ligar/desligar a chave geral e cada categoria; conferir o estado da permissão do sistema; com permissão bloqueada, a tela explica e oferece abrir as configurações.
5. **Segurança:** logout → favoritos/agenda locais somem; entrar com outra conta → nada da anterior aparece.
6. **Compatibilidade:** `pnpm check && pnpm lint && pnpm test`.
