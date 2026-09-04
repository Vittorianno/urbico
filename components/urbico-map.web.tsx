import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { UrbicoMapProps } from "./urbico-map.types";

const OPEN_FREE_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function UrbicoMap({ center, userLocation, path, vehicles, stops, onMapPress }: UrbicoMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const pressHandler = useRef(onMapPress);
  pressHandler.current = onMapPress;
  // FIX: guarda o centro só para a criação inicial do mapa. O centro "ao
  // vivo" é aplicado pelo outro efeito abaixo via easeTo, sem depender deste ref.
  const initialCenter = useRef(center);

  // FIX: antes este efeito dependia de [center.latitude, center.longitude],
  // então toda vez que o centro mudava (ex.: o usuário toca em "minha
  // localização", ou a localização atualiza em segundo plano) o mapa inteiro
  // era destruído (`instance.remove()`) e recriado do zero — perdendo zoom,
  // interação do usuário e piscando a tela. Agora a criação roda só uma vez,
  // no mount, e mudanças de centro são aplicadas suavemente pelo efeito
  // abaixo (igual à versão nativa, que já fazia isso corretamente).
  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({ container: container.current, style: OPEN_FREE_MAP_STYLE, center: [initialCenter.current.longitude, initialCenter.current.latitude], zoom: 14.5 });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    instance.on("click", (event) => pressHandler.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }));
    instance.on("load", () => {
      instance.addSource("urbico-context", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      instance.addLayer({ id: "urbico-route", type: "line", source: "urbico-context", filter: ["==", ["get", "kind"], "route"], paint: { "line-color": "#087DF5", "line-width": 5, "line-opacity": 0.88 } });
      instance.addLayer({ id: "urbico-stops", type: "circle", source: "urbico-context", filter: ["==", ["get", "kind"], "stop"], paint: { "circle-radius": 6, "circle-color": "#F5A623", "circle-stroke-width": 2, "circle-stroke-color": "#FFFFFF" } });
      instance.addLayer({ id: "urbico-vehicles", type: "circle", source: "urbico-context", filter: ["==", ["get", "kind"], "vehicle"], paint: { "circle-radius": 9, "circle-color": "#087DF5", "circle-stroke-width": 2, "circle-stroke-color": "#FFFFFF" } });
      instance.addLayer({ id: "urbico-user", type: "circle", source: "urbico-context", filter: ["==", ["get", "kind"], "user"], paint: { "circle-radius": 7, "circle-color": "#12C2E9", "circle-stroke-width": 3, "circle-stroke-color": "#FFFFFF" } });
    });
    return () => { instance.remove(); map.current = null; };
  }, []);

  // Reposiciona a câmera suavemente quando o centro muda, sem recriar o mapa.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    instance.easeTo({ center: [center.longitude, center.latitude], duration: 350 });
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const features = [...(path.length > 1 ? [{ type: "Feature", properties: { kind: "route" }, geometry: { type: "LineString", coordinates: path.map(([longitude, latitude]) => [longitude, latitude]) } }] : []), ...(userLocation ? [{ type: "Feature", properties: { kind: "user" }, geometry: { type: "Point", coordinates: [userLocation.longitude, userLocation.latitude] } }] : []), ...stops.map((stop) => ({ type: "Feature", properties: { kind: "stop" }, geometry: { type: "Point", coordinates: [stop.longitude, stop.latitude] } })), ...vehicles.map((vehicle) => ({ type: "Feature", properties: { kind: "vehicle" }, geometry: { type: "Point", coordinates: [vehicle.longitude, vehicle.latitude] } }))];
    const update = () => { const source = instance.getSource("urbico-context") as maplibregl.GeoJSONSource | undefined; source?.setData({ type: "FeatureCollection", features } as GeoJSON.FeatureCollection); };
    if (instance.isStyleLoaded()) update(); else instance.once("load", update);
  }, [path, stops, userLocation, vehicles]);

  return <div ref={container} aria-label="Mapa interativo baseado em OpenStreetMap" style={{ flex: 1, minHeight: 280, width: "100%" }} />;
}
