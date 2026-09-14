// FIX (AdMob): `react-native-google-mobile-ads` é um módulo nativo — não
// existe (e não deve ser importado) no bundle web, que é como o preview
// deste projeto tem sido testado (`pnpm dev:metro -- --web`). O Metro
// resolve automaticamente este arquivo ".web.tsx" no lugar de
// "ad-banner.tsx" quando compila para web, então nada do SDK do AdMob
// sequer é importado nessa plataforma. Fora da web (build nativo), o
// componente de verdade em ad-banner.tsx é o que entra.
export function AdBanner() {
  return null;
}
