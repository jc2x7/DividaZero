import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { getMonthName } from '../utils/formatting';

interface MonthYearPickerProps {
  year: number;
  month: number;
  onSelect: (year: number, month: number) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 2 + i);

export default function MonthYearPicker({ year, month, onSelect }: MonthYearPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(year);

  const handleMonthSelect = (m: number) => {
    onSelect(selectedYear, m);
    setModalVisible(false);
  };

  const goToPrevMonth = () => {
    if (month === 1) {
      onSelect(year - 1, 12);
    } else {
      onSelect(year, month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      onSelect(year + 1, 1);
    } else {
      onSelect(year, month + 1);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.arrowBtn} onPress={goToPrevMonth}>
        <MaterialCommunityIcons name="chevron-left" size={24} color={COLORS.highlight} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.dateBtn} onPress={() => setModalVisible(true)}>
        <Text style={styles.monthText}>{getMonthName(month)}</Text>
        <Text style={styles.yearText}>{year}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.arrowBtn} onPress={goToNextMonth}>
        <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.highlight} />
      </TouchableOpacity>

      {/* Month/Year Picker Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.picker}>
            {/* Year selector */}
            <View style={styles.yearRow}>
              <TouchableOpacity onPress={() => setSelectedYear((y) => y - 1)}>
                <MaterialCommunityIcons name="chevron-left" size={20} color={COLORS.highlight} />
              </TouchableOpacity>
              <Text style={styles.yearLabel}>{selectedYear}</Text>
              <TouchableOpacity onPress={() => setSelectedYear((y) => y + 1)}>
                <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.highlight} />
              </TouchableOpacity>
            </View>

            {/* Month grid */}
            <View style={styles.monthGrid}>
              {MONTHS.map((m) => {
                const isActive = m === month && selectedYear === year;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.monthItem, isActive && styles.monthItemActive]}
                    onPress={() => handleMonthSelect(m)}
                  >
                    <Text style={[styles.monthItemText, isActive && styles.monthItemTextActive]}>
                      {getMonthName(m).slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  arrowBtn: {
    padding: 8,
  },
  dateBtn: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: `${COLORS.highlight}15`,
    minWidth: 140,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  yearText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  picker: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    width: 300,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  yearLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthItem: {
    width: '22%',
    aspectRatio: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  monthItemActive: {
    backgroundColor: COLORS.highlight,
  },
  monthItemText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  monthItemTextActive: {
    color: '#fff',
  },
});
