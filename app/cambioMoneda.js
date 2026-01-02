import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ToastAndroid, Image, ScrollView, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography } from '../variables';

export default function CambioMonedaScreen() {
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [roundOption, setRoundOption] = useState('');
  const [isRedondeoFromPlus, setIsRedondeoFromPlus] = useState(false);
  const router = useRouter();

  const isEditable = !saving;

  const allRoundOptions = [
    'Normal',
    'Exeso 5',
    'Exeso 10',
    'Exeso 20',
    'Exeso 50'
  ];

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

        // Además cargar la opción de redondeo desde la API
        try {
          const rres = await fetch(`${host}/redondeo`, {
            method: 'GET',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          });
          const rdata = await rres.json();
          if (!mounted) return;
          if (rdata) {
            if (typeof rdata.value !== 'undefined') {
              setRoundOption(String(rdata.value));
            } else if (typeof rdata === 'string') {
              setRoundOption(rdata);
            }

            // Nuevo: leer isRedondeoFromPlus si viene en la respuesta
            if (typeof rdata.isRedondeoFromPlus !== 'undefined') {
              const v = rdata.isRedondeoFromPlus;
              const isPlus = v === true || v === 'true' || v === 1 || v === '1';
              setIsRedondeoFromPlus(Boolean(isPlus));
            }
          }
        } catch (e) {
          console.log('Error fetching /redondeo:', e);
          // No interrumpir la carga principal por fallo en redondeo
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
      const res = await fetch(`${host}/moneda/updateMoneda`, {
        method: 'PUT',
        body: JSON.stringify({"value": valueToSend}),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      
      if (!res.ok) {
        // Intentar leer body con detalle; si no es JSON, obtener texto
        let errMsg = 'Error al actualizar la moneda';
        try {
          const contentType = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : '';
          if (contentType.includes('application/json')) {
            const errData = await res.json();
            if (errData && (errData.error || errData.message)) {
              errMsg = errData.error || errData.message;
            }
          } else {
            const text = await res.text();
            if (text) errMsg = text;
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
      // Si el usuario seleccionó una opción de redondeo válida, actualizarla en la API
      if (roundOption && allRoundOptions.includes(roundOption)) {
        try {
          const body = {
            value: roundOption,
            isRedondeoFromPlus: String(isRedondeoFromPlus),
          };
          
          const rres = await fetch(`${host}/redondeo/updateRedondeo`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
          });

          if (!rres.ok) {
            let errMsg = 'Error al actualizar la opción de redondeo';
            try {
              const contentType = rres.headers && rres.headers.get ? (rres.headers.get('content-type') || '') : '';
              if (contentType.includes('application/json')) {
                const errData = await rres.json();
                if (errData && (errData.error || errData.message)) {
                  errMsg = errData.error || errData.message;
                }
              } else {
                const text = await rres.text();
                if (text) errMsg = text;
              }
            } catch (e) {
              console.log('Error parsing redondeo error body:', e);
            }
            Alert.alert('Error', errMsg);
          } else {
            try { ToastAndroid.show('Opción de redondeo actualizada', ToastAndroid.SHORT); } catch (e) {}
          }
        } catch (e) {
          console.log('Error updating redondeo:', e);
          Alert.alert('Error', 'No se pudo actualizar la opción de redondeo');
        }
      }
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

        <Text style={[styles.label, { marginTop: 6 }]}>Opción de Redondeo en ventas y consultas</Text>
        <View style={[styles.input, !isEditable && styles.disabledInput]}> 
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={styles.tiposRow}>
                {allRoundOptions.map((opt) => {
                  const selected = roundOption === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.tipoBox,
                        selected && styles.tipoBoxSelected,
                        !isEditable && styles.disabledTipo
                      ]}
                      onPress={() => {
                        if (!isEditable) return;
                        setRoundOption(opt);
                      }}
                    >
                      <Text style={[styles.tipoText, selected && styles.tipoTextSelected]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowInfo(!showInfo)}
              style={styles.infoButton}
            >
              <Image
                source={require('../assets/images/information.png')}
                style={styles.infoIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 }}>
          <Text style={[styles.label, { marginBottom: 0 }]}>Aplicar exedente al plus del usuario</Text>
          <Switch
            value={isRedondeoFromPlus}
            onValueChange={(val) => setIsRedondeoFromPlus(val)}
            disabled={!isEditable}
          />
        </View>

        {showInfo && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Seleccione cómo desea que se redondea los importes en ventas y consultas. 
              Ejemplo: "Normal" redondea 1.20→1.00. "Exeso 5" o superiores; redondea por 
              exeso al número natural inmediato más cercano divisible por el exeso. 
              Ejemplo para "Exeso 5": 13.03→15.00, 101.56→100.00, 14.12→15.00. 
              El exedente del redondeo está destinado al plus del usuario que realize 
              la venta si es que el redondeo es mayor a la suma total original de la venta.
            </Text>
          </View>
        )}

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
  tiposRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
  },
  tipoBox: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primarySuave,
    backgroundColor: '#fff',
    minWidth: 120,
    alignItems: 'center',
    marginRight: 8,
  },
  tipoBoxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tipoText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  tipoTextSelected: {
    color: Colors.textPrimary,
  },
  disabledTipo: {
    opacity: 0.6,
  },
  infoButton: {
    padding: 6,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: Colors.primarySuave,
  },
  infoIcon: {
    width: 24,
    height: 24,
  },
  infoBox: {
    backgroundColor: Colors.primaryClaro,
    borderRadius: 8,
    padding: Spacing.m,
    marginTop: Spacing.s,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
