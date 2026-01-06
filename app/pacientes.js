import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ToastAndroid,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import TopBar from '../components/TopBar';
import DropdownGenerico from '../components/DropdownGenerico';
import { Colors, Spacing, Typography } from '../variables';

const { width: screenWidth } = Dimensions.get('window');

export const especies = [
    { id: 1, nombre: 'Canino', image: require('../assets/images/especies/canino.png') },
    { id: 2, nombre: 'Felino', image: require('../assets/images/especies/gato-egipcio.png') },
    { id: 3, nombre: 'Ave', image: require('../assets/images/especies/gorrion.png') },
    { id: 4, nombre: 'Roedor', image: require('../assets/images/especies/huella.png') },
    { id: 5, nombre: 'Peces', image: require('../assets/images/especies/huella.png') },
    { id: 6, nombre: 'Caprino', image: require('../assets/images/especies/huella.png') },
    { id: 7, nombre: 'Porcino', image: require('../assets/images/especies/cerdo.png') },
    { id: 8, nombre: 'Ovino', image: require('../assets/images/especies/huella.png') },
    { id: 9, nombre: 'Otros', image: require('../assets/images/especies/huella.png') },
  ];
  
export default function PacientesScreen() {
  const router = useRouter();

  const [searchText, setSearchText] = useState(''); // nombre paciente
  const [searchCliente, setSearchCliente] = useState(''); // nombre cliente
  const [filters, setFilters] = useState({
    raza: '',
    numero_clinico: '',
    sexo: '',
    especie: '',
    descripcion: ''
  });
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5); // Cambiado de 10 a 5
  const [isLoading, setIsLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [pacientesData, setPacientesData] = useState([]);

  const isScreenFocused = useRef(false);

  const [apiHost, setApiHost] = useState('');

  // Cálculos de paginación
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  useEffect(() => {
    const getApiHost = async () => {
      try {
        const raw = await AsyncStorage.getItem('@config');
        if (raw) {
          const config = JSON.parse(raw);
          const host = config.api_host || config.apihost || config.apiHost;
          setApiHost(host || '');
        }
      } catch (error) {
        console.error('Error getting apiHost:', error);
      }
    };
    getApiHost();
  }, []);

  // Dropdown data
  const sexos = [
    { id: 1, nombre: 'macho' },
    { id: 2, nombre: 'hembra' },
    { id: 3, nombre: 'otros' }
  ];

  const handleMenuNavigate = (link) => {
    console.log('Navegando a:', link);
  };

  const computeAgeString = (birthDate) => {
    if (!birthDate) return '';

    try {
      // Convertir a objeto Date
      const b = new Date(birthDate);
      const now = new Date();

      // Validar que la fecha sea válida
      if (isNaN(b.getTime())) return 'Fecha inválida';

      // Validar que no sea fecha futura
      if (b > now) return 'Fecha futura';

      let years = now.getFullYear() - b.getFullYear();
      let months = now.getMonth() - b.getMonth();
      let days = now.getDate() - b.getDate();

      if (days < 0) {
        months -= 1;
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        days += prevMonth.getDate();
      }

      if (months < 0) {
        years -= 1;
        months += 12;
      }

      if (years > 0) return `${years} año${years > 1 ? 's' : ''} y ${months} mes${months > 1 ? 'es' : ''}`;
      if (months > 0) return `${months} mes${months > 1 ? 'es' : ''} y ${days} día${days > 1 ? 's' : ''}`;
      return `${days} día${days > 1 ? 's' : ''}`;

    } catch (error) {
      console.error('Error calculando edad:', error);
      return 'Error cálculo';
    }
  };

  // Función para formatear la fecha a un formato legible
  const formatDate = (dateString) => {
    if (!dateString) return 'No especificada';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Fecha inválida';

      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Error formato';
    }
  };

  const fetchPatients = async (page = currentPage, isSearch = false) => {
    setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem('@config');
      if (!raw) throw new Error('No hay configuración de API');
      const config = JSON.parse(raw);
      const host = config.api_host || config.apihost || config.apiHost;
      const token = config.token;
      if (!host) throw new Error('Host API no configurado');

      const url = `${host.replace(/\/+$/, '')}/paciente/Filter/${itemsPerPage}/${page}`;

      // Crear el body dinámicamente
      const body = {
        nombre: searchText || '',
        raza: filters.raza || '',
        especie: filters.especie || '',
        sexo: filters.sexo || '',
        nombre_cliente: searchCliente || '',
        descripcion: filters.descripcion || ''
      };

      // Solo agregar numero_clinico si no está vacío
      if (filters.numero_clinico !== '') {
        body.numero_clinico = Number(filters.numero_clinico);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });

      if (response.status === 403) {
        ToastAndroid.show('Acceso denegado', ToastAndroid.SHORT);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Error al obtener pacientes');
      }

      const data = await response.json();
      const pacientes = (data.data || []).map(item => ({
        ...item,
        id: item.id_paciente ?? item.id ?? null,
        nombre: item.nombre ?? '',
        raza: item.raza ?? '',
        especie: item.especie ?? '',
        sexo: item.sexo ?? '',
        numero_clinico: item.numero_clinico ?? '',
        foto_url: item.foto_ruta ? `${host.replace(/\/+$/, '')}/${item.foto_ruta.replace(/^\//, '')}` : null,
        clientes: item.clientes || []
      }));

      setPacientesData(pacientes);
      const pagination = data.pagination || {};
      setTotalItems(pagination.total || pacientes.length);
      setCurrentPage(pagination.currentPage || page);
    } catch (error) {
      console.error('Error fetching patients:', error);
      try {
        const localRaw = await AsyncStorage.getItem('@pacientes');
        if (localRaw) {
          const local = JSON.parse(localRaw) || [];
          // Aplicar filtros locales si la llamada fue una búsqueda
          const pacientesParaMostrar = isSearch ? aplicarFiltrosLocales(local) : local;
          // Actualizar estado con datos locales
          setPacientesData(pacientesParaMostrar);
          setTotalItems(pacientesParaMostrar.length);
          setCurrentPage(1);
          ToastAndroid.show('⚠️ Sin conexión. Mostrando datos locales guardados', ToastAndroid.LONG);
        } else {
          ToastAndroid.show('❌ Sin conexión y no hay datos locales guardados', ToastAndroid.LONG);
        }
      } catch (e) {
        console.error('Error cargando pacientes locales:', e);
        ToastAndroid.show('❌ Error al cargar datos locales', ToastAndroid.SHORT);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const guardarPacientesLocales = async () => {
    setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem('@config');
      if (!raw) throw new Error('No hay configuración');
      const config = JSON.parse(raw);
      const host = config.api_host || config.apihost || config.apiHost;
      const token = config.token;
      if (!host) throw new Error('Host no configurado');

      const url = `${host.replace(/\/+$/, '')}/paciente`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) throw new Error('Error al descargar pacientes');
      const data = await response.json();
      const pacientes = Array.isArray(data) ? data : data.data || [];

      // ✅ Mapear pacientes para eliminar foto_ruta antes de guardar
      const pacientesSinFotos = pacientes.map(paciente => {
        const { foto_ruta, ...pacienteSinFoto } = paciente;
        return {
          ...pacienteSinFoto,
          id: paciente.id_paciente ?? paciente.id
        };
      });

      await AsyncStorage.setItem('@pacientes', JSON.stringify(pacientesSinFotos));
      ToastAndroid.show(`✅ ${pacientesSinFotos.length} pacientes guardados localmente`, ToastAndroid.LONG);
      setPacientesData(pacientesSinFotos);
      setTotalItems(pacientesSinFotos.length);
    } catch (error) {
      console.error('Error guardarPacientesLocales:', error);
      ToastAndroid.show('Error al guardar pacientes', ToastAndroid.SHORT);
    } finally {
      setIsLoading(false);
    }
  };

  const aplicarFiltrosLocales = (pacientes) => {
    return pacientes.filter(p => {
      const nombreMatch = !searchText || (p.nombre && p.nombre.toLowerCase().includes(searchText.toLowerCase()));
      const clienteMatch = !searchCliente || (p.clientes && p.clientes.some(c => c.nombre && c.nombre.toLowerCase().includes(searchCliente.toLowerCase())));
      const razaMatch = !filters.raza || (p.raza && p.raza.toLowerCase().includes(filters.raza.toLowerCase()));
      const numeroMatch = !filters.numero_clinico || String(p.numero_clinico).includes(String(filters.numero_clinico));
      const especieMatch = !filters.especie || (p.especie && p.especie.toLowerCase() === filters.especie.toLowerCase());
      const sexoMatch = !filters.sexo || (p.sexo && p.sexo.toLowerCase() === filters.sexo.toLowerCase());
      const descMatch = !filters.descripcion || (p.historia_clinica && p.historia_clinica.toLowerCase().includes(filters.descripcion.toLowerCase()));
      return nombreMatch && clienteMatch && razaMatch && numeroMatch && especieMatch && sexoMatch && descMatch;
    });
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchPatients(1, true);
  };

  // Funciones para manejar el cambio de página
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      isScreenFocused.current = true;
      fetchPatients(currentPage, false);
      return () => { isScreenFocused.current = false; };
    }, [])
  );

  useEffect(() => {
    if (isScreenFocused.current) {
      fetchPatients(currentPage, false);
    }
  }, [currentPage]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setSearchText('');
    setSearchCliente('');
    setFilters({ raza: '', numero_clinico: '', sexo: '', especie: '', descripcion: '' });
  };

  const handleRowClick = (paciente) => {
    router.push({ pathname: '/pacienteModal', params: { mode: 'ver', paciente: JSON.stringify(paciente) } });
  };

  const deletePacienteServer = (paciente) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Está seguro de eliminar al paciente ${paciente.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive', onPress: async () => {
            try {
              const raw = await AsyncStorage.getItem('@config');
              if (!raw) throw new Error('No hay config');
              const config = JSON.parse(raw);
              const host = config.api_host || config.apihost || config.apiHost;
              const token = config.token;
              const url = `${host.replace(/\/+$/, '')}/paciente/Delete/${paciente.id_paciente ?? paciente.id}`;
              const response = await fetch(url, { method: 'DELETE', headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) } });
              if (!response.ok) throw new Error('Error eliminando');
              ToastAndroid.show('Paciente eliminado', ToastAndroid.SHORT);
              fetchPatients(currentPage, false);
            } catch (err) {
              console.error(err);
              ToastAndroid.show('Error al eliminar paciente', ToastAndroid.SHORT);
            }
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <TopBar onMenuNavigate={handleMenuNavigate} />

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.searchContainer}>
          <TouchableOpacity onPress={() => { router.replace('/'); }} style={styles.backButton}>
            <Image source={require('../assets/images/arrow-left.png')} style={styles.backButtonImage} resizeMode="contain" />
          </TouchableOpacity>

          <Text style={styles.searchTitle}>Opciones de búsqueda</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Buscar paciente</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Ingresa el nombre del paciente"
              value={searchText}
              onChangeText={setSearchText}
              placeholderTextColor="#999"
            />

            <View style={{ height: Spacing.s }} />
            <Text style={styles.inputLabel}>Buscar por nombre de cliente</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Ingresa el nombre del cliente"
              value={searchCliente}
              onChangeText={setSearchCliente}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity style={styles.moreOptionsButton} onPress={() => setShowMoreOptions(prev => !prev)}>
              <Image source={require('../assets/images/arrow-button.png')} style={styles.moreOptionsIcon} resizeMode="contain" />
              <Text style={styles.moreOptionsText}>{showMoreOptions ? 'Menos opciones' : 'Más opciones'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              <Image source={require('../assets/images/loupe.png')} style={styles.searchIcon} resizeMode="contain" />
              <Text style={styles.searchButtonText}>Buscar</Text>
            </TouchableOpacity>
          </View>

          {showMoreOptions && (
            <View style={styles.additionalOptions}>
              <View style={styles.additionalRow}>
                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                  <Text style={styles.inputLabel}>Raza</Text>
                  <TextInput
                    style={styles.additionalInput}
                    placeholder="Ej: Pequinés"
                    value={filters.raza}
                    onChangeText={(v) => handleFilterChange('raza', v)}
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                  <Text style={styles.inputLabel}>N° Clínico</Text>
                  <TextInput
                    style={styles.additionalInput}
                    placeholder="Ej: 123"
                    value={String(filters.numero_clinico)}
                    onChangeText={(v) => handleFilterChange('numero_clinico', v.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <View style={styles.additionalRow}>
                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                  <Text style={styles.inputLabel}>Sexo</Text>
                  <DropdownGenerico
                    data={sexos}
                    value={filters.sexo}
                    onValueChange={(item) => handleFilterChange('sexo', item.nombre || item)}
                    displayKey="nombre"
                    searchKey="nombre"
                    placeholder="Seleccionar sexo"
                    style={{ width: '100%' }}
                    enableFreeText={false}
                  />
                </View>

                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                  <Text style={styles.inputLabel}>Especie</Text>
                  <DropdownGenerico
                    data={especies}
                    value={filters.especie}
                    onValueChange={(item) => handleFilterChange('especie', item.nombre || item)}
                    displayKey="nombre"
                    searchKey="nombre"
                    placeholder="Seleccionar especie"
                    style={{ width: '100%' }}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Descripción</Text>
                <TextInput
                  style={[styles.additionalInput, { minHeight: 80 }]}
                  placeholder="Buscar por historia clínica u observaciones"
                  value={filters.descripcion}
                  onChangeText={(v) => handleFilterChange('descripcion', v)}
                  placeholderTextColor="#999"
                />
              </View>

              <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                <Text style={styles.clearButtonText}>Limpiar Filtros</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.saveButton} onPress={guardarPacientesLocales}>
            <Image source={require('../assets/images/descargar.png')} style={styles.saveButtonIcon} resizeMode="contain" />
            <Text style={styles.saveButtonText}>Guardar datos locales</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addButton} onPress={() => router.push({ pathname: '/pacienteModal', params: { mode: 'crear' } })}>
            <Text style={styles.addButtonText}>+ Agregar Paciente</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryDark, paddingVertical: Spacing.s, paddingHorizontal: Spacing.s, borderRadius: 8, width: '102%', height: 50 }}
           onPress={() => router.push({ pathname: '/asociarPacienteCliente'})}>
            <Image source={require('../assets/images/intercambiar.png')} style={styles.saveButtonIcon} resizeMode="contain" />
            <Text style={styles.saveButtonText}>Asociar Pacientes con Clientes</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pacientesListContainer}>
          {isLoading && (
            <View style={{ padding: Spacing.m, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          )}

          {!isLoading && pacientesData.length === 0 && (
            <View style={{ padding: Spacing.m }}>
              <Text>No hay pacientes disponibles</Text>
            </View>
          )}

          {pacientesData.map((p, idx) => {
            const especieMatch = especies.find(e => e.nombre && String(e.nombre).toLowerCase() === String(p.especie).toLowerCase());

            // Aplicar lógica para preferir siempre la imagen desde la API si existe
            let imgSource;
            if (p.foto_url) {
              // Usar foto_url si está disponible, pero normalizarla y añadir cache-buster
              const cleanedUrl = String(p.foto_url).replace(/\\/g, '/').replace(/\/\/+/g, '/');
              imgSource = { uri: `${cleanedUrl}${cleanedUrl.includes('?') ? '&' : '?'}t=${Date.now()}` };
            } else if (p.foto_ruta) {
              // Si hay foto_ruta construir URL completa a partir de apiHost o usar ruta absoluta
              const cleaned = String(p.foto_ruta).replace(/\\/g, '/').replace(/^\/+/, '');
              if (/^https?:\/\//i.test(cleaned)) {
                imgSource = { uri: cleaned };
              } else if (apiHost) {
                const baseHost = apiHost.replace(/\/+$/, '');
                const cleanPath = cleaned.replace(/^\/+/, '');
                const finalUrl = `${baseHost}/${cleanPath}`;
                imgSource = { uri: `${finalUrl}${finalUrl.includes('?') ? '&' : '?'}t=${Date.now()}` };
              } else {
                imgSource = especieMatch ? especieMatch.image : require('../assets/images/especies/huella.png');
              }
            } else if (p.photoUri) {
              // Usar imagen local tomada sólo si no hay imagen en la API
              imgSource = { uri: p.photoUri };
            } else {
              // Finalmente, imagen por especie o placeholder
              imgSource = especieMatch ? especieMatch.image : require('../assets/images/especies/huella.png');
            }

            return (
              <TouchableOpacity key={p.id ?? idx} style={styles.pacienteItem} onPress={() => handleRowClick(p)} activeOpacity={0.8}>
                <Image source={imgSource} style={styles.pacienteImage} resizeMode="cover" />
                <View style={styles.pacienteInfo}>
                  <Text style={styles.pacienteName}>
                    {p.nombre}
                    {p.numero_clinico ? <Text style={{ fontWeight: '700' }}> - {p.numero_clinico}</Text> : null}
                  </Text>
                  <Text style={styles.pacienteText}>
                    <Text style={{ fontWeight: '600' }}>Dueño/s:</Text> {
                      p.clientes && p.clientes.length > 0
                        ? (() => {
                          const primerosDos = p.clientes.slice(0, 2);
                          const nombres = primerosDos.map(cliente => cliente.nombre).join(', ');
                          return p.clientes.length > 2 ? `${nombres}, ...` : nombres;
                        })()
                        : 'No especificado'
                    }
                  </Text>
                  <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Especie:</Text> {p.especie}</Text>
                  <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Sexo:</Text> {p.sexo}</Text>
                  <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Raza:</Text> {p.raza}</Text>

                  <Text style={styles.pacienteText}>
                    <Text style={{ fontWeight: '600' }}>Fecha de nacimiento:</Text> {formatDate(p.fecha_nacimiento)} -
                    <Text style={styles.pacienteAgeBold}> {computeAgeString(p.fecha_nacimiento)}</Text>
                  </Text>
                </View>

                <View style={{ flexDirection: 'column', padding: Spacing.s }}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: Colors.boton_azul, marginBottom: Spacing.s }]}
                    onPress={() => router.push({ pathname: '/pacienteModal', params: { mode: 'editar', paciente: JSON.stringify(p) } })}
                  >
                    <Image source={require('../assets/images/editar.png')} style={{ width: 20, height: 20, tintColor: Colors.textPrimary }} resizeMode="contain" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: Colors.boton_rojo_opciones }]}
                    onPress={() => deletePacienteServer(p)}
                  >
                    <Image source={require('../assets/images/basura.png')} style={{ width: 20, height: 20, tintColor: Colors.textPrimary }} resizeMode="contain" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Controles de paginación */}
          {totalItems > 0 && (
            <View style={styles.paginationContainer}>
              {/* Primera fila: Botones Anterior y Siguiente */}
              <View style={styles.paginationControls}>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    currentPage === 1 && styles.paginationButtonDisabled
                  ]}
                  onPress={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <Text style={[
                    styles.paginationButtonText,
                    currentPage === 1 && styles.paginationButtonTextDisabled
                  ]}>
                    Anterior
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    currentPage >= totalPages && styles.paginationButtonDisabled
                  ]}
                  onPress={handleNextPage}
                  disabled={currentPage >= totalPages}
                >
                  <Text style={[
                    styles.paginationButtonText,
                    currentPage >= totalPages && styles.paginationButtonTextDisabled
                  ]}>
                    Siguiente
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Segunda fila: Información de paginación */}
              <View style={styles.paginationInfoContainer}>
                <Text style={styles.paginationInfo}>
                  {startIndex} - {endIndex} de {totalItems} pacientes
                </Text>
                <Text style={styles.paginationPageInfo}>
                  Página {currentPage} de {totalPages}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flex: 1 },
  scrollContentContainer: { flexGrow: 1 },
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
  backButton: { position: 'absolute', left: 10, top: 10, padding: 8, backgroundColor: Colors.primarySuave, borderRadius: 8, zIndex: 1 },
  backButtonImage: { width: 20, height: 20, tintColor: Colors.textPrimary },
  searchTitle: { fontSize: Typography.h3, fontWeight: 'bold', color: Colors.primary, marginBottom: Spacing.m, textAlign: 'center', marginTop: 10 },
  inputGroup: { marginBottom: Spacing.m },
  responsiveInputGroup: { flex: 1, minWidth: 0 },
  inputLabel: { fontSize: Typography.body, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs },
  searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.primarySuave, borderRadius: 8, paddingHorizontal: Spacing.m, paddingVertical: Spacing.s, fontSize: Typography.body, color: Colors.textSecondary, minHeight: 44, width: '100%' },
  buttonsContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.s, marginTop: Spacing.s },
  moreOptionsButton: { backgroundColor: Colors.primary, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.s, paddingHorizontal: Spacing.m, borderRadius: 8, elevation: 1, gap: Spacing.xs, minHeight: 44 },
  moreOptionsIcon: { width: 16, height: 16, tintColor: Colors.textPrimary },
  moreOptionsText: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '600' },
  searchButton: { backgroundColor: Colors.boton_azul, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.s, paddingHorizontal: Spacing.m, borderRadius: 8, elevation: 1, gap: Spacing.xs, minHeight: 44 },
  searchIcon: { width: 16, height: 16, tintColor: Colors.textPrimary },
  searchButtonText: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '600' },
  additionalOptions: { marginTop: Spacing.m, paddingTop: Spacing.m, borderTopWidth: 1, borderTopColor: Colors.primarySuave },
  additionalRow: { flexDirection: 'row', gap: Spacing.s, marginBottom: Spacing.m, flexWrap: 'wrap' },
  additionalInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.primarySuave, borderRadius: 8, paddingHorizontal: Spacing.m, paddingVertical: Spacing.s, fontSize: Typography.body, color: Colors.textSecondary, minHeight: 44, width: '100%' },
  clearButton: { backgroundColor: Colors.boton_rojo_opciones, paddingVertical: Spacing.s, paddingHorizontal: Spacing.m, borderRadius: 8, alignItems: 'center', marginTop: Spacing.s, alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  clearButtonText: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: 'bold' },
  actionsContainer: { flexDirection: 'row', justifyContent: 'flex-start', gap: Spacing.s, marginHorizontal: Spacing.m, marginBottom: Spacing.s },
  saveButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryDark, paddingVertical: Spacing.s, paddingHorizontal: Spacing.s, borderRadius: 8, width: '50%' },
  saveButtonIcon: { width: 18, height: 18, marginRight: Spacing.s, tintColor: Colors.textPrimary },
  saveButtonText: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '600' },
  addButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.boton_azul, paddingVertical: Spacing.s, paddingHorizontal: Spacing.s, borderRadius: 8, width: '50%' },
  addButtonText: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '600' },
  pacientesListContainer: { marginTop: Spacing.m },
  pacienteItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#000', borderRadius: 8, marginBottom: Spacing.s, overflow: 'hidden', position: 'relative', minHeight: 110 },
  pacienteImage: { width: 70, height: 70, borderRadius: 110 / 2, marginLeft: 8, marginRight: 8, borderWidth: 1, borderColor: '#ddd' },
  pacienteInfo: { flex: 1, padding: Spacing.s },
  pacienteName: { fontSize: Typography.body, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  pacienteText: { fontSize: Typography.small, color: Colors.textSecondary, marginBottom: 2 },
  actionButton: { alignItems: 'center', justifyContent: 'center', padding: Spacing.s, borderRadius: 8, backgroundColor: Colors.primary },
  tableContainer: { margin: Spacing.m, height: 560 },
  pacienteAgeBold: {
    fontWeight: '700'
  },
  // Estilos para la paginación
  paginationContainer: {
    paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.m,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: Spacing.s,
  },
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.s,
    marginBottom: Spacing.s,
  },
  paginationInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paginationButton: {
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.m,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: Colors.primarySuave,
    borderColor: Colors.primarySuave,
  },
  paginationButtonText: {
    fontSize: Typography.small,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  paginationButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  paginationInfo: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  paginationPageInfo: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});