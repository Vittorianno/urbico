export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Supabase: desde a decisão de login direto com o Google, o Supabase NÃO é
  // mais usado para autenticação — fica reservado à inteligência do Norby.
  // As chaves continuam aqui só porque outros módulos podem lê-las.
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  // Segredo compartilhado para acionar o monitoramento de alertas de saída
  // via HTTP a partir de um cron externo (GitHub Actions, Vercel Cron etc.).
  // Opcional: o agendador interno (setInterval em server/_core/index.ts) já
  // cobre o caso comum de hospedagem com processo de longa duração.
  cronSecret: process.env.CRON_SECRET ?? "",
  // Credenciais OAuth criadas no Google Cloud Console (APIs & Services →
  // Credentials → OAuth client ID → "Web application"). Usadas tanto pelo
  // login com Google (server/_core/google-auth-routes.ts) quanto pelo Google
  // Agenda (server/integrations/google-calendar.ts).
  // googleRedirectUri (Google Agenda) deve ser EXATAMENTE a URL cadastrada em
  // "Authorized redirect URIs" (ex.: https://seu-dominio.com/api/google-calendar/callback).
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
  // Login com Google: URL de retorno DO SERVIDOR cadastrada no Google (ex.:
  // https://seu-dominio.com/api/auth/google/callback ou, em desenvolvimento,
  // http://localhost:3000/api/auth/google/callback). Também precisa estar em
  // "Authorized redirect URIs" do mesmo cliente OAuth.
  googleAuthRedirectUri: process.env.GOOGLE_AUTH_REDIRECT_URI ?? "",
  // Origens web (separadas por vírgula) para as quais o servidor pode devolver o
  // usuário depois do login (ex.: https://app.seu-dominio.com). Em
  // desenvolvimento http://localhost:8081 já é aceito. O retorno ao app nativo
  // (urbico://login) é sempre aceito.
  authAllowedReturnOrigins: process.env.AUTH_ALLOWED_RETURN_ORIGINS ?? "",
};
