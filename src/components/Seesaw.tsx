import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Text } from './AppText';
import { colors, tiles } from '../theme';

const W = 180; // drawing width
const H = 140;
const CX = W / 2;
const PY = 82; // pivot height
const ARM = 60; // pivot → kettlebell centre
const MAX_TILT = 12; // degrees
const R = 23; // kettlebell body radius

const SIDES = {
  eaten: { fill: tiles.coral.bg, rim: colors.coral, ink: colors.coralDeep },
  burned: { fill: tiles.green.bg, rim: colors.sageDeep, ink: colors.tealDeep },
};

/**
 * Calorie seesaw: a kettlebell of what you ate on the left, one of what you burned on the right, the daily need
 * under the stand. The heavier side dips; a level, green beam means you're on target.
 */
export function Seesaw({ eaten, burned, need, budget }: { eaten: number; burned: number; need: number; budget: number }) {
  const tilt = budget > 0 ? Math.max(-MAX_TILT, Math.min(MAX_TILT, ((eaten - budget) / budget) * 40)) : 0; // + = eaten side down
  const rad = (tilt * Math.PI) / 180;
  const dx = Math.cos(rad) * ARM;
  const dy = Math.sin(rad) * ARM;
  const left = { x: CX - dx, y: PY + dy };
  const right = { x: CX + dx, y: PY - dy };
  const level = Math.abs(tilt) < 1.5;

  return (
    <View
      style={{ width: W, height: H }}
      accessibilityLabel={`Eaten ${Math.round(eaten)} kcal, burned ${Math.round(burned)} kcal, daily need ${need} kcal`}
    >
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={level ? '#8FD0B8' : '#F2C7AE'} />
            <Stop offset="1" stopColor={level ? colors.sageDeep : '#D9967A'} />
          </LinearGradient>
          <LinearGradient id="stand" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFE3D4" />
            <Stop offset="1" stopColor={colors.coralSoft} />
          </LinearGradient>
        </Defs>

        {/* ground shadow + stand */}
        <Ellipse cx={CX} cy={PY + 29} rx={40} ry={4} fill="rgba(160, 100, 70, 0.14)" />
        <Path
          d={`M ${CX} ${PY} L ${CX + 20} ${PY + 26} Q ${CX + 22} ${PY + 29} ${CX + 18} ${PY + 29} L ${CX - 18} ${PY + 29} Q ${CX - 22} ${PY + 29} ${CX - 20} ${PY + 26} Z`}
          fill="url(#stand)"
          stroke={colors.coral}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* beam */}
        <G rotation={-tilt} origin={`${CX}, ${PY}`}>
          <Rect x={CX - ARM - 8} y={PY - 5} width={(ARM + 8) * 2} height={10} rx={5} fill="url(#beam)" />
          <Rect x={CX - ARM - 4} y={PY - 3.5} width={(ARM + 4) * 2} height={2.5} rx={1.25} fill="rgba(255,255,255,0.45)" />
        </G>

        {/* kettlebells ride on the beam ends but stay upright */}
        <Kettlebell x={left.x} y={left.y} {...SIDES.eaten} />
        <Kettlebell x={right.x} y={right.y} {...SIDES.burned} />

        {/* pivot hub */}
        <Circle cx={CX} cy={PY} r={7} fill={colors.coral} />
        <Circle cx={CX} cy={PY} r={2.6} fill="#FFF4E8" />
      </Svg>

      <Reading x={left.x} y={left.y} value={eaten} label="Eaten" ink={SIDES.eaten.ink} />
      <Reading x={right.x} y={right.y} value={burned} label="Burned" ink={SIDES.burned.ink} />

      <View style={{ position: 'absolute', left: 0, right: 0, top: PY + 38, alignItems: 'center' }}>
        <View style={{ backgroundColor: tiles.yellow.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.inkSoft }}>Daily need {need}</Text>
        </View>
      </View>
    </View>
  );
}

/** Centre of the kettlebell body when its flat base rests on a beam end at (x, y). */
const bodyY = (y: number) => y - 5 - R;

/** A clay kettlebell standing on a beam end (x, y). */
function Kettlebell({ x, y, fill, rim }: { x: number; y: number; fill: string; rim: string }) {
  const cy = bodyY(y);
  const top = cy - R;
  const bx = R * 0.62; // flat base half-width
  const by = cy + R * 0.78;
  const hx = x - R * 0.45; // highlight
  const hy = cy - R * 0.52;
  return (
    <G>
      <Rect x={x - 3} y={y - 7} width={6} height={4} rx={1.5} fill={rim} />
      <Path
        d={`M ${x - 12} ${top + 5} C ${x - 14} ${top - 15} ${x + 14} ${top - 15} ${x + 12} ${top + 5}`}
        fill="none"
        stroke={rim}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <Path d={`M ${x - bx} ${by} A ${R} ${R} 0 1 1 ${x + bx} ${by} Z`} fill={fill} stroke={rim} strokeWidth={2} strokeLinejoin="round" />
      <Ellipse cx={hx} cy={hy} rx={5} ry={3} fill="rgba(255,255,255,0.75)" rotation={-35} origin={`${hx}, ${hy}`} />
    </G>
  );
}

/** Number inside the kettlebell, label under the beam end. */
function Reading({ x, y, value, label, ink }: { x: number; y: number; value: number; label: string; ink: string }) {
  const cy = bodyY(y);
  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', left: x - (R - 4), top: cy - 10, width: (R - 4) * 2, alignItems: 'center' }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: ink }} numberOfLines={1} adjustsFontSizeToFit>
          {Math.round(value)}
        </Text>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: x - 30, top: y + 8, width: 60, alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: ink }}>{label}</Text>
      </View>
    </>
  );
}
