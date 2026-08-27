import { useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";
import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef } from "@maplibre/maplibre-react-native";

import type { UrbicoMapProps } from "./urbico-map.types";

export type { MapCoordinate, MapStop, MapVehicle } from "./urbico-map.types";

const OPEN_FREE_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function UrbicoMap({ center, userLocation, path, vehicles, stops, onMapPress }: UrbicoMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const route = useMemo(() => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: path.filter((point) => point.length >= 2).map(([longitude, latitude]) => [longitude, latitude]) } }), [path]);
  useEffect(() => { cameraRef.current?.easeTo({ center: [center.longitude, center.latitude], zoom: 14.5, duration: 350 }); }, [center]);
  return <Map mapStyle={OPEN_FREE_MAP_STYLE} style={{ flex: 1 }} attribution logo compass onPress={(event) => onMapPress?.({ latitude: event.nativeEvent.lngLat[1], longitude: event.nativeEvent.lngLat[0] })} accessibilityLabel="Mapa interativo baseado em OpenStreetMap"><Camera ref={cameraRef} initialViewState={{ center: [center.longitude, center.latitude], zoom: 14.5 }} />{route.geometry.coordinates.length > 1 ? <GeoJSONSource id="urbico-route" data={route}><Layer id="urbico-route-line" type="line" style={{ lineColor: "#087DF5", lineWidth: 5, lineOpacity: 0.88 }} /></GeoJSONSource> : null}{userLocation ? <Marker id="current-location" lngLat={[userLocation.longitude, userLocation.latitude]}><View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#12C2E9", borderWidth: 3, borderColor: "#FFFFFF" }} /></Marker> : null}{stops.map((stop) => <Marker key={`stop-${stop.id}`} id={`stop-${stop.id}`} lngLat={[stop.longitude, stop.latitude]}><View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#F5A623", borderWidth: 2, borderColor: "#FFFFFF" }} /></Marker>)}{vehicles.map((vehicle) => <Marker key={`vehicle-${vehicle.id}`} id={`vehicle-${vehicle.id}`} lngLat={[vehicle.longitude, vehicle.latitude]}><View style={{ minWidth: 27, height: 27, paddingHorizontal: 5, borderRadius: 14, backgroundColor: "#087DF5", borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>BUS</Text></View></Marker>)}</Map>;
}
