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
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Definir los items con roles visibles y accesibilidad sin login
  const menuItems = [
    { name: 'Tareas', icon: require('../assets/images/tasks.png'), link: 'NoDisponible', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"] },
    { name: 'Clientes', icon: require('../assets/images/customers.png'), link: 'clientes', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"], alwaysAccessible: true },
    { name: 'Pacientes', icon: require('../assets/images/huella.png'), link: 'pacientes', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"], alwaysAccessible: true },
    { name: 'Servicios', icon: require('../assets/images/healthcare.png'), link: 'NoDisponible', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"] },
    { name: 'Calendario', icon: require('../assets/images/calendar.png'), link: 'NoDisponible', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"], alwaysAccessible: true },
    { name: 'Ventas', icon: require('../assets/images/shopping-cart.png'), link: 'NoDisponible', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"] },
    { name: 'Estética y baño', icon: require('../assets/images/perros.png'), link: 'NoDisponible', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"] },
    { name: 'Inventario', icon: require('../assets/images/medicamento.png'), link: 'NoDisponible', rolVisible: ["Administrador", "Médico", "Técnico"] },
    { name: 'Usuarios del sistema', icon: require('../assets/images/user.png'), link: 'NoDisponible', rolVisible: ['Administrador'] },
    { name: 'Informes', icon: require('../assets/images/bar-chart.png'), link: 'NoDisponible', rolVisible: ['Administrador'] },
    { name: 'Cambio moneda CUP - USD', icon: require('../assets/images/exchange.png'), link: 'config', rolVisible: ['Administrador'] },
    { name: 'Configuración', icon: require('../assets/images/config.png'), link: 'config', rolVisible: ["Administrador", "Médico", "Técnico", "Estilista"], alwaysAccessible: true },
  ];

  const slideAnim = React.useRef(new Animated.Value(-MENU_WIDTH)).current;

  // Cargar datos del usuario y filtrar menú
  useEffect(() => {
    const loadUserDataAndFilterMenu = async () => {
      try {
        const configString = await AsyncStorage.getItem('@config');
        
        if (configString) {
          const config = JSON.parse(configString);
          
          // Verificar si hay token para determinar si está logueado
          if (config.token) {
            setIsLoggedIn(true);
            
            // Obtener rol del usuario si existe
            const userRoleFromConfig = config.usuario?.rol;
            setUserRole(userRoleFromConfig);

            // Filtrar menú según el rol
            if (userRoleFromConfig) {
              const filtered = menuItems.filter(item => 
                item.rolVisible.includes(userRoleFromConfig)
              );
              setFilteredMenuItems(filtered);
            } else {
              // Si hay token pero no hay rol, mostrar todos los items
              setFilteredMenuItems(menuItems);
            }
          } else {
            // No hay token, usuario no logueado - mostrar items accesibles sin login
            setIsLoggedIn(false);
            setUserRole(null);
            const accessibleItems = menuItems.filter(item => item.alwaysAccessible);
            setFilteredMenuItems(accessibleItems);
          }
        } else {
          // No hay configuración, usuario no logueado - mostrar items accesibles sin login
          setIsLoggedIn(false);
          setUserRole(null);
          const accessibleItems = menuItems.filter(item => item.alwaysAccessible);
          setFilteredMenuItems(accessibleItems);
        }
      } catch (error) {
        console.log('Error cargando datos del usuario:', error);
        // En caso de error, mostrar items accesibles sin login
        setIsLoggedIn(false);
        setUserRole(null);
        const accessibleItems = menuItems.filter(item => item.alwaysAccessible);
        setFilteredMenuItems(accessibleItems);
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

  const handleItemPress = async (link, alwaysAccessible = false) => {
    try {
      // Si el item es siempre accesible, permitir acceso sin verificar login
      if (alwaysAccessible) {
        router.push(`/${link}`);
        onClose();
        return;
      }

      // Para otros items, verificar si está logueado
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

  const handleLoginNavigation = () => {
    router.replace('/login');
    onClose();
  };

  // Función para determinar si un item está habilitado
  const isItemEnabled = (item) => {
    // Items con alwaysAccessible están siempre habilitados
    if (item.alwaysAccessible) return true;
    // Otros items solo si está logueado
    return isLoggedIn;
  };

  // Función para determinar la opacidad del item
  const getItemOpacity = (item) => {
    // Items con alwaysAccessible siempre opaca completa
    if (item.alwaysAccessible) return 1;
    // Otros items dependen del login
    return isLoggedIn ? 1 : 0.7;
  };

  // Función para obtener el badge apropiado
  const getItemBadge = (item) => {
    if (item.alwaysAccessible) {
      return (
        <View style={styles.alwaysAccessibleBadge}>
          <Text style={styles.alwaysAccessibleText}>Libre</Text>
        </View>
      );
    } else if (!isLoggedIn) {
      return (
        <View style={styles.loginRequiredBadge}>
          <Text style={styles.loginRequiredText}>Login</Text>
        </View>
      );
    }
    return null;
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
            {isLoggedIn 
              ? (userRole ? `Rol: ${userRole}` : 'Usuario conectado') 
              : 'Usuario no identificado'
            }
          </Text>
          <Text style={styles.loginStatus}>
            {isLoggedIn ? '✅ Conectado' : '❌ No conectado'}
          </Text>
        </View>

        {/* Botón de login si no está logueado */}
        {!isLoggedIn && (
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={handleLoginNavigation}
          >
            <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
          </TouchableOpacity>
        )}

        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {filteredMenuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem, 
                { 
                  borderWidth: 2, 
                  borderColor: Colors.primary, 
                  backgroundColor: Colors.primarySuave,
                  opacity: getItemOpacity(item) // Opacidad dinámica
                }
              ]}
              onPress={() => handleItemPress(item.link, item.alwaysAccessible)}
              disabled={!isItemEnabled(item)} // Habilitación dinámica
            >
              <Image
                source={typeof item.icon === 'string' ? { uri: item.icon } : item.icon}
                style={styles.itemIcon}
                resizeMode="contain"
              />
              <Text style={styles.itemText}>{item.name}</Text>
              
              {/* Mostrar badge apropiado */}
              {getItemBadge(item)}
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

// Los estilos se mantienen igual...
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
    alignItems: 'center',
  },
  userName: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  loginStatus: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.m,
    paddingHorizontal: Spacing.l,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: Spacing.m,
    marginBottom: Spacing.m,
    elevation: 2,
  },
  loginButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: 'bold',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.m,
    paddingHorizontal: Spacing.s,
    marginVertical: Spacing.s,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
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
    flex: 1,
  },
  loginRequiredBadge: {
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.s,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: Spacing.s,
  },
  loginRequiredText: {
    color: 'white',
    fontSize: Typography.small,
    fontWeight: 'bold',
  },
  alwaysAccessibleBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.s,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: Spacing.s,
  },
  alwaysAccessibleText: {
    color: 'white',
    fontSize: Typography.small,
    fontWeight: 'bold',
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