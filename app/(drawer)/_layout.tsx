import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import CustomDrawerContent from '../../components/CustomDrawerContent';
import { COLORS } from '../../constants/colors';

function MenuButton() {
  const navigation = useNavigation<any>();
  return (
    <TouchableOpacity
      onPress={() => navigation.openDrawer()}
      style={{ marginLeft: 16, padding: 8 }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <MaterialCommunityIcons name="menu" size={26} color="#fff" />
    </TouchableOpacity>
  );
}

export default function DrawerLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.primary,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 18,
          },
          drawerStyle: {
            backgroundColor: COLORS.drawerBg,
            width: 290,
          },
          drawerActiveTintColor: COLORS.highlight,
          drawerInactiveTintColor: COLORS.drawerTextSecondary,
          headerLeft: () => <MenuButton />,
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            title: 'Dashboard',
            drawerLabel: 'Dashboard',
          }}
        />
        <Drawer.Screen
          name="simulator"
          options={{
            title: 'Simular Juros',
            drawerLabel: 'Simular Juros',
          }}
        />
        <Drawer.Screen
          name="salary-calc"
          options={{
            title: 'Salário Líquido',
            drawerLabel: 'Salário Líquido',
          }}
        />
        <Drawer.Screen
          name="labor-laws"
          options={{
            title: 'Rescisão & Férias',
            drawerLabel: 'Rescisão & Férias',
          }}
        />
        <Drawer.Screen
          name="lending"
          options={{
            title: 'Dinheiro Emprestado',
            drawerLabel: 'Dinheiro Emprestado',
          }}
        />
        <Drawer.Screen
          name="dados"
          options={{
            title: 'Meus Dados',
            drawerLabel: 'Meus Dados',
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
