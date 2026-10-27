# Urbico — prontidão para produção

**Última validação:** 27/10/2026  
**Commit validado:** `3fa039a` — `fix: explicit address geocoding and coordinate-safe saves`  
**Status:** o código passa nas validações de build, mas o produto **ainda não está pronto para lançamento público**. Backend público, banco de produção, URLs de build e testes em dispositivo continuam pendentes.

## Estado validado do repositório

Validação executada numa cópia limpa do `main`, sem usar nem sobrescrever as alterações locais do workspace de desenvolvimento.

| Verificação | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | passou |
| `pnpm exec expo install --check` | passou — dependências compatíveis com Expo SDK 57 |
| `pnpm check` | passou |
| `pnpm lint` | passou; há um aviso não fatal de formato ESM no ESLint |
| `pnpm exec vitest run` | **42 aprovados, 3 ignorados** |
| `pnpm build` | passou |
| `expo export --platform web` | passou |
| `expo export --platform android` | passou — bundle JavaScript nativo gerado |
| `expo prebuild --platform android --no-install` | passou |
| GitHub Actions — CI | [passou no commit validado](https://github.com/Vittorianno/urbico/actions/runs/40446090431) |
| GitHub Actions — secret scan | [passou no commit validado](https://github.com/Vittorianno/urbico/actions/runs/40446090463) |

**Limite importante:** export Android e `expo prebuild` não são um APK. O Codespace usado nesta validação não tem Java nem Android SDK; a compilação nativa ainda precisa ser feita por EAS Build ou num ambiente Android completo. Os testes também não substituem a validação num aparelho físico.

## Correções já integradas

- **Expo SDK 57:** dependências e lockfile alinhados com as versões compatíveis.
- **Exportação web limpa:** o `metro.config.js` pré-cria o cache CSS necessário para evitar a falha de hash do `react-native-css-interop` em builds frios.
- **Busca de endereços:** a ação explícita de busca pode geocodificar o texto; resultados desatualizados não são selecionados e coordenadas resolvidas são encaminhadas aos fluxos de rota/favoritos.
- **Nominatim:** o serviço público não é usado para autocomplete contínuo. Sem Pelias, sugestões automáticas ficam indisponíveis; a pessoa pode digitar o endereço e pedir uma busca pontual.
- **Caminhada:** o backend usa Valhalla com `costing: pedestrian`. Sem Valhalla ou em caso de falha, a rota a pé fica indisponível; OSRM público não é apresentado como rota pedestre.
- **Autenticação e banco:** os testes verificam que a API retorna indisponibilidade explícita quando o MySQL não está acessível.
- **Segurança:** limites de requisição, validação de CORS, timeouts externos, criptografia AES-256-GCM para tokens do Google Agenda e verificações de segredos estão integrados.

## Bloqueadores antes do lançamento

- [ ] **Hospedar o backend** num ambiente Node de processo contínuo, com HTTPS e domínio estável. O monitor de alertas usa um agendador interno; não assumir que uma hospedagem serverless o manterá ativo.
- [ ] **Configurar MySQL de produção:** definir `DATABASE_URL`, executar `pnpm db:push` e validar `GET /api/ready`. Sem banco acessível, a API pode iniciar, mas login persistido, alertas e outros recursos dependentes de banco não funcionam.
- [ ] **Configurar Supabase Auth:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`; verificar confirmação de e-mail e o provedor Google no painel se for oferecer login Google. Definir `JWT_SECRET` aleatório e forte no backend.
- [ ] **Configurar SPTrans:** fornecer `SPTRANS_TOKEN` válido apenas no servidor e confirmar dados reais de linhas/veículos.
- [ ] **Definir as URLs de API em `eas.json`:** os perfis development, preview e production ainda contêm domínios de exemplo (`SEU-BACKEND-...`). Um app nativo gerado com esses valores não alcançará o backend real.
- [ ] **Vincular o projeto Expo:** `app.config.ts` ainda não contém `extra.eas.projectId`. Executar `eas login` e `eas init` com a conta Expo pretendida antes do primeiro build EAS.
- [ ] **Configurar CORS e proxy:** preencher `CORS_ALLOWED_ORIGINS` para as origens web reais e definir `TRUST_PROXY` de acordo com a topologia do proxy reverso.
- [ ] **Decidir e provisionar geosserviços:** `PELIAS_BASE_URL` é necessário para sugestões automáticas; `VALHALLA_BASE_URL` é necessário para rotas a pé. Sem eles, as funcionalidades relacionadas ficam explicitamente indisponíveis. O limitador/cache do Nominatim é por processo; se houver várias instâncias do backend, usar limitador/cache compartilhado ou geocodificador próprio.
- [ ] **Testar num aparelho real:** login/cadastro, GPS em segundo plano, notificações, reconhecimento/síntese de voz, MapLibre, rotas e integração SPTrans ponta a ponta.
- [ ] **Revisar publicação na loja:** política de privacidade pública, justificativa de localização em segundo plano e microfone, permissões Android, identidade de push/Firebase se notificações remotas forem necessárias e IDs reais do AdMob se forem ativados anúncios de produção.

## Configuração do Google Agenda (opcional)

Só preencher se a integração de agenda for oferecida:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` no backend.
- `TOKEN_ENCRYPTION_KEY` aleatória e persistente (por exemplo, gerar com `openssl rand -base64 32`). Perder/trocar a chave exige que as pessoas reconectem a agenda.
- Registrar a URI de callback exata no Google Cloud Console.

O login Google do Urbico é uma configuração separada, feita no provedor Google dentro do Supabase.

## Infraestrutura e custos

- O backend MySQL e os serviços geográficos são componentes separados.
- Pelias/Valhalla com dados geográficos podem exceder a memória de uma VM de 1 GB; não instalar ambos nessa VM sem antes dimensionar e medir o consumo. Para manter custo baixo, pode-se lançar inicialmente com busca manual/uma busca pontual e sem rota a pé, deixando a indisponibilidade explícita.
- O Norby usa respostas locais por regras quando `OLLAMA_BASE_URL`/`OLLAMA_MODEL` não estão configurados. Um backend na nuvem não consegue acessar o Ollama que roda apenas no celular ou notebook do usuário.
- Não há comprovação de deploy de produção concluído nesta auditoria. A conectividade SSH ao servidor Oracle e a configuração de credenciais ainda precisam ser resolvidas antes de implantar.

## Riscos técnicos a acompanhar

- Rate limits atuais são em memória e por processo; não coordenam múltiplas réplicas.
- O secret scan do CI verifica os arquivos versionados, não substitui auditoria do histórico Git. Se um segredo já foi commitado, rotacioná-lo; não basta apagá-lo do último commit.
- Os três testes ignorados devem ser revisados para confirmar se continuam intencionalmente condicionais e não escondem regressões.
- O sucesso de CI/build não comprova a disponibilidade real do Supabase, MySQL, SPTrans, Pelias, Valhalla ou do backend em produção.

## Endpoints operacionais

- `GET /api/health`: liveness do processo.
- `GET /api/ready`: readiness; só deve retornar pronto quando o MySQL responder.
- `GET /api/norby/status`: diagnóstico do Norby/Ollama sem expor a URL do serviço.
