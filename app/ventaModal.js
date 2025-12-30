import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Image,
  Platform,
  ToastAndroid,
  Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import DropdownGenerico from '../components/DropdownGenerico';
import ApiAutocomplete from '../components/ApiAutocomplete';
import TopBar from '../components/TopBar';
import UsuariosLista from '../components/UsuariosLista';
import { Colors, Spacing, Typography } from '../variables';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function VentaModalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const mode = params.mode || 'ver'; // 'ver' | 'crear' | 'editar'
  const ventaParam = params.venta ? JSON.parse(params.venta) : null;

  const [ventaData, setVentaData] = useState(() => ({
    id: ventaParam?.id_venta || ventaParam?.id || null,
    fecha: ventaParam?.fecha || new Date().toISOString().split('T')[0],
    cantidad: ventaParam?.cantidad ? String(ventaParam.cantidad) : '1',
    precio_cobrado_cup: ventaParam?.precio_cobrado_cup ? String(ventaParam.precio_cobrado_cup) : '',
    precio_original_comerciable_cup: ventaParam?.precio_original_comerciable_cup ? String(ventaParam.precio_original_comerciable_cup) : '',
    precio_original_comerciable_usd: ventaParam?.precio_original_comerciable_usd ? String(ventaParam.precio_original_comerciable_usd) : '',
    forma_pago: ventaParam?.forma_pago || '',
    tipo_comerciable: ventaParam?.tipo_comerciable || '',
    comerciable_display: (ventaParam?.comerciable?.producto?.nombre) || (ventaParam?.comerciable?.servicio?.descripcion) || '',
    comerciable_id: ventaParam?.comerciable?.id_comerciable || ventaParam?.comerciable?.id || null,
    nombre_cliente: ventaParam?.nombre_cliente || '',
    nombre_usuario: ventaParam?.nombre_usuario || '',
    nota: ventaParam?.nota || ''
  }));

  const [showDatePicker, setShowDatePicker] = useState(false);
  const isEditable = mode !== 'ver';
  const [comerciableBusqueda, setComercialeBusqueda] = useState('');
  const [selectedComerciable, setSelectedComerciable] = useState(null);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [usuariosPreseleccionados, setUsuariosPreseleccionados] = useState([]);

  const formaPagoOptions = [
    { id: 1, nombre: 'Efectivo' },
    { id: 2, nombre: 'Transferencia' }
  ];

  const tipoComerciableOptions = [
    { id: 1, nombre: 'producto' },
    { id: 2, nombre: 'medicamento' },
    { id: 3, nombre: 'servicio' },
    { id: 4, nombre: 'servicio complejo' }
  ];

  useEffect(() => {
    // keep local state in sync if params change
    if (ventaParam) {
      setVentaData(prev => ({
        ...prev, ...{
          id: ventaParam?.id_venta || ventaParam?.id || prev.id,
          fecha: ventaParam?.fecha || prev.fecha,
          cantidad: ventaParam?.cantidad ? String(ventaParam.cantidad) : prev.cantidad,
          precio_cobrado_cup: ventaParam?.precio_cobrado_cup ? String(ventaParam.precio_cobrado_cup) : prev.precio_cobrado_cup,
          precio_original_comerciable_cup: ventaParam?.precio_original_comerciable_cup ? String(ventaParam?.precio_original_comerciable_cup) : prev.precio_original_comerciable_cup,
          precio_original_comerciable_usd: ventaParam?.precio_original_comerciable_usd ? String(ventaParam?.precio_original_comerciable_usd) : prev.precio_original_comerciable_usd,
          forma_pago: ventaParam?.forma_pago || prev.forma_pago,
          tipo_comerciable: ventaParam?.tipo_comerciable || prev.tipo_comerciable,
          comerciable_display: (ventaParam?.comerciable?.producto?.nombre) || (ventaParam?.comerciable?.servicio?.descripcion) || prev.comerciable_display,
          comerciable_id: ventaParam?.comerciable?.id_comerciable || ventaParam?.comerciable?.id || prev.comerciable_id,
          nombre_cliente: ventaParam?.nombre_cliente || prev.nombre_cliente,
          nombre_usuario: ventaParam?.nombre_usuario || prev.nombre_usuario,
          nota: ventaParam?.nota || prev.nota
        }
      }));
    }
  }, [params.venta]);

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const raw = await AsyncStorage.getItem('@config');
        if (!raw) return;
        const cfg = JSON.parse(raw);
        const host = cfg.api_host || cfg.apihost || cfg.apiHost;
        const token = cfg.token;
        if (!host) return;
        setUsuariosLoading(true);
        const url = `${host.replace(/\/+$/, '')}/usuario`;
        const res = await fetch(url, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch (e) { json = null; }
        if (!json) { setUsuariosDisponibles([]); setUsuariosPreseleccionados([]); setUsuariosLoading(false); return; }
        setUsuariosDisponibles(json);
        if (ventaParam?.nombre_usuario) {
          const found = json.find(u => (u.nombre_natural || u.nombre) === ventaParam.nombre_usuario || u.id_usuario === ventaParam?.id_usuario || u.id === ventaParam?.id);
          if (found) setUsuariosPreseleccionados([found]);
        }
      } catch (err) {
        setUsuariosDisponibles([]);
        setUsuariosPreseleccionados([]);
      } finally {
        setUsuariosLoading(false);
      }
    };

    fetchUsuarios();
  }, []);

  const handleChange = (field, value) => setVentaData(prev => ({ ...prev, [field]: value }));

  const computeRemaining = () => {
    const exist = selectedComerciable?.producto?.cantidad ?? selectedComerciable?.cantidad ?? ventaParam?.comerciable?.producto?.cantidad ?? ventaParam?.comerciable?.cantidad ?? 0;
    const qty = parseFloat(ventaData.cantidad || '0') || 0;
    const rem = Number(exist) - qty;
    return isNaN(rem) ? 0 : rem;
  };

  const parseFechaToDate = (fecha) => {
    if (!fecha) return new Date();
    const m = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(fecha);
  };

  const parseError = (status, responseData) => {
    let errorMessage = 'Error desconocido';
    if (responseData && responseData.errors && Array.isArray(responseData.errors)) {
      errorMessage = responseData.errors.join('\n• ');
    } else if (responseData && typeof responseData.error === 'string') {
      errorMessage = responseData.error;
    } else if (responseData && (responseData.message || responseData.description)) {
      errorMessage = responseData.message || responseData.description;
    } else if (responseData) {
      errorMessage = JSON.stringify(responseData);
    }
    return `Error ${status}\n${errorMessage}`;
  };

  const handleSave = async () => {
    try {
      const raw = await AsyncStorage.getItem('@config');
      if (!raw) { Alert.alert('Error', 'No se encontró configuración'); return; }
      const config = JSON.parse(raw);
      const host = config.api_host || config.apihost || config.apiHost;
      const token = config.token;
      if (!host) { Alert.alert('Error', 'No se encontró host en la configuración'); return; }

      const payload = {
        fecha: ventaData.fecha,
        cantidad: Number(ventaData.cantidad) || 0,
        precio_cobrado_cup: ventaData.precio_cobrado_cup ? Number(ventaData.precio_cobrado_cup) : null,
        precio_original_comerciable_cup: ventaData.precio_original_comerciable_cup ? Number(ventaData.precio_original_comerciable_cup) : null,
        precio_original_comerciable_usd: ventaData.precio_original_comerciable_usd ? Number(ventaData.precio_original_comerciable_usd) : null,
        forma_pago: ventaData.forma_pago,
        tipo_comerciable: ventaData.tipo_comerciable,
        comerciable_id: ventaData.comerciable_id,
        nombre_cliente: ventaData.nombre_cliente,
        nombre_usuario: ventaData.nombre_usuario,
        nota: ventaData.nota
      };

      let url = '';
      let method = 'POST';
      if (mode === 'crear') {
        url = `${host.replace(/\/+$/, '')}/venta/CreateVenta`;
        method = 'POST';
      } else if (mode === 'editar') {
        if (!ventaData.id) { Alert.alert('Error', 'ID de venta inválido'); return; }
        url = `${host.replace(/\/+$/, '')}/venta/UpdateVenta/${ventaData.id}`;
        method = 'PUT';
      } else {
        // view mode - nothing to do
        return router.back();
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      let responseData = null;
      try { responseData = await res.json(); } catch (e) { responseData = null; }

      if (res.status === 403) { Alert.alert('Sesión expirada'); router.replace('/login'); return; }

      if (!res.ok) {
        Alert.alert('Error', parseError(res.status, responseData));
        return;
      }

      ToastAndroid.show(mode === 'crear' ? '✅ Venta creada' : '✅ Venta actualizada', ToastAndroid.LONG);
      router.back();
    } catch (error) {
      Alert.alert('Error de conexión', 'No se pudo conectar con el servidor');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Image
              source={require('../assets/images/arrow-left.png')}
              style={styles.icon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.title}>{mode === 'ver' ? 'Ver Venta' : mode === 'editar' ? 'Editar Venta' : 'Crear Venta'}</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.section}>
          <View style={styles.field}>
            <Text style={styles.label}>Comerciable</Text>
            <ApiAutocomplete
              endpoint="/comerciable/filter/5/1"
              body={{ nombre: comerciableBusqueda, isProducto: true }}
              displayFormat={(item) => `${item.producto?.nombre || item.nombre || ''} - ${item.producto?.categoria || item.categoria || ''}`}
              onItemSelect={(item) => {
                  setSelectedComerciable(item);
                  setComercialeBusqueda('');
                  if (!item) {
                    // limpieza cuando se deselecciona
                    handleChange('comerciable_display', '');
                    handleChange('comerciable_id', null);
                    handleChange('precio_original_comerciable_cup', '');
                    handleChange('precio_original_comerciable_usd', '');
                    handleChange('precio_cobrado_cup', '');
                    return;
                  }
                  const display = item.producto?.nombre || item.servicio?.descripcion || item.nombre || '';
                  handleChange('comerciable_display', display);
                  handleChange('comerciable_id', item.id_comerciable || item.id || null);
                  handleChange('precio_original_comerciable_cup', item.precio_cup != null ? String(item.precio_cup) : (item.producto?.costo_cup ? String(item.producto.costo_cup) : ''));
                  handleChange('precio_original_comerciable_usd', item.precio_usd != null ? String(item.precio_usd) : (item.producto?.costo_usd ? String(item.producto.costo_usd) : ''));
                  // Autocompletar precio cobrado con el precio por defecto del comerciable
                  handleChange('precio_cobrado_cup', item.precio_cup != null ? String(item.precio_cup) : (item.producto?.costo_cup ? String(item.producto.costo_cup) : ''));
                }}
              placeholder="Buscar producto o medicamento..."
              delay={300}
              initialValue={selectedComerciable}
            />
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.label}>Precio original</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.infoText}>{`CUP: ${ventaData.precio_original_comerciable_cup || '-'}  •  USD: ${ventaData.precio_original_comerciable_usd || '-'}`}</Text>
              <Text style={styles.infoText}>{`Cant despues de la venta: ${computeRemaining()}`}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1, marginRight: Spacing.s }]}>
              <Text style={styles.label}>Cantidad</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={ventaData.cantidad} onChangeText={(t) => handleChange('cantidad', t)} editable={isEditable} />
            </View>

            <View style={[styles.field, { flex: 1 }, styles.rowBetween] }>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Precio cobrado (CUP)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={ventaData.precio_cobrado_cup} onChangeText={(t) => handleChange('precio_cobrado_cup', t)} editable={isEditable} />
              </View>
            </View>
          </View>

          <View style={styles.infoBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.infoText}>
                {`Total a cobrar: ${(() => {
                  const price = parseFloat(ventaData.precio_cobrado_cup || '0') || 0;
                  const qty = parseFloat(ventaData.cantidad || '0') || 0;
                  const total = price * qty;
                  return isNaN(total) ? '0.00' : total.toFixed(2);
                })()}`}
              </Text>

              <Text style={styles.infoText}>
                {`Plus: ${(() => {
                  const price = parseFloat(ventaData.precio_cobrado_cup || '0') || 0;
                  const qty = parseFloat(ventaData.cantidad || '0') || 0;
                  const original = parseFloat(ventaData.precio_original_comerciable_cup || '0') || 0;
                  const plusVal = (price * qty) - (original * qty);
                  const plus = isNaN(plusVal) ? 0 : Math.max(0, plusVal);
                  return plus.toFixed(2);
                })()}`}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1, marginRight: Spacing.s }]}>
              <Text style={styles.label}>Fecha</Text>
              <TouchableOpacity style={styles.input} onPress={() => isEditable && setShowDatePicker(true)}>
                <Text style={styles.inputText}>{ventaData.fecha ? parseFechaToDate(ventaData.fecha).toLocaleDateString() : ''}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={ventaData.fecha ? parseFechaToDate(ventaData.fecha) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => { setShowDatePicker(Platform.OS === 'ios'); if (d) handleChange('fecha', d.toISOString().split('T')[0]); }}
                />
              )}
            </View>

            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Tipo comerciable</Text>
              <DropdownGenerico data={tipoComerciableOptions} value={tipoComerciableOptions.find(x => x.nombre === ventaData.tipo_comerciable) || null} onValueChange={(v) => handleChange('tipo_comerciable', v?.nombre || '')} placeholder="Seleccionar" displayKey="nombre" searchKey="nombre" searchable={false} requiresSelection={false} disabled={!isEditable} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1, marginRight: Spacing.s }]}>
              <Text style={styles.label}>Forma de pago</Text>
              <DropdownGenerico data={formaPagoOptions} value={formaPagoOptions.find(x => x.nombre === ventaData.forma_pago) || null} onValueChange={(v) => handleChange('forma_pago', v?.nombre || '')} placeholder="Seleccionar" displayKey="nombre" searchKey="nombre" searchable={false} requiresSelection={false} disabled={!isEditable} />
            </View>

            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Cliente</Text>
              <TextInput style={styles.input} value={ventaData.nombre_cliente} onChangeText={(t) => handleChange('nombre_cliente', t)} editable={isEditable} placeholder="Nombre cliente" />
            </View>
          </View>

          <View style={styles.field}>
            <UsuariosLista
              data={usuariosDisponibles}
              initialSelected={usuariosPreseleccionados}
              isEditable={isEditable}
              onChange={(p) => {
                const items = p?.items || [];
                const first = items.length > 0 ? (items[0].nombre_natural || items[0].nombre || '') : '';
                handleChange('nombre_usuario', first);
              }}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nota</Text>
            <TextInput style={[styles.input, { minHeight: 80 }]} value={ventaData.nota} onChangeText={(t) => handleChange('nota', t)} editable={isEditable} multiline placeholder="Nota opcional" />
          </View>
        </View>

        {isEditable && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>{mode === 'crear' ? 'Crear Venta' : 'Guardar cambios'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => router.back()} style={[styles.saveButton, { backgroundColor: Colors.primaryClaro, marginTop: Spacing.s }]}>
          <Text style={[styles.saveButtonText, { color: Colors.textSecondary }]}>Cerrar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: Spacing.m,
    paddingBottom: Spacing.page,
  },
  section: {
    backgroundColor: '#fff',
    padding: Spacing.m,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: Spacing.m,
  },
  infoBox: {
    backgroundColor: '#f0f8ff',
    padding: Spacing.m,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.boton_azul,
    marginBottom: Spacing.m,
  },
  infoText: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.m,
  },
  title: {
    fontSize: Typography.h3,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: Spacing.m,
    textAlign: 'center'
  },
  field: { marginBottom: Spacing.m },
  label: {
    fontSize: Typography.body,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    paddingHorizontal: Spacing.m,
    paddingVertical: 12,
    fontSize: Typography.body,
    color: Colors.textSecondary,
    minHeight: 44
  },
  inputText: { color: Colors.textSecondary },
  row: { flexDirection: 'row', gap: Spacing.s },
  saveButton: {
    backgroundColor: Colors.boton_azul,
    paddingVertical: Spacing.m,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: Spacing.s,
    borderWidth: 1,
    borderColor: '#000',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: Typography.body,
    fontWeight: '700',
  },
  backButton: {
    backgroundColor: Colors.primarySuave,
    padding: Spacing.s,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000',
  },
  icon: {
    width: 20,
    height: 20,
    tintColor: Colors.textPrimary,
  },
});
