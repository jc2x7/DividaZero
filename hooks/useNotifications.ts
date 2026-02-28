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

/**
 * Schedule a notification 1 day before payment_day
 */
export async function schedulePaymentNotification(
  person: LoanPerson
): Promise<string | null> {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;

    // Cancel existing notification if any
    if (person.notification_id) {
      await Notifications.cancelScheduledNotificationAsync(person.notification_id);
    }

    const today = new Date();
    const targetDay = person.payment_day;

    // Calculate next notification date (1 day before payment day)
    let notifDate = new Date(today.getFullYear(), today.getMonth(), targetDay - 1, 8, 0, 0);
    if (notifDate <= today) {
      // Push to next month
      notifDate = new Date(today.getFullYear(), today.getMonth() + 1, targetDay - 1, 8, 0, 0);
    }

    const installmentAmount = calculateLoanInstallment(
      person.total_amount,
      person.monthly_interest,
      person.installments
    );
    const remaining = person.installments - person.installments_paid;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💰 Cobrança: ${person.name}`,
        body: `Parcela ${person.installments_paid + 1}/${person.installments} de ${formatCurrency(installmentAmount)} vence amanhã! Toque para cobrar.`,
        data: { loanPersonId: person.id, type: 'PAYMENT_REMINDER' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notifDate,
      },
    });

    // If there are more installments, re-schedule for next month too
    if (remaining > 1) {
      // Store main notification ID - re-scheduling will happen on app open
      await updateNotificationId(person.id, notificationId);
    }

    return notificationId;
  } catch (error) {
    console.error('Failed to schedule notification:', error);
    return null;
  }
}

/**
 * Schedule notifications for all active loan persons
 */
export async function scheduleAllPaymentNotifications(): Promise<void> {
  const persons = await getAllLoanPersons();
  for (const person of persons) {
    if (person.installments_paid < person.installments) {
      const notifId = await schedulePaymentNotification(person);
      if (notifId) {
        await updateNotificationId(person.id, notifId);
      }
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
