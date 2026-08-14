import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getMonthName, getMonthShortName, monthIndex } from '../utils/formatting';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha } from '../constants/theme';

interface MonthYearPickerProps {
  year: number;
  month: number;
  onSelect: (year: number, month: number) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function MonthYearPicker({ year, month, onSelect }: MonthYearPickerProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [modalVisible, setModalVisible] = useState(false);
  const [draftYear, setDraftYear] = useState(year);

  const now = new Date();
  const isCurrentMonth = monthIndex(year, month) === monthIndex(now.getFullYear(), now.getMonth() + 1);

  const shift = (delta: number) => {
    const idx = monthIndex(year, month) + delta;
    onSelect(Math.floor(idx / 12), (idx % 12) + 1);
  };

  const open = () => {
    setDraftYear(year);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.arrowBtn} onPress={() => shift(-1)} hitSlop={8}>
        <MaterialCommunityIcons name="chevron-left" size={22} color={theme.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.dateBtn} onPress={open} activeOpacity={0.7}>
        <Text style={styles.monthText}>
          {getMonthName(month)} <Text style={styles.yearText}>{year}</Text>
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color={theme.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.arrowBtn} onPress={() => shift(1)} hitSlop={8}>
        <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textSecondary} />
      </TouchableOpacity>

      {!isCurrentMonth && (
        <TouchableOpacity
          style={styles.todayBtn}
          onPress={() => onSelect(now.getFullYear(), now.getMonth() + 1)}
        >
          <Text style={styles.todayText}>hoje</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.picker}>
            <View style={styles.yearRow}>
              <TouchableOpacity onPress={() => setDraftYear((y) => y - 1)} hitSlop={10}>
                <MaterialCommunityIcons name="chevron-left" size={22} color={theme.primary} />
              </TouchableOpacity>
              <Text style={styles.yearLabel}>{draftYear}</Text>
              <TouchableOpacity onPress={() => setDraftYear((y) => y + 1)} hitSlop={10}>
                <MaterialCommunityIcons name="chevron-right" size={22} color={theme.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.monthGrid}>
              {MONTHS.map((m) => {
                const active = m === month && draftYear === year;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.monthItem, active && styles.monthItemActive]}
                    onPress={() => {
                      onSelect(draftYear, m);
                      setModalVisible(false);
                    }}
                  >
                    <Text style={[styles.monthItemText, active && styles.monthItemTextActive]}>
                      {getMonthShortName(m)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    arrowBtn: { padding: 6 },
    dateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: SPACING.md,
      paddingVertical: 6,
      borderRadius: RADIUS.pill,
    },
    monthText: { fontSize: 16.5, fontWeight: '700', color: t.text, letterSpacing: -0.2 },
    yearText: { fontSize: 16.5, fontWeight: '400', color: t.textSecondary },
    todayBtn: {
      position: 'absolute',
      right: 0,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: RADIUS.pill,
      backgroundColor: alpha(t.primary, 0.1),
    },
    todayText: { fontSize: 11.5, fontWeight: '700', color: t.primary },

    overlay: {
      flex: 1,
      backgroundColor: t.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACING.xl,
    },
    picker: {
      backgroundColor: t.surface,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      width: '100%',
      maxWidth: 340,
      borderWidth: 1,
      borderColor: t.border,
    },
    yearRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.lg,
    },
    yearLabel: { fontSize: 18, fontWeight: '700', color: t.text },
    monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    monthItem: {
      width: '22.4%',
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADIUS.md,
      backgroundColor: t.surfaceAlt,
    },
    monthItemActive: { backgroundColor: t.primaryFill },
    monthItemText: { fontSize: 13, color: t.text, fontWeight: '600' },
    monthItemTextActive: { color: t.onFill },
  });
