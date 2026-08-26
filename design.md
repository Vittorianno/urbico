# Urbico — Plano de Design de Interface

## Direção de produto

O Urbico será um aplicativo de mobilidade urbana para São Paulo em orientação **retrato (9:16)**, construído para decisões rápidas com uma mão. A interface faz do **Norby** a porta de entrada principal: o mapa apoia a orientação, mas não substitui uma recomendação clara. A primeira versão será local-first e demonstrará fluxos completos sem incorporar as credenciais que vieram expostas nos anexos.

O mockup fornecido define a referência visual prioritária: fundo azul-marinho quase preto, cartões azulados com contornos discretos, azul elétrico para ações primárias, ciano para sinais de inteligência e uma barra inferior compacta. A implementação preserva essa linguagem, sem copiar dados pessoais ou previsões fictícias do exemplo visual.

> O princípio de interface é: “o Urbico ajuda a decidir e acompanhar a viagem”, não apenas exibir opções de transporte.

## Telas e conteúdo

| Tela | Conteúdo principal | Ações prioritárias |
|---|---|---|
| Início | Saudação, localização, atalho de voz, campo Norby, favoritos e estado de próximas partidas | Iniciar uma conversa, abrir local salvo, consultar partidas |
| Conversa Norby | Histórico da sessão, estados de escuta/resposta, entrada de texto e microfone | Perguntar, enviar texto, iniciar/encerrar voz, interromper resposta |
| Planejamento de rota | Campos de origem e destino, resumo da melhor opção e alternativas | Trocar origem/destino, selecionar rota, iniciar acompanhamento |
| Mapa | Localização do usuário, paradas, veículos e rota selecionada em representação acessível | Selecionar parada/veículo, abrir detalhes, centralizar posição |
| Viagem em andamento | Linha, destino, próxima parada, progresso, lotação e ações rápidas | Compartilhar, registrar lotação, encerrar viagem |
| Agenda | Compromissos com data, hora e endereço; recomendação de horário de saída | Adicionar, editar ou remover compromisso |
| Favoritos | Casa, trabalho e locais recorrentes; espaço para linhas e paradas favoritas | Abrir rota, criar e excluir favorito |
| Relato de lotação | Escala discreta de vazio a lotado e contexto da linha | Enviar relato anônimo |
| Perfil e configurações | Preferências, privacidade, notificações, Norby, histórico e plano | Alterar preferências e limpar dados locais |

## Fluxos essenciais

| Objetivo | Fluxo projetado |
|---|---|
| Pedir orientação | Início → campo ou microfone do Norby → conversa → recomendação contextual → “Ver rota” |
| Planejar uma rota | Início/Favoritos → Planejamento → selecionar alternativa → “Iniciar viagem” → Viagem em andamento |
| Reportar lotação | Viagem em andamento → “Lotação” → selecionar nível → confirmação sem identidade pública |
| Organizar compromisso | Agenda → “Novo compromisso” → título, data, hora e endereço → cartão com horário recomendado de saída |
| Compartilhar deslocamento | Viagem em andamento → “Compartilhar” → folha nativa de compartilhamento quando disponível |

## Layout e ergonomia

As ações frequentes ficam na metade inferior ou em controles de alcance fácil. A barra inferior possui quatro destinos, como no mockup: **Início, Mapa, Norby e Perfil**. As rotas, a agenda e os fluxos de segurança são acessados contextualmente para manter a navegação enxuta. O botão de voz do Norby é visualmente distinto, mas não bloqueia a entrada por texto. Cartões usam raios amplos e espaçamento de 16–24 px, com alvos de toque de pelo menos 44 px. Estados vazios explicam a ausência de dados de trânsito sem inventar previsões.

## Linguagem visual

| Elemento | Escolha | Justificativa |
|---|---|---|
| Primária | `#087DF5` — azul elétrico | Ações principais e rotas ativas |
| Secundária | `#0A284D` — azul profundo | Superfícies de apoio, chips e estados selecionados |
| Ciano | `#56D7FF` | Sinais de inteligência do Norby e informação em tempo real |
| Fundo | `#07111D` — azul-marinho | Base escura de alto foco, alinhada ao mockup |
| Cartão | `#0D1A2A` | Hierarquia em superfícies elevadas sem excesso de contraste |
| Texto | `#F3F8FF` | Leitura clara em ambiente escuro |
| Sucesso | `#55CF84` | Situações favoráveis e status ativo |
| Alerta | `#EA3A47` | Emergência e ações críticas |

O símbolo do Norby será um **ponto de rota com um sorriso sutil**, combinando mobilidade e auxílio humano. A tipografia prioriza pesos médios e fortes apenas para decisões, com frases em linguagem simples e direta.

## Limites da primeira versão

A primeira implementação terá dados locais e estados de indisponibilidade para trânsito em tempo real. As integrações de SPTrans, mapas, roteamento, IA, voz remota, notificações e sincronização serão encapsuladas em serviços próprios e permanecerão desligadas até que novas credenciais sejam fornecidas de forma segura. Recursos que exigem monitoramento contínuo em segundo plano e links temporários dependem também de infraestrutura de backend e serão preparados como próximos passos.
