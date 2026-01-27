import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ToastAndroid,
  KeyboardAvoidingView,
  Platform,
  Image,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import TopBar from '../components/TopBar';
import { Calendar as RNCalendar, LocaleConfig } from 'react-native-calendars';
import * as Calendar from 'expo-calendar';
import { Colors, Spacing, Typography } from '../variables';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { especies } from './pacientes';
import DateTimePicker from '@react-native-community/datetimepicker';

// Configurar traducciones para react-native-calendars a español
LocaleConfig.locales['es'] = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

// Events loaded from API
const API_CALENDAR_ENDPOINT = '/calendario/filter';

// Agrupar eventos por fecha
const groupEventsByDate = (events) => {
  const grouped = {};
  events.forEach(event => {
    const dateStr = event.fecha.toISOString().split('T')[0];
    const formattedDate = event.fecha.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    if (!grouped[dateStr]) {
      grouped[dateStr] = {
        date: formattedDate,
        events: []
      };
    }
    
    grouped[dateStr].events.push({
      ...event,
      hora: event.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });
  
  // Convertir a array ordenado
  return Object.keys(grouped)
    .sort()
    .map(dateStr => ({
      dateStr,
      ...grouped[dateStr]
    }));
};

export default function CalendarioScreen() {
  const router = useRouter();
  const [calendarPermGranted, setCalendarPermGranted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiHost, setApiHost] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [modalEvent, setModalEvent] = useState({ id_calendario: null, descripcion: '', fecha: new Date(), paciente: null });
  const [showPickerMode, setShowPickerMode] = useState(null); // 'date' | 'time' | null
  const [savingEvent, setSavingEvent] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);

  // Fetch events for a given month (date may be any date inside the month)
  const fetchEventsForMonth = async (dateInMonth) => {
    setIsLoading(true);
    setApiLoading(true);
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
      setApiHost(host);

      const now = dateInMonth || new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const body = {
        fecha_inicio: start.toISOString().split('T')[0],
        fecha_fin: end.toISOString().split('T')[0]
      };

      const base = host.replace(/\/+$/, '');
      const path = API_CALENDAR_ENDPOINT.startsWith('/') ? API_CALENDAR_ENDPOINT : `/${API_CALENDAR_ENDPOINT}`;
      const url = `${base}${path}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });

      const responseData = await res.json().catch(() => null);

      if (res.status === 403) {
        router.replace('/login');
        return;
      }

      if (!res.ok) {
        // Manejar errores de la API y mostrar mensaje
        let errorMessage = 'Error desconocido';
        if (responseData && responseData.errors && Array.isArray(responseData.errors)) {
          errorMessage = responseData.errors.join('\n• ');
        } else if (responseData && (responseData.message || responseData.description)) {
          errorMessage = responseData.message || responseData.description;
        } else if (responseData) {
          errorMessage = JSON.stringify(responseData);
        }
        Alert.alert(`Error ${res.status}`, errorMessage);
        return;
      }

      const data = responseData;
      if (Array.isArray(data)) {
        setEvents(data.map(ev => ({ ...ev })));
      } else {
        console.warn('Respuesta inesperada del endpoint calendario/filter', data);
      }
    } catch (err) {
      console.error('Error cargando eventos calendario:', err);
      Alert.alert('Error', err.message || 'Error al cargar eventos');
    } finally {
      setIsLoading(false);
      setApiLoading(false);
    }
  };

  const confirmDelete = (id) => {
    Alert.alert(
      'Eliminar evento',
      '¿Estás seguro de que deseas eliminar este evento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteEvent(id) }
      ]
    );
  };

  const deleteEvent = async (id) => {
    try {
      setApiLoading(true);
      const raw = await AsyncStorage.getItem('@config');
      if (!raw) {
        Alert.alert('Error', 'Configuración no encontrada');
        router.replace('/config');
        return;
      }
      const config = JSON.parse(raw);
      const host = config.api_host || config.apihost || config.apiHost;
      const token = config.token;
      if (!host) {
        Alert.alert('Error', 'Host API no configurado');
        router.replace('/config');
        return;
      }

      const base = host.replace(/\/+$/, '');
      const url = `${base}/calendario/Delete/${id}`;

      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      const responseData = await res.json().catch(() => null);

      if (res.status === 403) {
        router.replace('/login');
        return;
      }

      if (!res.ok) {
        let errorMessage = 'Error desconocido';
        if (responseData && responseData.errors && Array.isArray(responseData.errors)) {
          errorMessage = responseData.errors.join('\n• ');
        } else if (responseData && (responseData.message || responseData.description)) {
          errorMessage = responseData.message || responseData.description;
        } else if (responseData) {
          errorMessage = JSON.stringify(responseData);
        }
        Alert.alert(`Error ${res.status}`, errorMessage);
        return;
      }

      Alert.alert('Éxito', 'Evento eliminado');
      // refrescar el mes actual
      fetchEventsForMonth(new Date(selectedDate));
    } catch (err) {
      console.error('Error eliminando evento:', err);
      Alert.alert('Error', err.message || 'Error eliminando evento');
    } finally {
      setApiLoading(false);
    }
  };

  // Agrupar eventos por fecha en un mapa estable (usando datos de la API)
  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      // ev.fecha puede ser string — convertir a Date si es necesario
      const fechaObj = ev.fecha instanceof Date ? ev.fecha : new Date(ev.fecha);
      const dateStr = fechaObj.toISOString().split('T')[0];
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push({
        ...ev,
        fecha: fechaObj,
        hora: fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });
    return map;
  }, [events]);

  // markedDates para el componente Calendar — usar custom styles para mayor visibilidad
  const markedDates = useMemo(() => {
    const m = {};
    Object.keys(eventsByDate).forEach(d => {
      m[d] = {
        customStyles: {
          container: {
            backgroundColor: (Colors.primary || '#2196F3') + '33',
            borderRadius: 6,
            padding: 4
          },
          text: {
            color: Colors.primary,
            fontWeight: '700'
          }
        }
      };
    });
    if (selectedDate) {
      m[selectedDate] = {
        ...(m[selectedDate] || {}),
        customStyles: {
          ...(m[selectedDate]?.customStyles || {}),
          container: {
            backgroundColor: Colors.primary,
            borderRadius: 6
          },
          text: { color: '#fff', fontWeight: '800' }
        }
      };
    }
    return m;
  }, [eventsByDate, selectedDate]);

  useEffect(() => {
    // Pedir permisos una vez
    (async () => {
      try {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        setCalendarPermGranted(status === 'granted');
        if (status !== 'granted') {
          ToastAndroid.show('Permiso de calendario no concedido (solo vista local activa)', ToastAndroid.LONG);
        }
      } catch (e) {
        console.error('Error permisos calendario', e);
      }
    })();
  }, []);

  // Cargar eventos desde API al montar (primer y último día del mes actual)
  useEffect(() => {
    fetchEventsForMonth(new Date());
  }, []);

  const openCreateModal = () => {
    setModalMode('create');
    setModalEvent({ id_calendario: null, descripcion: '', fecha: new Date(), paciente: null });
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setModalMode('edit');
    const fechaObj = item.fecha instanceof Date ? item.fecha : new Date(item.fecha);
    setModalEvent({ ...item, fecha: fechaObj });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setShowPickerMode(null);
  };

  const onPickerChange = (event, selected) => {
    if (selected) {
      setModalEvent(prev => ({ ...prev, fecha: selected }));
    }
    if (Platform.OS === 'android') setShowPickerMode(null);
  };

  const saveEvent = async () => {
    try {
      setSavingEvent(true);
      setApiLoading(true);
      const raw = await AsyncStorage.getItem('@config');
      if (!raw) {
        Alert.alert('Error', 'Configuración no encontrada');
        router.replace('/config');
        return;
      }
      const config = JSON.parse(raw);
      const host = config.api_host || config.apihost || config.apiHost;
      const token = config.token;
      const usuario = config.usuario || {};
      const id_usuario = usuario.id || usuario.id_usuario || usuario.usuario_id || 0;

      if (!host) {
        ToastAndroid.show('Host API no configurado', ToastAndroid.SHORT);
        router.replace('/config');
        return;
      }

      const base = host.replace(/\/+$/, '');
      if (modalMode === 'create') {
        const url = `${base}/calendario/Create`;
        const body = {
          fecha: toLocalISOString(modalEvent.fecha),
          descripcion: modalEvent.descripcion || '',
          id_usuario: id_usuario
        };
        console.log(JSON.stringify(body,null,2));
        
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(body)
        });

        const responseData = await res.json().catch(() => null);

        if (res.status === 403) {
          router.replace('/login');
          return;
        }

        if (!res.ok) {
          let errorMessage = 'Error desconocido';
          if (responseData && responseData.errors && Array.isArray(responseData.errors)) {
            errorMessage = responseData.errors.join('\n• ');
          } else if (responseData && (responseData.message || responseData.description)) {
            errorMessage = responseData.message || responseData.description;
          } else if (responseData) {
            errorMessage = JSON.stringify(responseData);
          }
          Alert.alert(`Error ${res.status}`, errorMessage);
          return;
        }

        Alert.alert('Éxito', 'Evento creado');
        closeModal();
        fetchEventsForMonth(modalEvent.fecha || new Date());
      } else if (modalMode === 'edit') {
        const id = modalEvent.id_calendario;
        const url = `${base}/calendario/Update/${id}`;
        const body = {
          fecha: toLocalISOString(modalEvent.fecha),
          descripcion: modalEvent.descripcion || '',
          id_usuario: id_usuario
        };

        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
        });

        const responseData = await res.json().catch(() => null);

        if (res.status === 403) {
          router.replace('/login');
          return;
        }

        if (!res.ok) {
          let errorMessage = 'Error desconocido';
          if (responseData && responseData.errors && Array.isArray(responseData.errors)) {
            errorMessage = responseData.errors.join('\n• ');
          } else if (responseData && (responseData.message || responseData.description)) {
            errorMessage = responseData.message || responseData.description;
          } else if (responseData) {
            errorMessage = JSON.stringify(responseData);
          }
          Alert.alert(`Error ${res.status}`, errorMessage);
          return;
        }

        Alert.alert('Éxito', 'Evento actualizado');
        closeModal();
        fetchEventsForMonth(modalEvent.fecha || new Date());
      }
    } catch (err) {
      console.error('Error guardando evento:', err);
      Alert.alert('Error', err.message || 'Error guardando evento');
    } finally {
      setSavingEvent(false);
      setApiLoading(false);
    }
  };

  const addToDeviceCalendar = async (event) => {
    if (!calendarPermGranted) {
      ToastAndroid.show('Permiso de calendario no concedido', ToastAndroid.SHORT);
      return;
    }

    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      let cal = calendars.find(c => c.allowsModifications) || calendars[0];
      if (!cal) {
        ToastAndroid.show('No se encontró calendario disponible en el dispositivo', ToastAndroid.SHORT);
        return;
      }

      const startDate = event.fecha;
      const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

      await Calendar.createEventAsync(cal.id, {
        title: event.descripcion || 'Evento V-Doctor',
        startDate,
        endDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: '',
        notes: event.descripcion
      });

      ToastAndroid.show('Evento añadido al calendario del dispositivo', ToastAndroid.LONG);
    } catch (err) {
      console.error('Error creando evento en calendario:', err);
      ToastAndroid.show('Error al añadir evento al calendario', ToastAndroid.SHORT);
    }
  };

  const renderEventItem = ({ item }) => (
    <TouchableOpacity style={styles.eventItem} key={item.id_calendario} onPress={() => openEditModal(item)}>
      {/* Left: patient image (if any) */}
      {item.paciente ? (
        <Image
          source={getPatientImageSource(item.paciente)}
          style={styles.pacienteImage}
          resizeMode="cover"
        />
      ) : (
        <View style={{ width: 70, height: 70 }} />
      )}

      <View style={styles.eventMain}>
        <Text style={styles.eventTitle}>{item.descripcion}</Text>
        <Text style={styles.eventTime}>{item.hora} • Creado por: {item.usuario?.nombre_natural || item.usuario?.nombre_usuario || '—'}</Text>

        {item.paciente && (
          <View style={{ marginTop: Spacing.s }}>
            <Text style={[styles.pacienteName, { fontSize: Typography.body }]}>
              {item.paciente.nombre}{item.paciente.numero_clinico ? ` - ${item.paciente.numero_clinico}` : ''}
            </Text>
            <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Especie:</Text> {item.paciente.especie || '—'}</Text>
            <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Raza:</Text> {item.paciente.raza || '—'}</Text>
            <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Sexo:</Text> {item.paciente.sexo || '—'}</Text>
            <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Nac.:</Text> {formatDate(item.paciente.fecha_nacimiento)} - <Text style={styles.pacienteAgeBold}>{computeAgeString(item.paciente.fecha_nacimiento)}</Text></Text>
          </View>
        )}
      </View>

      <View style={styles.eventActions}>
        {item.paciente && (
          <TouchableOpacity
            style={[styles.smallActionButton, styles.huellaButton]}
            onPress={() => router.push({ pathname: '/pacienteModal', params: { mode: 'ver', paciente: JSON.stringify(item.paciente) } })}
          >
            <Image source={require('../assets/images/especies/huella.png')} style={[styles.smallIcon, styles.huellaIcon]} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.smallActionButton, styles.deleteButton]} onPress={() => confirmDelete(item.id_calendario)}>
          <Image source={require('../assets/images/basura.png')} style={styles.smallIcon} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Helper: build image source for paciente
  function getPatientImageSource(paciente) {
    try {
      if (!paciente) return require('../assets/images/especies/huella.png');

      if (paciente.foto_url) {
        const cleanedUrl = String(paciente.foto_url).replace(/\\/g, '/').replace(/\/\/+/g, '/');
        return { uri: `${cleanedUrl}${cleanedUrl.includes('?') ? '&' : '?'}t=${Date.now()}` };
      }

      if (paciente.foto_ruta) {
        const cleaned = String(paciente.foto_ruta).replace(/\\/g, '/').replace(/^\/+/, '');
        if (/^https?:\/\//i.test(cleaned)) {
          return { uri: cleaned };
        } else if (apiHost) {
          const baseHost = apiHost.replace(/\/+$/, '');
          const cleanPath = cleaned.replace(/^\/+/, '');
          const finalUrl = `${baseHost}/${cleanPath}`;
          return { uri: `${finalUrl}${finalUrl.includes('?') ? '&' : '?'}t=${Date.now()}` };
        }
      }

      if (paciente.photoUri) return { uri: paciente.photoUri };

      if (paciente.especie) {
        const especieEncontrada = especies.find(e => e.nombre && String(e.nombre).toLowerCase() === String(paciente.especie).toLowerCase());
        if (especieEncontrada && especieEncontrada.image) return especieEncontrada.image;
      }

      return require('../assets/images/especies/huella.png');
    } catch (e) {
      return require('../assets/images/especies/huella.png');
    }
  }

  function formatDate(dateString) {
    if (!dateString) return 'No especificada';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('es-ES');
    } catch (e) {
      return dateString;
    }
  }

  // Convertir Date/local datetime a ISO string sin ajustar a UTC (mantener fecha/hora local)
  function toLocalISOString(d) {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return String(d);
    const pad = (n) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${y}-${m}-${dd}T${hh}:${mm}:${ss}`;
  }

  function computeAgeString(birthDate) {
    if (!birthDate) return 'No especificada';
    try {
      const nacimiento = new Date(birthDate);
      const hoy = new Date();
      let años = hoy.getFullYear() - nacimiento.getFullYear();
      let meses = hoy.getMonth() - nacimiento.getMonth();
      if (meses < 0) {
        años--; meses += 12;
      }
      return `${años} Años ${meses} Meses`;
    } catch (e) {
      return '';
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TopBar onMenuNavigate={() => {}} />

      <View style={styles.content}>
        <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => { router.replace('/'); }} style={styles.backButton}>
                        <Image source={require('../assets/images/arrow-left.png')} style={styles.backButtonImage} resizeMode="contain" />
                      </TouchableOpacity>
          <View style={styles.header}>
            <Text style={styles.title}>Calendario</Text>
          </View>

          <TouchableOpacity style={styles.addEventButton} onPress={openCreateModal}>
            <Text style={styles.addEventText}>+ Agregar</Text>
          </TouchableOpacity>
        </View>

        <RNCalendar
          current={new Date().toISOString().split('T')[0]}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          onMonthChange={(month) => {
            // `month` may have a `dateString` like 'YYYY-MM-01' or fields year/month
            try {
              let monthDate;
              if (month && month.dateString) {
                monthDate = new Date(month.dateString);
              } else if (month && month.year && month.month) {
                monthDate = new Date(month.year, month.month - 1, 1);
              } else {
                monthDate = new Date();
              }
              fetchEventsForMonth(monthDate);
            } catch (e) {
              console.warn('Error parsing month change', e);
            }
          }}
          markedDates={markedDates}
          markingType={'custom'}
          theme={{
            todayTextColor: Colors.primary,
            arrowColor: Colors.primary,
            selectedDayBackgroundColor: Colors.primary,
          }}
        />

        {(isLoading || apiLoading) && (
          <View style={styles.loadingOverlay} pointerEvents="box-none">
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={{ marginTop: Spacing.s, color: Colors.textSecondary }}>Cargando eventos...</Text>
            </View>
          </View>
        )}

        <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <ScrollView>
                <Text style={styles.fieldLabel}>Fecha</Text>
                <TouchableOpacity style={[styles.modalButton, styles.modalDateButton]} onPress={() => setShowPickerMode('date')}>
                  <Text style={styles.modalDateButtonText}>{modalEvent.fecha ? modalEvent.fecha.toLocaleDateString('es-ES') : 'Seleccionar fecha'}</Text>
                </TouchableOpacity>

                <Text style={styles.fieldLabel}>Hora</Text>
                <TouchableOpacity style={[styles.modalButton, styles.modalDateButton]} onPress={() => setShowPickerMode('time')}>
                  <Text style={styles.modalDateButtonText}>{modalEvent.fecha ? modalEvent.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Seleccionar hora'}</Text>
                </TouchableOpacity>

                {showPickerMode && (
                  <DateTimePicker value={modalEvent.fecha || new Date()} mode={showPickerMode} is24Hour={false} display="default" onChange={onPickerChange} />
                )}

                <Text style={styles.fieldLabel}>Descripción</Text>
                <TextInput style={styles.input} value={modalEvent.descripcion} onChangeText={(t) => setModalEvent(prev => ({ ...prev, descripcion: t }))} placeholder="Descripción" />

                {modalEvent.paciente && (
                  <TouchableOpacity
                    style={[styles.verPacienteRow, styles.huellaButton]}
                    onPress={() => router.push({ pathname: '/pacienteModal', params: { mode: 'ver', paciente: JSON.stringify(modalEvent.paciente) } })}
                  >
                    <Image source={require('../assets/images/especies/huella.png')} style={[styles.smallIcon, styles.huellaIcon]} />
                    <Text style={styles.verPacienteText}>Ver Paciente</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity style={[styles.modalButton, { backgroundColor: Colors.boton_azul }]} onPress={saveEvent} disabled={savingEvent}>
                    <Text style={[styles.modalButtonText, { color: Colors.textPrimary }]}>{savingEvent ? 'Guardando...' : 'Guardar'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, { backgroundColor: Colors.boton_rojo_opciones }]} onPress={closeModal} disabled={savingEvent}>
                    <Text style={[styles.modalButtonText, { color: Colors.textPrimary }]}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <View style={styles.eventsListContainer}>
          <Text style={styles.sectionTitle}>Eventos</Text>
          <FlatList
            data={eventsByDate[selectedDate] || []}
            keyExtractor={(item) => String(item.id_calendario)}
            renderItem={renderEventItem}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}><Text style={styles.emptyText}>No hay eventos para esta fecha</Text></View>
            )}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  content: {
    flex: 1
  },
  header: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.s
  },
  backButton: { position: 'absolute', left: Spacing.m, top: 10, padding: 8, backgroundColor: Colors.primarySuave, borderRadius: 8, zIndex: 2 },
  backButtonImage: { width: 20, height: 20, tintColor: Colors.textPrimary },
  title: { 
    fontSize: Typography.h2, 
    fontWeight: 'bold', 
    color: Colors.primary 
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: Spacing.m
  },
  dateGroup: {
    marginBottom: Spacing.l
  },
  dateHeader: {
    fontSize: Typography.h3,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.s,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + '20'
  },
  eventItem: { 
    backgroundColor: '#fff', 
    padding: Spacing.m, 
    marginBottom: Spacing.s,
    borderRadius: 8, 
    elevation: 1, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  eventMain: { 
    flex: 1, 
    paddingRight: Spacing.s 
  },
  pacienteImage: { width: 70, height: 70, borderRadius: 110 / 2, marginLeft: 8, marginRight: 8, borderWidth: 1, borderColor: '#ddd' },
  pacienteName: { fontSize: Typography.body, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  pacienteText: { fontSize: Typography.small, color: Colors.textSecondary, marginBottom: 2 },
  pacienteAgeBold: {
    fontWeight: '700'
  },
  eventTitle: { 
    fontSize: Typography.body, 
    color: Colors.textSecondary, 
    fontWeight: '600' 
  },
  eventTime: { 
    fontSize: Typography.small, 
    color: Colors.textSecondary, 
    marginTop: 6 
  },
  eventActions: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: Spacing.s,
  },
  smallActionButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  smallIcon: {
    width: 18,
    height: 18,
    tintColor: Colors.textPrimary
  },
  editButton: {
    backgroundColor: Colors.boton_azul
  },
  huellaButton: {
    backgroundColor: (Colors.success || Colors.boton_verde) || '#4CAF50'
  },
  huellaIcon: {
    tintColor: '#fff'
  },
  deleteButton: {
    backgroundColor: Colors.boton_rojo_opciones
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center'
  },
  emptyText: { 
    color: Colors.textSecondary,
    fontSize: Typography.body
  }
  ,
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.m,
    height: 56,
    position: 'relative'
  },
  addEventButton: {
    position: 'absolute',
    right: Spacing.m,
    top: 10,
    backgroundColor: Colors.boton_azul,
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.m,
    borderRadius: 8
  },
  addEventText: {
    color: Colors.textPrimary,
    fontWeight: '700'
  }
  ,
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)'
  },
  loadingBox: {
    padding: Spacing.l,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4
  }
  ,
  modalOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: Spacing.m
  },
  fieldLabel: {
    fontWeight: '700',
    marginTop: Spacing.s,
    marginBottom: Spacing.xs
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: Spacing.s,
    minHeight: 40,
    marginBottom: Spacing.s
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.m
  },
  modalButton: {
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.m,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: Spacing.s,
    flex: 1,
    marginRight: Spacing.s
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '700'
  },
  modalDateButton: {
    backgroundColor: Colors.boton_azul || Colors.primary || '#2196F3',
    flex: 0,
    marginRight: 0
  },
  modalDateButtonText: {
    color: '#fff',
    fontWeight: '700'
  },
  verPacienteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.s,
    borderRadius: 8,
    marginTop: Spacing.s
  },
  verPacienteText: {
    color: '#fff',
    marginLeft: Spacing.s,
    fontWeight: '700'
  }
});