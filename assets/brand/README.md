# Identidade visual do Urbico

Fontes vetoriais (SVG) da marca. São a fonte da verdade — os PNGs em
`assets/images/` são gerados a partir daqui, não editados diretamente.

## Paleta

| Uso | Cor |
|---|---|
| Fundo / preto-azulado | `#0B0F1A` |
| Azul primário | `#2F7FF5` |
| Azul escuro (gradiente) | `#1E5FD9` |
| Ciano de destaque (uso pontual: ondas sonoras, glow) | `#3ED6D1` |
| Texto claro sobre fundo escuro | `#EAF2FF` |

Preto/azul-marinho é a base predominante em todo ícone e gráfico; o ciano
aparece só como acento pontual (ex.: as 3 barras de "onda sonora" do ícone,
o anel do avatar do Norby), nunca como cor dominante.

## Arquivos

- `icon-mark-full.svg` — ícone/logo principal (fundo + glifo), usado para gerar `icon.png`, `favicon.png`, `splash-icon.png`.
- `android-icon-background.svg` / `android-icon-foreground.svg` / `android-icon-monochrome.svg` — as três camadas do ícone adaptativo do Android (Android 8+/13+).
- `notification-icon.svg` — silhueta branca simples (sem a badge de ônibus, que não lê bem em tamanho de status bar), para `notification-icon.png`.
- `logo-lockup-horizontal.svg` — logo + wordmark "Urbico" na horizontal, para cabeçalhos, splash alternativo e materiais de marketing.
- `norby-avatar.svg` — avatar redondo colorido do Norby, para o header do chat.
- `icons/*.svg` — ícones de navegação/utilitários no estilo do mockup (linha, `stroke="currentColor"`, viewBox 24x24): home, map, norby, profile, bus, shield. Como o projeto já usa `react-native-svg`, esses arquivos podem ser importados como componentes React Native (via `react-native-svg-transformer` ou convertidos com `npx react-native-svg-transformer`) e coloridos dinamicamente pelo tema, sem precisar gerar PNG.

## Como regenerar os PNGs

Os PNGs finais (`assets/images/*.png`) usados pelo `app.config.ts` são gerados
por `scripts/generate-brand-assets.mjs`:

```bash
pnpm add -D sharp   # uma vez só
node scripts/generate-brand-assets.mjs
```

Isso sobrescreve `icon.png`, `favicon.png`, `splash-icon.png`,
`android-icon-background.png`, `android-icon-foreground.png`,
`android-icon-monochrome.png` e `notification-icon.png`/`norby-avatar.png`
em `assets/images/`. Rode sempre que editar um SVG aqui.

## Por que SVG e não PNG direto no commit

O ambiente usado para gerar estes ativos não conseguiu enviar arquivos
binários (PNG) de forma confiável através da integração de código usada no
momento — o conteúdo chegava corrompido no repositório. Os SVGs são texto
puro e chegam intactos; o script acima produz os PNGs corretos localmente
(ou no Codespace) em segundos.
