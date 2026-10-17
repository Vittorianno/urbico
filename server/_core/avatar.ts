/**
 * Validação da URL da foto de perfil que vem do provedor de login (Google, via
 * `user_metadata` do Supabase Auth) antes de ela ser gravada em `users.avatarUrl`.
 *
 * Regras (privacidade/segurança — ver docs/auth-profile-notifications.md):
 * - só aceitamos a URL que o provedor realmente informou; nada é inventado;
 * - apenas `https:` (nada de `http:`, `data:`, `javascript:` etc.);
 * - sem credenciais embutidas na URL (`https://user:senha@host/...`);
 * - tamanho limitado ao da coluna do banco;
 * - a imagem em si nunca é baixada nem copiada para o Urbico.
 */
export const MAX_AVATAR_URL_LENGTH = 1024;

export function sanitizeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_AVATAR_URL_LENGTH) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;

  const normalized = parsed.toString();
  return normalized.length <= MAX_AVATAR_URL_LENGTH ? normalized : null;
}

/**
 * O Supabase Auth repassa os campos do Google em `user_metadata`: `avatar_url`
 * (preferido) e `picture` (nome do claim OIDC original). Usuários de e-mail e
 * senha normalmente não têm nenhum dos dois — nesse caso devolve null e o app
 * mostra o avatar com iniciais.
 */
export function pickAvatarUrl(metadata: { avatar_url?: unknown; picture?: unknown } | null | undefined): string | null {
  if (!metadata) return null;
  return sanitizeAvatarUrl(metadata.avatar_url) ?? sanitizeAvatarUrl(metadata.picture);
}
