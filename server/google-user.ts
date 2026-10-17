import { sql } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Procura um usuário já existente pelo e-mail (sem diferenciar maiúsculas).
 * Usado no primeiro login com Google para reaproveitar contas criadas antes
 * (quando o login era pelo Supabase), mantendo favoritos/agenda no backup. Só
 * deve ser chamado com um e-mail que o Google marcou como verificado.
 */
export async function findUserByEmail(email: string) {
  const database = await getDb();
  if (!database) return undefined;
  const rows = await database
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .orderBy(users.id)
    .limit(1);
  return rows[0];
}
