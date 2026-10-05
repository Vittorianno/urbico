import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

import type { UrbicoMapProps } from "./urbico-map.types";

export type { MapCoordinate, MapStop, MapVehicle } from "./urbico-map.types";

const ZOOM = 14.5;

// Marcadores com View customizada precisam de `tracksViewChanges` ligado só
// por um instante (para a view ser rasterizada) e desligado depois — mantido
// ligado o tempo todo, o Android redesenha todos os marcadores a cada frame.
function useSettledMarkers(signature: string) {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), 400);
    return () => clearTimeout(timer);
  }, [signature]);
  return tracking;
}

// Android usa Google Maps (chave em app.config.ts → android.config.googleMaps).
// No iOS o provider padrão (Apple Maps) é mantido até existir chave iOS.
const PROVIDER = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

export function UrbicoMap({ center, userLocation, path, vehicles, stops, onMapPress }: UrbicoMapProps) {
  const mapRef = useRef<MapView>(null);
  const initialCenter = useRef(center);
  const tracking = useSettledMarkers(`${stops.length}:${vehicles.length}:${userLocation ? 1 : 0}`);

  const routeCoordinates = useMemo(
    () => path.filter((point) => point.length >= 2).map(([longitude, latitude]) => ({ latitude, longitude })),
    [path],
  );

  useEffect(() => {
    mapRef.current?.animateCamera({ center: { latitude: center.latitude, longitude: center.longitude }, zoom: ZOOM }, { duration: 350 });
  }, [center.latitude, center.longitude]);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER}
      style={{ flex: 1 }}
      initialCamera={{
        center: { latitude: initialCenter.current.latitude, longitude: initialCenter.current.longitude },
        zoom: ZOOM,
        heading: 0,
        pitch: 0,
      }}
      toolbarEnabled={false}
      onPress={(event) => onMapPress?.({ latitude: event.nativeEvent.coordinate.latitude, longitude: event.nativeEvent.coordinate.longitude })}
      accessibilityLabel="Mapa interativo"
    >
      {routeCoordinates.length > 1 ? <Polyline coordinates={routeCoordinates} strokeColor="#087DF5" strokeWidth={5} /> : null}
      {userLocation ? (
        <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracking} zIndex={3}>
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#12C2E9", borderWidth: 3, borderColor: "#FFFFFF" }} />
        </Marker>
      ) : null}
      {stops.map((stop) => (
        <Marker key={`stop-${stop.id}`} coordinate={stop} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracking} title={stop.label} zIndex={1}>
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#F5A623", borderWidth: 2, borderColor: "#FFFFFF" }} />
        </Marker>
      ))}
      {vehicles.map((vehicle) => (
        <Marker key={`vehicle-${vehicle.id}`} coordinate={vehicle} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracking} title={vehicle.label} zIndex={2}>
          <View
            style={{
              minWidth: 27,
              height: 27,
              paddingHorizontal: 5,
              borderRadius: 14,
              backgroundColor: "#087DF5",
              borderWidth: 2,
              borderColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>BUS</Text>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}
