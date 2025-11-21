import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors } from '../variables';

export default function ConfigScreen() {
  // Prellenar con la IP de desarrollo solicitada. El usuario puede cambiar y guardar.
  const [apiHost, setApiHost] = useState('http://192.168.1.2');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const router = useRouter();

  // Cargar configuración al abrir la pantalla
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const configString = await AsyncStorage.getItem('@config');
      if (configString) {
        const config = JSON.parse(configString);
        if (config.api_host) {
          setApiHost(config.api_host);
          setHasExistingConfig(true); // ← Hay configuración existente
        }
      }
      // Si no hay configString o no tiene api_host, hasExistingConfig queda en false
    } catch (error) {
      console.log('Error cargando configuración:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.replace('/');
  };

  const handleSave = async () => {
    if (!apiHost || apiHost.trim() === '') return;
    setSaving(true);
    try {
      const config = { api_host: apiHost.trim() };
      await AsyncStorage.setItem('@config', JSON.stringify(config));
      Alert.alert('Configuración guardada', 'El host de la API se guardó correctamente.');
      // Volver a la pantalla principal
      router.replace('/');
    } catch (e) {
      console.log('Error guardando @config:', e);
      Alert.alert('Error', 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  // Mostrar loading mientras se carga la configuración
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.box}>
          <Text style={styles.title}>Cargando...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.box}>
        {/* Botón de retroceso - Solo visible si hay configuración existente */}
        {hasExistingConfig && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Image
              source={require('../assets/images/arrow-left.png')}
              style={styles.icon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}

        <Text style={styles.title}>
          {hasExistingConfig ? 'Configuración' : 'Configuración inicial'}
        </Text>
        
        <Text style={styles.label}>API Host</Text>
        <TextInput
          style={styles.input}
          placeholder="https://mi-api.com"
          value={apiHost}
          onChangeText={setApiHost}
          autoCapitalize="none"
          keyboardType="url"
          editable={!saving}
        />

        <TouchableOpacity
          style={[styles.button, { opacity: apiHost.trim() ? 1 : 0.6 }]}
          disabled={!apiHost.trim() || saving}
          onPress={handleSave}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Guardando...' : apiHost ? 'Actualizar' : 'Guardar'}
          </Text>
        </TouchableOpacity>

        {/* Mensaje informativo para primera configuración */}
        {!hasExistingConfig && (
          <Text style={styles.infoText}>
            Esta es la primera configuración. Debes establecer la URL de la API para continuar.
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 20,
  },
  box: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    elevation: 4,
    position: 'relative', // Necesario para el posicionamiento absoluto del botón
  },
  backButton: { 
    position: 'absolute', 
    left: 10, 
    top: 10, 
    padding: 8, 
    marginTop: 17,
    backgroundColor: Colors.primarySuave,
    borderRadius: 8,
    zIndex: 1, // Para que esté por encima de otros elementos
  },
  icon: {
    width: 20,
    height: 20,
    tintColor: Colors.textPrimary,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    marginTop: 10, // Espacio para el botón de retroceso
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});