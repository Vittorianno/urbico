export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Supabase Auth — substitui o OAuth proprietário do Manus (ver README,
  // seção "Autenticação"). SUPABASE_ANON_KEY é uma chave pública (mesma que
  // vai para o cliente), não um segredo: o backend só a usa para chamar o
  // endpoint /auth/v1/user do Supabase e confirmar que um access token
  // enviado pelo app é válido.
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  // Segredo compartilhado para acionar o monitoramento de alertas de saída
  // via HTTP a partir de um cron externo (GitHub Actions, Vercel Cron etc.).
  // Opcional: o agendador interno (setInterval em server/_core/index.ts) já
  // cobre o caso comum de hospedagem com processo de longa duração.
  cronSecret: process.env.CRON_SECRET ?? "",
};
