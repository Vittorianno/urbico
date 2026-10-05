import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const SPTRANS_BASE_URL = "http://api.olhovivo.sptrans.com.br/v2.1";

describe("integrações abertas e comerciais", () => {
  it.skipIf(!process.env.SPTRANS_TOKEN)("autentica o token da fonte pública de dados de trânsito da SPTrans", async () => {
    const token = process.env.SPTRANS_TOKEN;
    expect(token, "SPTRANS_TOKEN deve estar configurado").toBeTruthy();
    const response = await fetch(`${SPTRANS_BASE_URL}/Login/Autenticar?token=${encodeURIComponent(token ?? "")}`, { method: "POST" });
    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toBe(true);
  }, 15_000);

  it("usa Google Maps no mapa nativo e web, sem MapLibre", async () => {
    const [nativeMap, webMap, config] = await Promise.all([readFile("./components/urbico-map.native.tsx", "utf8"), readFile("./components/urbico-map.web.tsx", "utf8"), readFile("./app.config.ts", "utf8")]);
    expect(nativeMap).toContain("react-native-maps");
    expect(nativeMap).toContain("PROVIDER_GOOGLE");
    expect(webMap).toContain("maps.googleapis.com/maps/api/js");
    expect(webMap).toContain("EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY");
    expect(config).toContain("googleMaps");
    expect(nativeMap).not.toContain("maplibre");
    expect(webMap).not.toContain("maplibre");
    expect(config).not.toContain("@maplibre/maplibre-react-native");
  });

  it("não usa um domínio Supabase fictício quando o ambiente está incompleto", async () => {
    const supabase = await readFile("./lib/_core/supabase.ts", "utf8");
    expect(supabase).not.toContain("placeholder.supabase.co");
    expect(supabase).toContain("isSupabaseConfigured");
  });

  it("mantém roteamento e autocomplete preparados para instâncias próprias de Pelias e Valhalla", async () => {
    const geospatial = await readFile("./server/integrations/open-geospatial.ts", "utf8");
    expect(geospatial).toContain("PELIAS_BASE_URL");
    expect(geospatial).toContain("VALHALLA_BASE_URL");
    expect(geospatial).not.toContain("graphhopper.com");
  });

  it("usa síntese e reconhecimento locais sem chamada à ElevenLabs", async () => {
    const [voice, norby] = await Promise.all([readFile("./lib/norby-voice.ts", "utf8"), readFile("./server/integrations/norby.ts", "utf8")]);
    expect(voice).toContain('from "expo-speech"');
    expect(voice).toContain('language: "pt-BR"');
    expect(norby).not.toContain("generativelanguage.googleapis.com");
    expect(norby).toContain("getNorbyReply");
  });
});
