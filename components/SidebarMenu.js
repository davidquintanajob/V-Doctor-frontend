import React from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Colors, Spacing, Typography } from '../variables';

const { width } = Dimensions.get('window');
const MENU_WIDTH = width * 0.75;

const SidebarMenu = ({ isOpen, onClose, onNavigate }) => {
  // Definir los items directamente aquí según indicación
  const menuItems = [
    { name: 'Tareas', icon: require('../assets/images/customers.png'), link: 'clientes' },
    { name: 'Clientes', icon: require('../assets/images/customers.png'), link: 'clientes' },
    { name: 'Pacientes', icon: require('../assets/images/huella.png'), link: 'appointments' },
    { name: 'Servicios', icon: require('../assets/images/healthcare.png'), link: 'pets' },
    { name: 'Calendario', icon: require('../assets/images/calendar.png'), link: 'history' },
    { name: 'Ventas', icon: require('../assets/images/shopping-cart.png'), link: 'settings' },
    { name: 'Estética y baño', icon: require('../assets/images/perros.png'), link: 'settings' },
    { name: 'Inventario', icon: require('../assets/images/medicamento.png'), link: 'settings' },
    { name: 'Usuarios del sistema', icon: require('../assets/images/user.png'), link: 'settings' },
    { name: 'Informes', icon: require('../assets/images/bar-chart.png'), link: 'settings' },
    { name: 'Cambio moneda CUP - USD', icon: require('../assets/images/exchange.png'), link: 'settings' },
  ];

  const slideAnim = React.useRef(new Animated.Value(-MENU_WIDTH)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : -MENU_WIDTH,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isOpen]);

  const handleItemPress = (link) => {
    onNavigate(link);
    onClose();
  };

  return (
    <>
      {/* Overlay background */}
      {isOpen && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={onClose}
          activeOpacity={1}
        />
      )}

      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >

        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, { borderWidth: 2, borderColor: Colors.primary, backgroundColor: Colors.primarySuave }]}
              onPress={() => handleItemPress(item.link)}
            >
              <Image
                source={typeof item.icon === 'string' ? { uri: item.icon } : item.icon}
                style={styles.itemIcon}
                resizeMode="contain"
              />
              <Text style={styles.itemText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: MENU_WIDTH,
    height: '100%',
    backgroundColor: Colors.primarySuave,
    zIndex: 11,
    paddingTop: Spacing.l,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.m,
    marginTop: 15
  },
  logoWrap: {
    width: '100%',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.m,
    paddingBottom: Spacing.s,
  },
  sidebarLogo: {
    width: 100,
    height: 50,
    marginTop: 15,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.m,
    paddingHorizontal: Spacing.s,
    marginVertical: Spacing.s,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  itemIcon: {
    width: 24,
    height: 24,
    marginRight: Spacing.m,
  },
  itemText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});

export default SidebarMenu;
