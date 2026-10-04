import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

// JimBuddy's own clay-style illustrations (original artwork): "Buddy" the mascot, a potted plant,
// a smiling bowl for the menu banner, a dumbbell for the workout card and little sparkles.

const SKIN = { hi: '#FFE7D6', mid: '#FFC6A3', lo: '#F09C76', arm: '#FDB993' };

/** Buddy lifting a dumbbell. `face` crops to the head for avatars. */
export function Mascot({ size = 140, face = false, id = 'm' }: { size?: number; face?: boolean; id?: string }) {
  const vb = face ? '36 70 128 112' : '0 20 200 180';
  return (
    <Svg width={size} height={face ? size * (112 / 128) : size * 0.9} viewBox={vb}>
      <Defs>
        <RadialGradient id={`${id}body`} cx="40%" cy="30%" r="75%" fx="35%" fy="25%">
          <Stop offset="0" stopColor={SKIN.hi} />
          <Stop offset="0.55" stopColor={SKIN.mid} />
          <Stop offset="1" stopColor={SKIN.lo} />
        </RadialGradient>
        <LinearGradient id={`${id}band`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#9AD6BF" />
          <Stop offset="1" stopColor="#5FAE93" />
        </LinearGradient>
        <LinearGradient id={`${id}plate`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8FD0B8" />
          <Stop offset="1" stopColor="#3F8F75" />
        </LinearGradient>
      </Defs>

      {!face && <Ellipse cx="100" cy="186" rx="54" ry="8" fill="#B9764F" opacity={0.16} />}
      {!face && (
        <>
          <Ellipse cx="78" cy="176" rx="15" ry="8.5" fill={SKIN.lo} />
          <Ellipse cx="122" cy="176" rx="15" ry="8.5" fill={SKIN.lo} />
        </>
      )}

      {/* arms up, holding the dumbbell */}
      {!face && (
        <G>
          <Path d="M64 112 C52 98 46 84 46 68" stroke={SKIN.arm} strokeWidth={15} strokeLinecap="round" fill="none" />
          <Path d="M136 112 C148 98 154 84 154 68" stroke={SKIN.arm} strokeWidth={15} strokeLinecap="round" fill="none" />
        </G>
      )}

      {/* body */}
      <Ellipse cx="100" cy="126" rx="60" ry="54" fill={`url(#${id}body)`} />
      <Ellipse cx="76" cy="96" rx="17" ry="9" fill="#fff" opacity={0.5} transform="rotate(-22 76 96)" />

      {/* sweatband */}
      <Path d="M48 104 Q100 70 152 104" stroke={`url(#${id}band)`} strokeWidth={13} strokeLinecap="round" fill="none" />
      <Path d="M56 98 Q100 72 144 98" stroke="#fff" strokeOpacity={0.35} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Ellipse cx="154" cy="108" rx="6" ry="9" fill="#5FAE93" transform="rotate(25 154 108)" />
      <Ellipse cx="160" cy="100" rx="5" ry="8" fill="#7CC4AA" transform="rotate(60 160 100)" />

      {/* face */}
      <Ellipse cx="82" cy="128" rx="6.5" ry="8.5" fill="#3F2F27" />
      <Ellipse cx="118" cy="128" rx="6.5" ry="8.5" fill="#3F2F27" />
      <Circle cx="84.5" cy="124.5" r="2.4" fill="#fff" />
      <Circle cx="120.5" cy="124.5" r="2.4" fill="#fff" />
      <Ellipse cx="68" cy="142" rx="10" ry="6" fill="#F27B6B" opacity={0.45} />
      <Ellipse cx="132" cy="142" rx="10" ry="6" fill="#F27B6B" opacity={0.45} />
      <Path d="M91 141 Q100 154 109 141 Z" fill="#B9473A" />
      <Path d="M95 146.5 Q100 151 105 146.5" fill="#F48C80" />

      {/* dumbbell overhead */}
      {!face && (
        <G>
          <Rect x="34" y="60" width="132" height="7" rx="3.5" fill="#6B574B" />
          <Rect x="20" y="44" width="16" height="39" rx="6" fill={`url(#${id}plate)`} />
          <Rect x="164" y="44" width="16" height="39" rx="6" fill={`url(#${id}plate)`} />
          <Rect x="36" y="50" width="9" height="27" rx="4" fill="#7CC4AA" />
          <Rect x="155" y="50" width="9" height="27" rx="4" fill="#7CC4AA" />
          <Rect x="23" y="47" width="4" height="22" rx="2" fill="#fff" opacity={0.35} />
          <Rect x="167" y="47" width="4" height="22" rx="2" fill="#fff" opacity={0.35} />
          <Circle cx="50" cy="64" r="9.5" fill={SKIN.arm} />
          <Circle cx="150" cy="64" r="9.5" fill={SKIN.arm} />
        </G>
      )}
    </Svg>
  );
}

export function Plant({ size = 90, id = 'p' }: { size?: number; id?: string }) {
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 100 115">
      <Defs>
        <LinearGradient id={`${id}leaf`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#9BD3A6" />
          <Stop offset="1" stopColor="#4E9C6C" />
        </LinearGradient>
        <LinearGradient id={`${id}pot`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FBE3CB" />
          <Stop offset="1" stopColor="#E8B98F" />
        </LinearGradient>
      </Defs>
      {[
        { cx: 50, cy: 30, rx: 9, ry: 24, r: 0 },
        { cx: 34, cy: 40, rx: 8, ry: 20, r: -38 },
        { cx: 66, cy: 40, rx: 8, ry: 20, r: 38 },
        { cx: 26, cy: 56, rx: 7, ry: 16, r: -68 },
        { cx: 74, cy: 56, rx: 7, ry: 16, r: 68 },
      ].map((l, i) => (
        <G key={i} transform={`rotate(${l.r} ${l.cx} ${l.cy + l.ry * 0.8})`}>
          <Ellipse cx={l.cx} cy={l.cy} rx={l.rx} ry={l.ry} fill={`url(#${id}leaf)`} />
          <Path d={`M${l.cx} ${l.cy - l.ry + 4} L${l.cx} ${l.cy + l.ry - 2}`} stroke="#3E8159" strokeWidth={1.2} opacity={0.5} />
        </G>
      ))}
      <Path d="M24 70 h52 l-6 38 a6 6 0 0 1 -6 5 H36 a6 6 0 0 1 -6 -5 z" fill={`url(#${id}pot)`} />
      <Rect x="20" y="64" width="60" height="11" rx="5.5" fill="#F6D2B0" />
      <Rect x="26" y="66" width="20" height="3" rx="1.5" fill="#fff" opacity={0.5} />
    </Svg>
  );
}

/** A smiling bowl of rice and dal, for menu banners. */
export function BowlBuddy({ size = 76, id = 'b' }: { size?: number; id?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={`${id}bowl`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFC2A8" />
          <Stop offset="1" stopColor="#EF8B69" />
        </LinearGradient>
      </Defs>
      <Path d="M38 22 c-4 -5 4 -7 0 -12 M50 20 c-4 -5 4 -7 0 -12 M62 22 c-4 -5 4 -7 0 -12" stroke="#fff" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.9} />
      <Ellipse cx="50" cy="44" rx="34" ry="14" fill="#FFF8EE" />
      <Ellipse cx="40" cy="40" rx="10" ry="5" fill="#F8C65A" opacity={0.85} />
      <Path d="M12 46 h76 a38 38 0 0 1 -76 0 z" fill={`url(#${id}bowl)`} />
      <Rect x="12" y="44" width="76" height="6" rx="3" fill="#FDD2BF" />
      <Ellipse cx="38" cy="62" rx="3.4" ry="4.2" fill="#3F2F27" />
      <Ellipse cx="62" cy="62" rx="3.4" ry="4.2" fill="#3F2F27" />
      <Circle cx="39.3" cy="60.6" r="1.2" fill="#fff" />
      <Circle cx="63.3" cy="60.6" r="1.2" fill="#fff" />
      <Ellipse cx="30" cy="70" rx="5" ry="3" fill="#E5604C" opacity={0.45} />
      <Ellipse cx="70" cy="70" rx="5" ry="3" fill="#E5604C" opacity={0.45} />
      <Path d="M45 70 Q50 75 55 70" stroke="#3F2F27" strokeWidth={2.4} strokeLinecap="round" fill="none" />
      <Ellipse cx="50" cy="94" rx="24" ry="3.5" fill="#B9764F" opacity={0.15} />
    </Svg>
  );
}

/** A chunky clay dumbbell for the workout card. */
export function DumbbellArt({ width = 150, id = 'd' }: { width?: number; id?: string }) {
  return (
    <Svg width={width} height={width * 0.55} viewBox="0 0 200 110">
      <Defs>
        <LinearGradient id={`${id}p`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFD2BF" />
          <Stop offset="1" stopColor="#F07B5E" />
        </LinearGradient>
        <LinearGradient id={`${id}q`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE3A6" />
          <Stop offset="1" stopColor="#F2AE3C" />
        </LinearGradient>
      </Defs>
      <Ellipse cx="100" cy="100" rx="78" ry="7" fill="#000" opacity={0.12} />
      <Rect x="44" y="47" width="112" height="14" rx="7" fill="#7A655A" />
      <Rect x="50" y="49" width="100" height="4" rx="2" fill="#fff" opacity={0.25} />
      <Rect x="14" y="20" width="26" height="70" rx="10" fill={`url(#${id}p)`} />
      <Rect x="160" y="20" width="26" height="70" rx="10" fill={`url(#${id}p)`} />
      <Rect x="38" y="30" width="14" height="50" rx="6" fill={`url(#${id}q)`} />
      <Rect x="148" y="30" width="14" height="50" rx="6" fill={`url(#${id}q)`} />
      <Rect x="19" y="26" width="6" height="40" rx="3" fill="#fff" opacity={0.4} />
      <Rect x="165" y="26" width="6" height="40" rx="3" fill="#fff" opacity={0.4} />
    </Svg>
  );
}

export function Sparkle({ size = 14, color = '#F8BE55' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 1.5c.7 5 2.5 7.8 9.5 10.5-7 2.7-8.8 5.5-9.5 10.5-.7-5-2.5-7.8-9.5-10.5 7-2.7 8.8-5.5 9.5-10.5z" fill={color} />
    </Svg>
  );
}
