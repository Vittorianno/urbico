import { fetchWithTimeout } from "../_core/http";

export type WeatherSnapshot = {
  provider: "Open-Meteo";
  fetchedAt: string;
  timezone: string;
  current: {
    temperatureC: number | null;
    feelsLikeC: number | null;
    humidityPercent: number | null;
    precipitationMm: number | null;
    rainMm: number | null;
    windKmh: number | null;
    cloudCoverPercent: number | null;
    weatherCode: number | null;
    description: string;
  };
  nextHours: Array<{ time: string; temperatureC: number | null; precipitationProbability: number | null; precipitationMm: number | null; description: string }>;
  daily: Array<{ date: string; minC: number | null; maxC: number | null; precipitationProbabilityMax: number | null; description: string }>;
  sourceUrl: string;
  officialAlerts: Array<{ title: string; severity: string; startsAt: string | null; endsAt: string | null; details: string; sourceUrl: string }>;
  officialAlertsStatus: "available" | "no_active_alerts" | "unavailable";
};

export type SearchResult = { title: string; url: string; snippet: string; source: string };
export type OccurrenceResult = { title: string; url: string; publishedAt: string | null; source: string; category: string };

const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const DDG_URL = "https://html.duckduckgo.com/html/";
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

function weatherDescription(code: number | null | undefined): string {
  if (code == null) return "Condição não informada";
  if (code === 0) return "Céu limpo";
  if ([1, 2].includes(code)) return "Predominantemente limpo ou parcialmente nublado";
  if (code === 3) return "Nublado";
  if ([45, 48].includes(code)) return "Neblina";
  if ([51, 53, 55, 56, 57].includes(code)) return "Garoa";
  if ([61, 63, 65, 66, 67].includes(code)) return "Chuva";
  if ([71, 73, 75, 77].includes(code)) return "Neve";
  if ([80, 81, 82].includes(code)) return "Pancadas de chuva";
  if ([85, 86].includes(code)) return "Pancadas de neve";
  if ([95, 96, 99].includes(code)) return "Trovoadas";
  return "Condição meteorológica variável";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function getWeather(latitude: number, longitude: number): Promise<WeatherSnapshot> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Coordenadas inválidas para consulta meteorológica.");
  }

  const url = new URL(WEATHER_URL);
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,wind_speed_10m,cloud_cover,weather_code",
    hourly: "temperature_2m,precipitation_probability,precipitation,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
    forecast_days: "3",
    timezone: "auto",
  }).toString();

  const response = await fetchWithTimeout(url, { headers: { accept: "application/json" } }, 9_000);
  if (!response.ok) throw new Error(`Serviço meteorológico indisponível (HTTP ${response.status}).`);
  const payload = await response.json() as {
    timezone?: string;
    current?: Record<string, unknown>;
    hourly?: { time?: string[]; temperature_2m?: number[]; precipitation_probability?: number[]; precipitation?: number[]; weather_code?: number[] };
    daily?: { time?: string[]; temperature_2m_min?: number[]; temperature_2m_max?: number[]; precipitation_probability_max?: number[]; weather_code?: number[] };
  };
  if (!payload.current) throw new Error("A fonte meteorológica não retornou condições atuais.");

  const times = payload.hourly?.time ?? [];
  const now = String(payload.current.time ?? "");
  let startIndex = times.findIndex((time) => time >= now);
  if (startIndex < 0) startIndex = 0;
  const nextHours = times.slice(startIndex, startIndex + 8).map((time, offset) => {
    const i = startIndex + offset;
    const code = numberOrNull(payload.hourly?.weather_code?.[i]);
    return {
      time,
      temperatureC: numberOrNull(payload.hourly?.temperature_2m?.[i]),
      precipitationProbability: numberOrNull(payload.hourly?.precipitation_probability?.[i]),
      precipitationMm: numberOrNull(payload.hourly?.precipitation?.[i]),
      description: weatherDescription(code),
    };
  });
  const daily = (payload.daily?.time ?? []).map((date, i) => ({
    date,
    minC: numberOrNull(payload.daily?.temperature_2m_min?.[i]),
    maxC: numberOrNull(payload.daily?.temperature_2m_max?.[i]),
    precipitationProbabilityMax: numberOrNull(payload.daily?.precipitation_probability_max?.[i]),
    description: weatherDescription(numberOrNull(payload.daily?.weather_code?.[i])),
  }));

  const resolvedPlace = await resolveCity(latitude, longitude);
  const inmet = resolvedPlace ? await getInmetAlerts(resolvedPlace) : { alerts: [], status: "unavailable" as const };

  return {
    provider: "Open-Meteo",
    fetchedAt: new Date().toISOString(),
    timezone: payload.timezone ?? "auto",
    current: {
      temperatureC: numberOrNull(payload.current.temperature_2m),
      feelsLikeC: numberOrNull(payload.current.apparent_temperature),
      humidityPercent: numberOrNull(payload.current.relative_humidity_2m),
      precipitationMm: numberOrNull(payload.current.precipitation),
      rainMm: numberOrNull(payload.current.rain),
      windKmh: numberOrNull(payload.current.wind_speed_10m),
      cloudCoverPercent: numberOrNull(payload.current.cloud_cover),
      weatherCode: numberOrNull(payload.current.weather_code),
      description: weatherDescription(numberOrNull(payload.current.weather_code)),
    },
    nextHours,
    daily,
    sourceUrl: "https://open-meteo.com/",
    officialAlerts: inmet.alerts,
    officialAlertsStatus: inmet.status,
  };
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([\da-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/\s+/g, " ")
    .trim();
}

