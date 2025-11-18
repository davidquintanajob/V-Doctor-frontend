import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TopBar from '../components/TopBar';
import { Colors, Spacing, Typography } from '../variables';
import { Image } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function PerfilScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [changingPassword, setChangingPassword] = useState(false);

  // Estados para cambio de contraseña
  const [viejaContrasenna, setOldPassword] = useState('');
  const [nuevaContrasenna, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados para mostrar/ocultar contraseñas
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Cargar datos del usuario
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const configString = await AsyncStorage.getItem('@config');
        if (!configString) {
          router.replace('/login');
          return;
        }

        const config = JSON.parse(configString);

        // Verificar si hay usuario y token
        if (!config.usuario || !config.token) {
          router.replace('/login');
          return;
        }

        const userId = config.usuario.id_usuario;
        if (!userId) {
          router.replace('/login');
          return;
        }

        // Hacer petición a la API
        const host = config.api_host || config.apihost || config.apiHost;
        const url = `${host.replace(/\/+$/, '')}/usuario/${userId}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 403) {
          Alert.alert('Sesión expirada', 'Por favor inicia sesión nuevamente');
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const userData = await response.json();
        setUserData(userData);

      } catch (error) {
        console.log('Error cargando datos del usuario:', error);
        if (error.message.includes('403')) {
          Alert.alert('Sesión expirada', 'Por favor inicia sesión nuevamente');
          router.replace('/login');
        } else {
          Alert.alert('Error', 'No se pudieron cargar los datos del usuario');
        }
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Validaciones para el cambio de contraseña
  const isPasswordValid = nuevaContrasenna.length >= 6;
  const doPasswordsMatch = nuevaContrasenna === confirmPassword && nuevaContrasenna !== '';
  const isChangePasswordEnabled = isPasswordValid && doPasswordsMatch && viejaContrasenna !== '';

  const handleChangePassword = async () => {
    if (!isChangePasswordEnabled) return;

    setChangingPassword(true);

    try {
      const configString = await AsyncStorage.getItem('@config');
      if (!configString) {
        router.replace('/login');
        return;
      }

      const config = JSON.parse(configString);
      
      // Verificar si hay usuario y token
      if (!config.usuario || !config.token) {
        router.replace('/login');
        return;
      }

      const host = config.api_host || config.apihost || config.apiHost;
      const url = `${host.replace(/\/+$/, '')}/usuario/changePassword`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          viejaContrasenna: viejaContrasenna,
          nuevaContrasenna: nuevaContrasenna
        }),
      });

      if (response.status === 403) {
        Alert.alert('Sesión expirada', 'Por favor inicia sesión nuevamente');
        router.replace('/login');
        return;
      }

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

      // Contraseña cambiada exitosamente
      Alert.alert(
        'Éxito', 
        'Tu contraseña ha sido cambiada correctamente',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Limpiar campos después del éxito
              setOldPassword('');
              setNewPassword('');
              setConfirmPassword('');
              // Ocultar contraseñas nuevamente
              setShowOldPassword(false);
              setShowNewPassword(false);
              setShowConfirmPassword(false);
            }
          }
        ]
      );

    } catch (error) {
      console.log('Error cambiando contraseña:', error);
      if (error.message.includes('Network request failed')) {
        Alert.alert('Error de conexión', 'No se pudo conectar al servidor');
      } else {
        Alert.alert('Error', 'Ocurrió un error al cambiar la contraseña');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleMenuNavigate = (link) => {
    router.push(`/${link}`);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <TopBar onMenuNavigate={handleMenuNavigate} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar onMenuNavigate={handleMenuNavigate} />

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <TouchableOpacity onPress={() => { router.replace('/'); }} style={styles.backButton}>
              <Image
                source={require('../assets/images/arrow-left.png')}
                style={{
                  width: 20,
                  height: 20,
                  tintColor: Colors.textPrimary,
                }}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <Text style={styles.title}>Perfil de Usuario</Text>

            {/* Información del usuario */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información Personal</Text>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Nombre:</Text>
                <Text style={styles.value}>{userData?.nombre_natural || 'No disponible'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Usuario:</Text>
                <Text style={styles.value}>{userData?.nombre_usuario || 'No disponible'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Salario diario:</Text>
                <Text style={styles.value}>
                  ${userData?.salario_diario?.toFixed(2) || '0.00'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Rol:</Text>
                <Text style={styles.value}>{userData?.rol || 'No disponible'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Estado:</Text>
                <View style={[
                  styles.statusIndicator,
                  userData?.activo ? styles.statusActive : styles.statusInactive
                ]}>
                  <Text style={styles.statusText}>
                    {userData?.activo ? 'Activo' : 'Desactivado'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Cambio de contraseña */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cambiar Contraseña</Text>

              {/* Campo contraseña actual con ojo */}
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Contraseña actual"
                  value={viejaContrasenna}
                  onChangeText={setOldPassword}
                  secureTextEntry={!showOldPassword}
                  editable={!changingPassword}
                  returnKeyType="next"
                />
                <TouchableOpacity 
                  style={styles.eyeButton}
                  onPress={() => setShowOldPassword(!showOldPassword)}
                  disabled={changingPassword}
                >
                  <Image
                    source={
                      showOldPassword 
                        ? require('../assets/images/eye-open.png')
                        : require('../assets/images/eye-closed.png')
                    }
                    style={styles.eyeIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>

              {/* Campo nueva contraseña con ojo */}
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Nueva contraseña (mínimo 6 caracteres)"
                  value={nuevaContrasenna}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  editable={!changingPassword}
                  returnKeyType="next"
                />
                <TouchableOpacity 
                  style={styles.eyeButton}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  disabled={changingPassword}
                >
                  <Image
                    source={
                      showNewPassword 
                        ? require('../assets/images/eye-open.png')
                        : require('../assets/images/eye-closed.png')
                    }
                    style={styles.eyeIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>

              {/* Campo confirmar contraseña con ojo */}
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirmar nueva contraseña"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  editable={!changingPassword}
                  returnKeyType="done"
                  onSubmitEditing={isChangePasswordEnabled ? handleChangePassword : undefined}
                />
                <TouchableOpacity 
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={changingPassword}
                >
                  <Image
                    source={
                      showConfirmPassword 
                        ? require('../assets/images/eye-open.png')
                        : require('../assets/images/eye-closed.png')
                    }
                    style={styles.eyeIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>

              {/* Mensajes de validación */}
              {nuevaContrasenna.length > 0 && nuevaContrasenna.length < 6 && (
                <Text style={styles.errorText}>La contraseña debe tener al menos 6 caracteres</Text>
              )}

              {confirmPassword.length > 0 && !doPasswordsMatch && (
                <Text style={styles.errorText}>Las contraseñas no coinciden</Text>
              )}

              <TouchableOpacity
                style={[
                  styles.changePasswordButton,
                  { opacity: isChangePasswordEnabled ? 1 : 0.6 }
                ]}
                disabled={!isChangePasswordEnabled || changingPassword}
                onPress={handleChangePassword}
              >
                {changingPassword ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.changePasswordButtonText}>Cambiar Contraseña</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  backButton: { 
    position: 'absolute', 
    left: 10, 
    top: 10, 
    padding: 8, 
    marginTop: 10,
    marginLeft: 20,
    backgroundColor: Colors.primarySuave,
    borderRadius: 8,
    zIndex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.m,
    fontSize: Typography.body,
    color: Colors.textSecondary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xl,
  },
  content: {
    flex: 1,
    paddingHorizontal: screenWidth * 0.05,
    paddingVertical: screenHeight * 0.02,
    minHeight: screenHeight * 0.8,
  },
  title: {
    fontSize: screenWidth * 0.07,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: screenHeight * 0.03,
    marginTop: screenHeight * 0.02,
  },
  section: {
    backgroundColor: Colors.primaryClaro,
    padding: Spacing.m,
    borderRadius: 12,
    marginBottom: screenHeight * 0.03,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionTitle: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primarySuave,
    paddingBottom: Spacing.s,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
    color: Colors.textSecondary,
    flex: 1,
  },
  value: {
    fontSize: screenWidth * 0.04,
    color: Colors.textSecondary,
    flex: 1,
    textAlign: 'right',
  },
  statusIndicator: {
    paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.xs,
    borderRadius: 15,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusActive: {
    backgroundColor: Colors.success,
  },
  statusInactive: {
    backgroundColor: Colors.error,
  },
  statusText: {
    color: 'white',
    fontSize: Typography.small,
    fontWeight: 'bold',
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: Spacing.m,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: Colors.primarySuave,
    borderRadius: 8,
    padding: Spacing.m,
    paddingRight: 50, // Espacio para el ojo
    fontSize: screenWidth * 0.04,
    backgroundColor: '#fff',
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
  changePasswordButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.m,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: Spacing.s,
  },
  changePasswordButtonText: {
    color: Colors.textPrimary,
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.small,
    marginBottom: Spacing.s,
    marginLeft: Spacing.xs,
  },
});