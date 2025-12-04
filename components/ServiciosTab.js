import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ToastAndroid, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DataTable from './DataTable';
import { Colors, Spacing, Typography } from '../variables';
import eventBus from '../utils/eventBus';

export default function ServiciosTab() {
  const router = useRouter();
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [filters, setFilters] = useState({ descripcion: '', precio_usd_min: '', precio_usd_max: '', precio_cup_min: '', precio_cup_max: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isLoading, setIsLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [servicios, setServicios] = useState([]);
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
    const unsubscribe = eventBus.addListener('refreshServicios', () => fetchServicios(1));
    return () => unsubscribe();
  }, [fetchServicios]);

  useEffect(() => {
    if (apiHost) {
      fetchServicios(1);
    }
  }, [apiHost]);

  const fetchServicios = useCallback(async (page = 1, filtersData = null) => {
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
        ...(currentFilters.descripcion && { descripcion: currentFilters.descripcion }),
        ...(currentFilters.precio_usd_min && { precio_usd_min: Number(currentFilters.precio_usd_min) }),
        ...(currentFilters.precio_usd_max && { precio_usd_max: Number(currentFilters.precio_usd_max) }),
        ...(currentFilters.precio_cup_min && { precio_cup_min: Number(currentFilters.precio_cup_min) }),
        ...(currentFilters.precio_cup_max && { precio_cup_max: Number(currentFilters.precio_cup_max) })
      };
      
      const resp = await fetch(`${host}/servicio/filter/${limit}/${page}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      const list = (data?.data || []).filter((i) => i.servicio_complejo === null);
      setServicios(list);
      setTotalItems(data?.pagination?.total || list.length);
      setCurrentPage(data?.pagination?.currentPage || page);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo cargar los servicios');
    }
    setIsLoading(false);
  }, [apiHost, filters]); // Agregar filters como dependencia

  const handleSearch = () => {
    setCurrentPage(1);
    // Llamar fetchServicios con los filtros actuales
    fetchServicios(1, filters);
  };

  const handleMoreOptions = () => setShowMoreOptions(!showMoreOptions);

  const handleFilterChange = (field, value) => setFilters((f) => ({ ...f, [field]: value }));

  const clearFilters = () => {
    setFilters({ descripcion: '', precio_usd_min: '', precio_usd_max: '', precio_cup_min: '', precio_cup_max: '' });
    setCurrentPage(1);
    // Llamar fetchServicios con filtros limpios
    fetchServicios(1, { descripcion: '', precio_usd_min: '', precio_usd_max: '', precio_cup_min: '', precio_cup_max: '' });
  };

  const columns = [
    { key: 'descripcion', label: 'Descripción', width: 200, cellRenderer: (v) => <Text style={styles.cellText}>{v || 'N/A'}</Text> },
    { key: 'precio_cup', label: 'Precio CUP', width: 140, cellRenderer: (v, item) => <Text style={styles.cellText}>${(item?.comerciable?.precio_cup ?? 0).toFixed(2)}</Text> }
  ];

  const handleCreate = () => router.push('/servicioModal?mode=crear');
  const handleEdit = (item) => router.push(`/servicioModal?mode=editar&servicio=${encodeURIComponent(JSON.stringify(item))}`);
  const handleDelete = (item) => {
    Alert.alert('Confirmar', '¿Eliminar servicio?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteServicio(item) }
    ]);
  };

  const deleteServicio = async (item) => {
    try {
      const configRaw = await AsyncStorage.getItem('@config');
      const cfg = configRaw ? JSON.parse(configRaw) : {};
      const token = cfg.token || '';
      const host = apiHost || cfg.api_host || cfg.apihost || cfg.apiHost || '';
      const id = item?.comerciable?.id_comerciable || item?.id_comerciable || item?.id;
      const resp = await fetch(`${host}/servicio/DeleteServicio/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      if (data?.errors || data?.error) {
        const msg = data?.errors ? data.errors.join('\n') : data.error || 'Error';
        Alert.alert('Error', msg);
        return;
      }
      if (Platform.OS === 'android') ToastAndroid.show('Servicio eliminado', ToastAndroid.SHORT);
      else Alert.alert('OK', 'Servicio eliminado');
      fetchServicios(1, filters);
      eventBus.emit('refreshServicios');
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
          <Text style={styles.addButtonText}>Agregar Servicio</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tableContainer}>
        <DataTable
          columns={columns}
          items={servicios}
          actions={actions}
          isLoading={isLoading}
          totalItems={totalItems}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          onPageChange={(p) => fetchServicios(p, filters)} // Pasar filtros al cambiar página
          onRowClick={(producto) => {
            try {
              const payload = producto?.raw ? producto.raw : producto;
              router.push({
                pathname: '/servicioModal',
                params: {
                  mode: 'ver',
                  servicio: JSON.stringify(payload)
                }
              });
            } catch (e) {
              ToastAndroid.show(`Error abriendo servicio: ${e?.message || e}`, ToastAndroid.SHORT);
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