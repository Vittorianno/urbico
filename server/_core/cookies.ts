import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

// FIX: faixas de IP privado (RFC 1918) — o endereço que o próprio Metro
// imprime ao rodar `pnpm dev:metro` (ex.: "Web: exp://192.168.1.235:8081")
// para testar a partir de outro aparelho na mesma rede.
const PRIVATE_IPV4_RANGES = [/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/, /^192\.168\.\d{1,3}\.\d{1,3}$/];

function isPrivateNetworkHost(host: string) {
  return PRIVATE_IPV4_RANGES.some((pattern) => pattern.test(host));
}

// FIX: cookies com `sameSite: "none"` só são aceitos pelo navegador se também
// tiverem `secure: true` — caso contrário o navegador descarta o cookie por
// completo, silenciosamente. O código antigo considerava `http://localhost`
// sempre "inseguro" (`req.protocol !== "https"`), então em desenvolvimento
// local (`pnpm dev`, backend em :3000, Metro/web em :8081 — duas origens
// diferentes) o cookie de sessão do login nunca era aceito pelo navegador, e
// o login web ficava quebrado sem nenhum erro visível. Chrome e Edge tratam
// `localhost`/`127.0.0.1` como "origem confiável" e aceitam cookies `Secure`
// mesmo sobre HTTP puro nesse caso específico — então tratamos esses hosts
// como seguros para fins de cookie, igual o próprio navegador já faz.
//
// FIX 2: o mesmo problema acontecia ao abrir o app pelo IP da rede local
// (ex.: testando a partir do celular/outro computador na mesma Wi-Fi,
// usando o endereço que o Metro imprime) — só `localhost`/`127.0.0.1` tinham
// a exceção acima, então nesse cenário a pessoa fazia login, o cookie era
// silenciosamente descartado pelo navegador, e o app "esquecia" o login a
// cada abertura, mesmo a sessão sendo válida por ~1 ano no servidor. Redes
// privadas (RFC 1918) em desenvolvimento local recebem o mesmo tratamento de
// confiança que localhost — em produção isso não muda nada, porque ali
// `req.protocol === "https"` já é verdadeiro antes de chegar a esta checagem.
function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;
  if (LOCAL_HOSTS.has(req.hostname)) return true;
  if (isPrivateNetworkHost(req.hostname)) return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");

  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}

/**
 * Extract parent domain for cookie sharing across subdomains.
 * e.g., "3000-xxx.manuspre.computer" -> ".manuspre.computer"
 * This allows cookies set by 3000-xxx to be read by 8081-xxx
 */
function getParentDomain(hostname: string): string | undefined {
  // Don't set domain for localhost or IP addresses
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return undefined;
  }

  // Split hostname into parts
  const parts = hostname.split(".");

  // Need at least 3 parts for a subdomain (e.g., "3000-xxx.manuspre.computer")
  // For "manuspre.computer", we can't set a parent domain
  if (parts.length < 3) {
    return undefined;
  }

  // Return parent domain with leading dot (e.g., ".manuspre.computer")
  // This allows cookie to be shared across all subdomains
  return "." + parts.slice(-2).join(".");
}

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  const domain = getParentDomain(hostname);

  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
  };
}
