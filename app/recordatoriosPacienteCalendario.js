import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ScrollView, StyleSheet, ActivityIndicator, Alert, ToastAndroid, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PatientSidebarMenu from '../components/PatientSidebarMenu';
import { Colors, Spacing, Typography, ColorsData } from '../variables';
import TopBar from '../components/TopBar';

export default function RecordatoriosPacienteCalendarioScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const handleMenuNavigate = (link) => {
        console.log('Navegando a:', link);
    };

    const pacienteParam = params.paciente ? JSON.parse(params.paciente) : null;
    const pacienteId = pacienteParam?.id_paciente ?? pacienteParam?.id ?? null;

    const [showInfo, setShowInfo] = useState(false);
    const [showPatientMenu, setShowPatientMenu] = useState(false);
    const [pacienteData, setPacienteData] = useState({
        id_paciente: pacienteParam?.id_paciente ?? pacienteParam?.id ?? null,
        nombre: pacienteParam?.nombre ?? '',
        sexo: pacienteParam?.sexo ?? '',
        raza: pacienteParam?.raza ?? '',
        especie: pacienteParam?.especie ?? '',
        fecha_nacimiento: pacienteParam?.fecha_nacimiento ?? '',
        clientes: pacienteParam?.clientes || [],
        foto_ruta: pacienteParam?.foto_ruta ?? null,
    });

    const [pacienteYears, setPacienteYears] = useState('');
    const [pacienteMonths, setPacienteMonths] = useState('');
    const [apiHost, setApiHost] = useState('');
    const [operacionesList, setOperacionesList] = useState([]);
    const [loadingOperaciones, setLoadingOperaciones] = useState(false);
    const [consultaLoading, setConsultaLoading] = useState(false);
    // modal para crear/editar recordatorio
    const [modalVisible, setModalVisible] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [modalEvent, setModalEvent] = useState({ id_calendario: null, descripcion: '', fecha: new Date(), paciente: null });
    const [showPickerMode, setShowPickerMode] = useState(null);
    const [savingEvent, setSavingEvent] = useState(false);

    useEffect(() => {
        if (pacienteParam && pacienteParam.fecha_nacimiento) {
            // intentar rellenar años/meses a partir de la fecha
            try {
                const parts = String(pacienteParam.fecha_nacimiento).split('T')[0].split('-');
                if (parts.length === 3) {
                    const b = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                    const age = calculateAgeFromDate(b);
                    setPacienteYears(String(age.years));
                    setPacienteMonths(String(age.meses));
                }
            } catch (e) { }
        }
    }, [pacienteParam]);

    // función reutilizable para cargar recordatorios (calendario)
    const fetchOperaciones = useCallback(async () => {
        // enviar id_paciente (si no hay paciente, enviar 0)
        const idToSend = pacienteId ? Number(pacienteId) : 0;
        setLoadingOperaciones(true);
        try {
            const raw = await AsyncStorage.getItem('@config');
            const cfg = raw ? JSON.parse(raw) : {};
            const host = cfg.api_host || cfg.apihost || cfg.apiHost || '';
            setApiHost(host || '');
            const token = cfg.token || null;

            let baseHost = host || '';
            while (baseHost.endsWith('/')) baseHost = baseHost.slice(0, -1);
            const url = `${baseHost}/calendario/filter`;

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ id_paciente: idToSend })
            });

            if (!res.ok) {
                console.warn('Error cargando recordatorios/calendario:', res.status);
                setOperacionesList([]);
                return;
            }

            const json = await res.json();
            // la respuesta puede venir en data o ser un array directo
            const items = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : (json?.rows || []));

            // mapear id_calendario a id para uso en la UI
            const mapped = items.map(it => ({ ...it, id: it.id_calendario ?? it.id }));

            setOperacionesList(mapped);

        } catch (e) {
            console.error('Error fetching recordatorios/calendario:', e);
            setOperacionesList([]);
        } finally {
            setLoadingOperaciones(false);
        }
    }, [pacienteId]);

    // Carga inicial
    useEffect(() => {
        fetchOperaciones();
    }, [fetchOperaciones]);

    // Ejecutar cada vez que la pantalla reciba foco
    useFocusEffect(
        useCallback(() => {
            fetchOperaciones();
            return () => {};
        }, [fetchOperaciones])
    );

    const openCreateModal = () => {
        setModalMode('create');
        setModalEvent({ id_calendario: null, descripcion: '', fecha: new Date(), paciente: pacienteParam || null });
        setShowPickerMode(null);
        setModalVisible(true);
    };

    const openEditModal = (item) => {
        setModalMode('edit');
        const fechaObj = item.fecha instanceof Date ? item.fecha : new Date(item.fecha);
        setModalEvent({ ...item, fecha: fechaObj, paciente: item.paciente || pacienteParam || null });
        setShowPickerMode(null);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setShowPickerMode(null);
    };

    const onPickerChange = (event, selected) => {
        if (selected) setModalEvent(prev => ({ ...prev, fecha: selected }));
        if (Platform.OS === 'android') setShowPickerMode(null);
    };

    const saveEvent = async () => {
        try {
            setSavingEvent(true);
            const raw = await AsyncStorage.getItem('@config');
            if (!raw) {
                Alert.alert('Error', 'Configuración no encontrada');
                return;
            }
            const cfg = JSON.parse(raw);
            const host = cfg.api_host || cfg.apihost || cfg.apiHost || '';
            const token = cfg.token || null;
            const usuario = cfg.user || cfg.usuario || cfg.userdata || cfg.userData || {};
            const id_usuario = usuario.id || usuario.id_usuario || 0;

            if (!host) {
                Alert.alert('Error', 'Host API no configurado');
                return;
            }

            const base = host.replace(/\/+$/, '');

            if (modalMode === 'create') {
                const url = `${base}/calendario/Create`;
                const body = {
                    fecha: toLocalISOString(modalEvent.fecha),
                    descripcion: modalEvent.descripcion || '',
                    id_usuario: id_usuario,
                };
                if (modalEvent.paciente && (modalEvent.paciente.id_paciente || modalEvent.paciente.id)) {
                    body.id_paciente = modalEvent.paciente.id_paciente ?? modalEvent.paciente.id;
                }

                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify(body)
                });

                const responseData = await res.json().catch(() => null);
                if (!res.ok) {
                    let errorMessage = 'Error desconocido';
                    if (responseData && responseData.errors && Array.isArray(responseData.errors)) errorMessage = responseData.errors.join('\n• ');
                    else if (responseData && (responseData.message || responseData.description)) errorMessage = responseData.message || responseData.description;
                    else if (responseData) errorMessage = JSON.stringify(responseData);
                    Alert.alert(`Error ${res.status}`, errorMessage);
                    return;
                }

                Alert.alert('Éxito', 'Recordatorio creado');
                closeModal();
                fetchOperaciones();
            } else if (modalMode === 'edit') {
                const id = modalEvent.id_calendario ?? modalEvent.id;
                const url = `${base}/calendario/Update/${id}`;
                const body = {
                    fecha: toLocalISOString(modalEvent.fecha),
                    descripcion: modalEvent.descripcion || '',
                    id_usuario: id_usuario,
                };

                const res = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify(body)
                });

                const responseData = await res.json().catch(() => null);
                if (!res.ok) {
                    let errorMessage = 'Error desconocido';
                    if (responseData && responseData.errors && Array.isArray(responseData.errors)) errorMessage = responseData.errors.join('\n• ');
                    else if (responseData && (responseData.message || responseData.description)) errorMessage = responseData.message || responseData.description;
                    else if (responseData) errorMessage = JSON.stringify(responseData);
                    Alert.alert(`Error ${res.status}`, errorMessage);
                    return;
                }

                Alert.alert('Éxito', 'Recordatorio actualizado');
                closeModal();
                fetchOperaciones();
            }
        } catch (err) {
            console.error('Error creando/actualizando recordatorio:', err);
            Alert.alert('Error', err.message || 'Error creando/actualizando recordatorio');
        } finally {
            setSavingEvent(false);
        }
    };

    const confirmDeleteRecordatorio = (id) => {
        Alert.alert('Eliminar evento', '¿Estás seguro de que deseas eliminar este evento?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: () => deleteRecordatorio(id) }
        ]);
    };

    const deleteRecordatorio = async (id) => {
        try {
            setSavingEvent(true);
            const raw = await AsyncStorage.getItem('@config');
            if (!raw) {
                Alert.alert('Error', 'Configuración no encontrada');
                return;
            }
            const cfg = JSON.parse(raw);
            const host = cfg.api_host || cfg.apihost || cfg.apiHost || '';
            const token = cfg.token || null;

            if (!host) {
                Alert.alert('Error', 'Host API no configurado');
                return;
            }

            const base = host.replace(/\/+$/, '');
            const url = `${base}/calendario/Delete/${id}`;

            const res = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });

            const responseData = await res.json().catch(() => null);
            if (res.status === 403) {
                router.replace('/login');
                return;
            }
            if (!res.ok) {
                let errorMessage = 'Error desconocido';
                if (responseData && responseData.errors && Array.isArray(responseData.errors)) errorMessage = responseData.errors.join('\n• ');
                else if (responseData && (responseData.message || responseData.description)) errorMessage = responseData.message || responseData.description;
                else if (responseData) errorMessage = JSON.stringify(responseData);
                Alert.alert(`Error ${res.status}`, errorMessage);
                return;
            }

            Alert.alert('Éxito', 'Evento eliminado');
            fetchOperaciones();
        } catch (err) {
            console.error('Error eliminando evento:', err);
            Alert.alert('Error', err.message || 'Error eliminando evento');
        } finally {
            setSavingEvent(false);
        }
    };

    const calculateAgeFromDate = (birthDate) => {
        const now = new Date();
        let years = now.getFullYear() - birthDate.getFullYear();
        let meses = now.getMonth() - birthDate.getMonth();
        let days = now.getDate() - birthDate.getDate();

        if (days < 0) {
            meses -= 1;
            const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            days += prevMonth.getDate();
        }

        if (meses < 0) {
            years -= 1;
            meses += 12;
        }

        return { years, meses, days };
    };

    const formatDateToYMD = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const updateDateFromYearsMonths = (yearsStr, monthsStr) => {
        const years = parseInt(yearsStr) || 0;
        const months = parseInt(monthsStr) || 0;
        const now = new Date();
        const estimated = new Date(now.getFullYear() - years, now.getMonth() - months, now.getDate());
        setPacienteData(prev => ({ ...prev, fecha_nacimiento: formatDateToYMD(estimated) }));
    };

    const computeAgeString = (birthYMD) => {
        if (!birthYMD) return '';
        try {
            const parts = birthYMD.split('-');
            const b = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            const now = new Date();

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
        } catch (e) {
            return '';
        }
    };

    const handleOpenPatientMenu = () => setShowPatientMenu(true);

    // Confirma y elimina una venta por id_venta
    const handleDeleteVenta = (venta) => {
        if (!venta) return;
        const id_venta = venta.id_venta ?? venta.id;
        Alert.alert('Confirmar eliminación', `¿Eliminar venta ${venta?.comerciable?.producto?.nombre || id_venta}?`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: () => performDeleteVenta(id_venta) }
        ]);
    };

    const performDeleteVenta = async (id_venta) => {
        if (!id_venta) return;
        try {
            const raw = await AsyncStorage.getItem('@config');
            const cfg = raw ? JSON.parse(raw) : {};
            const host = cfg.api_host || cfg.apihost || cfg.apiHost || '';
            const token = cfg.token || null;

            let baseHost = host || '';
            while (baseHost.endsWith('/')) baseHost = baseHost.slice(0, -1);
            const url = `${baseHost}/venta/delete/${id_venta}`;

            const headers = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

            const res = await fetch(url, { method: 'DELETE', headers });
            let responseData = null;
            try { responseData = await res.json(); } catch (e) { /* ignore parse errors */ }

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

            try { ToastAndroid.show('Venta eliminada', ToastAndroid.SHORT); } catch (e) { /* ignore on non-Android */ }
            // refrescar lista
            await fetchOperaciones();

        } catch (err) {
            console.error('Error eliminando venta:', err);
            Alert.alert('Error', err.message || 'Error desconocido');
        }
    };

    // Extrae id_consulta de una venta y abre la consulta (modo 'ver' o 'editar')
    const handleOpenConsultaFromVenta = (venta, mode = 'ver') => {
        if (!venta) return;
        const consultaId = venta?.consultum?.id_consulta ?? venta?.consultum?.id ?? venta?.consulta?.id_consulta ?? venta?.consulta?.id ?? venta?.id_consulta ?? null;
        if (!consultaId) {
            Alert.alert('No disponible', 'Esta venta no tiene una consulta asociada');
            return;
        }
        fetchConsultaAndOpen(consultaId, mode);
    };

    const fetchConsultaAndOpen = async (consultaId, mode = 'ver') => {
        if (!consultaId) return;
        setConsultaLoading(true);
        try {
            const raw = await AsyncStorage.getItem('@config');
            const cfg = raw ? JSON.parse(raw) : {};
            const host = cfg.api_host || cfg.apihost || cfg.apiHost || '';
            const token = cfg.token || null;

            let baseHost = host || '';
            while (baseHost.endsWith('/')) baseHost = baseHost.slice(0, -1);
            const url = `${baseHost}/consulta/${consultaId}`;

            const res = await fetch(url, { method: 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
            let responseData = null;
            try { responseData = await res.json(); } catch (e) { /* ignore parse errors */ }

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
                setConsultaLoading(false);
                return;
            }

            // Abrir modal pasando la consulta completa
            setConsultaLoading(false);
            router.push({ pathname: '/operacionModal', params: { mode: mode, consulta: JSON.stringify(responseData) } });
        } catch (err) {
            console.error('Error obteniendo consulta:', err);
            setConsultaLoading(false);
            Alert.alert('Error', err.message || 'Error desconocido');
        }
    };

    return (
        <View style={styles.container}>
            <TopBar onMenuNavigate={handleMenuNavigate} />
            <Modal transparent animationType="fade" visible={consultaLoading}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.modalText}>Cargando consulta...</Text>
                    </View>
                </View>
            </Modal>
            <ScrollView contentContainerStyle={styles.scrollContentContainer}>
                {/* Header con back, toggle sidebar, título e info */}
                <View style={[styles.headerRow, { justifyContent: 'space-between' }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Image
                            source={require('../assets/images/arrow-left.png')}
                            style={styles.icon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleOpenPatientMenu} style={styles.menuButton}>
                        <Image
                            source={require('../assets/images/menu.png')}
                            style={styles.icon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>

                            <Text style={styles.sectionTitle}>Recordatorios</Text>
                </View>

                {/* Datos del paciente (vista compacta, solo texto) */}
                <View style={[styles.patientSmallContainer, { marginBottom: Spacing.m }]}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.s }}>
                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Nombre:</Text> {pacienteData.nombre || 'Paciente'}</Text>
                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Sexo:</Text> {pacienteData.sexo || 'N/A'}</Text>
                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Especie:</Text> {pacienteData.especie || 'N/A'}</Text>
                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Raza:</Text> {pacienteData.raza || 'N/A'}</Text>
                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Fecha de nacimiento:</Text> {formatDateForDisplay(pacienteData.fecha_nacimiento)} - <Text style={styles.pacienteAgeBold}>{computeAgeString(formatDateForDisplay(pacienteData.fecha_nacimiento))}</Text></Text>
                    </View>
                </View>

                {/* Botón ancho + Agregar Operación */}
                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={() => openCreateModal()}
                >
                    <Text style={styles.saveButtonText}>+ Agregar Recordatorio</Text>
                </TouchableOpacity>

                {/* Lista de operaciones (ventas filtradas) */}
                <View style={[styles.section, { minHeight: 200, marginTop: Spacing.m }]}>
                    <View style={{ marginBottom: Spacing.m }}>
                        {loadingOperaciones && (
                            <View style={{ padding: Spacing.m, alignItems: 'center', justifyContent: 'center' }}>
                                <ActivityIndicator size="large" color={Colors.primary} />
                            </View>
                        )}

                        {!loadingOperaciones && operacionesList.length === 0 && (
                            <View style={{ padding: Spacing.m }}><Text>No hay operaciones disponibles</Text></View>
                        )}

                        {!loadingOperaciones && operacionesList.map((c, idx) => {
                            if (!c) return null;

                            const usuarioNombre = c?.usuario?.nombre || c?.usuario?.nombre_natural || c?.usuario?.nombre_usuario || '';

                            return (
                                <TouchableOpacity key={c.id ?? idx} style={styles.pacienteItem} activeOpacity={0.8} onPress={() => openEditModal(c)}>
                                    <View style={styles.pacienteInfo}>
                                        <Text style={styles.pacienteName}>{c.descripcion || 'Recordatorio'}</Text>
                                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Usuario:</Text> {usuarioNombre || 'N/A'}</Text>
                                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Fecha:</Text> {formatDateTimeForDisplay(c.fecha)}</Text>
                                    </View>

                                        <View style={{ flexDirection: 'column', padding: Spacing.s }}>
                                            <TouchableOpacity style={[styles.smallActionButton, styles.deleteButton]} onPress={() => confirmDeleteRecordatorio(c.id_calendario ?? c.id)}>
                                                <Image source={require('../assets/images/basura.png')} style={[styles.smallIcon, styles.huellaIcon]} />
                                            </TouchableOpacity>
                                        </View>
                                </TouchableOpacity>
                            );
                            })}

                    </View>
                </View>
                
                {/* Modal para crear/editar recordatorio (copiado de calendario) */}
                <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <ScrollView>
                                <Text style={styles.fieldLabel}>Fecha</Text>
                                <TouchableOpacity style={[styles.modalButton, styles.modalDateButton]} onPress={() => setShowPickerMode('date')}>
                                    <Text style={styles.modalDateButtonText}>{modalEvent.fecha ? (modalEvent.fecha instanceof Date ? modalEvent.fecha.toLocaleDateString('es-ES') : new Date(modalEvent.fecha).toLocaleDateString('es-ES')) : 'Seleccionar fecha'}</Text>
                                </TouchableOpacity>

                                <Text style={styles.fieldLabel}>Hora</Text>
                                <TouchableOpacity style={[styles.modalButton, styles.modalDateButton]} onPress={() => setShowPickerMode('time')}>
                                    <Text style={styles.modalDateButtonText}>{modalEvent.fecha ? (modalEvent.fecha instanceof Date ? modalEvent.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : new Date(modalEvent.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })) : 'Seleccionar hora'}</Text>
                                </TouchableOpacity>

                                {showPickerMode && (
                                    <DateTimePicker value={modalEvent.fecha || new Date()} mode={showPickerMode} is24Hour={false} display="default" onChange={onPickerChange} />
                                )}

                                <Text style={styles.fieldLabel}>Descripción</Text>
                                <TextInput style={styles.input} value={modalEvent.descripcion} onChangeText={(t) => setModalEvent(prev => ({ ...prev, descripcion: t }))} placeholder="Descripción" />

                                {/* Ver paciente eliminado en este modal (no requerido) */}

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
            </ScrollView>

            {/* Patient sidebar modal */}
            <PatientSidebarMenu
                isOpen={showPatientMenu}
                onClose={() => setShowPatientMenu(false)}
                paciente={pacienteParam}
                apiHost={apiHost}
                selectedItem={'recordatorios'}
            />
        </View>
    );

    // helpers
    function formatDateForDisplay(dateString) {
        if (!dateString) return '';
        try {
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
            if (dateString.includes('T')) return dateString.split('T')[0];
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return formatDateToYMD(date);
        } catch (e) {
            return dateString;
        }
    }

    function formatDateTimeForDisplay(dateString) {
        if (!dateString) return '';
        try {
            const d = (dateString instanceof Date) ? dateString : new Date(dateString);
            if (isNaN(d.getTime())) return String(dateString);
            const datePart = formatDateToYMD(d);
            const hours = d.getHours();
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const period = hours >= 12 ? 'PM' : 'AM';
            let hour12 = hours % 12;
            if (hour12 === 0) hour12 = 12;
            return `${datePart} ${hour12}:${minutes} ${period}`;
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
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5'},
    scrollContentContainer: { padding: Spacing.m },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.m },
    backButton: {
        backgroundColor: Colors.primarySuave,
        padding: Spacing.s,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
    },
    icon: { width: 20, height: 20, tintColor: Colors.textPrimary },
    sectionTitle: { fontSize: Typography.h3, fontWeight: '700', color: Colors.textSecondary, flex: 1, textAlign: 'center' },
    infoButton: { width: 35, height: 35, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.s },
    infoIcon: { width: 20, height: 20, tintColor: Colors.textPrimary },
    infoBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.primarySuave, padding: Spacing.m, borderRadius: 8, marginBottom: Spacing.m },
    infoText: { fontSize: Typography.small, color: Colors.textSecondary },
    section: { backgroundColor: '#fff', padding: Spacing.m, borderRadius: 8, marginBottom: Spacing.m, borderWidth: 1, borderColor: '#000' },
    label: { fontSize: Typography.body, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#000', borderRadius: 8, paddingHorizontal: Spacing.m, paddingVertical: 10, fontSize: Typography.body, color: Colors.textSecondary, minHeight: 40 },
    twoColumnRow: { flexDirection: 'row', gap: Spacing.s, marginBottom: Spacing.s },
    column: { flex: 1 },
    inputGroup: { marginBottom: Spacing.m },
    saveButton: { backgroundColor: Colors.boton_azul, paddingVertical: Spacing.m, paddingHorizontal: Spacing.m, borderRadius: 8, alignItems: 'center', marginTop: Spacing.m, borderWidth: 1, borderColor: '#000' },
    saveButtonText: { color: '#fff', fontSize: Typography.body, fontWeight: '600' },
    patientSmallContainer: { backgroundColor: '#fff', padding: Spacing.s, borderRadius: 8, borderWidth: 1, borderColor: '#000' },
    patientLabel: { fontSize: Typography.small, color: Colors.textSecondary },
    patientValue: { fontSize: Typography.body, color: Colors.textSecondary, fontWeight: '700' },
    pacienteText: { fontSize: Typography.small, color: Colors.textSecondary, marginBottom: 4, marginRight: 12 },
    pacienteAgeBold: { fontWeight: '700' },
    menuButton: { padding: Spacing.s, borderRadius: 8, backgroundColor: Colors.primarySuave, marginLeft: Spacing.s, borderWidth: 1, borderColor: '#000' },
    pacienteItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#000', borderRadius: 8, marginBottom: Spacing.s, overflow: 'hidden', position: 'relative', minHeight: 110 },
    pacienteImage: { width: 70, height: 70, borderRadius: 110 / 2, marginLeft: 8, marginRight: 8, borderWidth: 1, borderColor: '#ddd' },
    pacienteInfo: { flex: 1, padding: Spacing.s },
    pacienteName: { fontSize: Typography.body, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
    pacienteText: { fontSize: Typography.small, color: Colors.textSecondary, marginBottom: 2 },
    actionButton: { alignItems: 'center', justifyContent: 'center', padding: Spacing.s, borderRadius: 8, backgroundColor: Colors.primary },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#fff', padding: Spacing.m, borderRadius: 8, alignItems: 'center', minWidth: 200 },
    modalText: { marginTop: Spacing.s, color: Colors.textSecondary },
    modalContainer: { backgroundColor: '#fff', padding: Spacing.m, borderRadius: 8, minWidth: 280, maxHeight: '85%' },
    modalContainer: { width: '90%', maxHeight: '80%', backgroundColor: '#fff', borderRadius: 12, padding: Spacing.m },
    fieldLabel: { fontWeight: '700', marginTop: Spacing.s, marginBottom: Spacing.xs },
    modalButton: { paddingVertical: Spacing.s, paddingHorizontal: Spacing.m, borderRadius: 8, alignItems: 'center', marginVertical: Spacing.s, flex: 1, marginRight: Spacing.s },
    modalDateButton: { backgroundColor: Colors.boton_azul || Colors.primary || '#2196F3', flex: 0, marginRight: 0 },
    modalDateButtonText: { color: '#fff', fontWeight: '700' },
    modalButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.m },
    modalButtonText: { color: '#fff', fontWeight: '700' },
    smallIcon: { width: 18, height: 18, tintColor: Colors.textPrimary },
    huellaIcon: { tintColor: '#fff' },
    deleteButton: { backgroundColor: Colors.boton_rojo_opciones },
    verPacienteRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.s, borderRadius: 8, marginTop: Spacing.s },
    verPacienteText: { color: '#fff', marginLeft: Spacing.s, fontWeight: '700' },
    smallActionButton: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.s },
    paginationContainer: { paddingHorizontal: Spacing.m, paddingVertical: Spacing.m, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: Spacing.s },
    paginationControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.s, marginBottom: Spacing.s },
    paginationInfoContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    paginationButton: { paddingVertical: Spacing.s, paddingHorizontal: Spacing.m, borderRadius: 4, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primary, minWidth: 100, alignItems: 'center' },
    paginationButtonDisabled: { backgroundColor: Colors.primarySuave, borderColor: Colors.primarySuave },
    paginationButtonText: { fontSize: Typography.small, color: Colors.textPrimary, fontWeight: '500' },
    paginationButtonTextDisabled: { color: Colors.textSecondary },
    paginationInfo: { fontSize: Typography.small, color: Colors.textSecondary, fontWeight: '500' },
    paginationPageInfo: { fontSize: Typography.small, color: Colors.textSecondary, fontWeight: '500' },
});
