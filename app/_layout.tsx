import { useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  requestNotificationPermissions,
  scheduleAllPaymentNotifications,
} from '../hooks/useNotifications';
import { getDatabase } from '../database/database';
import { initAnalytics, trackEvent, refreshSession, flushNow } from '../services/analytics';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Initialize DB, analytics and notifications on app start
    const init = async () => {
      try {
        await getDatabase();
        await initAnalytics();
        trackEvent('app_open');
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

    // Track app foreground/background transitions
    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        refreshSession();
        trackEvent('app_open');
      } else {
        flushNow();
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      subscription.remove();
      appStateSub.remove();
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
