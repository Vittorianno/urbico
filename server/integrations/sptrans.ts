const SPTRANS_BASE_URL = "https://api.olhovivo.sptrans.com.br/v2.1";

export type TransitLine = {
  id: number;
  label: string;
  direction: 1 | 2;
  destination: string;
  origin: string;
};

export type TransitStop = {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type TransitVehicle = {
  prefix: string;
  timestamp: string | null;
  accessible: boolean | null;
  latitude: number;
  longitude: number;
};

export type StopPrediction = {
  referenceTime: string;
  stop: TransitStop;
  lines: Array<{
    line: TransitLine;
    vehicleCount: number;
    vehicles: Array<TransitVehicle & { estimatedArrival: string | null }>;
  }>;
};

type RawLine = { cl: number; lc: boolean; lt0: string; lt1: string; sl: 1 | 2; tl: number; tp: string; ts: string };
type RawStop = { cp: number; np: string; ed: string; py: number; px: number };
type RawVehicle = { p: number; t?: string; a?: boolean; ta?: string; py: number; px: number };
type RawPredictionLine = { c: string; cl: number; sl: 1 | 2; lt0: string; lt1: string; qv: number; vs: RawVehicle[] };
type RawPrediction = { hr: string; p: RawStop & { l: RawPredictionLine[] } };

function getToken() {
  const token = process.env.SPTRANS_TOKEN;
  if (!token) throw new Error("Serviço de transporte não configurado.");
  return token;
}

function mapLine(raw: RawLine | RawPredictionLine): TransitLine {
  const label = "c" in raw ? raw.c : raw.lc ? `${raw.tl}-${raw.tp}` : `${raw.tl}-${raw.ts}`;
  return { id: raw.cl, label, direction: raw.sl, destination: raw.lt0, origin: raw.lt1 };
}

function mapStop(raw: RawStop): TransitStop {
  return { id: raw.cp, name: raw.np, address: raw.ed, latitude: raw.py, longitude: raw.px };
}

// FIX: a API Olho Vivo mantém a sessão autenticada por alguns minutos. O código
// original chamava /Login/Autenticar em TODA requisição, o que desperdiça
// latência e arrisca estourar o limite de autenticações da fonte oficial sob
// uso real. Agora a sessão é cacheada e reaproveitada até perto de expirar,
// com reautenticação automática em caso de expiração (401/403) e proteção
// contra autenticações concorrentes (várias chamadas simultâneas não disparam
// vários logins).
const SESSION_TTL_MS = 3 * 60 * 1000;
let cachedSession: { cookie: string; expiresAt: number } | null = null;
let pendingAuthentication: Promise<string> | null = null;

async function authenticate(): Promise<string> {
  const token = getToken();
  const login = await fetch(`${SPTRANS_BASE_URL}/Login/Autenticar?token=${encodeURIComponent(token)}`, { method: "POST" });
  if (!login.ok || (await login.json().catch(() => false)) !== true) {
    throw new Error("Não foi possível autenticar na fonte de transporte.");
  }
  const sessionCookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!sessionCookie) throw new Error("A fonte de transporte não retornou uma sessão válida.");
  cachedSession = { cookie: sessionCookie, expiresAt: Date.now() + SESSION_TTL_MS };
  return sessionCookie;
}

async function getSessionCookie(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession.cookie;
  }
  if (!pendingAuthentication) {
    pendingAuthentication = authenticate().finally(() => {
      pendingAuthentication = null;
    });
  }
  return pendingAuthentication;
}

async function authenticatedRequest<T>(path: string, isRetry = false): Promise<T> {
  const sessionCookie = await getSessionCookie(isRetry);
  const response = await fetch(`${SPTRANS_BASE_URL}${path}`, {
    headers: { cookie: sessionCookie },
  });
  // Sessão expirada no servidor antes do previsto: reautentica uma vez e tenta de novo.
  if ((response.status === 401 || response.status === 403) && !isRetry) {
    return authenticatedRequest<T>(path, true);
  }
  if (!response.ok) throw new Error("A fonte de transporte não respondeu à consulta.");
  return (await response.json()) as T;
}

export async function searchLines(term: string): Promise<TransitLine[]> {
  const data = await authenticatedRequest<RawLine[]>(`/Linha/Buscar?termosBusca=${encodeURIComponent(term)}`);
  return data.map(mapLine);
}

export async function searchStops(term: string): Promise<TransitStop[]> {
  const data = await authenticatedRequest<RawStop[]>(`/Parada/Buscar?termosBusca=${encodeURIComponent(term)}`);
  return data.map(mapStop);
}

export async function getLineStops(lineId: number): Promise<TransitStop[]> {
  const data = await authenticatedRequest<RawStop[]>(`/Parada/BuscarParadasPorLinha?codigoLinha=${lineId}`);
  return data.map(mapStop);
}

export async function getLineVehicles(lineId: number): Promise<TransitVehicle[]> {
  const data = await authenticatedRequest<{ vs?: RawVehicle[] }>(`/Posicao/Linha?codigoLinha=${lineId}`);
  return (data.vs ?? []).map((vehicle) => ({
    prefix: String(vehicle.p),
    timestamp: vehicle.ta ?? null,
    accessible: typeof vehicle.a === "boolean" ? vehicle.a : null,
    latitude: vehicle.py,
    longitude: vehicle.px,
  }));
}

export async function getStopPredictions(stopId: number): Promise<StopPrediction> {
  const data = await authenticatedRequest<RawPrediction>(`/Previsao/Parada?codigoParada=${stopId}`);
  return {
    referenceTime: data.hr,
    stop: mapStop(data.p),
    lines: (data.p.l ?? []).map((rawLine) => ({
      line: mapLine(rawLine),
      vehicleCount: rawLine.qv,
      vehicles: (rawLine.vs ?? []).map((vehicle) => ({
        prefix: String(vehicle.p),
        timestamp: vehicle.ta ?? null,
        accessible: typeof vehicle.a === "boolean" ? vehicle.a : null,
        latitude: vehicle.py,
        longitude: vehicle.px,
        estimatedArrival: vehicle.t ?? null,
      })),
    })),
  };
}
