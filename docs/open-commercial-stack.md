# Urbico — Pilha Aberta para Uso Comercial

> **Nota de licenciamento:** esta é uma análise técnica de licenças publicadas, não um parecer jurídico. Antes de lançamento comercial, um profissional jurídico deve conferir as licenças dos dados e os termos vigentes dos provedores que forem efetivamente utilizados.

## Decisão de arquitetura

O Urbico deixa de depender de **Google Maps, Google Places, GraphHopper hospedado, Gemini hospedado e ElevenLabs** no fluxo principal. A arquitetura passa a separar componentes livres de serviços hospedados: o aplicativo usa renderização cartográfica livre e voz local; busca e rota são projetadas para serviços abertos auto-hospedados. Assim, não há cobrança por chamada ou chave proprietária no caminho crítico do produto.

| Capacidade | Substituição adotada | Licença / condição | Operação recomendada |
|---|---|---|---|
| Mapa interativo | **MapLibre React Native** + estilo **OpenFreeMap** | Biblioteca MIT; MapLibre Native BSD-2. A instância pública do OpenFreeMap permite uso comercial, exige atribuição e não oferece SLA. | Usar OpenFreeMap no piloto; auto-hospedar tiles/estilo para controle operacional. |
| Dados cartográficos | **OpenStreetMap** | ODbL, com atribuição visível e deveres de compartilhamento quando aplicáveis. | Exibir “© OpenStreetMap contributors” no mapa e na tela de fontes. |
| Autocomplete de endereços | **Pelias** auto-hospedado | Software MIT; a licença de cada fonte de dados importada também deve ser respeitada. | Hospedar uma instância focada em São Paulo, com cache e dados OSM/OpenAddresses válidos. |
| Roteamento | **Valhalla** auto-hospedado | MIT; dados OSM seguem ODbL. | Hospedar a região de São Paulo e expor somente um endpoint de backend autenticado. |
| Voz de resposta | **Expo Speech** / sintetizador do sistema | Não consulta uma API de voz paga; utiliza as vozes instaladas no aparelho. | Selecionar a melhor voz pt-BR disponível em cada aparelho; informar que a qualidade pode variar por SO. |
| Voz de entrada | Reconhecimento nativo com pausa de fala | Executado pelo mecanismo de reconhecimento do dispositivo. | Conservar o encerramento automático de turno e oferecer texto como alternativa acessível. |
| Trânsito em tempo real | **API Olho Vivo da SPTrans** | A SPTrans disponibiliza o acesso a desenvolvedores por chave; não há cobrança apresentada na página de cadastro. | Manter a integração no backend, seguindo os termos da chave ativa e evitando redistribuição indevida. |

## Limites importantes

Não existe, de forma responsável, uma promessa de “qualidade idêntica, ilimitada, comercial e sem custo operacional” para todos esses serviços. Software aberto pode eliminar cobrança por requisição e dependência proprietária, mas **a hospedagem, a atualização de dados e a operação ainda têm custo de infraestrutura**. Para preservar a qualidade do autocomplete, o Pelias deve ser próprio: a política do Nominatim público proíbe explicitamente autocomplete no cliente.[1]

O OpenFreeMap é uma alternativa apropriada para o piloto porque permite uso comercial sem chave. Contudo, é disponibilizado “as-is” e sem garantia de disponibilidade; por isso a arquitetura mantém o URL do estilo configurável para futura hospedagem própria.[2] O MapLibre React Native é uma biblioteca MIT, enquanto o núcleo MapLibre Native usa BSD-2, ambas permissivas para distribuição comercial com preservação de avisos.[3] [4]

## Atribuições exigidas no produto

O mapa deverá manter uma atribuição visível com o texto **“© OpenStreetMap contributors”** e referência à licença ODbL. Quando for usado o estilo público, a interface também apresentará **“OpenFreeMap”** e **“© OpenMapTiles”**. A fonte de dados e qualquer base adicional importada ao Pelias devem ser registradas no pacote de atribuições de lançamento.[2] [5]

## Próximo ambiente técnico

Pelias e Valhalla não cabem no backend atual do aplicativo por exigirem dados geográficos, armazenamento e serviços persistentes. Eles devem ser instalados em infraestrutura própria com Docker ou equivalente. O aplicativo continuará funcionando com seus estados de ausência de rota até que os URLs internos `PELIAS_BASE_URL` e `VALHALLA_BASE_URL` sejam provisionados. Nenhuma chave paga será necessária para esse desenho.

O Valhalla recebe coordenadas de origem e destino pelo endpoint `route` e retorna rota e instruções; ele não é um geocodificador, portanto deve permanecer pareado ao Pelias.[9] A documentação do Pelias registra que sua implantação com Docker pode exigir múltiplos contêineres, dados geográficos e ao menos 8 GB de RAM, o que confirma a necessidade de infraestrutura fora do backend atual do app.[10]

## Referências

[1] [Política de uso do Nominatim](https://operations.osmfoundation.org/policies/nominatim/)

[2] [OpenFreeMap — uso comercial, atribuição e ausência de SLA](https://openfreemap.org/)

[3] [MapLibre React Native — licença MIT](https://github.com/maplibre/maplibre-react-native)

[4] [MapLibre Native — licença BSD 2-Clause](https://github.com/maplibre/maplibre-native/blob/main/LICENSES.core.md)

[5] [OpenStreetMap — Copyright e licença ODbL](https://www.openstreetmap.org/copyright)

[6] [Pelias — geocodificador aberto sob licença MIT](https://github.com/pelias/pelias)

[7] [Valhalla — roteador aberto sob licença MIT](https://github.com/valhalla/valhalla)

[8] [SPTrans — Área de Desenvolvedores](https://www.sptrans.com.br/desenvolvedores/)

[9] [Valhalla — referência do serviço de rota](https://valhalla.github.io/valhalla/api/route/api-reference/)

[10] [Pelias Docker — requisitos e implantação](https://github.com/pelias/docker)
