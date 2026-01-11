import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ToastAndroid, Image, ScrollView, Switch, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography } from '../variables';

export default function CambioMonedaScreen() {
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [originalValor, setOriginalValor] = useState('');
  const [showCambioModal, setShowCambioModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedCambio, setSelectedCambio] = useState('');
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [confirmDisabled, setConfirmDisabled] = useState(true);
  const [modalShowInfo, setModalShowInfo] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const timerRef = useRef(null);
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
          const v = String(data.value);
          setValor(v);
          setOriginalValor(v);
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
      const valueTrimmed = String(valor).trim();

      // Si el valor original cargado es distinto al nuevo, mostrar modal de opciones
      if (originalValor !== '' && originalValor !== valueTrimmed) {
        setPendingUpdate({ host, token, value: valueTrimmed });
        setShowCambioModal(true);
        return;
      }

      // Si no cambió el valor, proceder como antes (sin cambio de costos productos)
      const valueToSend = encodeURIComponent(valueTrimmed);
      const basicBody = { value: valueToSend };
      await performMonedaUpdate(basicBody, host, token);
    } catch (e) {
      console.log('Error updating moneda:', e);
      Alert.alert('Error', 'No se pudo comunicarse con el servicio para actualizar la moneda');
    } finally {
      setSaving(false);
    }
  };

  // Helper: realiza la petición a /moneda/updateMoneda y mantiene la lógica de redondeo
  const performMonedaUpdate = async (body, host, token) => {
    setSaving(true);
    try {
      const res = await fetch(`${host}/moneda/updateMoneda`, {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
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

      // Éxito - guardar en AsyncStorage @CambioMoneda (guardar valor decodificado si viene codificado)
      try {
        let toStore = body.value;
        try { toStore = decodeURIComponent(String(body.value)); } catch (e) { toStore = String(body.value); }
        await AsyncStorage.setItem('@CambioMoneda', String(toStore).trim());
      } catch (e) {
        // Si falla, guardar como viene
        await AsyncStorage.setItem('@CambioMoneda', String(body.value).trim());
      }
      try { ToastAndroid.show('Cambio de moneda actualizado', ToastAndroid.SHORT); } catch (e) { }

      // Actualizar redondeo si aplica (misma lógica que antes)
      if (roundOption && allRoundOptions.includes(roundOption)) {
        try {
          const rbody = {
            value: roundOption,
            isRedondeoFromPlus: String(isRedondeoFromPlus),
          };

          const rres = await fetch(`${host}/redondeo/updateRedondeo`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(rbody),
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
            try { ToastAndroid.show('Opción de redondeo actualizada', ToastAndroid.SHORT); } catch (e) { }
          }
        } catch (e) {
          console.log('Error updating redondeo:', e);
          Alert.alert('Error', 'No se pudo actualizar la opción de redondeo');
        }
      }
    } catch (e) {
      console.log('Error performing moneda update:', e);
      Alert.alert('Error', 'No se pudo comunicarse con el servicio para actualizar la moneda');
    } finally {
      setSaving(false);
    }
  };

  // Cuando se monte/desmonte, limpiar timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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

        {/* Modal: elegir CUP / USD / No Gracias */}
        <Modal visible={showCambioModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                onPress={() => setModalShowInfo(!modalShowInfo)}
                style={[styles.infoButton, { alignSelf: 'flex-end', marginBottom: 10 }]}
              >
                <Image
                  source={require('../assets/images/information.png')}
                  style={styles.infoIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              {modalShowInfo && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    Al seleccionar CUP o USD, los costos de TODOS los productos serán recalculados según el nuevo tipo de cambio.{'\n\n'}
                    Si se selecciona CUP, se modificará el costo CUP según el costo actual en USD ((costo USD) * (nuevo cambio)) de cada producto.{'\n\n'}
                    Si se selecciona USD, se modificará el costo USD según el costo actual en CUP ((costo CUP) / (nuevo cambio)) de cada producto.
                  </Text>
                </View>
              )}

              <Text style={styles.modalTitle}>¿Desea modificar el costo en CUP o USD de todos los productos en el sistema?</Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                <TouchableOpacity
                  style={styles.modalButtonOutline}
                  onPress={() => {
                    setSelectedCambio('CUP');
                    setShowCambioModal(false);
                    setShowConfirmModal(true);
                    setConfirmDisabled(true);
                    setCountdownSeconds(5);
                    if (timerRef.current) clearInterval(timerRef.current);
                    timerRef.current = setInterval(() => {
                      setCountdownSeconds((s) => {
                        if (s <= 1) {
                          if (timerRef.current) clearInterval(timerRef.current);
                          timerRef.current = null;
                          setConfirmDisabled(false);
                          return 0;
                        }
                        return s - 1;
                      });
                    }, 1000);
                  }}
                >
                  <Text style={styles.modalOutlineText}>CUP</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalButtonOutline}
                  onPress={() => {
                    setSelectedCambio('USD');
                    setShowCambioModal(false);
                    setShowConfirmModal(true);
                    setConfirmDisabled(true);
                    setCountdownSeconds(5);
                    if (timerRef.current) clearInterval(timerRef.current);
                    timerRef.current = setInterval(() => {
                      setCountdownSeconds((s) => {
                        if (s <= 1) {
                          if (timerRef.current) clearInterval(timerRef.current);
                          timerRef.current = null;
                          setConfirmDisabled(false);
                          return 0;
                        }
                        return s - 1;
                      });
                    }, 1000);
                  }}
                >
                  <Text style={styles.modalOutlineText}>USD</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={async () => {
                    setShowCambioModal(false);
                    if (pendingUpdate) {
                      const valueToSend = encodeURIComponent(String(pendingUpdate.value).trim());
                      await performMonedaUpdate({ value: valueToSend }, pendingUpdate.host, pendingUpdate.token);
                      setPendingUpdate(null);
                    }
                  }}
                >
                  <Text>No Gracias</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: confirmación con temporizador */}
        <Modal visible={showConfirmModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>¿Está seguro que desea cambiar el costo de {selectedCambio} por el nuevo valor?</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                <TouchableOpacity
                  style={confirmDisabled ? styles.modalButtonNoBg : styles.modalButton}
                  onPress={async () => {
                    if (confirmDisabled) return;
                    if (pendingUpdate) {
                      const valueToSend = encodeURIComponent(String(pendingUpdate.value).trim());
                      const body = {
                        value: valueToSend,
                        config: {
                          isCambioCostosProductos: true,
                          tipo: selectedCambio === 'CUP' ? 'cambiar cup' : 'cambiar usd',
                        },
                      };
                      await performMonedaUpdate(body, pendingUpdate.host, pendingUpdate.token);
                      setPendingUpdate(null);
                    }
                    setShowConfirmModal(false);
                    setSelectedCambio('');
                  }}
                  disabled={confirmDisabled}
                >
                  <Text style={confirmDisabled ? { color: '#999', fontSize: 16 } : { fontSize: 16 }}>{confirmDisabled ? String(countdownSeconds) : 'Sí'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => {
                    if (timerRef.current) clearTimeout(timerRef.current);
                    setShowConfirmModal(false);
                    setSelectedCambio('');
                    setPendingUpdate(null);
                  }}
                >
                  <Text>No</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 12, color: '#666', marginTop: 8 }}>{confirmDisabled ? 'Espere 5 segundos para confirmar...' : 'Puede confirmar ahora.'}</Text>
            </View>
          </View>
        </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    minWidth: '80%'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.primarySuave,
    alignItems: 'center',
    marginHorizontal: 6,
    minWidth: 80,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonOutline: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    marginHorizontal: 6,
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#000',
  },
  modalOutlineText: {
    color: '#000',
    fontWeight: '600',
  },
  modalButtonNoBg: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    marginHorizontal: 6,
    minWidth: 80,
  },
});
