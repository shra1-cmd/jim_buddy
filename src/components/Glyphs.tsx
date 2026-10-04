import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

// Small solid glyphs for badges, buttons and tabs. All original, drawn on a 24×24 grid.
export type GlyphName =
  | 'fork' | 'egg' | 'bolt' | 'flame' | 'steps' | 'sun' | 'moon' | 'bowl' | 'cup' | 'dumbbell'
  | 'menu' | 'camera' | 'plus' | 'play' | 'chevron' | 'gear' | 'home' | 'book' | 'person' | 'check' | 'scale' | 'heart';

export function Glyph({ name, size = 22, color = '#fff', accent }: { name: GlyphName; size?: number; color?: string; accent?: string }) {
  const s = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  let body: ReactNode = null;
  switch (name) {
    case 'fork':
      body = (
        <G {...s}>
          <Path d="M7 3v5.5a2.5 2.5 0 0 0 5 0V3M9.5 3v18" />
          <Path d="M17.5 3c-1.9 1.3-2.8 3.7-2.8 6.6V13h2.8v8" />
        </G>
      );
      break;
    case 'egg':
      body = (
        <>
          <Path d="M12 2.8c-3.7 0-6.7 5.4-6.7 9.7 0 4.2 3 7.7 6.7 7.7s6.7-3.5 6.7-7.7c0-4.3-3-9.7-6.7-9.7z" fill={color} />
          <Circle cx="12" cy="13.2" r="3.2" fill={accent ?? '#F8BE55'} />
        </>
      );
      break;
    case 'bolt':
      body = <Path d="M13.4 2 4.6 13.4h6.2L9.9 22l8.9-11.6h-6.3L13.4 2z" fill={color} />;
      break;
    case 'flame':
      body = (
        <>
          <Path d="M12 2c1.1 3.6 6.4 6 6.4 11.3A6.4 6.4 0 0 1 12 19.7a6.4 6.4 0 0 1-6.4-6.4c0-3.1 1.7-5.2 3.4-6.6.2 2 1.1 3.3 2.5 3.8C10.9 7.4 11.3 4.4 12 2z" fill={color} />
          <Path d="M12 11.2c.4 1.7 2.9 2.8 2.9 5.2a2.9 2.9 0 0 1-5.8 0c0-1.4.8-2.3 1.5-2.9.1.9.5 1.5 1.1 1.7-.2-1.6 0-3 .3-4z" fill={accent ?? '#F8BE55'} />
        </>
      );
      break;
    case 'steps':
      body = (
        <>
          <Ellipse cx="8" cy="9" rx="3" ry="4.6" fill={color} transform="rotate(-12 8 9)" />
          <Ellipse cx="8.7" cy="16.4" rx="2.3" ry="1.6" fill={color} transform="rotate(-12 8.7 16.4)" />
          <Ellipse cx="16" cy="11" rx="3" ry="4.6" fill={color} transform="rotate(12 16 11)" />
          <Ellipse cx="15.3" cy="18.4" rx="2.3" ry="1.6" fill={color} transform="rotate(12 15.3 18.4)" />
        </>
      );
      break;
    case 'sun':
      body = (
        <>
          <Circle cx="12" cy="12" r="4.4" fill={color} />
          <G {...s}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <Line key={a} x1="12" y1="2.6" x2="12" y2="4.6" transform={`rotate(${a} 12 12)`} />
            ))}
          </G>
        </>
      );
      break;
    case 'moon':
      body = <Path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z" fill={color} />;
      break;
    case 'bowl':
      body = (
        <>
          <Path d="M3 11.5h18a9 9 0 0 1-18 0z" fill={color} />
          <G {...s} strokeWidth={1.8}>
            <Path d="M9 8.5c-.8-1 .8-1.6 0-2.8M12.5 8.5c-.8-1 .8-1.6 0-2.8M16 8.5c-.8-1 .8-1.6 0-2.8" />
          </G>
        </>
      );
      break;
    case 'cup':
      body = (
        <>
          <Path d="M4.5 8.5h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-6z" fill={color} />
          <Path d="M15.5 10h1.6a2.4 2.4 0 0 1 0 4.8h-1.8" {...s} />
          <Path d="M8 6c-.6-.9.6-1.4 0-2.4M11.5 6c-.6-.9.6-1.4 0-2.4" {...s} strokeWidth={1.7} />
        </>
      );
      break;
    case 'dumbbell':
      body = (
        <>
          <Rect x="1.8" y="9" width="2.6" height="6" rx="1" fill={color} />
          <Rect x="4.4" y="6.5" width="3.6" height="11" rx="1.4" fill={color} />
          <Rect x="8" y="10.8" width="8" height="2.4" rx="1" fill={color} />
          <Rect x="16" y="6.5" width="3.6" height="11" rx="1.4" fill={color} />
          <Rect x="19.6" y="9" width="2.6" height="6" rx="1" fill={color} />
        </>
      );
      break;
    case 'menu':
      body = (
        <>
          <Rect x="4.5" y="4" width="15" height="17" rx="3" fill={color} />
          <Rect x="8.5" y="2.5" width="7" height="3.6" rx="1.6" fill={accent ?? color} />
          <G stroke={accent ?? '#5FAE93'} strokeWidth={1.9} strokeLinecap="round">
            <Line x1="8.5" y1="10.5" x2="15.5" y2="10.5" />
            <Line x1="8.5" y1="14" x2="15.5" y2="14" />
            <Line x1="8.5" y1="17.5" x2="12.5" y2="17.5" />
          </G>
        </>
      );
      break;
    case 'camera':
      body = (
        <>
          <Path d="M8.6 5.2 9.8 3.6h4.4l1.2 1.6h2.8A2.8 2.8 0 0 1 21 8v9.2a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 17.2V8a2.8 2.8 0 0 1 2.8-2.8h2.8z" fill={color} />
          <Circle cx="12" cy="12.6" r="3.6" fill={accent ?? '#F47C5F'} />
        </>
      );
      break;
    case 'plus':
      body = <Path d="M12 5v14M5 12h14" {...s} strokeWidth={2.8} />;
      break;
    case 'play':
      body = <Path d="M8.5 5.6v12.8c0 .8.9 1.3 1.6.9l10-6.4a1 1 0 0 0 0-1.8l-10-6.4c-.7-.4-1.6.1-1.6.9z" fill={color} />;
      break;
    case 'chevron':
      body = <Path d="m9 5 7 7-7 7" {...s} strokeWidth={2.6} />;
      break;
    case 'check':
      body = <Path d="m5 12.5 4.5 4.5L19 7.5" {...s} strokeWidth={3} />;
      break;
    case 'gear':
      body = (
        <>
          <G fill={color}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <Rect key={a} x="10.2" y="1.8" width="3.6" height="5" rx="1.2" transform={`rotate(${a} 12 12)`} />
            ))}
          </G>
          <Circle cx="12" cy="12" r="7" fill={color} />
          <Circle cx="12" cy="12" r="2.8" fill={accent ?? '#FFF4E8'} />
        </>
      );
      break;
    case 'home':
      body = (
        <Path d="M12 2.9 2.6 10.6a1.1 1.1 0 0 0 .7 2H5v7.1c0 .7.5 1.2 1.2 1.2H10v-5.6h4v5.6h3.8c.7 0 1.2-.5 1.2-1.2v-7.1h1.7a1.1 1.1 0 0 0 .7-2L12 2.9z" fill={color} />
      );
      break;
    case 'book':
      body = (
        <>
          <Path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v16.5H7.5A2.5 2.5 0 0 0 5 21V4.5z" fill={color} />
          <Path d="M5 21a2.5 2.5 0 0 1 2.5-2.5H19V22H7.5A2.5 2.5 0 0 1 5 21z" fill={color} opacity={0.55} />
          <G stroke={accent ?? '#FFF4E8'} strokeWidth={1.8} strokeLinecap="round">
            <Line x1="9" y1="7" x2="15.5" y2="7" />
            <Line x1="9" y1="10.5" x2="14" y2="10.5" />
          </G>
        </>
      );
      break;
    case 'person':
      body = (
        <>
          <Circle cx="12" cy="7.6" r="4.4" fill={color} />
          <Path d="M3.8 20.2c.7-4.2 4.1-6.7 8.2-6.7s7.5 2.5 8.2 6.7c.1.6-.4 1.1-1 1.1H4.8c-.6 0-1.1-.5-1-1.1z" fill={color} />
        </>
      );
      break;
    case 'scale':
      body = (
        <>
          <Path d="M12 3v15M6 21h12M4 6.5h16" {...s} />
          <Path d="M4 6.5 1.8 12a2.6 2.6 0 0 0 4.4 0L4 6.5zM20 6.5 17.8 12a2.6 2.6 0 0 0 4.4 0L20 6.5z" fill={color} />
        </>
      );
      break;
    case 'heart':
      body = <Path d="M12 20.5s-8-4.8-8-11a4.6 4.6 0 0 1 8-3.1 4.6 4.6 0 0 1 8 3.1c0 6.2-8 11-8 11z" fill={color} />;
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}
