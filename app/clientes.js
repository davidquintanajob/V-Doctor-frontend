import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  ToastAndroid,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import TopBar from '../components/TopBar';
import DataTable from '../components/DataTable';
import { Colors, Spacing, Typography, ColorsData } from '../variables';
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

const { width: screenWidth } = Dimensions.get('window');

// 🔥 INICIALIZACIÓN CORRECTA CON EXPO-SQLITE
let db = null;

const inicializarSQLite = async () => {
  try {
    // Abrir base de datos - API CORRECTA de expo-sqlite
    db = SQLite.openDatabaseSync('ClientesDatabase.db');
    console.log('✅ Base de datos SQLite abierta con expo-sqlite');

    // Inicializar tabla
    await inicializarTabla();
    return db;
  } catch (error) {
    console.error('❌ Error inicializando SQLite:', error);
    throw error;
  }
};

const inicializarTabla = async () => {
  try {
    if (!db) {
      throw new Error('Base de datos no inicializada');
    }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS clientes (
        id_cliente INTEGER PRIMARY KEY,
        nombre TEXT,
        telefono TEXT,
        color TEXT,
        direccion TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `);
    console.log('✅ Tabla clientes lista');
  } catch (error) {
    console.error('❌ Error creando tabla:', error);
    throw error;
  }
};

// Inicializar SQLite
inicializarSQLite().catch(error => {
  console.error('Error en inicialización:', error);
});

export default function ClientesScreen() {
  const router = useRouter();
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({
    telefono: '',
    direccion: '',
    activo: '',
    nombre_mascota: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [usandoDatosLocales, setUsandoDatosLocales] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;

  const [clientesData, setClientesData] = useState([]);

  const handleMenuNavigate = (link) => {
    // Navegación del menú
  };

  // Llamada al endpoint para obtener clientes
  const fetchClients = async (page = currentPage, isSearch = false) => {
    setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem('@config');
      if (!raw) {
        router.replace('/config');
        return;
      }
      const config = JSON.parse(raw);
      const host = config.api_host || config.apihost || config.apiHost;
      const token = config.token;
      if (!host) {
        router.replace('/config');
        return;
      }

      const url = `${host.replace(/\/+$/, '')}/cliente/filter/${itemsPerPage}/${page}`;

      const body = {
        nombre: searchText || '',
        telefono: filters.telefono || '',
        direccion: filters.direccion || '',
        nombre_mascota: filters.nombre_mascota || ''
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body),
        timeout: 10000 // 10 segundos de timeout
      });

      if (response.status === 403) {
        // Sesión expirada
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Normalizar datos: sustituir null por "" y mapear id
      const clientes = (data.data || []).map(item => {
        const normalized = { ...item };
        // Reemplazar null por cadena vacía en propiedades de primer nivel
        Object.keys(normalized).forEach(k => {
          if (normalized[k] === null) normalized[k] = '';
        });
        // mapear id_cliente -> id
        normalized.id = normalized.id_cliente ?? normalized.id;
        // Asegurar campo color
        normalized.color = normalized.color || '';
        return normalized;
      });

      setClientesData(clientes);
      const pagination = data.pagination || {};
      setTotalItems(pagination.total || clientes.length);
      setCurrentPage(pagination.currentPage || page);

    } catch (error) {
      // Intentar cargar datos locales desde AsyncStorage
      try {
        const clientesGuardados = await AsyncStorage.getItem('@clientes');
        if (clientesGuardados) {
          const clientesLocales = JSON.parse(clientesGuardados);

          // Aplicar filtros si es una búsqueda
          let clientesFiltrados = clientesLocales;
          if (isSearch) {
            clientesFiltrados = aplicarFiltrosLocales(clientesLocales);
          }

          // Calcular paginación para datos locales
          const startIndex = (page - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          const clientesPaginados = clientesFiltrados.slice(startIndex, endIndex);

          setClientesData(clientesPaginados);
          setTotalItems(clientesFiltrados.length);
          setCurrentPage(page);

          ToastAndroid.show(
            '⚠️ Sin conexión. Mostrando datos locales guardados',
            ToastAndroid.LONG
          );
        } else {
          ToastAndroid.show(
            '❌ Sin conexión y no hay datos locales guardados',
            ToastAndroid.LONG
          );
        }
      } catch (localError) {
        ToastAndroid.show(
          '❌ Error al cargar datos locales',
          ToastAndroid.SHORT
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Función para aplicar filtros a los datos locales
  const aplicarFiltrosLocales = (clientes) => {
    return clientes.filter(cliente => {
      const nombreMatch = !searchText ||
        (cliente.nombre && cliente.nombre.toLowerCase().includes(searchText.toLowerCase()));

      const telefonoMatch = !filters.telefono ||
        (cliente.telefono && cliente.telefono.includes(filters.telefono));

      const direccionMatch = !filters.direccion ||
        (cliente.direccion && cliente.direccion.toLowerCase().includes(filters.direccion.toLowerCase()));

      const mascotaMatch = !filters.nombre_mascota ||
        (cliente.pacientes && cliente.pacientes.some(paciente =>
          paciente.nombre && paciente.nombre.toLowerCase().includes(filters.nombre_mascota.toLowerCase())
        ));

      return nombreMatch && telefonoMatch && direccionMatch && mascotaMatch;
    });
  };

  // Modificar handleSearch para indicar que es una búsqueda
  const handleSearch = () => {
    // Reiniciar pagina y buscar
    setCurrentPage(1);
    fetchClients(1, true); // true indica que es una búsqueda
  };

  // Control de enfoque: llamar a fetchClients cuando la vista recibe focus
  const isScreenFocused = useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      isScreenFocused.current = true;
      // Al enfocar la pantalla, cargar la página actual
      fetchClients(currentPage, false);
      return () => {
        isScreenFocused.current = false;
      };
    }, [])
  );

  const guardarClientesLocales = async () => {
    try {
      setIsLoading(true);

      // ✅ MANTENER LÓGICA ORIGINAL COMPLETA
      const raw = await AsyncStorage.getItem('@config');
      if (!raw) {
        return;
      }

      const config = JSON.parse(raw);
      const host = config.api_host || config.apihost || config.apiHost;
      const token = config.token;

      if (!host) {
        return;
      }

      const url = `${host.replace(/\/+$/, '')}/cliente`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (response.status === 403) {
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        return;
      }

      const data = await response.json();
      const clientes = Array.isArray(data) ? data : data.data || [];

      // ✅ MANTENER LÓGICA ORIGINAL: Guardar en AsyncStorage
      await AsyncStorage.setItem('@clientes', JSON.stringify(clientes));

      // 🔥 NUEVA LÓGICA: Guardar en SQLite
      await guardarEnSQLite(clientes);

      // ✅ MANTENER LÓGICA ORIGINAL: Mensaje de éxito
      ToastAndroid.show(`✅ ${clientes.length} clientes guardados localmente`, ToastAndroid.LONG);

    } catch (error) {
      ToastAndroid.show('Error al guardar clientes', ToastAndroid.SHORT);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 FUNCIÓN ACTUALIZADA PARA EXPO-SQLITE: Guardar en SQLite
  const guardarEnSQLite = async (clientes) => {
    try {
      // Verificar que la BD esté inicializada
      if (!db) {
        console.log('🔄 BD no inicializada, intentando inicializar...');
        await inicializarSQLite();
      }

      if (!db) {
        console.error('❌ No se pudo inicializar la base de datos');
        throw new Error('Base de datos no disponible');
      }

      // 1. Limpiar tabla (sobrescribir)
      await db.execAsync('DELETE FROM clientes');
      console.log('✅ Tabla clientes limpiada');

      if (clientes.length === 0) {
        return;
      }

      // 2. Insertar cada cliente
      let insertados = 0;

      for (const cliente of clientes) {
        try {
          await db.runAsync(
            `INSERT OR REPLACE INTO clientes 
           (id_cliente, nombre, telefono, color, direccion, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              cliente.id_cliente,
              cliente.nombre || '',
              cliente.telefono || '',
              cliente.color || '#ffffffff',
              cliente.direccion || '',
              cliente.createdAt || '',
              cliente.updatedAt || ''
            ]
          );
          insertados++;
        } catch (error) {
          console.error('❌ Error insertando cliente:', error);
          console.log('Cliente problemático:', cliente);
          // Continuar con los siguientes clientes
        }
      }

      console.log(`✅ ${insertados} clientes guardados en SQLite`);

    } catch (error) {
      console.error('❌ Error en guardarEnSQLite:', error);
      throw error;
    }
  };

  // 🔍 Función actualizada para leer clientes desde SQLite (expo-sqlite)
  const leerClientesSQLite = async () => {
    try {
      // Verificar que la BD esté inicializada
      if (!db) {
        console.log('🔄 BD no inicializada, intentando inicializar...');
        await inicializarSQLite();
      }

      if (!db) {
        console.error('❌ No se pudo inicializar la base de datos');
        return [];
      }

      const results = await db.getAllAsync('SELECT * FROM clientes');
      console.log(`📖 ${results.length} clientes leídos de SQLite`);
      return results;

    } catch (error) {
      console.error('❌ Error en leerClientesSQLite:', error);
      return [];
    }
  };

  const handleMoreOptions = () => {
    setShowMoreOptions(!showMoreOptions);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setSearchText('');
    setFilters({
      telefono: '',
      direccion: '',
      activo: '',
      nombre_mascota: ''
    });
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Fetch when page changes, pero solo si la pantalla está enfocada
  useEffect(() => {
    if (isScreenFocused.current) {
      fetchClients(currentPage, false);
    }
  }, [currentPage]);

  const handleRowClick = (cliente) => {
    router.push({
      pathname: '/clienteModal',
      params: {
        mode: 'ver',
        cliente: JSON.stringify(cliente)
      }
    });
  };

  // Columnas de la tabla
  const columns = [
    {
      key: 'nombre',
      label: 'Nombre',
      width: 200,
      cellRenderer: (value, item) => (
        <Text style={styles.cellText}>{value || 'Sin nombre'}</Text>
      )
    },
    {
      key: 'telefono',
      label: 'Teléfono',
      width: 140,
      cellRenderer: (value, item) => (
        <Text style={styles.cellText}>{value || 'No especificado'}</Text>
      )
    }
  ];

  // Acciones para la tabla
  const actions = [
    {
      handler: (cliente) => {
        router.push({
          pathname: '/clienteModal',
          params: {
            mode: 'editar',
            cliente: JSON.stringify(cliente)
          }
        });
      },
      icon: (
        <Image
          source={require('../assets/images/editar.png')}
          style={{ width: 16, height: 16, tintColor: Colors.textPrimary }}
          resizeMode="contain"
        />
      ),
      buttonStyle: styles.editButton
    },
    {
      handler: (cliente) => {
        // Mostrar alerta de confirmación
        Alert.alert(
          'Confirmar eliminación',
          `¿Está seguro de eliminar al cliente ${cliente.nombre}?`,
          [
            {
              text: 'Cancelar',
              style: 'cancel',
            },
            {
              text: 'Eliminar',
              style: 'destructive',
              onPress: async () => {

                try {
                  // Obtener configuración
                  const raw = await AsyncStorage.getItem('@config');
                  if (!raw) {
                    Alert.alert('Error', 'No se encontró configuración');
                    return;
                  }

                  const config = JSON.parse(raw);
                  const host = config.api_host || config.apihost || config.apiHost;
                  const token = config.token;

                  if (!host) {
                    Alert.alert('Error', 'No se encontró host en la configuración');
                    return;
                  }

                  // Usar id_cliente si está disponible, sino usar id
                  const clienteId = cliente.id_cliente || cliente.id;

                  if (!clienteId) {
                    Alert.alert('Error', 'No se pudo identificar el cliente a eliminar');
                    return;
                  }

                  const url = `${host.replace(/\/+$/, '')}/cliente/DeleteCliente/${clienteId}`;

                  const response = await fetch(url, {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                  });

                  if (response.status === 403) {
                    Alert.alert('Sesión expirada', 'Por favor inicie sesión nuevamente');
                    router.replace('/login');
                    return;
                  }

                  if (response.status === 200) {
                    // Eliminación exitosa
                    ToastAndroid.show('✅ Cliente eliminado con éxito', ToastAndroid.LONG);

                    // Eliminar de la lista local
                    setClientesData(prev => prev.filter(c => {
                      const currentId = c.id_cliente || c.id;
                      const targetId = cliente.id_cliente || cliente.id;
                      return currentId !== targetId;
                    }));

                    // Actualizar el total de items
                    setTotalItems(prev => prev - 1);

                  } else {
                    // Manejar errores
                    let errorMessage = `Error ${response.status}`;
                    try {
                      const errorData = await response.json();
                      errorMessage = errorData.errors || errorData.message || errorMessage;
                    } catch (parseError) {
                      console.log('Error parseando respuesta:', parseError);
                    }

                    Alert.alert(
                      'Error al eliminar cliente',
                      `Status: ${response.status}\nError: ${errorMessage}`,
                      [{ text: 'Aceptar' }]
                    );
                  }

                } catch (error) {
                  Alert.alert(
                    'Error de conexión',
                    'No se pudo conectar con el servidor',
                    [{ text: 'Aceptar' }]
                  );
                }
              }
            }
          ]
        );
      },
      icon: (
        <Image
          source={require('../assets/images/basura.png')}
          style={{ width: 16, height: 16, tintColor: Colors.textPrimary }}
          resizeMode="contain"
        />
      ),
      buttonStyle: styles.deleteButton
    }
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <TopBar onMenuNavigate={handleMenuNavigate} />

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        {/* Contenedor de opciones de búsqueda */}
        <View style={styles.searchContainer}>
          <TouchableOpacity onPress={() => { router.replace('/'); }} style={styles.backButton}>
            <Image
              source={require('../assets/images/arrow-left.png')}
              style={styles.backButtonImage}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <Text style={styles.searchTitle}>Opciones de búsqueda</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Buscar por nombre</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Ingresa el nombre del cliente"
              value={searchText}
              onChangeText={setSearchText}
              placeholderTextColor="#999"
            />
            <View style={{ height: Spacing.s }} />
            <Text style={styles.inputLabel}>Buscar por nombre de mascota</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Ingresa el nombre de la mascota"
              value={filters.nombre_mascota}
              onChangeText={(value) => handleFilterChange('nombre_mascota', value)}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.moreOptionsButton}
              onPress={handleMoreOptions}
            >
              <Image
                source={
                  showMoreOptions
                    ? require('../assets/images/arrow-top.png')
                    : require('../assets/images/arrow-button.png')
                }
                style={styles.moreOptionsIcon}
                resizeMode="contain"
              />
              <Text style={styles.moreOptionsText}>
                {showMoreOptions ? 'Menos opciones' : 'Más opciones'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
            >
              <Image
                source={require('../assets/images/loupe.png')}
                style={styles.searchIcon}
                resizeMode="contain"
              />
              <Text style={styles.searchButtonText}>Buscar</Text>
            </TouchableOpacity>
          </View>

          {showMoreOptions && (
            <View style={styles.additionalOptions}>
              <View style={styles.additionalRow}>
                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                  <Text style={styles.inputLabel}>Teléfono</Text>
                  <TextInput
                    style={styles.additionalInput}
                    placeholder="Ej: +53 56487518"
                    value={filters.telefono}
                    onChangeText={(value) => handleFilterChange('telefono', value)}
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                  <Text style={styles.inputLabel}>Dirección</Text>
                  <TextInput
                    style={styles.additionalInput}
                    placeholder="Ej: Calle Principal, 123"
                    value={filters.direccion}
                    onChangeText={(value) => handleFilterChange('direccion', value)}
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearFilters}
              >
                <Text style={styles.clearButtonText}>Limpiar Filtros</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Botones de acciones arriba de la tabla (izquierda) */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.saveButton} onPress={guardarClientesLocales}>
            <Image
              source={require('../assets/images/descargar.png')}
              style={styles.saveButtonIcon}
              resizeMode="contain"
            />
            <Text style={styles.saveButtonText}>Guardar datos locales</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addButton} onPress={() => {
            router.push({
              pathname: '/clienteModal',
              params: {
                mode: 'crear'
              }
            });
          }}>
            <Text style={styles.addButtonText}>+ Agregar Cliente</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryDark, paddingVertical: Spacing.s, paddingHorizontal: Spacing.s, borderRadius: 8, width: '102%', height: 50 }}
            onPress={() => router.push({ pathname: '/asociarPacienteCliente' })}>
            <Image source={require('../assets/images/intercambiar.png')} style={styles.saveButtonIcon} resizeMode="contain" />
            <Text style={styles.saveButtonText}>Asociar Pacientes con Clientes</Text>
          </TouchableOpacity>
        </View>

        {/* Tabla de clientes - asegurar que items siempre sea un array */}
        <View style={styles.tableContainer}>
          <DataTable
            columns={columns}
            items={clientesData || []}
            actions={actions}
            totalItems={totalItems}
            itemsPerPage={10}
            currentPage={currentPage}
            isLoading={isLoading}
            onPageChange={handlePageChange}
            onRowClick={handleRowClick}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
  },
  searchContainer: {
    backgroundColor: Colors.primaryClaro,
    margin: Spacing.m,
    padding: Spacing.m,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    overflow: 'hidden',
  },
  backButton: {
    position: 'absolute',
    left: 10,
    top: 10,
    padding: 8,
    backgroundColor: Colors.primarySuave,
    borderRadius: 8,
    zIndex: 1,
  },
  backButtonImage: {
    width: 20,
    height: 20,
    tintColor: Colors.textPrimary,
  },
  searchTitle: {
    fontSize: Typography.h3,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.m,
    textAlign: 'center',
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: Spacing.m,
  },
  responsiveInputGroup: {
    flex: 1,
    minWidth: 0,
  },
  inputLabel: {
    fontSize: Typography.body,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
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
    minHeight: 44,
    width: '100%',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.s,
    marginTop: Spacing.s,
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
    elevation: 1,
    gap: Spacing.xs,
    minHeight: 44,
  },
  moreOptionsIcon: {
    width: 16,
    height: 16,
    tintColor: Colors.textPrimary,
  },
  moreOptionsText: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: '600',
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
    elevation: 1,
    gap: Spacing.xs,
    minHeight: 44,
  },
  searchIcon: {
    width: 16,
    height: 16,
    tintColor: Colors.textPrimary,
  },
  searchButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: Spacing.s,
    marginHorizontal: Spacing.m,
    marginBottom: Spacing.s,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDark,
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.s,
    borderRadius: 8,
    width: '50%',
  },
  saveButtonIcon: {
    width: 18,
    height: 18,
    marginRight: Spacing.s,
    tintColor: Colors.textPrimary,
  },
  saveButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: '600',
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.boton_azul,
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.s,
    borderRadius: 8,
    width: '50%',
  },
  addButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: '600',
  },
  additionalOptions: {
    marginTop: Spacing.m,
    paddingTop: Spacing.m,
    borderTopWidth: 1,
    borderTopColor: Colors.primarySuave,
  },
  additionalRow: {
    flexDirection: 'row',
    gap: Spacing.s,
    marginBottom: Spacing.m,
    flexWrap: 'wrap',
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
    minHeight: 44,
    width: '100%',
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
    justifyContent: 'center',
  },
  clearButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: 'bold',
  },
  tableContainer: {
    margin: Spacing.m,
    height: 560,
  },
  cellText: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
    textAlign: 'left',
  },
  editButton: {
    backgroundColor: Colors.boton_azul,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: Colors.boton_rojo_opciones,
    alignItems: 'center',
  },
});