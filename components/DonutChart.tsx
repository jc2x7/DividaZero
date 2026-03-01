import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../constants/colors';

export interface DonutSlice {
  value: number;
  color: string;
  label: string;
  sublabel?: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSub?: string;
  showLegend?: boolean;
}

function polarToCart(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(
  cx: number, cy: number,
  R: number, r: number,
  startDeg: number, endDeg: number
): string {
  // clamp to avoid full-circle degenerate case
  const end = Math.min(endDeg, startDeg + 359.99);
  const s = polarToCart(cx, cy, R, startDeg);
  const e = polarToCart(cx, cy, R, end);
  const si = polarToCart(cx, cy, r, startDeg);
  const ei = polarToCart(cx, cy, r, end);
  const large = end - startDeg > 180 ? 1 : 0;
  return [
    `M ${s.x} ${s.y}`,
    `A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`,
    `L ${ei.x} ${ei.y}`,
    `A ${r} ${r} 0 ${large} 0 ${si.x} ${si.y}`,
    'Z',
  ].join(' ');
}

export default function DonutChart({
  data,
  size = 160,
  strokeWidth = 30,
  centerLabel,
  centerSub,
  showLegend = true,
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 4;
  const r = R - strokeWidth;

  if (total === 0) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <View style={[styles.emptyRing, { width: size - 8, height: size - 8, borderRadius: (size - 8) / 2, borderWidth: strokeWidth }]} />
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.centerLabel}>—</Text>
        </View>
      </View>
    );
  }

  let currentAngle = 0;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const sweep = (d.value / total) * 360;
      const path = slicePath(cx, cy, R, r, currentAngle, currentAngle + sweep);
      currentAngle += sweep;
      return { ...d, path };
    });

  return (
    <View style={styles.wrapper}>
      <View style={{ position: 'relative', width: size, height: size }}>
        <Svg width={size} height={size}>
          {slices.map((s, i) => (
            <Path key={i} d={s.path} fill={s.color} />
          ))}
        </Svg>
        {/* Center text */}
        {(centerLabel || centerSub) && (
          <View style={[styles.center, { width: r * 2, height: r * 2, borderRadius: r, left: cx - r, top: cy - r }]}>
            {centerLabel && <Text style={styles.centerLabel} numberOfLines={1}>{centerLabel}</Text>}
            {centerSub && <Text style={styles.centerSub} numberOfLines={1}>{centerSub}</Text>}
          </View>
        )}
      </View>

      {showLegend && (
        <View style={styles.legend}>
          {slices.map((s, i) => {
            const pct = ((s.value / total) * 100).toFixed(0);
            return (
              <View key={i} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <View style={styles.legendText}>
                  <Text style={styles.legendLabel} numberOfLines={1}>{s.label}</Text>
                  {s.sublabel && <Text style={styles.legendSub}>{s.sublabel}</Text>}
                </View>
                <Text style={styles.legendPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 16,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRing: {
    borderColor: COLORS.border,
    position: 'absolute',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  centerSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  legend: {
    width: '100%',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  legendText: {
    flex: 1,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  legendSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  legendPct: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    minWidth: 36,
    textAlign: 'right',
  },
});
