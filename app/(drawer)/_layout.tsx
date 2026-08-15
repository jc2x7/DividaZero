import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import CustomDrawerContent from '../../components/CustomDrawerContent';
import { useTheme } from '../../hooks/useTheme';

function MenuButton() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => navigation.openDrawer()}
      style={{ marginLeft: 12, padding: 8 }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <MaterialCommunityIcons name="menu" size={24} color={theme.headerText} />
    </TouchableOpacity>
  );
}

function ThemeToggleButton() {
  const { theme, name, toggle } = useTheme();
  return (
    <TouchableOpacity
      onPress={toggle}
      style={{ marginRight: 12, padding: 8 }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <MaterialCommunityIcons
        name={name === 'dark' ? 'weather-sunny' : 'weather-night'}
        size={21}
        color={theme.headerText}
      />
    </TouchableOpacity>
  );
}

/** Ordem do menu: rotina do dia a dia primeiro, ferramentas depois. */
const SCREENS: { name: string; title: string }[] = [
  { name: 'index', title: 'Dashboard' },
  { name: 'analise', title: 'Análise' },
  { name: 'metas', title: 'Metas' },
  { name: 'plano', title: 'Plano de Quitação' },
  { name: 'planejador', title: 'Planejador' },
  { name: 'importar', title: 'Importar Extrato' },
  { name: 'simulator', title: 'Simular Juros' },
  { name: 'salary-calc', title: 'Salário Líquido' },
  { name: 'labor-laws', title: 'Rescisão & Férias' },
  { name: 'lending', title: 'Dinheiro Emprestado' },
  { name: 'dados', title: 'Ajustes e Dados' },
];

export default function DrawerLayout() {
  const { theme } = useTheme();

  return (
    <GestureHandlerRootView style={styles.root}>
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.headerBg,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.border,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: theme.headerText,
          headerTitleStyle: { fontWeight: '700', fontSize: 17, color: theme.headerText },
          sceneStyle: { backgroundColor: theme.background },
          drawerStyle: { backgroundColor: theme.drawerBg, width: 292 },
          drawerActiveTintColor: theme.primary,
          drawerInactiveTintColor: theme.drawerTextSecondary,
          headerLeft: () => <MenuButton />,
          headerRight: () => <ThemeToggleButton />,
        }}
      >
        {SCREENS.map((screen) => (
          <Drawer.Screen
            key={screen.name}
            name={screen.name}
            options={{ title: screen.title, drawerLabel: screen.title }}
          />
        ))}
      </Drawer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
