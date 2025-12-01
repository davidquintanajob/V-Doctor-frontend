import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ToastAndroid, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors } from '../variables';

export default function CambioMonedaScreen() {
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const fetchMoneda = async () => {
      try {
        const raw = await AsyncStorage.getItem('@config');
        if (!raw) {
          Alert.alert('Error', 'No se encontró configuración de la API');
          router.replace('/config');
          return;
        }
        const config = JSON.parse(raw);
        const host = config.api_host || config.apihost || config.apiHost;
        const token = config.token;
        if (!host) {
          Alert.alert('Error', 'La configuración de la API no es válida');
          router.replace('/config');
          return;
        }

        const res = await fetch(`${host}/moneda`, {
          method: 'GET',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!mounted) return;
        if (data && typeof data.value !== 'undefined') {
          setValor(String(data.value));
        } else {
          // Si la respuesta no trae value, dejar vacío
          setValor('');
        }
      } catch (e) {
        console.log('Error fetching /moneda:', e);
        Alert.alert('Error', 'No se pudo obtener el valor de la moneda desde el servidor');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMoneda();
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    if (!valor || String(valor).trim() === '') return Alert.alert('Error', 'Introduce un valor válido');
    setSaving(true);
    try {
      const raw = await AsyncStorage.getItem('@config');
      if (!raw) {
        Alert.alert('Error', 'No se encontró configuración de la API');
        router.replace('/config');
        return;
      }
      const config = JSON.parse(raw);
      const host = config.api_host || config.apihost || config.apiHost;
      const token = config.token;
      if (!host) {
        Alert.alert('Error', 'La configuración de la API no es válida');
        router.replace('/config');
        return;
      }

      const valueToSend = encodeURIComponent(String(valor).trim());
      const res = await fetch(`${host}/moneda/updateMoneda/${valueToSend}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        // Intentar leer body con detalle
        let errMsg = 'Error al actualizar la moneda';
        try {
          const errData = await res.json();
          if (errData && (errData.error || errData.message)) {
            errMsg = errData.error || errData.message;
          }
        } catch (e) {
          console.log('Error parsing error body:', e);
        }
        Alert.alert('Error', errMsg);
        return;
      }

      // Éxito - guardar en AsyncStorage @CambioMoneda
      await AsyncStorage.setItem('@CambioMoneda', String(valor).trim());
      // Mostrar toast informativo (Android). En iOS, también aceptable dejar sin toast.
      try { ToastAndroid.show('Cambio de moneda actualizado', ToastAndroid.SHORT); } catch (e) { }
    } catch (e) {
      console.log('Error updating moneda:', e);
      Alert.alert('Error', 'No se pudo comunicarse con el servicio para actualizar la moneda');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.box}>
          <Text style={styles.title}>Cargando valor de moneda...</Text>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.box}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
          <Image source={require('../assets/images/arrow-left.png')} style={styles.icon} resizeMode="contain" />
        </TouchableOpacity>

        <Text style={styles.title}>Cambio USD - CUP</Text>

        <Text style={styles.label}>Valor</Text>
        <TextInput
          style={styles.input}
          placeholder="500"
          value={valor}
          onChangeText={setValor}
          keyboardType="numeric"
          editable={!saving}
        />

        <TouchableOpacity
          style={[styles.button, { opacity: valor.trim() ? 1 : 0.6 }]}
          disabled={!valor.trim() || saving}
          onPress={handleSave}
        >
          <Text style={styles.buttonText}>{saving ? 'Guardando...' : 'Guardar cambio'}</Text>
        </TouchableOpacity>

        <Text style={styles.infoText}>Al guardar, el valor se actualizará en el servidor y se almacenará localmente.</Text>
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
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 10,
    top: 10,
    padding: 8,
    marginTop: 17,
    backgroundColor: Colors.primarySuave,
    borderRadius: 8,
    zIndex: 1,
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
    marginTop: 10,
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
