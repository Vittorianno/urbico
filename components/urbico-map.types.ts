export type MapCoordinate = { latitude: number; longitude: number };
export type MapVehicle = MapCoordinate & { id: string; label: string };
export type MapStop = MapCoordinate & { id: string; label: string };

export type UrbicoMapProps = {
  center: MapCoordinate;
  userLocation: MapCoordinate | null;
  path: number[][];
  vehicles: MapVehicle[];
  stops: MapStop[];
  onMapPress?: (coordinate: MapCoordinate) => void;
};
