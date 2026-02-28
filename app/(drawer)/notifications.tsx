import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { COLORS } from '../../constants/colors';
import { requestNotificationPermissions } from '../../hooks/useNotifications';

interface Scheduled {
  id: string;
  title: string;
  body: string;
  date: Date;
}

// ─── Inputs de tempo fora do componente para não perder foco ────────────────
function TimeInput({
  value,
  onChange,
  max,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  label: string;
}) {
  const ref = useRef<TextInput>(null);
  return (
    <View style={styles.timeBlock}>
      <Text style={styles.timeLabel}>{label}</Text>
      <TextInput
        ref={ref}
        style={styles.timeInput}
        value={value}
        onChangeText={(v) => {
          const clean = v.replace(/\D/g, '').slice(0, 2);
          const num = parseInt(clean, 10);
          if (clean === '' || (!isNaN(num) && num <= max)) {
            onChange(clean);
          }
        }}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="00"
        placeholderTextColor={COLORS.textLight}
        textAlign="center"
      />
    </View>
  );
}

function pad(n: string) {
  return n.padStart(2, '0');
}

export default function NotificationsScreen() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [day, setDay] = useState('');
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const [second, setSecond] = useState('00');
  const [scheduled, setScheduled] = useState<Scheduled[]>([]);

  const loadScheduled = async () => {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const mapped: Scheduled[] = all
      .filter((n) => {
        const trigger = n.trigger as any;
        return trigger?.type === 'date' || trigger?.dateComponents || trigger?.value;
      })
      .map((n) => {
        const trigger = n.trigger as any;
        let date = new Date();
        if (trigger?.value) date = new Date(trigger.value);
        else if (trigger?.seconds) date = new Date(Date.now() + trigger.seconds * 1000);
        return {
          id: n.identifier,
          title: n.content.title ?? '',
          body: n.content.body ?? '',
          date,
        };
      });
    setScheduled(mapped);
  };

  useEffect(() => {
    loadScheduled();
  }, []);

  const handleSchedule = async () => {
    if (!title.trim()) {
      Alert.alert('Atenção', 'Digite o título da notificação.');
      return;
    }

    const dayNum = parseInt(day, 10);
    if (!day || isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      Alert.alert('Atenção', 'Dia inválido (1-31).');
      return;
    }

    const h = parseInt(hour || '0', 10);
    const m = parseInt(minute || '0', 10);
    const s = parseInt(second || '0', 10);

    const granted = await requestNotificationPermissions();
    if (!granted) {
      Alert.alert('Permissão negada', 'Habilite as notificações nas configurações do dispositivo.');
      return;
    }

    const now = new Date();
    let notifDate = new Date(now.getFullYear(), now.getMonth(), dayNum, h, m, s);
    if (notifDate <= now) {
      notifDate = new Date(now.getFullYear(), now.getMonth() + 1, dayNum, h, m, s);
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title.trim(),
          body: body.trim() || undefined,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notifDate,
        },
      });

      Alert.alert(
        'Agendada!',
        `Notificação para ${pad(String(dayNum))}/${pad(String(notifDate.getMonth() + 1))} às ${pad(hour)}:${pad(minute)}:${pad(second)}`
      );

      setTitle('');
      setBody('');
      setDay('');
      setHour('08');
      setMinute('00');
      setSecond('00');
      await loadScheduled();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível agendar a notificação.');
    }
  };

  const handleCancel = async (id: string) => {
    await Notifications.cancelScheduledNotificationAsync(id);
    await loadScheduled();
  };

  const handleCancelAll = () => {
    Alert.alert('Cancelar todas', 'Remover todas as notificações agendadas?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim',
        style: 'destructive',
        onPress: async () => {
          await Notifications.cancelAllScheduledNotificationsAsync();
          await loadScheduled();
        },
      },
    ]);
  };

  const formatDate = (d: Date) => {
    try {
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerCard}>
          <MaterialCommunityIcons name="bell-ring" size={32} color={COLORS.highlight} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Notificações</Text>
            <Text style={styles.headerSubtitle}>Agende lembretes personalizados</Text>
          </View>
        </View>

        {/* Formulário */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Nova Notificação</Text>

          <Text style={styles.fieldLabel}>Título</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Cobrar João"
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.fieldLabel}>Mensagem (opcional)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={body}
            onChangeText={setBody}
            placeholder="Detalhes do lembrete..."
            placeholderTextColor={COLORS.textLight}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />

          <Text style={styles.fieldLabel}>Dia do mês (1–31)</Text>
          <TextInput
            style={[styles.input, styles.dayInput]}
            value={day}
            onChangeText={(v) => {
              const clean = v.replace(/\D/g, '').slice(0, 2);
              setDay(clean);
            }}
            placeholder="15"
            placeholderTextColor={COLORS.textLight}
            keyboardType="number-pad"
            maxLength={2}
          />

          <Text style={styles.fieldLabel}>Horário</Text>
          <View style={styles.timeRow}>
            <TimeInput value={hour} onChange={setHour} max={23} label="HH" />
            <Text style={styles.timeSep}>:</Text>
            <TimeInput value={minute} onChange={setMinute} max={59} label="MM" />
            <Text style={styles.timeSep}>:</Text>
            <TimeInput value={second} onChange={setSecond} max={59} label="SS" />
          </View>

          <TouchableOpacity style={styles.scheduleBtn} onPress={handleSchedule}>
            <MaterialCommunityIcons name="bell-plus" size={20} color="#fff" />
            <Text style={styles.scheduleBtnText}>Agendar Notificação</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de agendadas */}
        <View style={styles.listHeader}>
          <Text style={styles.sectionLabel}>
            Agendadas ({scheduled.length})
          </Text>
          {scheduled.length > 0 && (
            <TouchableOpacity onPress={handleCancelAll}>
              <Text style={styles.cancelAllText}>Cancelar todas</Text>
            </TouchableOpacity>
          )}
        </View>

        {scheduled.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="bell-off-outline" size={36} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Nenhuma notificação agendada</Text>
          </View>
        ) : (
          scheduled.map((item) => (
            <View key={item.id} style={styles.notifItem}>
              <MaterialCommunityIcons name="bell-outline" size={20} color={COLORS.highlight} style={{ marginTop: 2 }} />
              <View style={styles.notifInfo}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                {!!item.body && <Text style={styles.notifBody}>{item.body}</Text>}
                <Text style={styles.notifDate}>{formatDate(item.date)}</Text>
              </View>
              <TouchableOpacity onPress={() => handleCancel(item.id)} style={styles.cancelBtn}>
                <MaterialCommunityIcons name="close-circle" size={22} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputMulti: {
    height: 72,
  },
  dayInput: {
    width: 90,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  timeBlock: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textLight,
    letterSpacing: 1,
    marginBottom: 4,
  },
  timeInput: {
    width: 70,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 13,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'center',
  },
  timeSep: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  scheduleBtn: {
    backgroundColor: COLORS.highlight,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    marginTop: 20,
  },
  scheduleBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelAllText: {
    fontSize: 13,
    color: COLORS.error,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  notifInfo: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  notifBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  notifDate: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
  cancelBtn: {
    padding: 2,
  },
});
