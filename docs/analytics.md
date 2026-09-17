# Analytics/Telemetria do Urbico

Infraestrutura de dados para um futuro **Urbico Admin** — painel/app
administrativo **separado** do Urbico público. Este documento descreve o
que existe hoje; a interface administrativa em si não é implementada aqui
de propósito (ver decisão de produto).

## Arquitetura

```
Usuário → App Urbico → analytics.track() (lib/analytics.ts)
        → tRPC analytics.track (server/routers.ts)
        → analytics_events (drizzle/schema.ts)
        ← [futuro] API administrativa protegida ← Urbico Admin (site ou app separado)
```

Uma única tabela genérica (`analytics_events`), não uma tabela por tipo de
evento — cada linha tem um `event` (nome) e um `properties` (JSON livre,
formato definido por evento, catalogado abaixo). Isso cobre sessões,
recursos usados, comandos do Norby, falhas etc., sem precisar de uma
tabela nova a cada novo tipo de evento.

## Como adicionar um evento novo

1. Acrescente o nome em `lib/analytics-events.ts` (`ANALYTICS_EVENTS`).
2. Documente o formato de `properties` esperado numa linha da tabela
   abaixo.
3. Chame `analytics.track("seu_evento", { ...propriedades })` no ponto do
   código onde a ação acontece de verdade — nunca espalhe chamadas de rede
   de analytics por fora de `lib/analytics.ts`. Exceção: eventos que
   acontecem num job em segundo plano do servidor (sem nenhum app aberto
   no momento, ex.: `alert_triggered`) chamam `db.insertAnalyticsEvent`
   diretamente — ver `server/leave-alert-monitor.ts`.

`analytics.track()` é assíncrono, "melhor esforço" e nunca lança: falha em
telemetria (sem rede, banco fora do ar) nunca pode quebrar a ação real da
pessoa.

## Catálogo de eventos

| Evento | Onde é disparado | `properties` |
|---|---|---|
| `app_opened` | `app/_layout.tsx`, uma vez por carregamento do app | — |
| `user_registered` | `app/login.tsx`, cadastro por e-mail/senha concluído | `{ method: "password" }` |
| `user_login` | `app/login.tsx`, login concluído (senha ou Google) | `{ method: "password" \| "google" }` |
| `user_logout` | `hooks/use-auth.ts`, ponto único de logout | — |
| `route_search` | `app/(tabs)/routes.tsx`, ao pedir para calcular uma rota | `{ hasCoordinates: boolean, hasLine: boolean }` |
| `route_selected` | `app/(tabs)/routes.tsx`, ao tocar numa linha sugerida | `{ lineId, lineLabel }` |
| `route_started` | `app/(tabs)/routes.tsx`, ao iniciar a viagem com sucesso | `{ hasLine: boolean, distanceMeters }` |
| `map_opened` | `app/(tabs)/map.tsx`, montagem da tela | — |
| `favorite_added` | `app/favorites.tsx`, novo favorito salvo | `{ label }` |
| `favorite_removed` | `app/favorites.tsx`, favorito excluído | `{ label }` |
| `favorite_used` | `lib/favorite-navigation.ts`, favorito configurado usado para navegar | `{ favoriteId, label }` |
| `calendar_opened` | `app/(tabs)/agenda.tsx`, montagem da tela | — |
| `calendar_event_created` | `app/(tabs)/agenda.tsx`, compromisso salvo | `{ hasLine: boolean, hasCoordinates: boolean }` |
| `alert_created` | `app/(tabs)/agenda.tsx`, alerta de saída armado com sucesso | `{ lineId }` |
| `alert_triggered` | `server/leave-alert-monitor.ts` — único evento disparado no servidor, no job em segundo plano que decide "hora de sair" | `{ lineId, confidence }` |
| `crowd_report_created` | `app/(tabs)/norby.tsx`, resposta de lotação reconhecida durante a viagem | `{ lineId, level }` |
| `crowd_report_viewed` | catalogado, ainda não emitido — ver "Próximos passos" | `{ lineId }` |
| `norby_opened` | `app/(tabs)/norby.tsx`, montagem da tela | — |
| `norby_command` | `app/(tabs)/norby.tsx`, toda mensagem enviada ao Norby | `{ intent, subintent?, context?, status, durationMs }` — ver seção Norby |
| `ad_impression` | `components/ad-banner.tsx`, anúncio carregado | — |
| `ad_clicked` | `components/ad-banner.tsx`, anúncio tocado/aberto | — |
| `navigation_started` | `lib/trip-navigation.ts`, início do acompanhamento por GPS de uma viagem ativa | `{ hasLine: boolean }` |
| `navigation_step_completed` | catalogado, reservado para granularidade futura por trecho (ver "Próximos passos") — hoje as transições reais de etapa já ficam registradas via `bus_stop_reached`/`bus_boarding_detected`/`bus_alighting_detected`/`destination_reached` | `{ step }` |
| `navigation_rerouted` | `lib/trip-navigation.ts`, recálculo após desvio de rota confirmado (2 leituras de GPS seguidas fora da rota) | `{ reason: "off_route" }` |
| `bus_stop_reached` | `lib/trip-navigation.ts`, chegada real (raio de 30 m) ao ponto de embarque | `{ lineId }` |
| `bus_boarding_detected` | `lib/trip-navigation.ts`, embarque — por heurística real (velocidade + proximidade ao veículo) ou confirmação manual | `{ lineId, method: "heuristic" \| "manual" }` |
| `bus_alighting_detected` | `lib/trip-navigation.ts`, desembarque — mesma lógica do embarque | `{ lineId, method: "heuristic" \| "manual" }` |
| `destination_reached` | `lib/trip-navigation.ts`, chegada real (raio de 30 m) ao destino final | `{ lineId }` |
| `navigation_cancelled` | `app/trip.tsx`, viagem encerrada manualmente antes de chegar ao destino | `{ phase, lineId }` |
| `norby_navigation_instruction` | `lib/trip-navigation.ts`, toda instrução contextual narrada pelo Norby durante a viagem (chegada ao ponto, embarque, "faltam paradas" etc.) | `{ key, lineId }` — `key` identifica qual instrução (ex.: `"arrived_stop"`, `"boarded"`, `"approaching_destination"`), nunca o texto falado em si |

