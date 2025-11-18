import React, { useState, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const MENU_WIDTH = width * 0.75;

const SidebarMenu = ({ isOpen, onClose, onNavigate }) => {
  const router = useRouter();
  const [filteredMenuItems, setFilteredMenuItems] = useState([]);
  const [userRole, setUserRole] = useState(null);

  // Definir los items con roles visibles
  const menuItems = [
    { name: 'Tareas', icon: require('../assets/images/tasks.png'), link: 'clientes', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"] },
    { name: 'Clientes', icon: require('../assets/images/customers.png'), link: 'clientes', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"] },
    { name: 'Pacientes', icon: require('../assets/images/huella.png'), link: 'pacientes', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"] },
    { name: 'Servicios', icon: require('../assets/images/healthcare.png'), link: 'servicios', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"] },
    { name: 'Calendario', icon: require('../assets/images/calendar.png'), link: 'calendario', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"] },
    { name: 'Ventas', icon: require('../assets/images/shopping-cart.png'), link: 'ventas', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"] },
    { name: 'Estética y baño', icon: require('../assets/images/perros.png'), link: 'estetica', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"] },
    { name: 'Inventario', icon: require('../assets/images/medicamento.png'), link: 'inventario', rolVisible: ["Administrador", "Médico", "Técnico"] },
    { name: 'Usuarios del sistema', icon: require('../assets/images/user.png'), link: 'usuarios', rolVisible: ['Administrador'] },
    { name: 'Informes', icon: require('../assets/images/bar-chart.png'), link: 'informes', rolVisible: ['Administrador'] },
    { name: 'Cambio moneda CUP - USD', icon: require('../assets/images/exchange.png'), link: 'cambio-moneda', rolVisible: ['Administrador'] },
    { name: 'Configuración', icon: require('../assets/images/config.png'), link: 'config', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"] },
  ];

  const slideAnim = React.useRef(new Animated.Value(-MENU_WIDTH)).current;

  // Cargar datos del usuario y filtrar menú
  useEffect(() => {
    const loadUserDataAndFilterMenu = async () => {
      try {
        const configString = await AsyncStorage.getItem('@config');
        if (configString) {
          const config = JSON.parse(configString);
          
          // Verificar si hay token
          if (!config.token) {
            // No hay token, redirigir a login
            router.replace('/login');
            onClose();
            return;
          }

          // Obtener rol del usuario
          const userRoleFromConfig = config.usuario?.rol;
          setUserRole(userRoleFromConfig);

          // Filtrar menú según el rol
          if (userRoleFromConfig) {
            const filtered = menuItems.filter(item => 
              item.rolVisible.includes(userRoleFromConfig)
            );
            setFilteredMenuItems(filtered);
          } else {
            // Si no hay rol, mostrar todos los items
            setFilteredMenuItems(menuItems);
          }
        } else {
          // No hay configuración, redirigir a login
          router.replace('/login');
          onClose();
        }
      } catch (error) {
        console.log('Error cargando datos del usuario:', error);
        // En caso de error, mostrar todos los items
        setFilteredMenuItems(menuItems);
      }
    };

    if (isOpen) {
      loadUserDataAndFilterMenu();
    }
  }, [isOpen]);

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : -MENU_WIDTH,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isOpen]);

  const handleItemPress = async (link) => {
    try {
      // Verificar token antes de navegar
      const configString = await AsyncStorage.getItem('@config');
      if (configString) {
        const config = JSON.parse(configString);
        
        if (!config.token) {
          // No hay token, redirigir a login
          router.replace('/login');
          onClose();
          return;
        }

        // Hay token, navegar normalmente
        router.push(`/${link}`);
        onClose();
      } else {
        // No hay configuración, redirigir a login
        router.replace('/login');
        onClose();
      }
    } catch (error) {
      console.log('Error verificando token:', error);
      router.replace('/login');
      onClose();
    }
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
        {/* Información del usuario */}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {userRole ? `Rol: ${userRole}` : 'Usuario no identificado'}
          </Text>
        </View>

        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {filteredMenuItems.map((item, index) => (
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
          
          {/* Mostrar mensaje si no hay items visibles */}
          {filteredMenuItems.length === 0 && (
            <View style={styles.noItemsContainer}>
              <Text style={styles.noItemsText}>
                No tienes permisos para ver ningún menú
              </Text>
            </View>
          )}
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
  userInfo: {
    paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    marginBottom: Spacing.s,
  },
  userName: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
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
  noItemsContainer: {
    padding: Spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noItemsText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SidebarMenu;