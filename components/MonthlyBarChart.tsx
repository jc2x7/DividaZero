import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Rect, Line, Circle, Polyline } from 'react-native-svg';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, SPACING } from '../constants/theme';
import { formatCompact, formatMonthIndex } from '../utils/formatting';

export interface MonthBar {
  index: number;
  /** Segmentos empilhados, de baixo para cima. */
  segments: { value: number; color: string }[];
  /** Linha de referência (renda do mês). */
  reference?: number;
}

/**
 * Barras empilhadas mês a mês, com a renda desenhada como linha por cima.
 * SVG cru em vez de biblioteca de gráfico: são poucos elementos e assim o
 * gráfico segue o tema sem depender de configuração externa de cores.
 */
export default function MonthlyBarChart({
  data,
  height = 170,
  selectedIndex,
  onSelect,
  referenceLabel = 'Renda',
}: {
  data: MonthBar[];
  height?: number;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
  referenceLabel?: string;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (data.length === 0) {
    return <View style={{ height }} />;
  }

  const totals = data.map((d) => d.segments.reduce((s, x) => s + x.value, 0));
  const refs = data.map((d) => d.reference ?? 0);
  const max = Math.max(...totals, ...refs, 1);
  // Teto arredondado para o gráfico não encostar no topo.
  const ceiling = max * 1.12;

  const slotWidth = 100 / data.length;
  const barWidth = Math.min(slotWidth * 0.56, 9);

  const hasReference = data.some((d) => d.reference !== undefined && d.reference > 0);
  const referencePoints = data
    .map((d, i) => {
      if (d.reference === undefined) return null;
      const x = slotWidth * i + slotWidth / 2;
      const y = 100 - (d.reference / ceiling) * 100;
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(' ');

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {/* Eixo de valores */}
        <View style={[styles.axis, { height }]}>
          <Text style={styles.axisLabel}>{formatCompact(ceiling)}</Text>
          <Text style={styles.axisLabel}>{formatCompact(ceiling / 2)}</Text>
          <Text style={styles.axisLabel}>0</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Svg width="100%" height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Linhas de grade */}
            {[0, 50, 100].map((y) => (
              <Line
                key={y}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke={theme.divider}
                strokeWidth="0.4"
              />
            ))}

            {data.map((d, i) => {
              const x = slotWidth * i + slotWidth / 2 - barWidth / 2;
              let cursor = 100;
              const selected = selectedIndex === d.index;
              return d.segments.map((seg, j) => {
                if (seg.value <= 0) return null;
                const h = (seg.value / ceiling) * 100;
                cursor -= h;
                return (
                  <Rect
                    key={`${i}-${j}`}
                    x={x}
                    y={cursor}
                    width={barWidth}
                    height={h}
                    fill={seg.color}
                    opacity={selectedIndex == null || selected ? 1 : 0.35}
                  />
                );
              });
            })}

            {hasReference && referencePoints && (
              <Polyline
                points={referencePoints}
                fill="none"
                stroke={theme.textSecondary}
                strokeWidth="1.5"
                strokeDasharray="5 4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </Svg>

          {/* Camada de toque + rótulos de mês */}
          <View style={styles.labelRow}>
            {data.map((d) => {
              const selected = selectedIndex === d.index;
              return (
                <TouchableOpacity
                  key={d.index}
                  style={styles.labelSlot}
                  onPress={() => onSelect?.(d.index)}
                  activeOpacity={onSelect ? 0.6 : 1}
                  disabled={!onSelect}
                >
                  <Text
                    style={[styles.monthLabel, selected && styles.monthLabelActive]}
                    numberOfLines={1}
                  >
                    {formatMonthIndex(d.index).split('/')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {hasReference && (
        <View style={styles.refLegend}>
          {/* Três traços imitam a linha tracejada do gráfico. */}
          <View style={styles.refDashRow}>
            <View style={styles.refDash} />
            <View style={styles.refDash} />
            <View style={styles.refDash} />
          </View>
          <Text style={styles.refText}>{referenceLabel}</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    axis: {
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingRight: 6,
      width: 34,
    },
    axisLabel: { fontSize: 9.5, color: t.textLight, fontVariant: ['tabular-nums'] },
    labelRow: { flexDirection: 'row', marginTop: 6 },
    labelSlot: { flex: 1, alignItems: 'center', paddingVertical: 2 },
    monthLabel: { fontSize: 9.5, color: t.textLight, fontWeight: '500' },
    monthLabelActive: { color: t.text, fontWeight: '800' },
    refLegend: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: SPACING.sm,
      marginLeft: 34,
    },
    refDashRow: { flexDirection: 'row', gap: 3, alignItems: 'center' },
    refDash: {
      width: 5,
      height: 1.5,
      backgroundColor: t.textSecondary,
      borderRadius: 1,
    },
    refText: { fontSize: 10.5, color: t.textSecondary },
  });
