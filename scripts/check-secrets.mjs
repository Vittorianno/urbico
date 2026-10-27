#!/usr/bin/env node
/**
 * Guarda de segredos do Urbico.
 *
 * Regra do projeto: chaves de API, tokens e senhas existem SOMENTE no .env
 * (local, fora do Git). Este script falha se encontrar:
 *   - arquivos que não devem ser versionados (.env, .env.*, chaves privadas,
 *     google-services.json etc.);
 *   - valores que parecem segredos dentro de arquivos versionados.
 *
 * Uso:
 *   node scripts/check-secrets.mjs             # todos os arquivos versionados
 *   node scripts/check-secrets.mjs --staged    # só o que está no commit (hook)
 *   node scripts/check-secrets.mjs --history   # procura segredos no histórico
 *
 * NUNCA imprime o valor encontrado — só arquivo, linha e o tipo de regra.
 * Falso positivo numa linha: acrescente o comentário `secret-scan:allow`.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const args = new Set(process.argv.slice(2));
const STAGED = args.has("--staged");
const HISTORY = args.has("--history");
const BIG = 256 * 1024 * 1024;

const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: BIG });
const gitBuf = (...a) => execFileSync("git", a, { maxBuffer: BIG });

// ---- 1. nomes de arquivo que nunca podem ser versionados ---------------------
const BLOCKED_NAMES = [
  [/(^|\/)\.env$/, "arquivo .env"],
  [/(^|\/)\.env\.(?!example$).+/, "variante de .env (.env.local, .env.backup.* ...)"],
  [/(^|\/)[^/]*\.env$/, "arquivo *.env"],
  [/\.(pem|key|p12|pfx|jks|keystore|p8|mobileprovision)$/i, "chave ou certificado privado"],
  [/(^|\/)(google-services\.json|GoogleService-Info\.plist)$/, "config do Firebase (contém chave de API)"],
  [/(^|\/)(service[-_]?account|credentials)[^/]*\.json$/i, "credencial de conta de serviço"],
  [/(^|\/)\.git-credentials$/, "credenciais do Git"],
];

// ---- 2. padrões de conteúdo ---------------------------------------------------
const PLACEHOLDER = /troque|senha|password|exemplo|example|changeme|placeholder|seu[-_ ]|your[-_ ]|xxxx|\.\.\.|<[^>]+>|\$\{/i;
const RULES = [
  { name: "chave de API do Google (AIza...)", re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "segredo OAuth do Google (GOCSPX-...)", re: /GOCSPX-[0-9A-Za-z_-]{20,}/ },
  { name: "Client ID do Google escrito no código", re: /[0-9]{8,}-[0-9a-z]{20,}\.apps\.googleusercontent\.com/ },
  { name: "token do GitHub", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/ },
  { name: "token fine-grained do GitHub", re: /github_pat_[A-Za-z0-9_]{50,}/ },
  { name: "token do Slack", re: /xox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: "chave de acesso AWS", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "chave privada (PEM)", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "JWT / chave do Supabase escrita no código", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "chave estilo OpenAI/Stripe (sk-...)", re: /\b(?:sk-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{16,})/ },
  { name: "ID real do AdMob (só os IDs de teste do Google são aceitos)", re: /ca-app-pub-(?!3940256099942544)\d{16}[~/]\d{10}/ },
  {
    name: "URL com usuário e senha embutidos",
    re: /\b[a-z][a-z0-9+.-]*:\/\/([^\s/:@'"]+):([^\s/:@'"]{6,})@/i,
    accept: (match) => !PLACEHOLDER.test(match[2]),
  },
  {
    name: "atribuição de segredo literal (api_key / secret / token / password)",
    re: /(?:api[_-]?key|apikey|client[_-]?secret|secret|token|passwd|password|access[_-]?key)["']?\s*[:=]\s*["'`]([A-Za-z0-9_\-./+=]{20,})["'`]/i,
    accept: (match, line) => {
      const value = match[1];
      if (/process\.env|import\.meta\.env/.test(line) || PLACEHOLDER.test(line)) return false;
      return /[0-9]/.test(value) && /[A-Za-z]/.test(value) && new Set(value).size > 8;
    },
  },
];

const SKIP_PATHS = [/(^|\/)pnpm-lock\.yaml$/, /(^|\/)drizzle\/meta\//, /(^|\/)assets\//, /^scripts\/check-secrets\.mjs$/, /\.(png|jpe?g|gif|webp|ico|ttf|otf|woff2?|mp3|mp4|wav|pdf|zip|jar|keystore)$/i];

const findings = [];
const report = (file, line, what) => findings.push({ file, line, what });

function listFiles() {
  const out = STAGED ? git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z") : git("ls-files", "-z");
  return out.split("\0").filter(Boolean);
}

function readContent(file) {
  try {
    return STAGED ? gitBuf("show", `:${file}`) : fs.readFileSync(file);
  } catch {
    return null;
  }
}

if (HISTORY) {
  console.log("Procurando segredos no HISTÓRICO do Git (pode demorar)...\n");
  let problems = 0;
  const added = git("log", "--all", "--pretty=format:", "--name-only", "--diff-filter=A").split("\n").filter(Boolean);
  const badFiles = [...new Set(added.filter((name) => BLOCKED_NAMES.some(([re]) => re.test(name))))];
  for (const name of badFiles) {
    problems++;
    console.log(`HISTÓRICO: já existiu no Git o arquivo proibido: ${name}`);
  }
  const ERE = [
    ["chave de API do Google", "AIza[0-9A-Za-z_-]{35}"],
    ["segredo OAuth do Google", "GOCSPX-[0-9A-Za-z_-]{20,}"],
    ["token do GitHub", "gh[pousr]_[A-Za-z0-9]{36,}"],
    ["token fine-grained do GitHub", "github_pat_[A-Za-z0-9_]{50,}"],
    ["chave AWS", "AKIA[0-9A-Z]{16}"],
    ["chave privada PEM", "BEGIN [A-Z ]*PRIVATE KEY"],
  ];
  for (const [name, pattern] of ERE) {
    const commits = git("log", "--all", "--format=%h", `-G${pattern}`, "--", ".", ":!pnpm-lock.yaml").split("\n").filter(Boolean);
    if (commits.length) {
      problems++;
      console.log(`HISTÓRICO: ${name} aparece em ${commits.length} commit(s) (ex.: ${commits.slice(0, 5).join(", ")})`);
    }
  }
  if (problems) {
    console.log("\nSe algum segredo REAL já foi commitado, considere-o vazado: GERE UMA CHAVE NOVA no serviço de origem e revogue a antiga. Apagar o arquivo agora não remove o histórico.");
    process.exit(1);
  }
  console.log("Nada suspeito encontrado no histórico (padrões conhecidos).");
  process.exit(0);
}

for (const file of listFiles()) {
  for (const [re, label] of BLOCKED_NAMES) {
    if (re.test(file)) report(file, 0, `não pode ser versionado: ${label}`);
  }
  if (SKIP_PATHS.some((re) => re.test(file))) continue;
  if (file === ".env.example") continue; // valores vazios/exemplos; ainda assim conferido abaixo
  const buffer = readContent(file);
  if (!buffer || buffer.length > 1_500_000 || buffer.subarray(0, 8000).includes(0)) continue;
  const lines = buffer.toString("utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.length > 2000 || line.includes("secret-scan:allow")) return;
    for (const rule of RULES) {
      const match = rule.re.exec(line);
      if (match && (!rule.accept || rule.accept(match, line))) report(file, index + 1, rule.name);
    }
  });
}

// .env.example: só modelos — qualquer valor com cara de segredo real é erro.
if (!STAGED || listFiles().includes(".env.example")) {
  const example = readContent(".env.example");
  if (example) {
    example.toString("utf8").split(/\r?\n/).forEach((line, index) => {
      const m = /^([A-Z0-9_]+)=(.+)$/.exec(line.trim());
      if (!m) return;
      const name = m[1];
      const value = m[2].replace(/^['"]|['"]$/g, "");
      const sensitive = /(KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL)/.test(name);
      if (sensitive && value && !PLACEHOLDER.test(value) && !/^(mysql:\/\/usuario:senha@)/.test(value)) {
        report(".env.example", index + 1, `valor preenchido em ${name} (o .env.example deve ter só modelos)`);
      }
    });
  }
}

// .gitignore precisa realmente proteger o .env e suas variantes.
for (const probe of [".env", ".env.local", ".env.backup.20260101_000000", ".env.production"]) {
  try {
    git("check-ignore", "-q", probe);
  } catch {
    report(".gitignore", 0, `não ignora ${probe} — adicione .env e .env.* (com !.env.example)`);
  }
}

if (findings.length) {
  console.error("\nBLOQUEADO: possíveis segredos ou arquivos proibidos no Git:\n");
  for (const { file, line, what } of findings) console.error(`  ${file}${line ? `:${line}` : ""}  →  ${what}`);
  console.error("\nMova o valor para o .env (e leia por process.env / EXPO_PUBLIC_*). Falso positivo? Marque a linha com `secret-scan:allow`.");
  console.error("Se um segredo REAL já foi commitado, gere uma chave nova no serviço de origem e revogue a antiga.\n");
  process.exit(1);
}
console.log(`OK: nenhum segredo encontrado${STAGED ? " nos arquivos do commit" : " nos arquivos versionados"}.`);
