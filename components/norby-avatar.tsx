import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

export function NorbyAvatar({ large = false, diameter }: { large?: boolean; diameter?: number }) {
  const size = diameter ?? (large ? 82 : 44);

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Mascote Norby">
      <Defs>
        <LinearGradient id="norby-shell" x1="0" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#DCE8F7" />
        </LinearGradient>
        <LinearGradient id="norby-blue" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#36B8FF" />
          <Stop offset="1" stopColor="#1268D8" />
        </LinearGradient>
        <LinearGradient id="norby-visor" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#102D53" />
          <Stop offset="1" stopColor="#06162D" />
        </LinearGradient>
      </Defs>
      <Circle cx="50" cy="50" r="48" fill="#071A33" />
      <Circle cx="50" cy="50" r="45" fill="none" stroke="#1D4B80" strokeWidth="2" />
      <Path d="M50 9 Q50 2 55 2 Q61 2 61 9 L59 21 L51 21Z" fill="url(#norby-blue)" />
      <Circle cx="55" cy="7" r="5" fill="#55C9FF" />
      <Path d="M22 34 Q22 22 34 22 H66 Q78 22 78 34 V62 Q78 70 70 75 L50 87 L30 75 Q22 70 22 62Z" fill="url(#norby-shell)" stroke="#B8D0EE" strokeWidth="1.4" />
      <Path d="M27 36 Q27 27 37 27 H63 Q73 27 73 36 V60 Q73 66 66 70 L50 80 L34 70 Q27 66 27 60Z" fill="url(#norby-visor)" stroke="#2A5A91" strokeWidth="1.5" />
      <Circle cx="17" cy="50" r="8" fill="url(#norby-blue)" stroke="#CDEAFF" strokeWidth="1.5" />
      <Circle cx="17" cy="50" r="3.5" fill="#0A2447" />
      <Circle cx="83" cy="50" r="8" fill="url(#norby-blue)" stroke="#CDEAFF" strokeWidth="1.5" />
      <Circle cx="83" cy="50" r="3.5" fill="#0A2447" />
      <Path d="M36 46 Q41 39 46 46" fill="none" stroke="#68D9FF" strokeWidth="3.4" strokeLinecap="round" />
      <Path d="M54 46 Q59 39 64 46" fill="none" stroke="#68D9FF" strokeWidth="3.4" strokeLinecap="round" />
      <Path d="M39 57 Q50 67 61 57" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
      <Path d="M43 77 L57 77" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="50" cy="77" r="4" fill="url(#norby-blue)" stroke="#FFFFFF" strokeWidth="1" />
    </Svg>
  );
}
