import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ToastAndroid, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DataTable from './DataTable';
import { Colors, Spacing, Typography } from '../variables';
import eventBus from '../utils/eventBus';

export default function ServicioComplejoTab() {
  const router = useRouter();
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [filters, setFilters] = useState({ 
    tipo_servicio: '', 
    descripcion: '', 
    precio_usd_min: '', 
    precio_usd_max: '', 
    precio_cup_min: '', 
    precio_cup_max: '' 
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isLoading, setIsLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [serviciosComplejos, setServiciosComplejos] = useState([]);
  const [apiHost, setApiHost] = useState('');

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const configRaw = await AsyncStorage.getItem('@config');
      if (configRaw && isMounted) {
        try {
          const cfg = JSON.parse(configRaw);
          setApiHost(cfg.api_host || cfg.apihost || cfg.apiHost || '');
        } catch (e) { }
      }
    };
    init();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const unsubscribe = eventBus.addListener('refreshServiciosComplejos', () => fetchServiciosComplejos(1));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (apiHost) {
      fetchServiciosComplejos(1);
    }
  }, [apiHost]);

  const fetchServiciosComplejos = useCallback(async (page = 1, filtersData = null) => {
    setIsLoading(true);
    try {
      const configRaw = await AsyncStorage.getItem('@config');
      const cfg = configRaw ? JSON.parse(configRaw) : {};
      const token = cfg.token || '';
      const host = apiHost || cfg.api_host || cfg.apihost || cfg.apiHost || '';
      const limit = itemsPerPage;
      
      // Usar los filtros pasados como parámetro o los del estado
      const currentFilters = filtersData || filters;
      const body = {
        ...(currentFilters.tipo_servicio && { tipo_servicio: currentFilters.tipo_servicio }),
        ...(currentFilters.descripcion && { descripcion: currentFilters.descripcion }),
        ...(currentFilters.precio_usd_min && { precio_usd_min: Number(currentFilters.precio_usd_min) }),
        ...(currentFilters.precio_usd_max && { precio_usd_max: Number(currentFilters.precio_usd_max) }),
        ...(currentFilters.precio_cup_min && { precio_cup_min: Number(currentFilters.precio_cup_min) }),
        ...(currentFilters.precio_cup_max && { precio_cup_max: Number(currentFilters.precio_cup_max) })
      };
      
      const resp = await fetch(`${host}/servicioComplejo/filter/${limit}/${page}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      setServiciosComplejos(data?.data || []);
      setTotalItems(data?.pagination?.total || (data?.data || []).length);
      setCurrentPage(data?.pagination?.currentPage || page);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo cargar los servicios complejos');
    }
    setIsLoading(false);
  }, [apiHost, filters]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchServiciosComplejos(1, filters);
  };

  const handleMoreOptions = () => setShowMoreOptions(!showMoreOptions);

  const handleFilterChange = (field, value) => setFilters((f) => ({ ...f, [field]: value }));

  const clearFilters = () => {
    const clearedFilters = { 
      tipo_servicio: '', 
      descripcion: '', 
      precio_usd_min: '', 
      precio_usd_max: '', 
      precio_cup_min: '', 
      precio_cup_max: '' 
    };
    setFilters(clearedFilters);
    setCurrentPage(1);
    fetchServiciosComplejos(1, clearedFilters);
  };

  const columns = [
    { key: 'servicio.descripcion', label: 'Descripción', width: 200, cellRenderer: (v) => <Text style={styles.cellText}>{v || 'N/A'}</Text> },
    // Usar `v` (valor anidado) en lugar de acceder a `item.comerciable` que no existe en este objeto
    { key: 'servicio.comerciable.precio_cup', label: 'Precio CUP', width: 140, cellRenderer: (v) => <Text style={styles.cellText}>${Number(v || 0).toFixed(2)}</Text> }
  ];

  const handleCreate = () => router.push('/servicioComplejoModal?mode=crear');
  const handleEdit = (item) => router.push(`/servicioComplejoModal?mode=editar&servicioComplejo=${encodeURIComponent(JSON.stringify(item))}`);
  const handleDelete = (item) => {
    Alert.alert('Confirmar', '¿Eliminar servicio complejo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteServicioComplejo(item) }
    ]);
  };

  const deleteServicioComplejo = async (item) => {
    try {
      const configRaw = await AsyncStorage.getItem('@config');
      const cfg = configRaw ? JSON.parse(configRaw) : {};
      const token = cfg.token || '';
      const host = apiHost || cfg.api_host || cfg.apihost || cfg.apiHost || '';
      const id = item?.comerciable?.id_comerciable || item?.id_comerciable || item?.id;
      if (!id) {
        Alert.alert('Error', 'No se pudo identificar el servicio complejo a eliminar');
        return;
      }
      const base = (host || '').replace(/\/+$/, '');
      const url = `${base}/servicioComplejo/delete/${id}`;
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(url, { method: 'DELETE', headers });
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

      if (Platform.OS === 'android') ToastAndroid.show('Servicio complejo eliminado', ToastAndroid.SHORT);
      else Alert.alert('OK', 'Servicio complejo eliminado');
      fetchServiciosComplejos(1, filters);
      eventBus.emit('refreshServiciosComplejos');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo eliminar');
    }
  };

  const actions = [
    { handler: handleEdit, icon: <Image source={require('../assets/images/editar.png')} style={{ width: 16, height: 16, tintColor: Colors.textPrimary }} resizeMode="contain" />, buttonStyle: styles.editButton },
    { handler: handleDelete, icon: <Image source={require('../assets/images/basura.png')} style={{ width: 16, height: 16, tintColor: Colors.textPrimary }} resizeMode="contain" />, buttonStyle: styles.deleteButton }
  ];

  return (
    <View style={styles.tabContent}>
      <View style={styles.searchContainer}>
        <Text style={styles.searchTitle}>Opciones de búsqueda</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Tipo de Servicio</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar tipo de servicio"
            value={filters.tipo_servicio}
            onChangeText={(value) => handleFilterChange('tipo_servicio', value)}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Descripción</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar descripción"
            value={filters.descripcion}
            onChangeText={(value) => handleFilterChange('descripcion', value)}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity style={styles.moreOptionsButton} onPress={handleMoreOptions}>
            <Image
              source={showMoreOptions ? require('../assets/images/arrow-top.png') : require('../assets/images/arrow-button.png')}
              style={styles.moreOptionsIcon}
              resizeMode="contain"
            />
            <Text style={styles.moreOptionsText}>{showMoreOptions ? 'Menos opciones' : 'Más opciones'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Image source={require('../assets/images/loupe.png')} style={styles.searchIcon} resizeMode="contain" />
            <Text style={styles.searchButtonText}>Buscar</Text>
          </TouchableOpacity>
        </View>

        {showMoreOptions && (
          <View style={styles.additionalOptions}>
            <View style={styles.rangeRow}>
              <View style={[styles.inputGroup, styles.halfInput]}>
                <Text style={styles.inputLabel}>Precio USD Min</Text>
                <TextInput
                  style={styles.additionalInput}
                  placeholder="0"
                  value={filters.precio_usd_min}
                  onChangeText={(value) => handleFilterChange('precio_usd_min', value.replace(/[^0-9\.]/g, ''))}
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputGroup, styles.halfInput]}>
                <Text style={styles.inputLabel}>Precio USD Max</Text>
                <TextInput
                  style={styles.additionalInput}
                  placeholder="0"
                  value={filters.precio_usd_max}
                  onChangeText={(value) => handleFilterChange('precio_usd_max', value.replace(/[^0-9\.]/g, ''))}
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.rangeRow}>
              <View style={[styles.inputGroup, styles.halfInput]}>
                <Text style={styles.inputLabel}>Precio CUP Min</Text>
                <TextInput
                  style={styles.additionalInput}
                  placeholder="0"
                  value={filters.precio_cup_min}
                  onChangeText={(value) => handleFilterChange('precio_cup_min', value.replace(/[^0-9\.]/g, ''))}
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputGroup, styles.halfInput]}>
                <Text style={styles.inputLabel}>Precio CUP Max</Text>
                <TextInput
                  style={styles.additionalInput}
                  placeholder="0"
                  value={filters.precio_cup_max}
                  onChangeText={(value) => handleFilterChange('precio_cup_max', value.replace(/[^0-9\.]/g, ''))}
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Limpiar filtros</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.addButton} onPress={handleCreate}>
          <Text style={styles.addButtonText}>Agregar Servicio Complejo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tableContainer}>
        <DataTable
          columns={columns}
          items={serviciosComplejos}
          actions={actions}
          isLoading={isLoading}
          totalItems={totalItems}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          onPageChange={(p) => fetchServiciosComplejos(p, filters)}
          onRowClick={(item) => {
            try {
              const payload = item?.raw ? item.raw : item;
              router.push({
                pathname: '/servicioComplejoModal',
                params: {
                  mode: 'ver',
                  servicioComplejo: JSON.stringify(payload)
                }
              });
            } catch (e) {
              ToastAndroid.show(`Error abriendo servicio complejo: ${e?.message || e}`, ToastAndroid.SHORT);
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContent: {
    paddingHorizontal: Spacing.m,
  },
  searchContainer: {
    backgroundColor: Colors.primaryClaro,
    padding: Spacing.m,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.m,
  },
  searchTitle: {
    fontSize: Typography.h3,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.m,
    textAlign: 'center'
  },
  inputGroup: {
    marginBottom: Spacing.m
  },
  inputLabel: {
    fontSize: Typography.body,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.primarySuave,
    borderRadius: 8,
    paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.s,
    fontSize: Typography.body,
    color: Colors.textSecondary,
    minHeight: 44
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.s
  },
  moreOptionsButton: {
    backgroundColor: Colors.primary,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.m,
    borderRadius: 8,
    gap: Spacing.xs,
    minHeight: 44
  },
  moreOptionsIcon: {
    width: 16,
    height: 16,
    tintColor: Colors.textPrimary
  },
  moreOptionsText: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: '600'
  },
  searchButton: {
    backgroundColor: Colors.boton_azul,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.m,
    borderRadius: 8,
    gap: Spacing.xs,
    minHeight: 44
  },
  searchIcon: {
    width: 16,
    height: 16,
    tintColor: Colors.textPrimary
  },
  searchButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: '600'
  },
  additionalOptions: {
    marginTop: Spacing.m,
    paddingTop: Spacing.m,
    borderTopWidth: 1,
    borderTopColor: Colors.primarySuave
  },
  additionalInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.primarySuave,
    borderRadius: 8,
    paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.s,
    fontSize: Typography.body,
    color: Colors.textSecondary,
    minHeight: 44
  },
  rangeRow: {
    flexDirection: 'row',
    gap: Spacing.s,
    marginBottom: Spacing.m
  },
  halfInput: {
    flex: 1
  },
  clearButton: {
    backgroundColor: Colors.boton_rojo_opciones,
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.m,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: Spacing.s,
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center'
  },
  clearButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: 'bold'
  },
  cellText: {
    fontSize: Typography.small,
    color: Colors.textSecondary
  },
  editButton: {
    backgroundColor: Colors.boton_azul,
    alignItems: 'center'
  },
  deleteButton: {
    backgroundColor: Colors.boton_rojo_opciones,
    alignItems: 'center'
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.s,
    marginBottom: Spacing.m,
  },
  addButton: {
    backgroundColor: Colors.boton_azul,
    paddingVertical: Spacing.m,
    paddingHorizontal: Spacing.m,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: '#000',
    minHeight: 50,
    justifyContent: 'center'
  },
  addButtonText: {
    color: '#fff',
    fontSize: Typography.body,
    fontWeight: '600',
    textAlign: 'center'
  },
  tableContainer: {
    marginBottom: Spacing.m,
    height: 560
  }
});
