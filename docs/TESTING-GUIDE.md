# 🚀 URBICO — Guia de Teste Real via Expo Go

> **Nota de correção (07/09):** a seção "🐛 Se Algo Quebrar" abaixo lista
> "Nenhuma notificação quando sair" como esperado por a funcionalidade "ainda
> não wired" — isso já foi corrigido (`scheduleTravelNotice()` é chamado em
> `lib/departure-location-task.ts` sempre que o servidor marca o alerta como
> disparado). Se a notificação não aparecer no teste, é bug de verdade, não
> comportamento esperado — verifique se a permissão de notificação foi
> concedida (`enableTravelNotifications()`, chamado ao armar o alerta em
> `app/(tabs)/agenda.tsx`) antes de reportar.

Este documento orienta o teste completo do Urbico em dispositivo Android real via Expo Go ou dev client.

---

## 📋 Pré-requisitos

✅ **Já Configurado:**
- `.env.example` documentado (copie para `.env` e preencha os valores)
- `package.json` com todos os scripts
- Backend (Express + tRPC) pronto
- Estrutura Expo+Metro configurada

✅ **Você Precisa De:**
- Node.js 20+
- pnpm 9.12.0+ (use `corepack enable`)
- Um smartphone Android com Expo Go instalado (Google Play Store)
- Android e computador na mesma rede Wi-Fi
- Porta 3000 (backend) e 8081 (Metro) livres

---

## 🔧 Etapa 1: Validação Local (5 minutos)

Execute no seu terminal na pasta urbico:

```bash
# 1. Instale dependências se não tiver feito
pnpm install

# 2. Valide TypeScript
pnpm check
```

**Esperado:**
- ✅ Sem erros de tipo
- ✅ Compilação bem-sucedida

**Se houver erro:**
- Procure por "transit-engine" ou outro arquivo faltante
- Reporte no console

---

## 🎮 Etapa 2: Teste Web (3 minutos)

Teste no navegador primeiro (mais rápido):

```bash
# Inicie o servidor
pnpm dev
```

**Você verá:**
```
[api] server listening on port 3000
info - Metro waiting on exp://...
```

Abra o navegador em: **http://localhost:8081**

**Teste estas telas:**
1. ✅ Página inicial carrega (Norby, favoritos, ônibus)
2. ✅ Clique em "FALAR COM NORBY" → digita "oi"
3. ✅ Norby responde com texto
4. ✅ Abra aba "Mapa"
5. ✅ Abra aba "Perfil"

**Se vir erros:**
- Procure por `[api]` ou `[TRPC]` nos logs
- Reporte a mensagem de erro

---

## 📱 Etapa 3: Teste Android Real (5-10 minutos)

### Opção A: Expo Go (Mais Rápido, Limitações de Módulos Nativos)

1. **No seu Android:**
   - Abra Expo Go
   - Toque em "Scan QR code"

2. **No seu PC (terminal rodando `pnpm dev`):**
   - Procure por um QR code no terminal ou em http://localhost:8081
   - Exempla: `exp://192.168.1.100:8081`

3. **Aponte a câmera do Android para o QR**
   - O app carrega

### Opção B: Dev Client (Recomendado - Suporta Módulos Nativos)

Se Expo Go disser "App não pode ser carregado" (devido a `@maplibre`):

```bash
# Criar dev client (conectado à conta Expo)
npm install -g eas-cli
eas login
eas build --platform android --profile development
```

Isso gera um APK. Instale no Android. Depois:

```bash
pnpm dev:metro
```

E conecte no app.

---

## ✅ Checklist de Teste Android

Quando o app abrir no Android, teste **nesta ordem**:

| # | Funcionalidade | Teste | Status |
|---|---|---|---|
| 1 | **App inicia** | Tela inicial aparece | ⚪ |
| 2 | **Navegação** | Toque em Início → Mapa → Norby → Perfil | ⚪ |
| 3 | **Norby texto** | Digite "oi", pressione enviar | ⚪ |
| 4 | **Norby voz** | Toque no ícone do microfone | ⚪ |
| 5 | **Mapa carrega** | Aba Mapa mostra mapa interativo | ⚪ |
| 6 | **Localização** | Mapa tem botão "centralizar", toque | ⚪ |
| 7 | **Favoritos** | Aba Favoritos tem Casa/Trabalho | ⚪ |
| 8 | **Rotas** | Ir para Rotas → digitar "875" → linhas aparecem | ⚪ |
| 9 | **SPTrans** | Tela inicial → "Próximos ônibus" → consulta linhas | ⚪ |
| 10 | **Perfil** | Toque em Perfil → vê configurações | ⚪ |

**Legenda:**
- 🟢 Funciona
- 🟠 Funciona com aviso/degradado
- 🔴 Quebrado
- ⚪ Não testado

---

## 🐛 Se Algo Quebrar

### Erro: "Cannot find module 'transit-engine'"
```
Solução: Já está no código. Pode ignorar se os testes passarem.
```

### Erro: "API call failed: Cannot connect to localhost:3000"
```
Solução: Verificar se backend está rodando:
  - Terminal mostra "[api] server listening on port 3000"?
  - Android conectado na mesma rede Wi-Fi?
  - Firewall bloqueando porta 3000? (Desligue temporariamente)
```

### Erro: "Expo Go says app cannot be run"
```
Solução: Use dev client em vez de Expo Go
  eas build --platform android --profile development
```

### Norby não responde
```
Solução: Esperado se sem SPTRANS_TOKEN
  Backend diz "integração indisponível" — é fallback correto
```

### Nenhuma notificação quando sair
```
Status: NÃO é mais esperado (ver nota de correção no topo do documento).
Verifique, nesta ordem:
  1. A permissão de notificação foi concedida no Android (Configurações do
     app > Notificações)?
  2. O alerta foi realmente armado (agenda.tsx chamou departureAlerts.arm
     com sucesso, sem erro no Alert exibido)?
  3. DATABASE_URL está configurado? Sem banco, o alerta não persiste.
  4. O agendador interno do backend está rodando (log
     "[departure-alerts] evaluation failed" apareceria no terminal em caso
     de erro; silêncio é esperado quando não há alerta elegível ainda)?
Se tudo isso estiver certo e ainda assim não notificar, é um bug real —
reporte com os logs do terminal do backend.
```

---

## 📊 Relatório de Teste

Depois que terminar, colete:

1. **Screenshots:**
   - Tela inicial
   - Norby chat
   - Mapa
   - Console de erros (se houver)

2. **Logs:**
   - Terminal backend (stdout)
   - Logcat do Android (dev tools)

3. **Checklist acima preenchido**

4. **Navegador web e Android:** Ambos funcionam?

---

## 🎯 Próximos Passos Após Teste

- ✅ Se tudo passar → Prossiga para o teste real de voz/notificação em dispositivo
- ❌ Se algo quebrar → Reporte o erro específico
- ⚠️ Se parcial → Documente o que não funciona

---

## 📞 Comando Rápido para Tudo

```bash
# Arquivo de teste automático
chmod +x scripts/test-setup.sh
./scripts/test-setup.sh
```

Isso roda TypeScript check, lint, testes, e depois `pnpm dev`.

---

**Tempo estimado total: 20-30 minutos**

Boa sorte! 🚀