## Norby — intenção estruturada, não o texto

Toda mensagem enviada ao Norby passa por `classifyNorbyIntent()`
(`lib/urbico-logic.ts`), baseada em palavras-chave (sem IA/clustering,
conforme decisão de produto) e vira um evento `norby_command` assim:

```json
{ "event": "norby_command", "intent": "route_search", "subintent": "fastest_route", "context": "work", "status": "success", "durationMs": 842 }
```

- **`intent`**: uma das categorias em `lib/norby-intents.ts`
  (`NORBY_INTENTS`) — inclui `"unknown"` quando nenhum padrão bate.
- **`subintent`**: modificador opcional (ex.: `"fastest_route"`,
  `"arrival_notification"`).
- **`context`**: `"home" | "work" | "favorite"`, quando detectado.
- **`status`**:
  - `"success"` — o Norby respondeu normalmente;
  - `"failure"` — a chamada ao Norby falhou (erro de rede/serviço);
  - `"unsupported"` — a intenção foi reconhecida, mas o Urbico ainda não
    tem essa funcionalidade (ver `NORBY_UNSUPPORTED_INTENTS`). É assim
    que fica registrado, por exemplo, um pedido de "me avise quando o
    ônibus estiver chegando" — reconhecido, mas sem funcionalidade real
    por trás ainda.
- **`durationMs`**: tempo entre a mensagem ser enviada e a resposta (ou
  falha) chegar.

**Nunca o texto da mensagem em si** — a intenção estruturada é
considerada suficiente (ver Privacidade abaixo). O mesmo vale para
`norby_navigation_instruction`: só a `key` da instrução, nunca o texto
narrado.

### Como o futuro Urbico Admin poderia responder às perguntas do brief

Tudo isso é possível com `SELECT`s simples sobre `analytics_events` filtrando
por `event = 'norby_command'` e usando `JSON_EXTRACT`/`->>` do MySQL sobre a
coluna `properties` para agrupar por `intent`, `status`, dia/semana/mês etc.
Nenhum endpoint administrativo existe ainda de propósito — ver "Próximos
passos".

### Como adicionar uma intenção nova

1. Acrescente o nome em `lib/norby-intents.ts` (`NORBY_INTENTS`).
2. Adicione as palavras-chave correspondentes em `NORBY_INTENT_PATTERNS`
   (ou `NORBY_SUBINTENT_PATTERNS`) em `lib/urbico-logic.ts`.
