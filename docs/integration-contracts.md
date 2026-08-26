# Contratos de Integração do Urbico

## SPTrans — Olho Vivo

A autenticação será feita pelo backend usando `POST /Login/Autenticar?token=...` sobre HTTPS. A sessão autenticada será mantida somente dentro da chamada de servidor e nunca será exposta ao aplicativo. As consultas planejadas são `Linha/Buscar`, `Parada/Buscar`, `Parada/BuscarParadasPorLinha`, `Posicao/Linha` e `Previsao/Parada`, sempre traduzidas para os tipos internos do Urbico.

| Origem | Informação do Urbico |
|---|---|
| `Linha/Buscar` | Código, letreiro, origem e destino da linha |
| `Parada/Buscar` | Código, nome, endereço e coordenadas da parada |
| `Posicao/Linha` | Veículos e coordenadas disponíveis para uma linha |
| `Previsao/Parada` | Chegadas previstas, veículo e horário de referência |

## GraphHopper

O backend resolve os endereços pela geocodificação e envia pontos em longitude/latitude a `POST /route`. A chamada de rota utiliza o perfil apropriado, instruções em português e resposta não codificada quando uma geometria precisa ser exibida no mapa. A chave é enviada somente pelo backend.

| Entrada do Urbico | Contrato GraphHopper |
|---|---|
| Endereço de origem/destino | Geocodificação para coordenadas |
| Pontos da rota | `POST /route` com ao menos origem e destino |
| Caminhada | Perfil `foot`, duração, distância e instruções |

## Norby

O Norby utiliza a Gemini API exclusivamente pelo backend. O adaptador envia `contents` com a conversa atual e uma instrução de sistema; extrai somente o texto final da primeira resposta candidata. As telas enviam texto ao endpoint interno e recebem apenas uma resposta textual; nenhum token de IA é disponibilizado ao dispositivo.

## Referências

[1] [SPTrans — API Olho Vivo: documentação](https://www.sptrans.com.br/desenvolvedores/api-do-olho-vivo-guia-de-referencia/documentacao-api/)

[2] [GraphHopper — Routing API](https://docs.graphhopper.com/openapi/routing)

[3] [Google AI for Developers — models.generateContent](https://ai.google.dev/api/generate-content)
