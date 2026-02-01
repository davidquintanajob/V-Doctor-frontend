import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, Dimensions } from 'react-native';
import TopBar from '../components/TopBar';
import { Colors } from '../variables';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [calendarioCount, setCalendarioCount] = useState(0);
  const [calendarioItems, setCalendarioItems] = useState([]);

  // Datos para los botones - definir cuáles son accesibles sin login
  const buttonData = [
    {
      id: 1,
      name: 'Pacientes',
      image: require('../assets/images/huella.png'),
      link: 'pacientes',
      requiresLogin: false, // Accesible sin login
    },
    {
      id: 2,
      name: 'Clientes',
      image: require('../assets/images/customers.png'),
      link: 'clientes',
      requiresLogin: false, // Accesible sin login
    },
    {
      id: 3,
      name: 'Calendario',
      image: require('../assets/images/calendar.png'),
      link: 'calendario',
      requiresLogin: true, // Accesible sin login
    },
    {
      id: 4,
      name: 'Ventas',
      image: require('../assets/images/shopping-cart.png'),
      link: 'ventas',
      requiresLogin: true, // Requiere login
    },
  ];

  const handleMenuNavigate = (link) => {
    router.push(`/${link}`);
  };

  const handleButtonPress = async (button) => {
    try {
      // Si el botón no requiere login, navegar directamente
      if (!button.requiresLogin) {
        router.push(`/${button.link}`);
        return;
      }

      // Si requiere login, verificar token
      const configString = await AsyncStorage.getItem('@config');
      if (!configString) {
        Alert.alert('Sesión requerida', 'Debes iniciar sesión para acceder a esta función');
        router.replace('/login');
        return;
      }

      const config = JSON.parse(configString);
      if (!config.token || !config.usuario) {
        Alert.alert('Sesión requerida', 'Debes iniciar sesión para acceder a esta función');
        router.replace('/login');
        return;
      }

      // Si hay token, navegar normalmente
      router.push(`/${button.link}`);
    } catch (error) {
      console.log('Error verificando token:', error);
      Alert.alert('Error', 'Error al verificar la sesión');
      router.replace('/login');
    }
  };

  const handleLogin = () => {
    console.log('Iniciar sesión presionado');
    router.push('/login');
  };

  useEffect(() => {
    let mounted = true;
    const checkConfig = async () => {
      try {
        const raw = await AsyncStorage.getItem('@config');
        if (!mounted) return;
        if (!raw) {
          router.replace('/config');
          return;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.api_host) {
          router.replace('/config');
          return;
        }
        // Al abrir por primera vez, sincronizar el valor de la moneda desde el servidor
        (async () => {
          try {
            const host = parsed.api_host || parsed.apihost || parsed.apiHost;
            const token = parsed.token;
            if (!host) return;

            // Sincronizar /moneda
            try {
              const res = await fetch(`${host}/moneda`, {
                method: 'GET',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
              });
              const contentType = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : '';
              if (res.ok && contentType.includes('application/json')) {
                const data = await res.json();
                if (data && typeof data.value !== 'undefined') {
                  await AsyncStorage.setItem('@CambioMoneda', String(data.value));
                }
              }
            } catch (e) {
              console.log('No se pudo sincronizar @CambioMoneda:', e);
            }

            // Sincronizar /redondeo y guardar en @redondeoConfig
            try {
              const rres = await fetch(`${host}/redondeo`, {
                method: 'GET',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
              });
              const contentTypeR = rres.headers && rres.headers.get ? (rres.headers.get('content-type') || '') : '';
              if (rres.ok && contentTypeR.includes('application/json')) {
                const rdata = await rres.json();
                // Guardar la respuesta tal cual en JSON string bajo @redondeoConfig
                await AsyncStorage.setItem('@redondeoConfig', JSON.stringify(rdata));
              } else if (rres.ok) {
                // Si responde OK pero no JSON, intentar leer texto y guardarlo como value
                try {
                  const text = await rres.text();
                  await AsyncStorage.setItem('@redondeoConfig', JSON.stringify({ raw: text }));
                } catch (e) {
                  console.log('No se pudo leer respuesta /redondeo como texto:', e);
                }
              }
            } catch (e) {
              console.log('No se pudo sincronizar @redondeoConfig:', e);
            }

            // Consultar recordatorios del calendario para hoy y guardar en AsyncStorage
            try {
              const formatDateToYMD = (d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${dd}`;
              };

              const today = new Date();
              const dateStr = formatDateToYMD(today);

              const cleanHost = String(host).replace(/\/+$|\/+/g, '').replace(/\/$/, '');
              let base = cleanHost;
              // ensure no trailing slash
              while (base.endsWith('/')) base = base.slice(0, -1);
              const url = `${base}/calendario/filter`;

              const resCal = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ fecha_inicio: dateStr, fecha_fin: dateStr })
              });

              let items = [];
              if (resCal.ok) {
                const j = await resCal.json().catch(() => null);
                items = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : (j?.rows || []));
              }

              const count = Array.isArray(items) ? items.length : 0;
              setCalendarioItems(items);
              setCalendarioCount(count);
              try { await AsyncStorage.setItem('@CalendarioHoy', JSON.stringify(items || [])); } catch (e) { /* ignore */ }
            } catch (e) {
              console.log('Error consultando calendario hoy:', e);
              setCalendarioItems([]);
              setCalendarioCount(0);
            }

          } catch (e) {
            console.log('No se pudo sincronizar @CambioMoneda y @redondeoConfig:', e);
          }
        })();
      } catch (e) {
        console.log('Error leyendo @config:', e);
        router.replace('/config');
      } finally {
        if (mounted) setCheckingConfig(false);
      }
    };
    checkConfig();
    return () => { mounted = false; };
  }, []);

  // Función para dividir los botones en filas de 2
  const renderButtonRows = () => {
    const rows = [];
    for (let i = 0; i < buttonData.length; i += 2) {
      const rowButtons = buttonData.slice(i, i + 2);
      rows.push(
        <View key={i} style={styles.buttonRow}>
          {rowButtons.map((button) => (
            <TouchableOpacity
              key={button.id}
              style={[
                styles.menuButton,
                !button.requiresLogin && styles.freeAccessButton // Estilo diferente para acceso libre
              ]}
              onPress={() => handleButtonPress(button)}
            >
              <Image
                source={button.image}
                style={styles.buttonImage}
                resizeMode="contain"
              />
              <Text style={styles.buttonText}>{button.name}</Text>
              
              {/* Badge para indicar acceso libre */}
              {!button.requiresLogin && (
                <View style={styles.freeAccessBadge}>
                  <Text style={styles.freeAccessBadgeText}>Libre</Text>
                </View>
              )}
                  {/* Badge de notificaciones para Calendario */}
                  {button.link === 'calendario' && calendarioCount > 0 && (
                    <View style={styles.calendarioBadge}>
                      <Text style={styles.calendarioBadgeText}>{calendarioCount}</Text>
                    </View>
                  )}
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    return rows;
  };

  return (
    <View style={styles.container}>
      {checkingConfig ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <>
          <TopBar onMenuNavigate={handleMenuNavigate} />
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/images/logo(con_borde_blanco).png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.content}>
              <Text style={styles.title}>Bienvenido a V-Doctor</Text>
              <Text style={styles.subtitle}>Selecciona una opción</Text>

              {/* Botones en filas de 2 */}
              <View style={styles.buttonsContainer}>
                {renderButtonRows()}
              </View>

              {/* Botón de iniciar sesión */}
              <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
              </TouchableOpacity>

              {/* Información sobre el acceso */}
              <View style={styles.accessInfo}>
                <Text style={styles.accessInfoText}>
                  💡 Algunas funciones están disponibles sin iniciar sesión
                </Text>
              </View>
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: screenWidth * 0.05,
    paddingVertical: screenHeight * 0.02,
  },
  logoContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: screenHeight * 0.01,
  },
  logo: {
    width: screenWidth * 0.4,
    height: screenHeight * 0.15,
    maxWidth: 200,
    maxHeight: 150,
  },
  title: {
    fontSize: screenWidth * 0.06,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: screenHeight * 0.01,
  },
  subtitle: {
    fontSize: screenWidth * 0.04,
    marginBottom: screenHeight * 0.04,
    color: '#666',
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
    marginBottom: screenHeight * 0.04,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: screenHeight * 0.02,
    paddingHorizontal: screenWidth * 0.02,
  },
  menuButton: {
    backgroundColor: Colors.primary,
    width: '48%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: screenWidth * 0.04,
    padding: screenWidth * 0.03,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minHeight: screenWidth * 0.3,
    position: 'relative', // Para posicionar el badge
  },
  freeAccessButton: {
    backgroundColor: '#4CAF50', // Color diferente para acceso libre
    borderWidth: 2,
    borderColor: '#2E7D32',
  },
  buttonImage: {
    width: '60%',
    height: '60%',
    marginBottom: '5%',
    tintColor: Colors.textPrimary
  },
  buttonText: {
    color: Colors.textPrimary,
    fontSize: screenWidth * 0.035,
    fontWeight: 'bold',
    textAlign: 'center',
    minFontSize: 12,
  },
  freeAccessBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#2E7D32',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  freeAccessBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  calendarioBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#E53935',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  calendarioBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  loginButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: screenWidth * 0.1,
    paddingVertical: screenHeight * 0.02,
    borderRadius: screenWidth * 0.08,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minWidth: screenWidth * 0.5,
    alignItems: 'center',
    marginTop: screenHeight * -0.03,
    marginBottom: screenHeight * 0.05,
  },
  loginButtonText: {
    color: 'white',
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
  },
  accessInfo: {
    backgroundColor: '#E3F2FD',
    padding: screenWidth * 0.03,
    borderRadius: screenWidth * 0.02,
    marginTop: screenHeight * -0.02,
    marginBottom: screenHeight * 0.02,
  },
  accessInfoText: {
    fontSize: screenWidth * 0.03,
    color: '#1565C0',
    textAlign: 'center',
    fontWeight: '500',
  },
});