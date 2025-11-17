import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import TopBar from '../components/TopBar';
import { Colors } from '../variables';
import { useRouter } from 'expo-router'; // ← NUEVA IMPORTACIÓN

export default function HomeScreen() {
  const router = useRouter(); // ← Para navegación

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
    console.log('Navegando a:', link);
    Alert.alert('Navegación', `Irías a la vista: ${link}`);
  };

  const handleButtonPress = (buttonName) => {
    console.log('Botón presionado:', buttonName);
    
    // AQUÍ USAMOS LA NAVEACIÓN NUEVA
    switch(buttonName) {
      case 'Pacientes':
        router.push('/pacientes'); // ← Navega a pacientes
        break;
      case 'Clientes':
        router.push('/clientes'); // ← Navega a clientes
        break;
      // Agrega más casos según necesites
      default:
        Alert.alert('Función', `Función de ${buttonName}`);
    }
  };

  const handleLogin = () => {
    console.log('Iniciar sesión presionado');
    router.push('/login'); // ← Navega a login
  };

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
      <TopBar onMenuNavigate={handleMenuNavigate} />
      <Image
        source={require('../assets/images/logo(con_borde_blanco).png')}
        style={styles.logo}
        resizeMode="contain"
      />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 170,
    height: 150,
    marginLeft: 115,
    marginBottom: -50
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
    color: '#666',
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
    marginBottom: 40,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  menuButton: {
    backgroundColor: Colors.primary,
    width: '48%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    padding: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonImage: {
    width: 100,
    height: 100,
    marginBottom: 10,
    tintColor: Colors.textPrimary
  },
  buttonText: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minWidth: 200,
    alignItems: 'center',
    marginTop: -30,
    marginBottom: 50
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});