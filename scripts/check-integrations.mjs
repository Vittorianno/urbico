#!/usr/bin/env node
/**
 * Diagnóstico das integrações do Urbico.
 *
 * Uso (na pasta do projeto):  node scripts/check-integrations.mjs
 *
 * Lê o .env, CHAMA de verdade cada serviço que esta versão do código usa e
 * diz se respondeu. Nunca imprime valores de chaves — só nomes e OK/FALHA.
 * Também lista nomes presentes no .env que o código NÃO lê (chave preenchida
 * que não muda nada no app).
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
const fileEnv = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  if (!line.trim() || line.trim().startsWith("#")) continue;
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    fileEnv[match[1]] = value;
  }
} else {
  console.log("AVISO: .env não encontrado em", envPath);
}
const get = (name) => (process.env[name] ?? fileEnv[name] ?? "").trim();

// Nomes que o código desta versão realmente lê.
const KNOWN = new Set([
  "PORT", "NODE_ENV", "DATABASE_URL", "JWT_SECRET", "OWNER_OPEN_ID", "VITE_APP_ID",
  "SPTRANS_TOKEN", "PELIAS_BASE_URL", "VALHALLA_BASE_URL", "OLLAMA_BASE_URL", "OLLAMA_MODEL",
  "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "GOOGLE_AUTH_REDIRECT_URI",
  "AUTH_ALLOWED_RETURN_ORIGINS", "CRON_SECRET", "SUPABASE_URL", "SUPABASE_ANON_KEY",
  "BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY", "EXPO_PORT", "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_ADMOB_ANDROID_APP_ID",
  "EXPO_PUBLIC_ADMOB_IOS_APP_ID", "EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID", "ANALYTICS_STORE_UNKNOWN_TEXT",
]);

const results = [];
const record = (area, ok, detail) => results.push({ area, ok, detail });
const timeout = () => AbortSignal.timeout(10_000);
const UA = { "User-Agent": "UrbicoApp/1.0 (diagnostico)" };

async function check(area, fn) {
  try {
    const detail = await fn();
    record(area, true, detail ?? "respondeu");
  } catch (error) {
    record(area, false, error instanceof Error ? error.message : "erro desconhecido");
  }
}

const missing = (name) => {
  throw new Error(`${name} não está definida no .env`);
};

// --- Servidor ---------------------------------------------------------------
await check("JWT_SECRET (sessão)", async () => (get("JWT_SECRET") ? "definido" : missing("JWT_SECRET")));
await check("DATABASE_URL (MySQL)", async () => (get("DATABASE_URL") ? "definida (conexão não testada aqui)" : missing("DATABASE_URL")));

// --- Transporte (SPTrans Olho Vivo) -------------------------------------------
await check("SPTrans (SPTRANS_TOKEN)", async () => {
  const token = get("SPTRANS_TOKEN");
  if (!token) missing("SPTRANS_TOKEN");
  const response = await fetch(`https://api.olhovivo.sptrans.com.br/v2.1/Login/Autenticar?token=${encodeURIComponent(token)}`, { method: "POST", signal: timeout() });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if ((await response.json().catch(() => false)) !== true) throw new Error("token recusado pela SPTrans (verifique se está correto e ativo)");
  return "token aceito";
});

// --- Endereços e rotas a pé (públicos, sem chave) --------------------------------
await check("Endereços — Nominatim (OpenStreetMap)", async () => {
  const response = await fetch("https://nominatim.openstreetmap.org/search?q=Avenida%20Paulista&format=jsonv2&countrycodes=br&limit=1", { headers: UA, signal: timeout() });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data) || !data.length) throw new Error("respondeu sem resultados");
  return "respondeu";
});
await check("Rota a pé — OSRM público", async () => {
  const response = await fetch("https://router.project-osrm.org/route/v1/foot/-46.6565,-23.5614;-46.6520,-23.5640?overview=false", { headers: UA, signal: timeout() });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.code !== "Ok") throw new Error(`código ${data.code}`);
  return "respondeu";
});

// --- Opcionais próprios --------------------------------------------------------
if (get("PELIAS_BASE_URL")) {
  await check("Pelias (PELIAS_BASE_URL)", async () => {
    const response = await fetch(`${get("PELIAS_BASE_URL").replace(/\/$/, "")}/v1/autocomplete?text=paulista&size=1`, { signal: timeout() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return "respondeu";
  });
}
if (get("VALHALLA_BASE_URL")) {
  await check("Valhalla (VALHALLA_BASE_URL)", async () => {
    const response = await fetch(`${get("VALHALLA_BASE_URL").replace(/\/$/, "")}/status`, { signal: timeout() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return "respondeu";
  });
}

// --- Norby (Ollama) --------------------------------------------------------------
const ollamaUrl = get("OLLAMA_BASE_URL");
const ollamaModel = get("OLLAMA_MODEL");
if (!ollamaUrl || !ollamaModel) {
  record("Norby — modelo (Ollama)", false, "OLLAMA_BASE_URL e OLLAMA_MODEL não definidos: o Norby responde só por regras locais (não é erro, mas não usa IA)");
} else {
  await check("Norby — modelo (Ollama)", async () => {
    const response = await fetch(`${ollamaUrl.replace(/\/$/, "")}/api/tags`, { signal: timeout() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const names = (data.models ?? []).map((model) => model.name);
    if (!names.some((name) => name === ollamaModel || name.startsWith(`${ollamaModel}:`))) {
      throw new Error(`o Ollama responde, mas o modelo "${ollamaModel}" não está instalado (rode: ollama pull ${ollamaModel})`);
    }
    return "modelo disponível";
  });
}

// --- Login com Google ------------------------------------------------------------
const googleMissing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_AUTH_REDIRECT_URI"].filter((name) => !get(name));
record("Login com Google", googleMissing.length === 0, googleMissing.length ? `faltam no .env: ${googleMissing.join(", ")}` : "variáveis definidas (o login em si só se prova entrando)");

// --- Relatório -------------------------------------------------------------------
console.log("\n=== DIAGNÓSTICO DAS INTEGRAÇÕES DO URBICO ===\n");
for (const result of results) console.log(`${result.ok ? "OK   " : "FALHA"}  ${result.area}: ${result.detail}`);

const unused = Object.keys(fileEnv).filter((name) => !KNOWN.has(name));
if (unused.length) {
  console.log("\nNomes no .env que ESTA versão do código não lê (preencher não muda nada no app):");
  for (const name of unused) console.log(`  - ${name}`);
}
console.log("\nLembrete: reinicie o servidor (pnpm dev) depois de mudar o .env — ele só lê o arquivo ao iniciar.");
process.exit(results.some((result) => !result.ok) ? 1 : 0);
