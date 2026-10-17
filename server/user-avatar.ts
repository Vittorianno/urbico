import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Grava (ou limpa, com null) a URL da foto de perfil de um usuário já
 * existente. Fica separado de `db.upsertUser` de propósito: o upsert é chamado
 * a cada requisição autenticada só com `openId`/`lastSignedIn`, e a foto só
 * deve ser atualizada no login, quando o provedor acabou de informá-la.
 */
export async function saveUserAvatarUrl(openId: string, avatarUrl: string | null): Promise<void> {
  const database = await getDb();
  if (!database) return;
  await database.update(users).set({ avatarUrl }).where(eq(users.openId, openId));
}
