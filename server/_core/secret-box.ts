import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Criptografia em repouso (AES-256-GCM) para credenciais sensíveis gravadas no
 * banco — hoje, o refresh_token do Google Agenda, que antes ficava em texto
 * puro (ver comentário em drizzle/schema.ts, googleCalendarAccounts).
 *
 * Chave: TOKEN_ENCRYPTION_KEY (qualquer string longa e aleatória, ex.:
 * `openssl rand -base64 32`). É derivada com SHA-256 para 32 bytes.
 * ATENÇÃO: se a chave for perdida ou trocada, os tokens já gravados não podem
 * mais ser lidos e cada pessoa precisa reconectar o Google Agenda.
 *
 * Formato gravado: enc:v1:<iv>:<tag>:<dados> (base64). Valores sem esse
 * prefixo são tratados como legado em texto puro e devolvidos como estão, para
 * não quebrar contas já conectadas antes desta mudança.
 */

const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  return createHash("sha256").update(raw).digest();
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TOKEN_ENCRYPTION_KEY não configurada — não é seguro gravar credenciais sem criptografia em produção.");
    }
    console.warn("[secret-box] TOKEN_ENCRYPTION_KEY ausente; gravando sem criptografia (aceitável só em desenvolvimento).");
    return plain;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (!isEncryptedSecret(stored)) return stored;
  const key = getKey();
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY ausente: não é possível ler uma credencial criptografada.");
  }
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Credencial criptografada em formato inválido.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
