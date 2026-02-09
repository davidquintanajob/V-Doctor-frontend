import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ToastAndroid,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TopBar from '../components/TopBar';
import { Colors, Spacing, Typography } from '../variables';
import eventBus from '../utils/eventBus';
import DataTable from '../components/DataTable';

export default function ServicioComplejoModalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mode = params.mode; // 'ver' | 'editar' | 'crear'
  const rawServicioComplejoParam = params.servicioComplejo ? JSON.parse(params.servicioComplejo) : null;
  // Aceptar tanto la forma antigua (objeto) como la nueva respuesta { data: [...] }
  const servicioComplejoParam = rawServicioComplejoParam?.data && Array.isArray(rawServicioComplejoParam.data)
    ? rawServicioComplejoParam.data[0]
    : rawServicioComplejoParam;

  // Obtener el servicio base desde el parámetro
  const servicioBase = servicioComplejoParam?.servicio || {};

  // Definir los tipos de servicios complejos disponibles
  const allTiposServicios = ["Estética y baño", "Operación", "Dental", "Otros"];

  // Definir los roles disponibles (igual que en `servicioModal`)
  const allRoles = ['Administrador', 'Médico', 'Técnico', 'Estilista'];

  // Estado para los datos del servicio complejo
  const [servicioComplejoData, setServicioComplejoData] = useState({
    tipo_servicio: servicioComplejoParam?.tipo_servicio || '',
    descripcion: servicioBase?.descripcion || '',
    precio_usd: servicioBase?.comerciable?.precio_usd ? String(servicioBase.comerciable.precio_usd) : '',
    precio_cup: servicioBase?.comerciable?.precio_cup ? String(servicioBase.comerciable.precio_cup) : ''
  });

  // Estado para los roles seleccionados (autorizados)
  const [rolesSelected, setRolesSelected] = useState([]);

  const [cambioMoneda, setCambioMoneda] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ventasPage, setVentasPage] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const itemsPerPage = 10;

  const ventasList = servicioBase?.comerciable?.venta || [];
  const isEditable = mode !== 'ver';

  useEffect(() => {
    const init = async () => {
      // Obtener configuración y determinar si es admin
      const configRaw = await AsyncStorage.getItem('@config');
      if (configRaw) {
        try {
          const cfg = JSON.parse(configRaw);
          // Determine if current user is Administrator
          try {
            const user = cfg.usuario || cfg.user || {};
            setIsAdmin((user && user.rol && String(user.rol) === 'Administrador'));
          } catch (e) {
            setIsAdmin(false);
          }
        } catch (e) {
          setIsAdmin(false);
        }
      }

      // Cargar cambio de moneda
      const cm = await AsyncStorage.getItem('@CambioMoneda');
      setCambioMoneda(cm ? Number(cm) : null);

      // Inicializar roles seleccionados desde los datos del servicio (si vienen)
      if (servicioBase?.comerciable?.roles_autorizados) {
        const rolesStr = servicioBase.comerciable.roles_autorizados;
        const parsed = String(rolesStr).split(',').map(s => s.trim()).filter(s => s.length > 0);
        // Filtrar solo roles conocidos
        setRolesSelected(parsed.filter(r => allRoles.includes(r)));
      }
    };
    init();
  }, []);

  const parseNumber = (s) => {
    const n = Number(String(s).replace(/[^0-9.-]+/g, ''));
    return Number.isNaN(n) ? 0 : n;
  };

  const handlePrecioUSDChange = (t) => {
    setServicioComplejoData((s) => ({ ...s, precio_usd: t }));
    if (cambioMoneda) {
      const usd = parseNumber(t);
      setServicioComplejoData((s) => ({
        ...s,
        precio_cup: (Math.round((usd * cambioMoneda + Number.EPSILON) * 100) / 100).toString()
      }));
    }
  };

  const handlePrecioCUPChange = (t) => {
    setServicioComplejoData((s) => ({ ...s, precio_cup: t }));
    if (cambioMoneda) {
      const cup = parseNumber(t);
      setServicioComplejoData((s) => ({
        ...s,
        precio_usd: (Math.round((cup / cambioMoneda + Number.EPSILON) * 100) / 100).toString()
      }));
    }
  };

  const handleBack = () => router.back();

  const handleSave = async () => {
    setIsSaving(true);
    if (!servicioComplejoData.tipo_servicio) {
      setIsSaving(false);
      Alert.alert('Validación', 'Tipo de servicio es requerido');
      return;
    }
    if (!servicioComplejoData.descripcion) {
      setIsSaving(false);
      Alert.alert('Validación', 'Descripción es requerida');
      return;
    }
    if (!servicioComplejoData.precio_usd && !servicioComplejoData.precio_cup) {
      setIsSaving(false);
      Alert.alert('Validación', 'Precio es requerido');
      return;
    }
    if (rolesSelected.length === 0) {
      setIsSaving(false);
      Alert.alert('Validación', 'Se debe elegir al menos un rol autorizado');
      return;
    }

    try {
      const configRaw = await AsyncStorage.getItem('@config');
      const cfg = configRaw ? JSON.parse(configRaw) : {};
      const token = cfg.token || '';
      const host = cfg.api_host || cfg.apihost || cfg.apiHost || '';

      const body = {
        precio_usd: parseNumber(servicioComplejoData.precio_usd),
        precio_cup: parseNumber(servicioComplejoData.precio_cup),
        roles_autorizados: rolesSelected.join(', '),
        descripcion: servicioComplejoData.descripcion,
        tipo_servicio: servicioComplejoData.tipo_servicio
      };

      const base = (host || '').replace(/\/+$/, '');
      let url;
      let method = 'POST';
      if (mode === 'editar') {
        const id = servicioComplejoParam?.id_comerciable || servicioComplejoParam?.id;
        if (!id) {
          Alert.alert('Error', 'No se pudo identificar el servicio complejo a actualizar');
          return;
        }
        url = `${base}/servicioComplejo/update/${id}`;
        method = 'PUT';
      } else {
        url = `${base}/servicioComplejo/create`;
        method = 'POST';
      }

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body)
      });

      if (res.status === 403) {
        router.replace('/login');
        return;
      }

      const responseData = await res.json().catch(() => null);
      if (!res.ok) {
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
        Alert.alert(`Error ${res.status}`, errorMessage);
        return;
      }

      if (Platform.OS === 'android') {
        ToastAndroid.show('Guardado', ToastAndroid.SHORT);
      } else {
        Alert.alert('OK', 'Guardado');
      }

      eventBus.emit('refreshServiciosComplejos');
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo guardar');
    } finally {
      setIsSaving(false);
    }
  };

  // Columnas para la tabla de ventas (visual only)
  const ventasColumns = [
    { key: 'fecha', label: 'Fecha', width: 140, cellRenderer: (v) => <Text style={styles.cellText}>{v ? (new Date(v)).toLocaleDateString() : 'N/A'}</Text> },
    { key: 'cantidad', label: 'Cantidad', width: 100, cellRenderer: (v) => <Text style={styles.cellText}>{v ?? '0'}</Text> },
    { key: 'precio_original_comerciable_cup', label: 'Precio Original CUP', width: 120, cellRenderer: (v) => <Text style={styles.cellText}>{v || 'N/A'}</Text> },
    { key: 'precio_cobrado_cup', label: 'Precio Cobrado', width: 120, cellRenderer: (v) => <Text style={styles.cellText}>{v || 'N/A'}</Text> },
    { key: 'forma_pago', label: 'Forma de Pago', width: 140, cellRenderer: (v) => <Text style={styles.cellText}>{v || 'N/A'}</Text> }
  ];

  // Resúmenes calculados para ventas
  const ventasSummary = ventasList.reduce((acc, v) => {
    const cantidad = Number(v.cantidad) || 0;
    const precio_cobrado = v.precio_cobrado_cup != null ? Number(v.precio_cobrado_cup) || 0 : 0;
    const precio_original = v.precio_original_comerciable_cup != null ? Number(v.precio_original_comerciable_cup) || 0 : 0;
    const forma = v.forma_pago || '';
    // Sumar por unidad: precio * cantidad
    acc.totalCantidad += cantidad;
    acc.totalPrecioCobrado += precio_cobrado * cantidad;
    acc.totalPlus += (precio_cobrado - precio_original) * cantidad;
    if (String(forma).toLowerCase() === 'efectivo') acc.efectivoCount += 1;
    acc.totalVentas += 1;
    return acc;
  }, { totalCantidad: 0, totalPrecioCobrado: 0, totalPlus: 0, efectivoCount: 0, totalVentas: 0 });

  const efectivoPercent = ventasSummary.totalVentas > 0 ? Math.round((ventasSummary.efectivoCount / ventasSummary.totalVentas) * 100) : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 80}
    >
      <View style={styles.container}>
        <TopBar onMenuNavigate={() => { }} />
        {isSaving && (
          <Modal transparent={true} visible={isSaving} animationType="fade">
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          </Modal>
        )}
        <ScrollView
          contentContainerStyle={[styles.scrollContentContainer, { paddingBottom: Spacing.page }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Image
                source={require('../assets/images/arrow-left.png')}
                style={styles.icon}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <Text style={styles.title}>
              {mode === 'ver' ? 'Detalles de Servicio Complejo' : mode === 'editar' ? 'Editar Servicio Complejo' : 'Crear Servicio Complejo'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Tipo de Servicio *</Text>
            <View style={[styles.input, !isEditable && styles.disabledInput]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tiposRow}>
                  {allTiposServicios.map((tipo) => {
                    const selected = servicioComplejoData.tipo_servicio === tipo;
                    return (
                      <TouchableOpacity
                        key={tipo}
                        style={[
                          styles.tipoBox,
                          selected && styles.tipoBoxSelected,
                          !isEditable && styles.disabledTipo
                        ]}
                        onPress={() => {
                          if (!isEditable) return;
                          setServicioComplejoData((s) => ({ ...s, tipo_servicio: tipo }));
                        }}
                      >
                        <Text
                          style={[styles.tipoText, selected && styles.tipoTextSelected]}
                        >
                          {tipo}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <Text style={styles.label}>Descripción *</Text>
            <TextInput
              style={[styles.input, !isEditable && styles.disabledInput]}
              editable={isEditable}
              value={servicioComplejoData.descripcion}
              onChangeText={(t) => setServicioComplejoData((s) => ({ ...s, descripcion: t }))}
              placeholder="Descripción del servicio complejo"
            />

            <View style={styles.twoColumnRow}>
              <View style={styles.column}>
                <Text style={styles.label}>Precio USD *</Text>
                <TextInput
                  style={[styles.input, !isEditable && styles.disabledInput]}
                  keyboardType="numeric"
                  editable={isEditable}
                  value={servicioComplejoData.precio_usd}
                  onChangeText={handlePrecioUSDChange}
                  placeholder="0.00"
                />
              </View>
              <View style={styles.column}>
                <Text style={styles.label}>Precio CUP *</Text>
                <TextInput
                  style={[styles.input, !isEditable && styles.disabledInput]}
                  keyboardType="numeric"
                  editable={isEditable}
                  value={servicioComplejoData.precio_cup}
                  onChangeText={handlePrecioCUPChange}
                  placeholder="0"
                />
              </View>
            </View>

            {/* Roles autorizados como checkboxes */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Roles autorizados *</Text>
              <View style={styles.rolesRow}>
                {allRoles.map((role) => {
                  const selected = rolesSelected.includes(role);
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleBox,
                        selected && styles.roleBoxSelected,
                        !isEditable && styles.disabledRole
                      ]}
                      onPress={() => {
                        if (!isEditable) return;
                        setRolesSelected((prev) => {
                          if (prev.includes(role)) {
                            return prev.filter((r) => r !== role);
                          }
                          return [...prev, role];
                        });
                      }}
                    >
                      <Text
                        style={[styles.roleText, selected && styles.roleTextSelected]}
                      >
                        {role}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {isEditable && (
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>
                  {mode === 'editar' ? 'Actualizar Servicio Complejo' : 'Crear Servicio Complejo'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Ventas table (visual only) */}
          {(isAdmin && mode !== "crear") && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ventas</Text>
              <DataTable
                columns={ventasColumns}
                items={ventasList || []}
                actions={[]}
                totalItems={(ventasList || []).length}
                itemsPerPage={itemsPerPage}
                currentPage={ventasPage}
                isLoading={false}
                onPageChange={(p) => setVentasPage(p)}
              />
              {/* Información resumen Ventas */}
              <View style={styles.infoBox}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total cantidad (ventas):</Text>
                  <Text style={styles.infoValue}>{ventasSummary.totalCantidad}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total precio cobrado (CUP):</Text>
                  <Text style={styles.infoValue}>${ventasSummary.totalPrecioCobrado.toFixed(2)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total de Plus (CUP):</Text>
                  <Text style={styles.infoValue}>${ventasSummary.totalPlus.toFixed(2)}</Text>
                </View>
                <View style={[styles.infoRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                  <Text style={styles.infoLabel}>Porcentaje en Efectivo:</Text>
                  <View style={styles.percentBarContainer}>
                    <View style={[styles.percentBarFill, { width: `${efectivoPercent}%` }]} />
                  </View>
                  <Text style={styles.percentText}>
                    {efectivoPercent}% Efectivo ({ventasSummary.efectivoCount}/{ventasSummary.totalVentas})
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContentContainer: { padding: Spacing.m },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.m,
  },
  title: {
    fontSize: Typography.h3,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  backButton: {
    padding: 8,
    backgroundColor: Colors.primarySuave,
    borderRadius: 8,
    marginRight: Spacing.s,
  },
  icon: {
    width: 20,
    height: 20,
    tintColor: Colors.textPrimary,
  },
  section: {
    backgroundColor: '#fff',
    padding: Spacing.m,
    borderRadius: 8,
    marginBottom: Spacing.m,
    borderWidth: 1,
    borderColor: '#000',
  },
  label: {
    fontSize: Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    color: Colors.textSecondary,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    paddingHorizontal: Spacing.m,
    paddingVertical: 10,
    fontSize: Typography.body,
    color: Colors.textSecondary,
    minHeight: 44,
    marginBottom: Spacing.m,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
  },
  tiposRow: {
    flexDirection: 'row',
    gap: Spacing.s,
    paddingHorizontal: Spacing.s,
  },
  tipoBox: {
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.m,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primarySuave,
    backgroundColor: '#fff',
    minWidth: 100,
    alignItems: 'center',
  },
  tipoBoxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tipoText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: Typography.small,
  },
  tipoTextSelected: {
    color: Colors.textPrimary,
  },
  disabledTipo: {
    opacity: 0.6,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: Spacing.s,
    marginBottom: Spacing.m,
  },
  column: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: Colors.boton_azul,
    paddingVertical: Spacing.m,
    paddingHorizontal: Spacing.m,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: Spacing.m,
    borderWidth: 1,
    borderColor: '#000',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: Typography.body,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: Typography.h4,
    fontWeight: '700',
    marginBottom: Spacing.s,
    color: Colors.textSecondary,
  },
  cellText: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
  },
  infoBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.primarySuave,
    padding: Spacing.m,
    borderRadius: 8,
    marginTop: Spacing.s,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    width: '100%',
  },
  infoLabel: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  percentBarContainer: {
    width: '100%',
    height: 12,
    backgroundColor: '#eee',
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  percentBarFill: {
    height: '100%',
    backgroundColor: Colors.boton_azul,
  },
  percentText: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  inputGroup: {
    marginBottom: Spacing.m,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.s,
    marginTop: Spacing.xs,
  },
  roleBox: {
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.m,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primarySuave,
    backgroundColor: '#fff',
    marginRight: Spacing.s,
  },
  roleBoxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  roleTextSelected: {
    color: Colors.textPrimary,
  },
  disabledRole: {
    opacity: 0.6,
  },
});
