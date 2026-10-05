# Google Maps — configuração do mapa (Etapa 2)

O mapa agora usa Google Maps: `react-native-maps` (`PROVIDER_GOOGLE`) no Android e a Maps JavaScript API na web. A interface `UrbicoMapProps` não mudou, então as telas que usam `UrbicoMap` não precisam de alteração.

## Antes de rodar (obrigatório)

```bash
npx expo install react-native-maps   # adiciona a versão compatível com o SDK 57 e atualiza o pnpm-lock.yaml
```

Sem isso o bundle falha em `import ... from "react-native-maps"`. Depois, gere um novo build nativo (`expo prebuild` / EAS / `expo run:android`): o mapa Google não funciona no Expo Go.

## Chaves (crie chaves NOVAS; as antigas foram expostas)

| Variável | Onde | Restrição no Google Cloud |
|---|---|---|
| `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` | build Android (`app.config.ts`) | Maps SDK for Android + package `com.app.urbico` + SHA-1/SHA-256 |
| `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` | navegador | Maps JavaScript API + referências HTTP do seu domínio |
| `EXPO_PUBLIC_GOOGLE_MAP_ID` | navegador (opcional) | Map ID do Console; sem ele usa `DEMO_MAP_ID` (só desenvolvimento) |
| `GOOGLE_MAPS_SERVER_API_KEY` | backend (Etapa 1) | Places (New), Geocoding, Routes + IP do servidor |

Chaves `EXPO_PUBLIC_*` vão para o app/bundle: por isso as restrições acima são obrigatórias, e a chave do servidor nunca deve usar esse prefixo. Defina quotas e alertas de orçamento em cada API.

## Custo

O mapa cobra por carregamento (SDK/JS), não por atualização de GPS. Posição do usuário, paradas, veículos e rota são desenhados localmente.

## Comportamento e limites desta etapa

- iOS continua com o provider padrão (Apple Maps) até existir chave e configuração iOS.
- Marcadores são views próprias (mesmo visual de antes); na web usam `AdvancedMarkerElement`.
- O plugin `@maplibre/maplibre-react-native` saiu do `app.config.ts`; as dependências `@maplibre/maplibre-react-native` e `maplibre-gl` ainda estão no `package.json` e devem ser removidas (`pnpm remove ...`) depois que o mapa for validado em aparelho.
- Não foi possível compilar nem executar nada a partir daqui: valide `pnpm check`, `pnpm test` e o mapa no aparelho antes de mesclar.
