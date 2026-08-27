import { useEffect, useRef } from "react";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

export type MapCoordinate = { latitude: number; longitude: number };
export type MapVehicle = MapCoordinate & { id: string; label: string };
export type MapStop = MapCoordinate & { id: string; label: string };

type UrbicoMapProps = {
  center: MapCoordinate;
  userLocation: MapCoordinate | null;
  path: number[][];
  vehicles: MapVehicle[];
  stops: MapStop[];
  onMapPress?: (coordinate: MapCoordinate) => void;
};

export function UrbicoMap({ center, userLocation, path, vehicles, stops, onMapPress }: UrbicoMapProps) {
  const mapRef = useRef<MapView>(null);
  const routeCoordinates = path
    .filter((point) => point.length >= 2)
    .map(([longitude, latitude]) => ({ latitude, longitude }));
  useEffect(() => {
    mapRef.current?.animateToRegion({ ...center, latitudeDelta: 0.035, longitudeDelta: 0.035 }, 350);
  }, [center]);
  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1 }}
      initialRegion={{ ...center, latitudeDelta: 0.035, longitudeDelta: 0.035 }}
      showsUserLocation
      showsMyLocationButton={false}
      onPress={(event) => onMapPress?.(event.nativeEvent.coordinate)}
      accessibilityLabel="Mapa interativo de mobilidade urbana"
    >
      {routeCoordinates.length > 1 ? <Polyline coordinates={routeCoordinates} strokeColor="#087DF5" strokeWidth={5} /> : null}
      {userLocation ? <Marker coordinate={userLocation} title="Sua localização" pinColor="#12C2E9" /> : null}
      {stops.map((stop) => <Marker key={`stop-${stop.id}`} coordinate={stop} title={stop.label} pinColor="#F5A623" />)}
      {vehicles.map((vehicle) => <Marker key={`vehicle-${vehicle.id}`} coordinate={vehicle} title={vehicle.label} pinColor="#087DF5" />)}
    </MapView>
  );
}
