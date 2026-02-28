import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CustomDrawerContent from '../../components/CustomDrawerContent';
import { COLORS } from '../../constants/colors';

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
          headerLeft: ({ onPress }) => (
            <TouchableOpacity onPress={onPress} style={{ marginLeft: 16, padding: 4 }}>
              <MaterialCommunityIcons name="menu" size={26} color="#fff" />
            </TouchableOpacity>
          ),
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
      </Drawer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