3. Se a intenção representa algo que o Urbico ainda não faz de verdade,
   adicione-a a `NORBY_UNSUPPORTED_INTENTS` para que ela entre como
   `status: "unsupported"` em vez de `"unknown"`.

## Urbico Navigation — etapas de uma viagem

`lib/trip-navigation.ts` acompanha uma viagem ativa por GPS real e emite os
eventos de navegação da tabela acima nas transições reais de etapa:

```
walking_to_stop → waiting_at_stop → on_bus → walking_to_destination → arrived
   bus_stop_reached   bus_boarding_   bus_alighting_   destination_reached
                        detected        detected
```

Embarque/desembarque combinam uma heurística sobre dados reais (velocidade
do GPS + proximidade ao veículo real da SPTrans) com confirmação manual da
pessoa (`method: "manual"` vs `"heuristic"` em `properties`) — nunca há
posição, ETA ou instrução inventada; quando o dado real não existe (sem
veículo posicionado, sem SPTrans configurado), o estado correspondente
fica indisponível em vez de simulado.

## Usuários e sessões

Não existe uma tabela de usuários/sessões separada — isso se deriva de
`analytics_events` (e da tabela `users` já existente):

- **Total de usuários**: `SELECT COUNT(*) FROM users`.
- **Usuários ativos** num período: `openId` distintos em
  `analytics_events` nesse intervalo de `createdAt`.
- **Novos usuários**: `users.createdAt` dentro do período.
- **Usuários recorrentes**: `openId` com eventos em mais de um dia
  distinto.
- **Sessões**: eventos agrupados por `sessionId` (gerado uma vez por
  carregamento do app, em `lib/analytics.ts`) — não existe uma tabela de
  sessões à parte de propósito (ver arquitetura acima).
- **Plataforma/versão**: colunas `platform`/`appVersion`, preenchidas
  automaticamente pelo cliente em todo evento.

## Recursos mais utilizados

`SELECT event, COUNT(*) FROM analytics_events GROUP BY event ORDER BY
COUNT(*) DESC` já dá o ranking bruto de uso por recurso. Sem dados
fictícios: o ranking só existe de verdade depois que o app estiver em uso
real.

## Privacidade

- Identificadores: `openId` (quando logado) e/ou `installationId`
  (dispositivo, mesmo id usado pelos alertas de saída) — nunca nome,
  e-mail ou qualquer dado pessoal.
- Nenhum evento guarda senha, token, credencial ou dado bancário.
- O texto literal de mensagens ao Norby **nunca** é armazenado — só a
  intenção classificada. A única exceção prevista (ainda não
  implementada) seria uma amostra curta do texto para comandos
  `"unknown"`/`"unsupported"`, justamente para permitir descobrir novas
  demandas — e mesmo essa exceção ficaria atrás de uma flag de ambiente
  dedicada, nunca ligada por padrão.

## Performance e offline

- Todo `analytics.track()` é assíncrono e disparado sem bloquear a UI
  (`void (async () => {...})()`).
- Sem fila de retry/persistência offline: se a chamada falhar (sem rede,
  app em segundo plano), o evento é perdido silenciosamente. Isso é
  intencional para manter a implementação simples agora — ver "Próximos
  passos" se isso vier a importar de verdade.

## Próximos passos (não implementados de propósito)

- Endpoints administrativos protegidos (`GET /admin/analytics/...` ou
  equivalente em tRPC) para o futuro Urbico Admin consumir — hoje
  `analytics_events` só recebe gravações, ninguém fora do próprio banco
  consulta agregações.
- Papel `creator` (já existe na coluna `role` de `users`) com permissões
  acima de `admin` — ainda sem nenhuma verificação de acesso usando esse
  valor.
- Eventos catalogados mas ainda não emitidos: `crowd_report_viewed`,
  `bus_details_viewed`, `route_details_viewed`, `navigation_step_completed`
  em granularidade fina (hoje coberto pelas transições de etapa reais).
- Detecção de "demandas incomuns" (agrupar solicitações `unknown`
  semanticamente parecidas) — hoje os dados ficam estruturados e prontos
  para isso, mas nenhum processamento de agrupamento existe ainda (ver
  decisão de produto: não implementar clustering agora).
- Distância-à-rota (detecção de desvio) usa o vértice mais próximo do
  trajeto em vez de projeção exata em segmento — aproximação razoável,
  registrada como melhoria futura.
