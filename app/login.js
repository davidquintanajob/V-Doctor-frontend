import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../variables';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [contrasenna, setContrasenna] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleBack = () => {
    router.replace('/');
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async () => {
    // Verificar configuración primero
    try {
      const raw = await AsyncStorage.getItem('@config');
      if (!raw) {
        Alert.alert('Configuración requerida', 'Debes configurar la API primero');
        router.replace('/config');
        return;
      }
      
      const parsed = JSON.parse(raw);
      const host = parsed?.api_host || parsed?.apihost || parsed?.apiHost;
      if (!host) {
        Alert.alert('Configuración requerida', 'Debes configurar la API primero');
        router.replace('/config');
        return;
      }
    } catch (error) {
      Alert.alert('Error', 'Error al verificar configuración');
      return;
    }

    if (!nombre.trim() || !contrasenna) {
      Alert.alert('Error', 'Por favor ingresa usuario y contraseña');
      return;
    }

    setLoading(true);
    setSuccessMessage('');

    try {
      const raw = await AsyncStorage.getItem('@config');
      const parsed = JSON.parse(raw);
      const host = parsed?.api_host || parsed?.apihost || parsed?.apiHost;
      const url = host.replace(/\/+$/, '') + '/usuario/login';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          nombre_usuario: nombre, 
          contrasenna: contrasenna 
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Manejar errores de la API
        let errorMessage = 'Error desconocido';
        if (responseData.errors && Array.isArray(responseData.errors)) {
          errorMessage = responseData.errors.join('\n• ');
        } else if (responseData.message) {
          errorMessage = responseData.message;
        }
        
        Alert.alert(
          `Error ${response.status}`,
          errorMessage,
          [{ text: 'OK' }]
        );
        return;
      }

      // Login exitoso (status 200)
      if (responseData.usuario && responseData.token) {
        // Guardar datos del usuario y token
        const userConfig = {
          ...parsed,
          usuario: responseData.usuario,
          token: responseData.token,
          refreshToken: responseData.refreshToken
        };
        
        await AsyncStorage.setItem('@config', JSON.stringify(userConfig));
        
        // Mostrar mensaje de éxito
        setSuccessMessage(`¡Bienvenido ${responseData.usuario.nombre}!`);
        
        // Navegar después de un breve delay para que se vea el mensaje
        setTimeout(() => {
          router.replace('/');
        }, 1500);
      }

    } catch (error) {
      if (error.message.includes('Network request failed')) {
        Alert.alert('Error de conexión', 'No se pudo conectar al servidor');
      } else {
        Alert.alert('Error', error.message || 'Error en la petición');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Image
              source={require('../assets/images/arrow-left.png')}
              style={styles.icon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.logoBox}>
          <Image source={require('../assets/images/logo(con_borde_blanco).png')} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.title}>Iniciar Sesión</Text>

        {/* Mensaje de éxito */}
        {successMessage ? (
          <View style={styles.successContainer}>
            <Image
              source={require('../assets/images/success.png')} // Asegúrate de tener esta imagen
              style={styles.successIcon}
              resizeMode="contain"
            />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Usuario"
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="none"
              editable={!loading}
            />
            
            {/* Campo de contraseña con ojo */}
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Contraseña"
                value={contrasenna}
                onChangeText={setContrasenna}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity 
                style={styles.eyeButton}
                onPress={toggleShowPassword}
                disabled={loading}
              >
                <Image
                  source={
                    showPassword 
                      ? require('../assets/images/eye-open.png')
                      : require('../assets/images/eye-closed.png')
                  }
                  style={styles.eyeIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, { opacity: nombre.trim() && contrasenna ? 1 : 0.6 }]}
              disabled={!nombre.trim() || !contrasenna || loading}
              onPress={handleSubmit}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Ingresar</Text>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  container: { 
    flex: 1, 
    padding: 20, 
    alignItems: 'center', 
    marginTop: 50 
  },
  header: { 
    width: '100%', 
    height: 40, 
    justifyContent: 'center' 
  },
  backButton: { 
    position: 'absolute', 
    left: 0, 
    padding: 8, 
    backgroundColor: Colors.primarySuave,
    borderRadius: 8,
  },
  icon: {
    width: 30,
    height: 30,
    tintColor: Colors.textPrimary,
  },
  logoBox: { 
    width: '100%', 
    alignItems: 'center', 
    marginTop: 10, 
    marginBottom: 6 
  },
  logo: { 
    width: 140, 
    height: 120 
  },
  title: { 
    fontSize: 22, 
    fontWeight: '700', 
    color: Colors.primary, 
    marginBottom: 10 
  },
  form: { 
    width: '100%', 
    marginTop: 10 
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 12 
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    paddingRight: 50, // Espacio para el ojo
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  eyeIcon: {
    width: 24,
    height: 24,
    tintColor: Colors.primary,
  },
  button: { 
    backgroundColor: Colors.primary, 
    padding: 14, 
    borderRadius: 8, 
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 16,
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    marginTop: 20,
  },
  successIcon: {
    width: 60,
    height: 60,
    marginBottom: 15,
  },
  successText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2e7d32',
    textAlign: 'center',
  },
});