import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SystemUI from 'expo-system-ui';
import {
  requestNotificationPermissions,
  scheduleAllPaymentNotifications,
} from '../hooks/useNotifications';
import { getDatabase } from '../database/database';
import { initAnalytics, trackEvent, refreshSession, flushNow } from '../services/analytics';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import { CategoriesProvider } from '../hooks/useCategories';

function AppShell() {
  const router = useRouter();
  const { theme, name } = useTheme();

  useEffect(() => {
    // Pinta o fundo nativo para não piscar branco ao abrir no tema escuro.
    SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
  }, [theme.background]);

  useEffect(() => {
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

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'PAYMENT_REMINDER' && data?.loanPersonId) {
        router.push('/(drawer)/lending');
      }
    });

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
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <CategoriesProvider>
        <AppShell />
      </CategoriesProvider>
    </ThemeProvider>
  );
}
