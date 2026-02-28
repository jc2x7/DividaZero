import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { LoanPerson } from '../types';
import { updateNotificationId, getAllLoanPersons } from '../database/database';
import { calculateLoanInstallment } from '../utils/calculations';
import { formatCurrency } from '../utils/formatting';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Divida Zero',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E94560',
    });
  }

  return true;
}

// 3 lembretes: 5 dias, 3 dias e 1 dia antes do vencimento
const REMINDERS: { days: number; title: (name: string) => string; body: (parcela: number, total: number, valor: string) => string }[] = [
  {
    days: 5,
    title: (name) => `⏰ Lembrete: ${name}`,
    body: (parcela, total, valor) =>
      `Parcela ${parcela}/${total} de ${valor} vence em 5 dias. Prepare a cobrança!`,
  },
  {
    days: 3,
    title: (name) => `⚠️ Atenção: ${name}`,
    body: (parcela, total, valor) =>
      `Parcela ${parcela}/${total} de ${valor} vence em 3 dias. Hora de cobrar!`,
  },
  {
    days: 1,
    title: (name) => `🔴 Vence amanhã: ${name}`,
    body: (parcela, total, valor) =>
      `Parcela ${parcela}/${total} de ${valor} vence amanhã! Toque para cobrar.`,
  },
];

async function cancelPersonNotifications(notificationId?: string): Promise<void> {
  if (!notificationId) return;
  const ids = notificationId.split(',').filter(Boolean);
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // já expirada ou inexistente — ignorar
    }
  }
}

/**
 * Agenda 3 notificações: 5, 3 e 1 dia antes do payment_day.
 * Retorna os IDs separados por vírgula para salvar no banco.
 */
export async function schedulePaymentNotification(
  person: LoanPerson
): Promise<string | null> {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;

    // Cancela todos os lembretes anteriores desta pessoa
    await cancelPersonNotifications(person.notification_id);

    const today = new Date();
    const parcela = person.installments_paid + 1;
    const valor = formatCurrency(
      calculateLoanInstallment(person.total_amount, person.monthly_interest, person.installments)
    );

    const scheduledIds: string[] = [];

    for (const reminder of REMINDERS) {
      // Calcula a data: payment_day - N dias (JS Date lida com overflow de mês)
      let notifDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        person.payment_day - reminder.days,
        8, 0, 0
      );

      // Se já passou, empurra para o próximo mês
      if (notifDate <= today) {
        notifDate = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          person.payment_day - reminder.days,
          8, 0, 0
        );
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title(person.name),
          body: reminder.body(parcela, person.installments, valor),
          data: { loanPersonId: person.id, type: 'PAYMENT_REMINDER', daysBefore: reminder.days },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notifDate,
        },
      });

      scheduledIds.push(id);
    }

    const combinedId = scheduledIds.join(',');
    await updateNotificationId(person.id, combinedId);
    return combinedId;
  } catch (error) {
    console.error('Failed to schedule notification:', error);
    return null;
  }
}

/**
 * Agenda notificações para todas as pessoas com parcelas pendentes
 */
export async function scheduleAllPaymentNotifications(): Promise<void> {
  const persons = await getAllLoanPersons();
  for (const person of persons) {
    if (person.installments_paid < person.installments) {
      await schedulePaymentNotification(person);
    }
  }
}

export function useNotificationListener(
  onNotification: (notification: Notifications.Notification) => void,
  onResponse: (response: Notifications.NotificationResponse) => void
) {
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(onNotification);
    responseListener.current = Notifications.addNotificationResponseReceivedListener(onResponse);

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [onNotification, onResponse]);
}
