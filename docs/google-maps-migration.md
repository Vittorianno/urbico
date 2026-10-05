# Migração Google Maps / OAuth — auditoria e plano

Estado da auditoria do repositório (antes de qualquer remoção de código).

## Matriz de migração

| Área | Situação atual no repositório | Ação |
|---|---|---|
| Mapa (nativo) | `components/urbico-map.native.tsx` com `@maplibre/maplibre-react-native`, estilo OpenFreeMap; plugin em `app.config.ts` | Etapa 2: trocar por Google Maps (`react-native-maps`, `PROVIDER_GOOGLE`) mantendo `UrbicoMapProps` |
| Mapa (web) | `components/urbico-map.web.tsx` com `maplibre-gl` | Etapa 2: Maps JavaScript API |
| Busca/geocodificação | `server/integrations/open-geospatial.ts` (Pelias opcional → Nominatim) | **Etapa 1 (esta)**: `google-geospatial.ts` (Places New + Geocoding) atrás da fachada `geospatial.ts` |
| Rota a pé | mesmo arquivo (Valhalla opcional → OSRM público) | **Etapa 1 (esta)**: Routes API (`WALK`) com cache, dedupe e teto diário |
| GraphHopper | Nenhum uso em código (só menções em docs/todo) | Nada a migrar; limpar menções na Etapa 3 |
| Consumers do geoespacial | `server/routers.ts` (`routing.*`), `server/leave-alert-monitor.ts` (job em segundo plano) | Migrados para a fachada nesta etapa |
| Login Google | `app/login.tsx` já usa **Supabase Auth com provider Google** + troca por sessão própria (`/api/auth/session`) | **Preservar**. Só configuração (ver abaixo) |
| Banco de dados | MySQL via Drizzle (`DATABASE_URL`); Supabase é usado só para Auth | Divergência com a especificação — decidir antes de implementar viagem/lotação |
| SPTrans | `server/integrations/sptrans.ts`, `SPTRANS_TOKEN` só no backend | Manter |
| Norby | `server/integrations/norby.ts` com Ollama opcional, fallback por regras | Manter (sem Gemini/ElevenLabs no código atual) |
| Viagem / CHECK_IN / lotação validada | **Não existe**. Hoje há relatos anônimos por linha (`crowdReports`) | Projeto novo (Etapa 4), não migração |

## Etapa 1 — o que foi feito

- `server/integrations/google-geospatial.ts`: Places API (New) `searchText`, Geocoding API e Routes API `computeRoutes` (WALK), com cache em memória (TTL curto), deduplicação de chamadas simultâneas e teto diário por API.
- `server/integrations/geospatial.ts`: fachada única. Google quando `GOOGLE_MAPS_SERVER_API_KEY` existe; senão provider aberto. Falha ou teto diário do Google → cai para o provider aberto.
- `server/routers.ts` e `server/leave-alert-monitor.ts` passam a importar da fachada.
- O provider aberto **não foi removido**: só deve sair depois de validar o Google em uso real.

### Variáveis (somente backend)

```
GOOGLE_MAPS_SERVER_API_KEY=   # restrita às APIs Places (New), Geocoding e Routes
GOOGLE_MAPS_DAILY_LIMIT=1500  # teto diário por API (opcional)
GEO_PROVIDER=                 # google | open (opcional, força o provider)
```

Não use `EXPO_PUBLIC_` para esta chave. Gere uma chave nova (as anteriores foram expostas) e configure alertas de orçamento e quotas no Google Cloud.

### Regra de custo

O GPS nunca dispara chamada ao Google. `updateLocation` apenas grava a posição; o monitor de alertas consulta rotas pela fachada, que reaproveita resultados por ~11 m / 10 min.

## Login Google (sem mudança de código)

1. Google Cloud: cliente OAuth tipo Web com redirect `https://<projeto>.supabase.co/auth/v1/callback`.
2. Supabase: Authentication → Providers → Google com Client ID/Secret; em URL Configuration, adicionar `urbico://login` às Redirect URLs.
3. Android: se passar a usar Google Sign-In nativo, cliente OAuth Android com package `com.app.urbico` e SHA-1/SHA-256 do certificado de assinatura.

## Próximas etapas

2. Mapa Google (nativo e web). Exige `npx expo install react-native-maps`, atualizar `pnpm-lock.yaml`, chave Android em `app.config.ts` e novo build nativo.
3. Remover MapLibre, Pelias, Valhalla, OSRM/Nominatim e atualizar `tests/external-integrations.test.ts`, que hoje exige MapLibre.
4. Sessões de viagem e lotação validada (novo modelo de dados).
