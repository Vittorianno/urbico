import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";

export function NorbyAvatar({ large = false, diameter }: { large?: boolean; diameter?: number }) {
  const size = diameter ?? (large ? 82 : 44);

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Mascote Norby">
      <Defs>
        <LinearGradient id="norby-orbit" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#66F0E4" />
          <Stop offset="1" stopColor="#2385FF" />
        </LinearGradient>
        <LinearGradient id="norby-visor" x1="0" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor="#183D5A" />
          <Stop offset="1" stopColor="#07182B" />
        </LinearGradient>
      </Defs>

      {/* Orbit and route nodes: Norby as a mobility guide, not a generic robot. */}
      <Circle cx="50" cy="50" r="47" fill="#0C2035" />
      <Circle cx="50" cy="50" r="44" fill="none" stroke="#1C4260" strokeWidth="2" />
      <Path d="M20 26 C30 10 54 8 70 19" fill="none" stroke="#3ED6D1" strokeWidth="3" strokeLinecap="round" />
      <Circle cx="22" cy="24" r="4" fill="#3ED6D1" />
      <Circle cx="71" cy="19" r="4" fill="#3ED6D1" />

      {/* Rounded transit-companion silhouette with a distinctive lower chin. */}
      <Path d="M27 29 Q27 22 36 22 H64 Q75 22 75 34 V61 Q75 70 66 74 L50 84 L34 74 Q25 70 25 61 V36 Q25 29 27 29Z" fill="url(#norby-orbit)" />
      <Path d="M31 35 Q31 29 39 29 H61 Q69 29 69 37 V59 Q69 65 62 68 L50 75 L38 68 Q31 65 31 59Z" fill="url(#norby-visor)" stroke="#9AF5F0" strokeWidth="1.3" />

      {/* Eyes and warm, friendly expression. */}
      <Ellipse cx="41" cy="47" rx="4.3" ry="5.5" fill="#73F0EE" />
      <Ellipse cx="59" cy="47" rx="4.3" ry="5.5" fill="#73F0EE" />
      <Path d="M40 57 Q50 67 60 57" fill="none" stroke="#EAFBFF" strokeWidth="3.2" strokeLinecap="round" />

      {/* Route marker on the chest. */}
      <Path d="M43 76 L57 76" stroke="#77E8E2" strokeWidth="2.5" strokeLinecap="round" />
      <Circle cx="50" cy="76" r="3" fill="#F4FCFF" />
      <Circle cx="78" cy="76" r="9" fill="#07111D" stroke="#0C2035" strokeWidth="2" />
      <Circle cx="78" cy="76" r="5.3" fill="#55CF84" />
    </Svg>
  );
}
