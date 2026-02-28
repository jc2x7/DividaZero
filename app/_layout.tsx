import { useEffect, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  requestNotificationPermissions,
  scheduleAllPaymentNotifications,
} from '../hooks/useNotifications';
import { getDatabase } from '../database/database';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Initialize DB and notifications on app start
    const init = async () => {
      try {
        await getDatabase();
        await requestNotificationPermissions();
        await scheduleAllPaymentNotifications();
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };
    init();

    // Handle notification taps
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'PAYMENT_REMINDER' && data?.loanPersonId) {
        router.push('/(drawer)/lending');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
