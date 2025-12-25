import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator, Modal, ScrollView, StyleSheet, ToastAndroid } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PatientSidebarMenu from '../components/PatientSidebarMenu';
import { Colors, Spacing, Typography } from '../variables';
import TopBar from '../components/TopBar';

export default function AntiparasitariosScreen() {
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
    const [antiparasitariosList, setAntiparasitariosList] = useState([]);
    const [loadingAntiparasitarios, setLoadingAntiparasitarios] = useState(false);
    const [consultaLoading, setConsultaLoading] = useState(false);

    useEffect(() => {
        if (pacienteParam && pacienteParam.fecha_nacimiento) {
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

    // función reutilizable para cargar antiparasitarios (ventas filtradas)
    const fetchAntiparasitarios = async () => {
        if (!pacienteId) return;
        setLoadingAntiparasitarios(true);
        try {
            const raw = await AsyncStorage.getItem('@config');
            const cfg = raw ? JSON.parse(raw) : {};
            const host = cfg.api_host || cfg.apihost || cfg.apiHost || '';
            setApiHost(host || '');
            const token = cfg.token || null;

            let baseHost = host || '';
            while (baseHost.endsWith('/')) baseHost = baseHost.slice(0, -1);
            const url = `${baseHost}/venta/Filter/500/1`;

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ tipo_comerciable: 'medicamento' })
            });

            if (!res.ok) {
                console.warn('Error cargando ventas/antiparasitarios:', res.status);
                setAntiparasitariosList([]);
                return;
            }

            const json = await res.json();
            const items = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : (json?.rows || []));

            // filtrar solo productos cuyo medicamento.tipo_medicamento === 'antiparasitario' y que pertenezcan al paciente
            const filtered = items.filter(it => {
                try {
                    const isAntiparasitario = it?.comerciable?.producto?.medicamento?.tipo_medicamento === 'antiparasitario';
                    const ventaPacienteId = it?.consulta?.paciente?.id_paciente ?? it?.consultum?.paciente?.id_paciente ?? it?.paciente?.id_paciente ?? null;
                    return isAntiparasitario && ventaPacienteId != null && String(ventaPacienteId) === String(pacienteId);
                } catch (e) {
                    return false;
                }
            }).map(it => ({ ...it, id: it.id_venta ?? it.id }));

            setAntiparasitariosList(filtered);

        } catch (e) {
            console.error('Error fetching ventas/antiparasitarios:', e);
            setAntiparasitariosList([]);
        } finally {
            setLoadingAntiparasitarios(false);
        }
    };

    useEffect(() => {
        fetchAntiparasitarios();
    }, [pacienteId]);

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
            try { responseData = await res.json(); } catch (e) { }

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

            try { ToastAndroid.show('Venta eliminada', ToastAndroid.SHORT); } catch (e) { }
            await fetchAntiparasitarios();

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
            try { responseData = await res.json(); } catch (e) { }

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

            setConsultaLoading(false);
            router.push({ pathname: '/historia_clinicaModal', params: { mode: mode, consulta: JSON.stringify(responseData) } });
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

                    <Text style={styles.sectionTitle}>Antiparasitarios</Text>
                </View>

                <View style={[styles.patientSmallContainer, { marginBottom: Spacing.m }]}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.s }}>
                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Nombre:</Text> {pacienteData.nombre || 'Paciente'}</Text>
                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Sexo:</Text> {pacienteData.sexo || 'N/A'}</Text>
                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Especie:</Text> {pacienteData.especie || 'N/A'}</Text>
                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Raza:</Text> {pacienteData.raza || 'N/A'}</Text>
                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Fecha de nacimiento:</Text> {formatDateForDisplay(pacienteData.fecha_nacimiento)} - <Text style={styles.pacienteAgeBold}>{computeAgeString(formatDateForDisplay(pacienteData.fecha_nacimiento))}</Text></Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={async () => {
                        try {
                            const raw = await AsyncStorage.getItem('@config');
                            const cfg = raw ? JSON.parse(raw) : {};
                            const usuario = cfg.user || cfg.usuario || cfg.userdata || cfg.userData || null;

                            const fecha = new Date().toISOString();
                            const consultaToPass = {
                                fecha: fecha,
                                motivo: 'Antiparasitario',
                                anamnesis: 'El cliente solicita antiparasitario',
                                paciente: pacienteParam || pacienteData,
                                usuario: usuario,
                            };

                            router.push({
                                pathname: '/historia_clinicaModal',
                                params: {
                                    mode: 'crear',
                                    consulta: JSON.stringify(consultaToPass),
                                    paciente: JSON.stringify(pacienteParam || pacienteData),
                                }
                            });
                        } catch (e) {
                            console.error('Error preparando nueva consulta:', e);
                            Alert.alert('Error', 'No se pudo abrir el modal de consulta');
                        }
                    }}
                >
                    <Text style={styles.saveButtonText}>+ Agregar Antiparasitario</Text>
                </TouchableOpacity>

                <View style={[styles.section, { minHeight: 200, marginTop: Spacing.m }]}>
                    <View style={{ marginBottom: Spacing.m }}>
                        {loadingAntiparasitarios && (
                            <View style={{ padding: Spacing.m, alignItems: 'center', justifyContent: 'center' }}>
                                <ActivityIndicator size="large" color={Colors.primary} />
                            </View>
                        )}

                        {!loadingAntiparasitarios && antiparasitariosList.length === 0 && (
                            <View style={{ padding: Spacing.m }}><Text>No hay antiparasitarios disponibles</Text></View>
                        )}

                        {!loadingAntiparasitarios && antiparasitariosList.map((c, idx) => {
                            if (!c) return null;

                            const productoNombre = c?.comerciable?.producto?.nombre || c?.comerciable?.servicio?.descripcion || ('Venta ' + (c.id_venta ?? c.id ?? idx));

                            let imgSource = require('../assets/images/especies/huella.png');
                            if (c?.cliente?.foto_ruta && apiHost) {
                                const cleaned = String(c.cliente.foto_ruta).replace(/\\/g, '/').replace(/^\/+/, '');
                                const final = apiHost.replace(/\/+$/, '') + '/' + cleaned;
                                imgSource = { uri: final };
                            }

                            return (
                                <TouchableOpacity key={c.id ?? c.id_venta ?? idx} style={styles.pacienteItem} activeOpacity={0.8} onPress={() => handleOpenConsultaFromVenta(c, 'ver')}>
                                    <View style={styles.pacienteInfo}>
                                        <Text style={styles.pacienteName}>{productoNombre}</Text>
                                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Fecha:</Text> {formatDateForDisplay(c.fecha)}</Text>
                                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Precio cobrado:</Text> $ {c.precio_cobrado_cup ?? '-'}</Text>
                                    </View>

                                    <View style={{ flexDirection: 'column', padding: Spacing.s }}>
                                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: Colors.boton_azul, marginBottom: Spacing.s }]} onPress={() => handleOpenConsultaFromVenta(c, 'editar')}>
                                            <Image source={require('../assets/images/editar.png')} style={{ width: 20, height: 20, tintColor: Colors.textPrimary }} resizeMode="contain" />
                                        </TouchableOpacity>

                                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: Colors.boton_rojo_opciones }]} onPress={() => handleDeleteVenta(c)}>
                                            <Image source={require('../assets/images/basura.png')} style={{ width: 20, height: 20, tintColor: Colors.textPrimary }} resizeMode="contain" />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                    </View>
                </View>
            </ScrollView>

            <PatientSidebarMenu
                isOpen={showPatientMenu}
                onClose={() => setShowPatientMenu(false)}
                paciente={pacienteParam}
                apiHost={apiHost}
                selectedItem={'antiparasitarios'}
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
