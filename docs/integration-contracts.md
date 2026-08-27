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

## Google Places

O autocomplete usa `POST /v1/places:autocomplete` com `X-Goog-Api-Key`, entrada do usuário, idioma `pt-BR`, região `br` e um token de sessão gerado pelo cliente. Após a seleção, o backend consulta o detalhe do local pelo identificador retornado, solicitando somente o nome, endereço formatado e coordenadas. O token de sessão não identifica o usuário e não é persistido.

## Norby

O Norby utiliza a Gemini API exclusivamente pelo backend. O adaptador envia `contents` com a conversa atual e uma instrução de sistema; extrai somente o texto final da primeira resposta candidata. As telas enviam texto ao endpoint interno e recebem apenas uma resposta textual; nenhum token de IA é disponibilizado ao dispositivo.

## Voz, pausa e síntese

A captação por voz usará reconhecimento nativo compatível com Expo. O fluxo trata o evento de fim de fala e a ausência de fala como fim de turno, envia somente a transcrição confirmada ao Norby e encerra o indicador de escuta. A resposta textual é enviada ao endpoint de síntese da ElevenLabs e o dispositivo reproduz apenas a URL de áudio devolvida pelo backend. O segredo da ElevenLabs permanece no servidor.

## Alerta de saída monitorado

O modo de alerta contínuo depende de consentimento explícito para localização compartilhada. O servidor recebe atualizações autorizadas, calcula a rota até uma parada associada ao compromisso, consulta as posições da linha relevante e avalia uma margem configurável antes de criar o alerta. O app deve permitir pausar ou revogar esse compartilhamento a qualquer momento. A ativação em produção exige hospedagem contínua e um provedor de entrega de push configurado.

## Referências

[1] [SPTrans — API Olho Vivo: documentação](https://www.sptrans.com.br/desenvolvedores/api-do-olho-vivo-guia-de-referencia/documentacao-api/)

[2] [GraphHopper — Routing API](https://docs.graphhopper.com/openapi/routing)

[3] [Google AI for Developers — models.generateContent](https://ai.google.dev/api/generate-content)

[4] [expo-speech-recognition — eventos de reconhecimento](https://github.com/jamsch/expo-speech-recognition)

[5] [ElevenLabs — Create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)

[6] [Google Maps Platform — Autocomplete (New)](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete)

[7] [Google Maps Platform — Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)
