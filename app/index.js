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

  // Datos para los botones - puedes modificar las imágenes y textos
  const buttonData = [
    {
      id: 1,
      name: 'Pacientes',
      image: require('../assets/images/huella.png'),
    },
    {
      id: 2,
      name: 'Clientes',
      image: require('../assets/images/customers.png'),
    },
    {
      id: 3,
      name: 'Calendario',
      image: require('../assets/images/calendar.png'),
    },
    {
      id: 4,
      name: 'Ventas',
      image: require('../assets/images/shopping-cart.png'),
    },
  ];

  const handleMenuNavigate = (link) => {
    router.push(`/${link}`);
  };

  const handleButtonPress = async (buttonName) => {
    try {
      // Verificar token antes de navegar
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
      switch (buttonName) {
        case 'Pacientes':
          router.push('/pacientes');
          break;
        case 'Clientes':
          router.push('/clientes');
          break;
        case 'Calendario':
          router.push('/calendario');
          break;
        case 'Ventas':
          router.push('/ventas');
          break;
        default:
          Alert.alert('Función', `Función de ${buttonName}`);
      }
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
              style={styles.menuButton}
              onPress={() => handleButtonPress(button.name)}
            >
              <Image
                source={button.image}
                style={styles.buttonImage}
                resizeMode="contain"
              />
              <Text style={styles.buttonText}>{button.name}</Text>
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
    paddingHorizontal: screenWidth * 0.05, // 5% del ancho de pantalla
    paddingVertical: screenHeight * 0.02, // 2% del alto de pantalla
  },
  logoContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: screenHeight * 0.01, // 1% del alto
  },
  logo: {
    width: screenWidth * 0.4, // 40% del ancho de pantalla
    height: screenHeight * 0.15, // 15% del alto de pantalla
    maxWidth: 200, // Límite máximo para tablets
    maxHeight: 150, // Límite máximo para tablets
  },
  title: {
    fontSize: screenWidth * 0.06, // 6% del ancho de pantalla
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: screenHeight * 0.01, // 1% del alto
  },
  subtitle: {
    fontSize: screenWidth * 0.04, // 4% del ancho de pantalla
    marginBottom: screenHeight * 0.04, // 4% del alto
    color: '#666',
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
    marginBottom: screenHeight * 0.04, // 4% del alto
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: screenHeight * 0.02, // 2% del alto
    paddingHorizontal: screenWidth * 0.02, // 2% del ancho
  },
  menuButton: {
    backgroundColor: Colors.primary,
    width: '48%', // Mantenemos el 48% para el espacio entre botones
    aspectRatio: 1, // Mantiene forma cuadrada
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: screenWidth * 0.04, // 4% del ancho
    padding: screenWidth * 0.03, // 3% del ancho
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minHeight: screenWidth * 0.3, // Altura mínima para botones muy pequeños
  },
  buttonImage: {
    width: '60%', // 60% del ancho del botón
    height: '60%', // 60% del alto del botón
    marginBottom: '5%', // 5% del alto del botón
    tintColor: Colors.textPrimary
  },
  buttonText: {
    color: Colors.textPrimary,
    fontSize: screenWidth * 0.035, // 3.5% del ancho de pantalla
    fontWeight: 'bold',
    textAlign: 'center',
    minFontSize: 12, // Tamaño mínimo de fuente
  },
  loginButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: screenWidth * 0.1, // 10% del ancho
    paddingVertical: screenHeight * 0.02, // 2% del alto
    borderRadius: screenWidth * 0.08, // 8% del ancho
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minWidth: screenWidth * 0.5, // 50% del ancho mínimo
    alignItems: 'center',
    marginTop: screenHeight * -0.03, // -3% del alto
    marginBottom: screenHeight * 0.05, // 5% del alto
  },
  loginButtonText: {
    color: 'white',
    fontSize: screenWidth * 0.045, // 4.5% del ancho de pantalla
    fontWeight: 'bold',
  },
});