function unwrapDdgUrl(raw: string): string {
  try {
    const url = new URL(raw, "https://duckduckgo.com");
    const target = url.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : url.toString();
  } catch {
    return raw;
  }
}

export async function searchInternet(query: string): Promise<{ provider: string; searchedAt: string; results: SearchResult[] }> {
  const cleanQuery = query.trim().slice(0, 240);
  if (cleanQuery.length < 2) throw new Error("Informe o que deseja pesquisar.");
  const url = `${DDG_URL}?q=${encodeURIComponent(cleanQuery)}&kl=br-pt`;
  const response = await fetchWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Urbico/1.0 (mobilidade urbana; contato: suporte@urbico.app)",
    },
  }, 10_000);
  if (!response.ok) throw new Error(`Pesquisa na internet indisponível (HTTP ${response.status}).`);
  const html = await response.text();
  const anchors = [...html.matchAll(/<a\b(?=[^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/gi)];
  const snippets = [...html.matchAll(/<(?:a|div)\b[^>]*\bclass=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/gi)];
  const results = anchors.slice(0, 8).map((match, index) => {
    const target = unwrapDdgUrl(match[1] ?? "");
    let source = "Web";
    try { source = new URL(target).hostname.replace(/^www\./, ""); } catch { /* URL inválida será descartada pelo filtro */ }
    return {
      title: decodeHtml(match[2] ?? ""),
      url: target,
      snippet: decodeHtml(snippets[index]?.[1] ?? ""),
      source,
    };
  }).filter((item) => item.title && /^https?:\/\//i.test(item.url));
  return { provider: "DuckDuckGo HTML Search", searchedAt: new Date().toISOString(), results };
}

function classifyOccurrence(title: string): string {
  const text = title.toLowerCase();
  if (/acidente|colis|capot|atropel/.test(text)) return "Acidente";
  if (/interdi|bloque|desvio|fechamento/.test(text)) return "Interdição ou desvio";
  if (/obra|manuten|requalifica/.test(text)) return "Obras";
  if (/chuva|alag|enchente|temporal|desliz/.test(text)) return "Evento climático";
  if (/greve|manifesta|protesto/.test(text)) return "Mobilização";
  if (/ônibus|onibus|metrô|metro|transporte|trânsito|transito/.test(text)) return "Transporte e trânsito";
  return "Ocorrência";
}

const INMET_ACTIVE_ALERTS_URL = "https://apiprevmet3.inmet.gov.br/avisos/ativos";
const BRAZIL_STATE_CODES: Record<string, string> = {
  "acre":"AC","alagoas":"AL","amapá":"AP","amazonas":"AM","bahia":"BA","ceará":"CE","distrito federal":"DF","espírito santo":"ES","goiás":"GO","maranhão":"MA","mato grosso":"MT","mato grosso do sul":"MS","minas gerais":"MG","pará":"PA","paraíba":"PB","paraná":"PR","pernambuco":"PE","piauí":"PI","rio de janeiro":"RJ","rio grande do norte":"RN","rio grande do sul":"RS","rondônia":"RO","roraima":"RR","santa catarina":"SC","são paulo":"SP","sergipe":"SE","tocantins":"TO",
};

function collectAlertObjects(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["avisos", "alertas", "data", "results"]) {
    if (Array.isArray(record[key])) return collectAlertObjects(record[key]);
  }
  return [];
}

function alertText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

async function getInmetAlerts(place: string): Promise<{ alerts: WeatherSnapshot["officialAlerts"]; status: WeatherSnapshot["officialAlertsStatus"] }> {
  const stateName = place.split(",").map((part) => part.trim()).filter(Boolean).at(-1)?.toLowerCase() ?? "";
  const stateCode = BRAZIL_STATE_CODES[stateName];
  if (!stateCode) return { alerts: [], status: "unavailable" };
  try {
    const response = await fetchWithTimeout(INMET_ACTIVE_ALERTS_URL, {
      headers: { accept: "application/json", "user-agent": "Urbico/1.0 (mobilidade urbana)" },
    }, 6_000);
    if (!response.ok) return { alerts: [], status: "unavailable" };
    const payload = await response.json() as unknown;
    const alerts = collectAlertObjects(payload).flatMap((item) => {
      const serialized = JSON.stringify(item).toLowerCase();
      const stateMatches = serialized.includes(stateName)
        || serialized.includes('"uf":"' + stateCode.toLowerCase() + '"')
        || serialized.includes('"estado":"' + stateCode.toLowerCase() + '"')
        || serialized.includes('"sigla":"' + stateCode.toLowerCase() + '"');
      if (!stateMatches) return [];
      const title = alertText(item, ["descricao", "evento", "tipo", "nome", "aviso"]) || "Aviso meteorológico ativo";
      return [{
        title,
        severity: alertText(item, ["severidade", "nivel", "risco", "severity"]) || "Severidade não informada",
        startsAt: alertText(item, ["inicio", "data_inicio", "start"]) || null,
        endsAt: alertText(item, ["fim", "data_fim", "end"]) || null,
        details: alertText(item, ["recomendacoes", "recomendacao", "descricao_risco", "texto"]) || title,
        sourceUrl: "https://avisos.inmet.gov.br/",
      }];
    }).slice(0, 10);
    return { alerts, status: alerts.length ? "available" : "no_active_alerts" };
  } catch {
    return { alerts: [], status: "unavailable" };
  }
}

async function resolveCity(latitude?: number, longitude?: number): Promise<string | null> {
  if (latitude == null || longitude == null) return null;
  const url = new URL(NOMINATIM_REVERSE_URL);
  url.search = new URLSearchParams({ format: "jsonv2", lat: String(latitude), lon: String(longitude), zoom: "10", addressdetails: "1" }).toString();
  try {
    const response = await fetchWithTimeout(url, { headers: { accept: "application/json", "user-agent": "Urbico/1.0 (mobilidade urbana)" } }, 5_000);
    if (!response.ok) return null;
    const payload = await response.json() as { address?: Record<string, string> };
    const address = payload.address ?? {};
    const city = address.city || address.town || address.municipality || address.village;
    const state = address.state;
    return city ? [city, state].filter(Boolean).join(", ") : state ?? null;
  } catch {
    return null;
  }
}

export async function searchMobilityOccurrences(input: {
  query?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ provider: string; searchedAt: string; location: string; results: OccurrenceResult[]; disclaimer: string }> {
  const location = input.location?.trim() || await resolveCity(input.latitude, input.longitude) || "Brasil";
  const topic = input.query?.trim().slice(0, 160);
  const terms = topic
    ? `(${topic.replace(/[()]/g, " ")})`
    : '(acidente OR interdição OR bloqueio OR desvio OR obras OR alagamento OR greve OR manifestação OR "transporte público")';
  const query = `${terms} "${location}" sourcecountry:BR sourcelang:portuguese`;
  const url = new URL(GDELT_URL);
  url.search = new URLSearchParams({
    query,
    mode: "artlist",
    format: "json",
    timespan: "3days",
    maxrecords: "12",
    sort: "datedesc",
  }).toString();
  const response = await fetchWithTimeout(url, { headers: { accept: "application/json" } }, 12_000);
  if (!response.ok) throw new Error(`Busca de ocorrências indisponível (HTTP ${response.status}).`);
  const payload = await response.json() as { articles?: Array<{ title?: string; url?: string; seendate?: string; domain?: string }> };
  const results = (payload.articles ?? []).flatMap((article) => {
    if (!article.title || !article.url || !/^https?:\/\//i.test(article.url)) return [];
    return [{
      title: article.title,
      url: article.url,
      publishedAt: article.seendate ?? null,
      source: article.domain ?? "Fonte jornalística",
      category: classifyOccurrence(article.title),
    }];
  }).slice(0, 12);
  return {
    provider: "GDELT DOC 2.0",
    searchedAt: new Date().toISOString(),
    location,
    results,
    disclaimer: "Resultados jornalísticos recentes; não equivalem a confirmação oficial de bloqueio, acidente ou alteração de linha. Confira a fonte e a data antes de tomar decisões.",
  };
}
