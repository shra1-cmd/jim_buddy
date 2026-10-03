import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { color: string; size?: number };
const sw = 1.9;

export const HomeIcon = ({ color, size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
  </Svg>
);

export const JournalIcon = ({ color, size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="4.5" y="3" width="15" height="18" rx="2.5" stroke={color} strokeWidth={sw} />
    <Path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke={color} strokeWidth={sw} strokeLinecap="round" />
  </Svg>
);

export const TrainIcon = ({ color, size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M7 12h10" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    <Rect x="3.5" y="7.5" width="3.5" height="9" rx="1.2" stroke={color} strokeWidth={sw} />
    <Rect x="17" y="7.5" width="3.5" height="9" rx="1.2" stroke={color} strokeWidth={sw} />
    <Path d="M2 10.5v3M22 10.5v3" stroke={color} strokeWidth={sw} strokeLinecap="round" />
  </Svg>
);

export const ProfileIcon = ({ color, size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={sw} />
    <Path d="M4 20.5c1.4-3.6 4.4-5.5 8-5.5s6.6 1.9 8 5.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
  </Svg>
);

export const CameraIcon = ({ color, size = 20 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
    <Circle cx="12" cy="13.5" r="3.5" stroke={color} strokeWidth={sw} />
  </Svg>
);
