/** Iniciais para o avatar alternativo: nome (primeira + última palavra) ou, sem nome, o e-mail. */
export function getInitials(name?: string | null, email?: string | null): string | null {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  if (words.length === 1) return words[0][0].toUpperCase();
  const local = (email ?? "").trim().split("@")[0];
  return local ? local[0].toUpperCase() : null;
}
