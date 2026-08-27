# Contratos de Integração do Urbico

## SPTrans — Olho Vivo

A autenticação é realizada pelo backend com `POST /Login/Autenticar?token=...` por HTTPS. A sessão autenticada permanece apenas no servidor. As consultas usam `Linha/Buscar`, `Parada/Buscar`, `Parada/BuscarParadasPorLinha`, `Posicao/Linha` e `Previsao/Parada`, sempre traduzidas para tipos internos. A tela de mapa solicita apenas as linhas ativas na rota ou no compromisso atual, evitando exibir toda a frota.

## MapLibre e OpenFreeMap

O aplicativo usa **MapLibre React Native** no Android/iOS e **MapLibre GL JS** na web. Ambos recebem o estilo aberto `https://tiles.openfreemap.org/styles/liberty`. A camada de interface inclui veículos, paradas, localização autorizada e geometria de rota como fontes e camadas separadas. A atribuição “© OpenStreetMap contributors · OpenFreeMap” permanece visível.

## Pelias — autocomplete de endereço

O endpoint interno de sugestões consulta uma instância própria definida em `PELIAS_BASE_URL`. O Urbico envia texto, idioma `pt-BR`, limite de cinco resultados e restrição territorial brasileira. A instância retorna rótulo, endereço e coordenadas; nenhuma chave proprietária é armazenada no aplicativo.

## Valhalla — roteamento de caminhada

O backend envia origem e destino ao endpoint `route` da instância em `VALHALLA_BASE_URL`, usando o custo `pedestrian`, quilómetros como unidade, instruções em português e formato `polyline6`. O adaptador converte a geometria para longitude/latitude e normaliza distância, duração e manobras antes de enviar a rota ao aplicativo.

## Norby e voz local

Por padrão, o Norby usa respostas locais e determinísticas, sem chamadas a um serviço de IA hospedado. Quando existir uma instância própria de modelo aberto, o backend pode consultar `OLLAMA_BASE_URL` com `OLLAMA_MODEL`; em falha ou ausência de configuração, o fallback local mantém a conversa funcional. A captação reconhece fim de fala e a resposta usa a voz `pt-BR` disponível no sistema por meio do Expo Speech, sem sintetizador remoto.

## Alerta de saída monitorado

O alerta requer consentimento explícito para localização compartilhada. O servidor cruza a última posição autorizada, a caminhada até a parada, os veículos da linha relevante e o horário do compromisso. A pessoa pode revogar o compartilhamento nas configurações. A execução contínua e o push remoto continuam condicionados à hospedagem persistente e à configuração de entrega de notificações.

## Referências

[1] [SPTrans — Área de Desenvolvedores](https://www.sptrans.com.br/desenvolvedores/)

[2] [OpenFreeMap — Quick Start](https://openfreemap.org/quick_start/)

[3] [MapLibre React Native — Setup Expo](https://maplibre.org/maplibre-react-native/docs/setup/expo/)

[4] [Pelias — geocodificador MIT](https://github.com/pelias/pelias)

[5] [Valhalla — referência de rota](https://valhalla.github.io/valhalla/api/route/api-reference/)

[6] [Expo Speech Recognition](https://github.com/jamsch/expo-speech-recognition)
