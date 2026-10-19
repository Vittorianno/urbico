# Segredos do Urbico

**Regra:** chaves de API, tokens, senhas e IDs de serviços ficam **somente no arquivo `.env`** (local, fora do Git). O código lê tudo por `process.env.*` (servidor) ou `EXPO_PUBLIC_*` (cliente — vai para o bundle, então só valores públicos).

## Como o Git é protegido

1. **`.gitignore`:** ignora `.env`, `.env.*` (inclusive os `.env.backup.*` dos scripts), `*.env`, chaves privadas, `google-services.json` e credenciais de conta de serviço. Só `.env.example` (apenas modelos, sem valores) é versionado.
2. **Hooks locais** (`.githooks/`): `pre-commit` confere o que está no commit e `pre-push` confere tudo. Ative uma vez por clone/Codespace/Termux:
   ```
   bash scripts/install-git-hooks.sh
   ```
3. **O verificador** (`node scripts/check-secrets.mjs`) bloqueia arquivos proibidos e valores com cara de segredo (chaves do Google, tokens do GitHub, JWT/chaves do Supabase, chaves privadas, URLs com senha, IDs reais do AdMob, atribuições literais de `api_key`/`secret`/`token`/`password`). Nunca imprime o valor achado. Falso positivo numa linha: comente `secret-scan:allow`.
4. **Verificação no GitHub (opcional, a adicionar):** um workflow que rode `node scripts/check-secrets.mjs` em todo push e pull request é a única barreira que não dá para pular pelo cliente Git. Veja o modelo em `docs/secret-scan.workflow.yml.txt`.

`node scripts/check-secrets.mjs --history` procura segredos que já passaram pelo histórico do Git.

## Limites (o que isto NÃO garante)

- Hooks locais podem ser pulados com `git commit --no-verify`.
- Se um segredo real já foi commitado em algum momento, apagar o arquivo não resolve: ele continua no histórico. Gere uma chave nova no serviço de origem e revogue a antiga.
- Para uma camada extra, ative em *Settings → Code security*: **Secret scanning** e **Push protection** (disponíveis conforme o plano do repositório).
- Os IDs de teste do AdMob (`ca-app-pub-3940256099942544~...`) são públicos, documentados pelo Google, e ficam como alternativa em `app.config.ts`. A pasta `android/` versionada vem de um prebuild com esses IDs de teste; ao fazer prebuild com IDs reais, não commite o `AndroidManifest.xml` resultante.
- `.github/workflows/android-build.yml` ainda tem uma senha de keystore descartável escrita no arquivo (`urbico-dev-only`, usada só para assinar um APK de teste gerado na hora). Não é uma chave de API, mas quebra a regra “senha só no .env”; veja a correção sugerida em `docs/secret-scan.workflow.yml.txt`.
