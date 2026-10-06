# Viagem, CHECK_IN e lotação (Etapa 4)

Tudo roda sobre **MySQL + Drizzle** e o backend atual. O Supabase continua só na autenticação.

## Banco

Alterações em `drizzle/schema.ts` (não destrutivas):

- Nova tabela `trips` (viagem ativa por aparelho, status `ACTIVE | COMPLETED | CANCELLED | EXPIRED`).
- `crowd_reports` ganha colunas opcionais: `trip_id`, `direction`, `vehicle_prefix`, `reporter_key`. Relatos antigos ficam com `NULL` e continuam válidos.
- Índices novos: `crowd_reports(line_id, created_at)`, `crowd_reports(reporter_key, created_at)`, `trips(installation_id, status)`, `trips(line_id, status, last_seen_at)`.

Para gerar e aplicar a migração (o drizzle-kit cria o SQL e os snapshots a partir do schema):

```bash
pnpm db:push
```

Revise o SQL gerado em `drizzle/` antes de aplicar em produção.

## Como funciona

**Dono da viagem.** O Urbico funciona sem login, então a viagem pertence ao `installationId` (UUID anônimo por aparelho, o mesmo dos alertas de saída). Outro aparelho recebe `NOT_FOUND` ao tentar mexer na viagem alheia.

**Viagem.** `trip.start` cria a viagem (idempotente para a mesma linha). Se já existe viagem em outra linha: sem CHECK_IN recente, ela é cancelada e substituída; com CHECK_IN recente, retorna `CONFLICT`. A linha é validada na SPTrans (se a SPTrans estiver fora do ar, não bloqueia). Veículo só é gravado se existir de fato na linha segundo a SPTrans.

**CHECK_IN.** `trip.checkIn` registra "estou neste ônibus" (idempotente, preserva o primeiro horário). Conta como passageiro a bordo enquanto houver sinal de vida há menos de 10 min.

**Encerramento e expiração.** `trip.checkOut` (concluída) e `trip.cancel` são idempotentes. Sem depender deles: uma viagem `ACTIVE` sem sinal há 20 min, ou com mais de 4 h, vira `EXPIRED` (expiração preguiçosa, aplicada em `start`, `checkIn`, `ping` e `current`). O app envia `trip.ping` a cada 3 min (não a cada leitura de GPS). `trip.current` recupera a viagem após reabrir o app.

**Relato.** `crowdReports.submit` mantém `{ lineId, level }` e aceita `installationId`, `tripId`, `direction`, `vehiclePrefix`. Com `tripId`, linha, sentido e veículo vêm da viagem validada. Anti-spam: mesmo nível pela mesma pessoa em 10 min é ignorado; níveis diferentes exigem 60 s; máximo 20/hora; sem `installationId` há teto de 20/min por linha.

**Estimativa.** `crowdReports.estimate` usa relatos dos últimos 45 min, uma contagem por pessoa (o mais recente), peso com meia-vida de 12 min, mais peso para relato ligado a viagem, mesmo veículo e mesmo sentido, menos peso para relato sem identificador. Nível = média ponderada arredondada. CHECK_INS ativos não criam nível: só elevam a confiança. Sem relatos: `level: null`, `confidence: NONE`.

**Confiança.** `0,5 × volume + 0,25 × concordância + 0,15 × recência` + bônus de CHECK_INS (até 0,2) + bônus de veículo (0,1). `HIGH ≥ 0,7`, `MEDIUM ≥ 0,45`, senão `LOW`. Um único relato recente dá `LOW`.

## Privacidade

- A viagem guarda só a última posição, arredondada (~110 m), apagada ao encerrar ou expirar. Não há trilha.
- `reporter_key` é um HMAC do `installationId` (com `JWT_SECRET`), usado só para anti-spam e para contar cada pessoa uma vez. Nunca é exposto pela API. Isto muda a premissa anterior de relatos 100% sem identificador: relatos novos enviados pelo app com `installationId` têm esse pseudônimo.
- Nenhuma resposta da API traz posição ou identifica passageiros; o histórico é agregado.

## Limites conhecidos

- O app ainda não envia veículo nem sentido: não há como identificar com confiança qual ônibus a pessoa pegou. O servidor já aceita e valida esses campos.
- A tela do Norby continua enviando relatos sem `installationId` (sem anti-spam por pessoa, apenas o teto por linha).
- Não há índice único "uma viagem ACTIVE por aparelho" (MySQL não tem índice parcial): corridas simultâneas são reconciliadas depois do insert.
- Rate limit e dedupe dependem do MySQL; não foi adicionado Redis nem outro serviço.
