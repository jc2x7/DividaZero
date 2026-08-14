import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { usePathname, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha } from '../constants/theme';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  description: string;
}

/** Grupos separam o uso diário das ferramentas de cálculo pontuais. */
const MENU_GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Meu dinheiro',
    items: [
      {
        label: 'Dashboard',
        icon: 'view-dashboard-outline',
        route: '/(drawer)/',
        description: 'O mês de hoje',
      },
      {
        label: 'Análise',
        icon: 'chart-line',
        route: '/(drawer)/analise',
        description: 'Evolução e comparações',
      },
      {
        label: 'Metas',
        icon: 'flag-checkered',
        route: '/(drawer)/metas',
        description: 'Guardar com objetivo',
      },
      {
        label: 'Plano de Quitação',
        icon: 'rocket-launch-outline',
        route: '/(drawer)/plano',
        description: 'Sair das parcelas antes',
      },
      {
        label: 'Planejador',
        icon: 'clipboard-list-outline',
        route: '/(drawer)/planejador',
        description: 'Abater dívida mês a mês',
      },
      {
        label: 'Importar Extrato',
        icon: 'file-pdf-box',
        route: '/(drawer)/importar',
        description: 'Puxar lançamentos do PDF',
      },
    ],
  },
  {
    title: 'Ferramentas',
    items: [
      {
        label: 'Simular Juros',
        icon: 'calculator-variant-outline',
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
        icon: 'briefcase-check-outline',
        route: '/(drawer)/labor-laws',
        description: 'Cálculos CLT',
      },
      {
        label: 'Dinheiro Emprestado',
        icon: 'account-cash-outline',
        route: '/(drawer)/lending',
        description: 'Agenda de cobranças',
      },
    ],
  },
  {
    title: 'Aplicativo',
    items: [
      {
        label: 'Ajustes e Dados',
        icon: 'cog-outline',
        route: '/(drawer)/dados',
        description: 'Tema, backup e restauração',
      },
    ],
  },
];

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const pathname = usePathname();
  const { theme, name, toggle } = useTheme();
  const styles = useThemedStyles(makeStyles);

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
      <View style={styles.header}>
        <Image source={require('../assets/Logo.png')} style={styles.logo} resizeMode="cover" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.appName}>Dívida Zero</Text>
          <Text style={styles.appSubtitle}>Controle financeiro completo</Text>
        </View>
      </View>

      {MENU_GROUPS.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          {group.items.map((item) => {
            const active = isActive(item.route);
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.menuItem, active && styles.menuItemActive]}
                onPress={() => router.push(item.route as never)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, active && styles.iconContainerActive]}>
                  <MaterialCommunityIcons
                    name={item.icon as never}
                    size={20}
                    color={active ? theme.primary : theme.drawerTextSecondary}
                  />
                </View>
                <View style={styles.menuTextContainer}>
                  <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                    {item.label}
                  </Text>
                  <Text style={styles.menuDescription}>{item.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <TouchableOpacity style={styles.themeToggle} onPress={toggle} activeOpacity={0.7}>
        <MaterialCommunityIcons
          name={name === 'dark' ? 'weather-sunny' : 'weather-night'}
          size={19}
          color={theme.drawerTextSecondary}
        />
        <Text style={styles.themeToggleText}>
          {name === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        </Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <View style={styles.divider} />
        <Text style={styles.footerCreator}>Criado por Julio Lemos</Text>
        <Text style={styles.footerText}>v1.1.0 · @juliolemosdf</Text>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL('https://jc2x7.github.io/DividaZero/politica-privacidade.html')
          }
        >
          <Text style={styles.footerLink}>Política de Privacidade</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    container: { backgroundColor: t.drawerBg, flex: 1 },
    contentContainer: { flexGrow: 1, paddingBottom: SPACING.xl },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.lg,
      paddingHorizontal: SPACING.xl,
    },
    logo: { width: 44, height: 44, borderRadius: 11 },
    appName: { fontSize: 17, fontWeight: '800', color: t.drawerText, letterSpacing: -0.3 },
    appSubtitle: { fontSize: 11.5, color: t.textLight, marginTop: 1 },

    group: { paddingHorizontal: SPACING.md, marginTop: SPACING.md },
    groupTitle: {
      fontSize: 10.5,
      fontWeight: '700',
      color: t.textLight,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginLeft: SPACING.md,
      marginBottom: SPACING.sm,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      marginVertical: 1,
    },
    menuItemActive: { backgroundColor: t.drawerActiveBg },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.sm + 2,
      backgroundColor: t.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.md,
    },
    iconContainerActive: { backgroundColor: alpha(t.primary, 0.14) },
    menuTextContainer: { flex: 1, minWidth: 0 },
    menuLabel: { fontSize: 14.5, fontWeight: '600', color: t.drawerTextSecondary },
    menuLabelActive: { color: t.drawerText, fontWeight: '700' },
    menuDescription: { fontSize: 11, color: t.textLight, marginTop: 1 },

    themeToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.xl,
      marginHorizontal: SPACING.xl,
      paddingVertical: 11,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
    },
    themeToggleText: { fontSize: 13, fontWeight: '600', color: t.drawerTextSecondary },

    footer: { marginTop: 'auto', paddingTop: SPACING.xl },
    divider: { height: 1, backgroundColor: t.divider, marginHorizontal: SPACING.xl },
    footerCreator: {
      textAlign: 'center',
      color: t.textSecondary,
      fontSize: 11.5,
      marginTop: SPACING.md,
      fontWeight: '600',
    },
    footerText: { textAlign: 'center', color: t.textLight, fontSize: 10.5, marginTop: 3 },
    footerLink: {
      textAlign: 'center',
      color: t.primary,
      fontSize: 11,
      marginTop: 6,
      textDecorationLine: 'underline',
    },
  });
