import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { usePathname, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  description: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard',
    icon: 'view-dashboard',
    route: '/(drawer)/',
    description: 'Visão geral das finanças',
  },
  {
    label: 'Simular Juros',
    icon: 'calculator-variant',
    route: '/(drawer)/simulator',
    description: 'Price & SAC',
  },
  {
    label: 'Salário Líquido',
    icon: 'cash-multiple',
    route: '/(drawer)/salary-calc',
    description: 'INSS + IRRF 2026',
  },
  {
    label: 'Rescisão & Férias',
    icon: 'briefcase-check',
    route: '/(drawer)/labor-laws',
    description: 'Cálculos CLT',
  },
  {
    label: 'Dinheiro Emprestado',
    icon: 'account-cash',
    route: '/(drawer)/lending',
    description: 'Agenda de cobranças',
  },
  {
    label: 'Notificações',
    icon: 'bell-ring',
    route: '/(drawer)/notifications',
    description: 'Agendar lembretes',
  },
];

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const pathname = usePathname();

  const isActive = (route: string) => {
    if (route === '/(drawer)/') return pathname === '/' || pathname === '/index';
    return pathname.includes(route.replace('/(drawer)', ''));
  };

  return (
    <DrawerContentScrollView
      {...props}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <MaterialCommunityIcons name="cash-remove" size={40} color={COLORS.highlight} />
        </View>
        <Text style={styles.appName}>Divida Zero</Text>
        <Text style={styles.appSubtitle}>Controle Financeiro Completo</Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        {MENU_ITEMS.map((item) => {
          const active = isActive(item.route);
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.menuItem, active && styles.menuItemActive]}
              onPress={() => router.push(item.route as never)}
            >
              <View style={[styles.iconContainer, active && styles.iconContainerActive]}>
                <MaterialCommunityIcons
                  name={item.icon as never}
                  size={22}
                  color={active ? COLORS.highlight : COLORS.drawerTextSecondary}
                />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                  {item.label}
                </Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
              {active && (
                <View style={styles.activeIndicator} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.divider} />
        <Text style={styles.footerText}>v1.0.0 · Legislação 2026</Text>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.drawerBg,
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  logoContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(233, 69, 96, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(233, 69, 96, 0.3)',
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.drawerText,
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 12,
    color: COLORS.drawerTextSecondary,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
  },
  menuContainer: {
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  menuItemActive: {
    backgroundColor: 'rgba(233, 69, 96, 0.12)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconContainerActive: {
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
  },
  menuTextContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.drawerTextSecondary,
  },
  menuLabelActive: {
    color: COLORS.drawerText,
  },
  menuDescription: {
    fontSize: 11,
    color: 'rgba(178,190,195,0.6)',
    marginTop: 1,
  },
  activeIndicator: {
    position: 'absolute',
    right: 0,
    top: '25%',
    bottom: '25%',
    width: 3,
    backgroundColor: COLORS.highlight,
    borderRadius: 2,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: 10,
  },
  footerText: {
    textAlign: 'center',
    color: 'rgba(178,190,195,0.4)',
    fontSize: 11,
    marginTop: 12,
  },
});
