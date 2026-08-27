import { Text, View } from "react-native";

import { colors } from "@/components/urbico-ui";

import type { MapCoordinate, MapStop, MapVehicle } from "./urbico-map.native";

type UrbicoMapProps = {
  center: MapCoordinate;
  userLocation: MapCoordinate | null;
  path: number[][];
  vehicles: MapVehicle[];
  stops: MapStop[];
};

export function UrbicoMap({ vehicles, stops }: UrbicoMapProps) {
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#07111D" }}><Text style={{ color: colors.text, textAlign: "center", fontSize: 16, fontWeight: "700" }}>Mapa Google interativo</Text><Text style={{ color: colors.muted, textAlign: "center", lineHeight: 20, marginTop: 10 }}>A visualização interativa abre na build Android/iOS. O contexto atual possui {vehicles.length} veículo(s) e {stops.length} parada(s) da linha selecionada.</Text></View>;
}
