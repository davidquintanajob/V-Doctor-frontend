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
  Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TopBar from '../components/TopBar';
import { Colors, Spacing, Typography } from '../variables';
import eventBus from '../utils/eventBus';
import DataTable from '../components/DataTable';

export default function ServicioModalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mode = params.mode; // 'ver' | 'editar' | 'crear'
  const servicioParam = params.servicio ? JSON.parse(params.servicio) : null;

  // Definir los roles disponibles
  const allRoles = ['Administrador', 'Médico', 'Técnico', 'Estilista'];

  // Estado para los roles seleccionados
  const [rolesSelected, setRolesSelected] = useState([]);

  // Estado para los datos del servicio
  const [servicioData, setServicioData] = useState({
    descripcion: servicioParam?.descripcion || '',
    precio_usd: servicioParam?.comerciable?.precio_usd ? String(servicioParam.comerciable.precio_usd) : '',
    precio_cup: servicioParam?.comerciable?.precio_cup ? String(servicioParam.comerciable.precio_cup) : ''
  });

  const [cambioMoneda, setCambioMoneda] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ventasPage, setVentasPage] = useState(1);
  const itemsPerPage = 10;

  const ventasList = servicioParam?.comerciable?.venta || [];
  const isEditable = mode !== 'ver';

  // Obtener servicios complejos de las ventas
  const serviciosComplejosEnVentas = ventasList
    .filter(venta => {
      // Verificar que servicio_complejo existe y tiene descripción
      const servicioComplejo = venta.servicio_complejo;
      return servicioComplejo !== null &&
        servicioComplejo !== undefined &&
        servicioComplejo.descripcion;
    })
    .map(venta => {
      const servicioComplejo = venta.servicio_complejo;
      return {
        id: servicioComplejo?.id_comerciable || servicioComplejo?.id || venta.id_venta,
        descripcion: servicioComplejo.descripcion,
        fecha: venta.fecha,
        tipo_servicio: servicioComplejo?.tipo_servicio || 'Sin tipo'
      };
    });

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

      // Inicializar roles seleccionados desde los datos del servicio
      if (servicioParam?.comerciable?.roles_autorizados) {
        const rolesStr = servicioParam.comerciable.roles_autorizados;
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
    setServicioData((s) => ({ ...s, precio_usd: t }));
    if (cambioMoneda) {
      const usd = parseNumber(t);
      setServicioData((s) => ({
        ...s,
        precio_cup: (Math.round((usd * cambioMoneda + Number.EPSILON) * 100) / 100).toString()
      }));
    }
  };

  const handlePrecioCUPChange = (t) => {
    setServicioData((s) => ({ ...s, precio_cup: t }));
    if (cambioMoneda) {
      const cup = parseNumber(t);
      setServicioData((s) => ({
        ...s,
        precio_usd: (Math.round((cup / cambioMoneda + Number.EPSILON) * 100) / 100).toString()
      }));
    }
  };

  const handleBack = () => router.back();

  const handleSave = async () => {
    if (!servicioData.descripcion) {
      Alert.alert('Validación', 'Descripción es requerida');
      return;
    }
    if (!servicioData.precio_usd && !servicioData.precio_cup) {
      Alert.alert('Validación', 'Precio es requerido');
      return;
    }
    if (rolesSelected.length === 0) {
      Alert.alert('Validación', 'Se debe elegir al menos un rol autorizado');
      return;
    }

    try {
      const configRaw = await AsyncStorage.getItem('@config');
      const cfg = configRaw ? JSON.parse(configRaw) : {};
      const token = cfg.token || '';
      const host = cfg.api_host || cfg.apihost || cfg.apiHost || '';

      const body = {
        descripcion: servicioData.descripcion,
        precio_usd: parseNumber(servicioData.precio_usd),
        precio_cup: parseNumber(servicioData.precio_cup),
        roles_autorizados: rolesSelected.join(', ') // Unir los roles seleccionados
      };

      let resp, data;
      if (mode === 'editar') {
        const id = servicioParam?.comerciable?.id_comerciable || servicioParam?.id_comerciable || servicioParam?.id;
        resp = await fetch(`${host}/servicio/UpdateServicio/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });
      } else {
        resp = await fetch(`${host}/servicio/CreateServicio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });
      }

      data = await resp.json();
      if (data?.errors || data?.error) {
        const msg = data?.errors ? data.errors.join('\n') : data.error || 'Error';
        Alert.alert('Error', msg);
        return;
      }

      if (Platform.OS === 'android') {
        ToastAndroid.show('Guardado', ToastAndroid.SHORT);
      } else {
        Alert.alert('OK', 'Guardado');
      }

      eventBus.emit('refreshServicios');
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo guardar');
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
              {mode === 'ver' ? 'Detalles de Servicio' : mode === 'editar' ? 'Editar Servicio' : 'Crear Servicio'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Descripción *</Text>
            <TextInput
              style={[styles.input, !isEditable && styles.disabledInput]}
              editable={isEditable}
              value={servicioData.descripcion}
              onChangeText={(t) => setServicioData((s) => ({ ...s, descripcion: t }))}
              placeholder="Descripción del servicio"
            />

            <View style={styles.twoColumnRow}>
              <View style={styles.column}>
                <Text style={styles.label}>Precio USD *</Text>
                <TextInput
                  style={[styles.input, !isEditable && styles.disabledInput]}
                  keyboardType="numeric"
                  editable={isEditable}
                  value={servicioData.precio_usd}
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
                  value={servicioData.precio_cup}
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
                  {mode === 'editar' ? 'Actualizar Servicio' : 'Crear Servicio'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Campo para mostrar servicios complejos relacionados */}
          {(mode !== "crear" && serviciosComplejosEnVentas.length > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Servicios Complejos Relacionados</Text>
              <View style={styles.serviciosComplejosContainer}>
                {serviciosComplejosEnVentas.map((servicio, index) => (
                  <View key={`${servicio.id}-${index}`} style={styles.servicioComplejoItem}>
                    <Text style={styles.servicioComplejoText}>
                      {servicio.descripcion} - {servicio.fecha ? new Date(servicio.fecha).toLocaleDateString() : 'Sin fecha'}
                    </Text>
                    {servicio.tipo_servicio && (
                      <Text style={styles.servicioComplejoTipo}>({servicio.tipo_servicio})</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

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
  twoColumnRow: {
    flexDirection: 'row',
    gap: Spacing.s,
    marginBottom: Spacing.m,
  },
  column: {
    flex: 1,
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
  serviciosComplejosContainer: {
    maxHeight: 200,
    marginTop: Spacing.s,
  },
  servicioComplejoItem: {
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primarySuave,
  },
  servicioComplejoText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  servicioComplejoTipo: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
});