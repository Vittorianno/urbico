import Svg, { Path } from "react-native-svg";

export function UrbicoNotificationIcon({ size = 22, color = "#EAF2FF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="Notificações">
      <Path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M10 21h4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}
