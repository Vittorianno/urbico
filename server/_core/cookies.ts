import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
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
function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;
  if (LOCAL_HOSTS.has(req.hostname)) return true;

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
