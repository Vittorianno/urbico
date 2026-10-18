import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";

export function NorbyAvatar({ large = false }: { large?: boolean }) {
  const size = large ? 82 : 44;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Mascote Norby">
      <Defs>
        <LinearGradient id="norby-shell" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#56D7FF" />
          <Stop offset="1" stopColor="#087DF5" />
        </LinearGradient>
        <LinearGradient id="norby-face" x1="0" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor="#173B58" />
          <Stop offset="1" stopColor="#0A2035" />
        </LinearGradient>
      </Defs>
      <Circle cx="50" cy="50" r="47" fill="#56D7FF" opacity="0.09" />
      <Circle cx="50" cy="50" r="40" fill="url(#norby-shell)" opacity="0.22" />
      <Rect x="18" y="25" width="64" height="55" rx="22" fill="url(#norby-shell)" />
      <Rect x="23" y="30" width="54" height="45" rx="17" fill="url(#norby-face)" stroke="#6CE2FF" strokeWidth="1.2" />
      <Path d="M50 17 L50 25" stroke="#56D7FF" strokeWidth="4" strokeLinecap="round" />
      <Circle cx="50" cy="13" r="5" fill="#56D7FF" />
      <Ellipse cx="38" cy="50" rx="4.8" ry="6.3" fill="#8CEBFF" />
      <Ellipse cx="62" cy="50" rx="4.8" ry="6.3" fill="#8CEBFF" />
      <Path d="M40 62 Q50 70 60 62" stroke="#56D7FF" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <Path d="M15 46 L8 46 M85 46 L92 46" stroke="#56D7FF" strokeWidth="3" strokeLinecap="round" />
      <Circle cx="80" cy="78" r="9" fill="#07111D" stroke="#07111D" strokeWidth="3" />
      <Circle cx="80" cy="78" r="5.5" fill="#55CF84" />
    </Svg>
  );
}
