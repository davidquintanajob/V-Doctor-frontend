import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ScrollView, StyleSheet, Alert, ToastAndroid, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PatientSidebarMenu from '../components/PatientSidebarMenu';
import ConsultaModeloImprecion from '../components/ConsultaModeloImprecion';
import TopBar from '../components/TopBar';
import { Colors, Spacing, Typography, ColorsData } from '../variables';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function HistoriaClinicaScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const pacienteParam = params.paciente ? JSON.parse(params.paciente) : null;

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
    const [historiaClinicaList, setHistoriaClinicaList] = useState([]);
    const [loadingHistoriaClinica, setLoadingHistoriaClinica] = useState(false);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [consultaToPrint, setConsultaToPrint] = useState(null);
    const [motivoSearch, setMotivoSearch] = useState('');
    const [filters, setFilters] = useState({
        diagnostico: '',
        anamnesis: '',
        tratamiento: '',
        patologia: '',
        fecha_desde: '',
        fecha_hasta: '',
        descripcion: ''
    });
    
    // Estados para los DatePickers
    const [showDatePickerDesde, setShowDatePickerDesde] = useState(false);
    const [showDatePickerHasta, setShowDatePickerHasta] = useState(false);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 10;
    const isScreenFocused = useRef(false);
    const [apiHost, setApiHost] = useState('');

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    const handlePreviousPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
    const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };

    const handleMenuNavigate = (link) => {
        console.log('Navegando a:', link);
    };
    
    // Función para manejar el cambio de fecha en DateTimePicker
    const handleDateChangeDesde = (event, selectedDate) => {
        setShowDatePickerDesde(false);
        if (selectedDate) {
            const formattedDate = formatDateToYMD(selectedDate);
            setFilters(prev => ({ ...prev, fecha_desde: formattedDate }));
        }
    };

    const handleDateChangeHasta = (event, selectedDate) => {
        setShowDatePickerHasta(false);
        if (selectedDate) {
            const formattedDate = formatDateToYMD(selectedDate);
            setFilters(prev => ({ ...prev, fecha_hasta: formattedDate }));
        }
    };

    // Función para limpiar una fecha específica
    const clearFechaDesde = () => {
        setFilters(prev => ({ ...prev, fecha_desde: '' }));
    };

    const clearFechaHasta = () => {
        setFilters(prev => ({ ...prev, fecha_hasta: '' }));
    };

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

    // Cargar historiaClinica desde la API al montar la pantalla
    // Fetch consultas con paginado y filtros cuando la pantalla esté enfocada o cambie página
    const fetchConsultas = async (page = 1, isSearch = false) => {
        if (!pacienteParam || (!pacienteParam.id_paciente && !pacienteParam.id)) return;
        const id = pacienteParam.id_paciente ?? pacienteParam.id;
        setLoadingHistoriaClinica(true);
        try {
            const raw = await AsyncStorage.getItem('@config');
            if (!raw) {
                return;
            }
            const cfg = JSON.parse(raw);
            const host = cfg.api_host || cfg.apihost || cfg.apiHost || '';
            const token = cfg.token || null;
            if (!host) return;
            setApiHost(host || '');

            let baseHost = host || '';
            while (baseHost.endsWith('/')) baseHost = baseHost.slice(0, -1);
            const url = baseHost + '/consulta/Filter/' + itemsPerPage + '/' + page;

            // Construir body solo con campos no vacíos
            const body = {};
            if (motivoSearch && motivoSearch.trim() !== '') body.motivo = motivoSearch.trim();
            Object.keys(filters).forEach(k => {
                const v = filters[k];
                if (v && String(v).trim() !== '') body[k] = v;
            });
            // id_paciente siempre debe incluirse
            body.id_paciente = id;

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: 'Bearer ' + token } : {})
                },
                body: JSON.stringify(body)
            });

            if (res.status === 403) {
                router.replace('/login');
                return;
            }

            if (!res.ok) {
                console.warn('Error cargando consultas:', res.status);
                setHistoriaClinicaList([]);
                setTotalItems(0);
                return;
            }

            const data = await res.json();
            const items = data.data || data.rows || [];
            // Normalizar id
            const normalized = items.map(it => ({ ...it, id: it.id_consulta ?? it.id }));
            setHistoriaClinicaList(normalized);
            const pagination = data.pagination || {};
            setTotalItems(pagination.total || normalized.length);
            setCurrentPage(pagination.currentPage || page);

        } catch (e) {
            console.error('Error fetching consultas:', e);
            setHistoriaClinicaList([]);
            setTotalItems(0);
        } finally {
            setLoadingHistoriaClinica(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            isScreenFocused.current = true;
            fetchConsultas(currentPage, false);
            return () => { isScreenFocused.current = false; };
        }, [])
    );

    useEffect(() => {
        if (isScreenFocused.current) {
            fetchConsultas(currentPage, false);
        }
    }, [currentPage]);

    const handleDeleteConsulta = async (id_consulta) => {
        try {
            const raw = await AsyncStorage.getItem('@config');
            if (!raw) {
                Alert.alert('Error', 'No hay configuración de API');
                return;
            }
            const cfg = JSON.parse(raw);
            const host = cfg.api_host || cfg.apihost || cfg.apiHost || '';
            const token = cfg.token || null;
            if (!host) {
                Alert.alert('Error', 'No hay host configurado');
                return;
            }
            const url = `${host.replace(/\/+$/, '')}/consulta/Delete/${id_consulta}`;
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(url, { method: 'DELETE', headers });
            let responseData = null;
            try { responseData = await res.json(); } catch (e) { responseData = null; }
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
            // Success
            ToastAndroid.show('Consulta eliminada', ToastAndroid.SHORT);
            fetchConsultas(currentPage, false);
        } catch (err) {
            console.error('Error eliminando consulta:', err);
            Alert.alert('Error', err.message || 'Error desconocido');
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
        return y + '-' + m + '-' + d;
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

            if (years > 0) return years + ' año' + (years > 1 ? 's' : '') + ' y ' + months + ' mes' + (months > 1 ? 'es' : '');
            if (months > 0) return months + ' mes' + (months > 1 ? 'es' : '') + ' y ' + days + ' día' + (days > 1 ? 's' : '');
            return days + ' día' + (days > 1 ? 's' : '');
        } catch (e) {
            return '';
        }
    };

    const handleOpenPatientMenu = () => setShowPatientMenu(true);

    return (
        <View style={styles.container}>
            <TopBar onMenuNavigate={handleMenuNavigate} />
            <ScrollView contentContainerStyle={styles.scrollContentContainer}>
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

                    <Text style={styles.sectionTitle}>Historia Clinica</Text>
                </View>

                {/* Contenedor de búsqueda (separado, igual que en pacientes) */}

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

                {/* Botón ancho + Agregar historiaClinica */}
                <TouchableOpacity style={styles.saveButton} onPress={() => router.push({ pathname: '/historia_clinicaModal', params: { mode: 'crear', paciente: JSON.stringify(pacienteParam || {}) } }) }>
                    <Text style={styles.saveButtonText}>+ Agregar Consulta</Text>
                </TouchableOpacity>

                {/* Contenedor blanco vacío */}
                <View style={[styles.section, { minHeight: 200, marginTop: Spacing.m }]}>
                    {/* NOTA: Búsqueda en su propio contenedor (ver abajo) - aquí solo mostramos la lista */}
                    <View style={{ marginBottom: Spacing.m }}>
                        {/* Lista de consultas */}
                        {loadingHistoriaClinica && (
                            <View style={{ padding: Spacing.m, alignItems: 'center', justifyContent: 'center' }}>
                                <ActivityIndicator size="large" color={Colors.primary} />
                            </View>
                        )}

                        {!loadingHistoriaClinica && historiaClinicaList.length === 0 && (
                            <View style={{ padding: Spacing.m }}><Text>No hay consultas disponibles</Text></View>
                        )}

                        {!loadingHistoriaClinica && historiaClinicaList.map((c, idx) => {
                            if (!c) return null;
                            const paciente = c.paciente || {};
                            // imagen paciente si está disponible
                            let imgSource = require('../assets/images/especies/huella.png');
                            if (paciente.foto_ruta && apiHost) {
                                const cleaned = String(paciente.foto_ruta).replace(/\\/g, '/').replace(/^\/+/, '');
                                const final = apiHost.replace(/\/+$/, '') + '/' + cleaned;
                                imgSource = { uri: final };
                            }

                            return (
                                <TouchableOpacity key={c.id ?? idx} style={styles.pacienteItem} activeOpacity={0.8} onPress={() => router.push({ pathname: '/historia_clinicaModal', params: { mode: 'ver', consulta: JSON.stringify(c) } })}>
                                    <View style={styles.pacienteInfo}>
                                        <Text style={styles.pacienteName}>{c.motivo}</Text>
                                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Usuario:</Text> {formatDateForDisplay(c.usuario?.nombre_natural)}</Text>
                                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Fecha:</Text> {formatDateForDisplay(c.fecha)}</Text>
                                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Diagnóstico:</Text> {c.diagnostico || '-'}</Text>
                                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Tratamiento:</Text> {c.tratamiento || '-'}</Text>
                                    </View>

                                    <View style={{ flexDirection: 'column', padding: Spacing.s }}>
                                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: Colors.boton_azul, marginBottom: Spacing.s }]} onPress={() => router.push({ pathname: '/historia_clinicaModal', params: { mode: 'editar', consulta: JSON.stringify(c) } })}>
                                            <Image source={require('../assets/images/editar.png')} style={{ width: 20, height: 20, tintColor: Colors.textPrimary }} resizeMode="contain" />
                                        </TouchableOpacity>

                                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: Colors.primarySuave, marginBottom: Spacing.s }]} onPress={() => { setConsultaToPrint(c); setPrintModalOpen(true); }}>
                                            <Image source={require('../assets/images/impresora.png')} style={{ width: 20, height: 20, tintColor: Colors.textPrimary }} resizeMode="contain" />
                                        </TouchableOpacity>

                                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: Colors.boton_rojo_opciones }]} onPress={() => Alert.alert('Confirmar eliminación', `¿Eliminar consulta ${c.motivo || c.id}?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: () => handleDeleteConsulta(c.id_consulta || c.id) }])}>
                                            <Image source={require('../assets/images/basura.png')} style={{ width: 20, height: 20, tintColor: Colors.textPrimary }} resizeMode="contain" />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        {/* Paginación */}
                        {totalItems > 0 && (
                            <View style={styles.paginationContainer}>
                                <View style={styles.paginationControls}>
                                    <TouchableOpacity style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]} onPress={handlePreviousPage} disabled={currentPage === 1}><Text style={[styles.paginationButtonText, currentPage === 1 && styles.paginationButtonTextDisabled]}>Anterior</Text></TouchableOpacity>
                                    <TouchableOpacity style={[styles.paginationButton, currentPage >= totalPages && styles.paginationButtonDisabled]} onPress={handleNextPage} disabled={currentPage >= totalPages}><Text style={[styles.paginationButtonText, currentPage >= totalPages && styles.paginationButtonTextDisabled]}>Siguiente</Text></TouchableOpacity>
                                </View>
                                <View style={styles.paginationInfoContainer}><Text style={styles.paginationInfo}>{startIndex} - {endIndex} de {totalItems}</Text><Text style={styles.paginationPageInfo}>Página {currentPage} de {totalPages}</Text></View>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Patient sidebar modal */}
            <PatientSidebarMenu
                isOpen={showPatientMenu}
                onClose={() => setShowPatientMenu(false)}
                paciente={pacienteParam}
                apiHost={apiHost}
                selectedItem={'historia_clinica'}
            />

            <ConsultaModeloImprecion isOpen={printModalOpen} onClose={() => { setPrintModalOpen(false); setConsultaToPrint(null); }} consulta={consultaToPrint} paciente={pacienteData} />
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
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
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
    moreOptionsButton: { backgroundColor: Colors.primary, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.s, paddingHorizontal: Spacing.m, borderRadius: 8, elevation: 1, gap: Spacing.xs, minHeight: 44 },
    clearButton: { backgroundColor: Colors.boton_rojo_opciones, paddingVertical: Spacing.s, paddingHorizontal: Spacing.m, borderRadius: 8, alignItems: 'center', marginTop: Spacing.s, alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
    clearButtonText: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: 'bold' },
    editButton: { backgroundColor: Colors.primary, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4 },
    deleteButton: { backgroundColor: '#ff6b6b', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4 },
    patientSmallContainer: { backgroundColor: '#fff', padding: Spacing.s, borderRadius: 8, borderWidth: 1, borderColor: '#000' },
    patientLabel: { fontSize: Typography.small, color: Colors.textSecondary },
    patientValue: { fontSize: Typography.body, color: Colors.textSecondary, fontWeight: '700' },
    pacienteText: { fontSize: Typography.small, color: Colors.textSecondary, marginBottom: 4, marginRight: 12 },
    pacienteAgeBold: { fontWeight: '700' },
    menuButton: { padding: Spacing.s, borderRadius: 8, backgroundColor: Colors.primarySuave, marginLeft: Spacing.s, borderWidth: 1, borderColor: '#000' },
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
    backButtonImage: { width: 20, height: 20, tintColor: Colors.textPrimary },
    searchTitle: { fontSize: Typography.h3, fontWeight: 'bold', color: Colors.primary, marginBottom: Spacing.m, textAlign: 'center', marginTop: 10 },
    searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.primarySuave, borderRadius: 8, paddingHorizontal: Spacing.m, paddingVertical: Spacing.s, fontSize: Typography.body, color: Colors.textSecondary, minHeight: 44, width: '100%' },
    buttonsContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.s, marginTop: Spacing.s },
    moreOptionsIcon: { width: 16, height: 16, tintColor: Colors.textPrimary },
    moreOptionsText: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '600' },
    searchButton: { backgroundColor: Colors.boton_azul, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.s, paddingHorizontal: Spacing.m, borderRadius: 8, elevation: 1, gap: Spacing.xs, minHeight: 44 },
    searchIcon: { width: 16, height: 16, tintColor: Colors.textPrimary },
    searchButtonText: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '600' },
    additionalOptions: { marginTop: Spacing.m, paddingTop: Spacing.m, borderTopWidth: 1, borderTopColor: Colors.primarySuave },
    additionalRow: { flexDirection: 'row', gap: Spacing.s, marginBottom: Spacing.m, flexWrap: 'wrap' },
    additionalInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.primarySuave, borderRadius: 8, paddingHorizontal: Spacing.m, paddingVertical: Spacing.s, fontSize: Typography.body, color: Colors.textSecondary, minHeight: 44, width: '100%' },
    responsiveInputGroup: { flex: 1, minWidth: 0 },
    
    // Nuevos estilos para los DatePickers
    dateInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    dateInput: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: Colors.primarySuave,
        borderRadius: 8,
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.s,
        fontSize: Typography.body,
        color: Colors.textSecondary,
        minHeight: 44,
        flex: 1,
        justifyContent: 'center',
    },
    datePickerTouchable: {
        // Estilo para el touchable
    },
    clearDateButton: {
        position: 'absolute',
        right: 10,
        height: '100%',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    clearDateIcon: {
        width: 16,
        height: 16,
        tintColor: Colors.textSecondary,
    },
    
    pacienteItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#000', borderRadius: 8, marginBottom: Spacing.s, overflow: 'hidden', position: 'relative', minHeight: 110 },
    pacienteImage: { width: 70, height: 70, borderRadius: 110 / 2, marginLeft: 8, marginRight: 8, borderWidth: 1, borderColor: '#ddd' },
    pacienteInfo: { flex: 1, padding: Spacing.s },
    pacienteName: { fontSize: Typography.body, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
    pacienteText: { fontSize: Typography.small, color: Colors.textSecondary, marginBottom: 2 },
    actionButton: { alignItems: 'center', justifyContent: 'center', padding: Spacing.s, borderRadius: 8, backgroundColor: Colors.primary },
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