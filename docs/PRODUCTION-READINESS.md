# Urbico — Prontidão para produção (auditoria de 01/10/2026)

Auditoria feita por leitura direta do repositório (`main` @ `eb0a7a2`). Não foi
possível rodar `pnpm check`, `pnpm test` nem o app nesse ambiente: **rode
`pnpm check && pnpm test` localmente antes de fazer merge desta branch.**

## O que foi corrigido nesta branch (`audit/hardening-producao`)

| # | Problema encontrado | Correção |
|---|---|---|
| 1 | CORS refletia **qualquer** origem com `Allow-Credentials: true` e o cookie usa `SameSite=None` → qualquer site na web podia chamar o backend em nome do usuário logado | `server/_core/security.ts`: em produção só passam origens de `CORS_ALLOWED_ORIGINS` (e a própria origem do servidor). Dev continua como antes. App Android não envia `Origin` e não é afetado |
| 2 | Nenhum rate limit; endpoints públicos (Norby, SPTrans, lotação, analytics) abertos a abuso e a esgotar a cota do token SPTrans | Limite por IP: 600 req/min em `/api/trpc`, 30 req/min em `/api/auth/session` |
| 3 | `express.json({ limit: "50mb" })` sem necessidade | 1 MB |
| 4 | Requisito "conta só ativa depois de confirmar o e-mail" dependia só de uma opção no painel do Supabase | Servidor recusa criar sessão se `email_confirmed_at` estiver vazio (`SUPABASE_REQUIRE_EMAIL_CONFIRMATION=false` desativa) |
| 5 | Sem `SIGTERM` gracioso, sem `exit(1)` em falha de boot, sem aviso de config insegura | `index.ts` + `logSecurityWarnings()` |
| 6 | Sem testes de segurança | `tests/security.test.ts` (CORS e rate limit, sem rede) |

### Novas variáveis de ambiente (acrescentar ao `.env.example`)

| Variável | Para quê |
|---|---|
| `CORS_ALLOWED_ORIGINS` | Origens web autorizadas em produção, separadas por vírgula. Vazio = nenhum site de outra origem (Android segue funcionando) |
| `TRUST_PROXY` | Nº de proxies reversos na frente do servidor (padrão em produção: `1`). Necessário para o rate limit enxergar o IP real |
| `SUPABASE_REQUIRE_EMAIL_CONFIRMATION` | `false` só para desativar temporariamente a exigência de e-mail confirmado |

> ⚠️ Atenção ao fazer deploy: se o projeto Supabase estiver com *Confirm email*
> desligado, o login por e-mail/senha passa a ser recusado pelo servidor até
> você ligar essa opção no painel (ou definir a flag acima como `false`).

## Não commitado: workflow de CI

A integração do GitHub usada na auditoria não tem permissão para criar
arquivos em `.github/workflows/`. Crie você mesmo `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      # Sem pnpm-lock.yaml no repo (ver bloqueador 3); depois de commitá-lo, use --frozen-lockfile
      - run: pnpm install --no-frozen-lockfile
      - run: pnpm check
      - run: pnpm test
        env:
          SPTRANS_TOKEN: ${{ secrets.SPTRANS_TOKEN }}
```

## O que ainda falta para 100% (exige ação sua — não dá para fazer por commit)

**Bloqueadores de lançamento**

1. **Hospedar o backend** (Node contínuo, não serverless, por causa do agendador de alertas de 60 s) e definir `EXPO_PUBLIC_API_BASE_URL`. Em `eas.json` as 3 URLs ainda são `SEU-BACKEND-...exemplo.com`: um APK gerado hoje não consegue falar com nenhum servidor.
2. **Banco MySQL gerenciado** + `DATABASE_URL` e rodar `pnpm db:push`. Sem banco: sem login salvo, sem alertas, sem lotação.
3. **Gerar e commitar `pnpm-lock.yaml`** (`pnpm install` na raiz). Hoje não há lockfile no repositório: builds do EAS/CI não são reprodutíveis e o README já presume que ele existe.
4. **`eas init`** para gravar o `projectId` em `app.config.ts` (`extra.eas`) antes do primeiro `eas build`.
5. **Painel do Supabase**: ligar *Confirm email*, habilitar provedor Google (se usar "Continuar com Google") e cadastrar a *Redirect URL* do esquema `urbico://`. Depois do 1º cadastro real, preencher `OWNER_OPEN_ID` para existir um admin.
6. **Variáveis de produção**: `JWT_SECRET` (≥ 32 caracteres), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SPTRANS_TOKEN`, `CORS_ALLOWED_ORIGINS` (se houver cliente web).
7. **Validar em dispositivo real** (pendência aberta no `todo.md`): GPS em segundo plano, reconhecimento de voz, notificações, MapLibre, SPTrans ponta a ponta.

**Pendências do `todo.md`**

- `[ ]` Push com Firebase — só é necessário se quiser notificações com o app fechado; hoje as notificações são locais.
- `[ ]` Hospedagem contínua para o monitoramento — é o item 1 acima.
- `[ ]` Validar recursos nativos em dispositivo — item 7.
- `[ ]` *Autocomplete do Google Places* e `[ ]` *ElevenLabs* estão **obsoletos**: ambos foram substituídos (Pelias/Nominatim e voz local) e já marcados como `[x]` mais abaixo. Podem ser riscados.

**Antes de publicar na Play Store**

- Política de privacidade pública (obrigatória por usar localização em segundo plano e microfone) e a declaração de uso de `ACCESS_BACKGROUND_LOCATION` no Play Console.
- Trocar os IDs de teste do AdMob (`EXPO_PUBLIC_ADMOB_*`) pelos reais.
- Revisar plugins que parecem sobras do template: `expo-video` (reprodução em segundo plano / PiP) e `expo-audio` (texto de permissão em inglês). Se o app não usa vídeo, remover reduz permissões e superfície de revisão.
- Cor de fundo da *splash* está `#ffffff` no modo claro enquanto o app é só tema escuro.

**Riscos conhecidos, não alterados aqui (decisão de produto/arquitetura)**

- Sessão do Urbico dura 1 ano e não há revogação no servidor (logout só limpa o cookie/token local).
- `crowdReports.submit`, `analytics.track` e `norby.chat` são públicos; o rate limit por IP mitiga mas não impede envenenamento dos dados de lotação. Considerar exigir login ou assinatura do dispositivo para relatos.
- `departureAlerts.*` identifica o dispositivo só pelo `installationId` (UUID); quem souber o UUID controla o alerta.
- Arquivos legados do Manus em `server/_core/` (listados no README) seguem no repositório; remover só após `grep` local.
- Painel admin está dentro do app (rota restrita a `admin`); a decisão original era um painel separado.
