/* eslint-disable @typescript-eslint/no-explicit-any */
// Mapa web com a Maps JavaScript API do Google (carregada sob demanda).
//
// Variáveis (EXPO_PUBLIC_* — vão para o bundle, então restrinja a chave por
// referência HTTP e só à Maps JavaScript API no Google Cloud Console):
//   EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY
//   EXPO_PUBLIC_GOOGLE_MAP_ID   (opcional; sem ele usa "DEMO_MAP_ID", só para
//                                desenvolvimento — crie um Map ID no Console)
//
// Sem tipos do Google instalados (@types/google.maps) de propósito: a API é
// acessada via window.google com tipagem mínima, sem nova dependência.
//
// Carregamento: script com `callback` + `libraries=marker`. O callback só é
// chamado quando a API terminou de inicializar, então google.maps.Map e
// google.maps.marker existem — sem depender de importLibrary.
import { useEffect, useRef, useState } from "react";

import type { UrbicoMapProps } from "./urbico-map.types";

export type { MapCoordinate, MapStop, MapVehicle } from "./urbico-map.types";

const WEB_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY?.trim();
const MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAP_ID?.trim() || "DEMO_MAP_ID";
const ZOOM = 14.5;
const READY_CALLBACK = "__urbicoGoogleMapsReady";
const AUTH_FAILURE_MESSAGE =
  "O Google Maps recusou a chave. Confira a chave, se a Maps JavaScript API está ativada com cobrança e se as restrições de site incluem este endereço (ex.: http://localhost:8081/*).";

let loader: Promise<void> | null = null;
let authFailed = false;
const authListeners = new Set<() => void>();

function loadGoogleMaps(key: string): Promise<void> {
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (loader) return loader;
  // O Google chama gm_authFailure quando a chave é inválida/não autorizada.
  (window as any).gm_authFailure = () => {
    authFailed = true;
    authListeners.forEach((listener) => listener());
  };
  loader = new Promise<void>((resolve, reject) => {
    (window as any)[READY_CALLBACK] = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=marker&v=weekly&language=pt-BR&region=BR&callback=${READY_CALLBACK}`;
    script.async = true;
    script.onerror = () => {
      loader = null;
      reject(new Error("Não foi possível carregar o Google Maps (rede ou bloqueador de anúncios)."));
    };
    document.head.appendChild(script);
  });
  return loader;
}

function dot(color: string, size: number, border: number) {
  const element = document.createElement("div");
  Object.assign(element.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    background: color,
    border: `${border}px solid #FFFFFF`,
    boxSizing: "border-box",
  });
  return element;
}

function busPill() {
  const element = document.createElement("div");
  element.textContent = "BUS";
  Object.assign(element.style, {
    minWidth: "27px",
    height: "27px",
    padding: "0 5px",
    borderRadius: "14px",
    background: "#087DF5",
    border: "2px solid #FFFFFF",
    boxSizing: "border-box",
    color: "#FFFFFF",
    fontSize: "10px",
    fontWeight: "800",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });
  return element;
}

export function UrbicoMap({ center, userLocation, path, vehicles, stops, onMapPress }: UrbicoMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerClass = useRef<any>(null);
  const pressHandler = useRef(onMapPress);
  const initialCenter = useRef(center);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(authFailed ? AUTH_FAILURE_MESSAGE : null);

  useEffect(() => {
    pressHandler.current = onMapPress;
  }, [onMapPress]);

  useEffect(() => {
    const listener = () => setError(AUTH_FAILURE_MESSAGE);
    authListeners.add(listener);
    return () => {
      authListeners.delete(listener);
    };
  }, []);

  // Cria o mapa uma única vez; mudanças de centro são aplicadas pelo efeito
  // seguinte (panTo), sem recriar o mapa nem perder o zoom da pessoa.
  useEffect(() => {
    if (!WEB_API_KEY || !container.current || mapRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        await loadGoogleMaps(WEB_API_KEY);
        const gmaps = (window as any).google.maps;
        const AdvancedMarkerElement = gmaps.marker?.AdvancedMarkerElement;
        if (!AdvancedMarkerElement) throw new Error("A biblioteca de marcadores do Google Maps não carregou.");
        if (cancelled || !container.current) return;
        markerClass.current = AdvancedMarkerElement;
        const map = new gmaps.Map(container.current, {
          center: { lat: initialCenter.current.latitude, lng: initialCenter.current.longitude },
          zoom: ZOOM,
          mapId: MAP_ID,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
        });
        map.addListener("click", (event: any) => {
          if (!event?.latLng) return;
          pressHandler.current?.({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
        });
        mapRef.current = map;
        setReady(true);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Falha ao carregar o mapa.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.panTo({ lat: center.latitude, lng: center.longitude });
  }, [ready, center.latitude, center.longitude]);

  // Redesenha rota, paradas, veículos e posição do usuário. Tudo local: não
  // gera nenhuma chamada de API além do carregamento inicial do mapa.
  useEffect(() => {
    const map = mapRef.current;
    const AdvancedMarkerElement = markerClass.current;
    if (!ready || !map || !AdvancedMarkerElement) return;
    const gmaps = (window as any).google.maps;
    const markers: any[] = [];
    const validPath = path.filter((point) => point.length >= 2).map(([lng, lat]) => ({ lat, lng }));
    const line =
      validPath.length > 1
        ? new gmaps.Polyline({ map, path: validPath, strokeColor: "#087DF5", strokeOpacity: 0.88, strokeWeight: 5 })
        : null;
    const add = (latitude: number, longitude: number, content: HTMLElement, zIndex: number, title?: string) => {
      markers.push(new AdvancedMarkerElement({ map, position: { lat: latitude, lng: longitude }, content, zIndex, title }));
    };
    stops.forEach((stop) => add(stop.latitude, stop.longitude, dot("#F5A623", 18, 2), 1, stop.label));
    vehicles.forEach((vehicle) => add(vehicle.latitude, vehicle.longitude, busPill(), 2, vehicle.label));
    if (userLocation) add(userLocation.latitude, userLocation.longitude, dot("#12C2E9", 18, 3), 3, "Você está aqui");
    return () => {
      line?.setMap(null);
      markers.forEach((marker) => {
        marker.map = null;
      });
    };
  }, [ready, path, stops, vehicles, userLocation]);

  if (!WEB_API_KEY) {
    return (
      <div role="alert" style={{ flex: 1, minHeight: 280, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, textAlign: "center", color: "#9AA4B2" }}>
        Mapa indisponível: configure EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 280, width: "100%", position: "relative" }}>
      <div ref={container} aria-label="Mapa interativo" style={{ position: "absolute", inset: 0 }} />
      {error ? (
        <div role="alert" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, textAlign: "center", color: "#9AA4B2", background: "rgba(0,0,0,0.5)" }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
