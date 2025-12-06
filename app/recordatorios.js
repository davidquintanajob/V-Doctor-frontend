import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ScrollView, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import PatientSidebarMenu from '../components/PatientSidebarMenu';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TopBar from '../components/TopBar';
import { Colors, Spacing, Typography, ColorsData } from '../variables';

export default function RecordatoriosScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const handleMenuNavigate = (link) => {
        console.log('Navegando a:', link);
    };

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
    const [apiHost, setApiHost] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem('@config');
                const cfg = raw ? JSON.parse(raw) : {};
                const host = cfg.api_host || cfg.apihost || cfg.apiHost || '';
                setApiHost(host || '');
            } catch (e) {
                setApiHost('');
            }
        })();
    }, []);

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

    return (
        <View style={styles.container}>
            <TopBar onMenuNavigate={handleMenuNavigate} />
            <ScrollView contentContainerStyle={styles.scrollContentContainer}>
                <View style={[styles.headerRow, { justifyContent: 'space-between' }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Image source={require('../assets/images/arrow-left.png')} style={styles.icon} resizeMode="contain" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleOpenPatientMenu} style={styles.menuButton}>
                        <Image source={require('../assets/images/menu.png')} style={styles.icon} resizeMode="contain" />
                    </TouchableOpacity>
                    <Text style={styles.sectionTitle}>Recordatorios</Text>

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

                <TouchableOpacity style={styles.saveButton} onPress={() => { }}>
                    <Text style={styles.saveButtonText}>+ Agregar Recordatorio</Text>
                </TouchableOpacity>

                <View style={[styles.section, { minHeight: 200, marginTop: Spacing.m }]} />
            </ScrollView>

            <PatientSidebarMenu isOpen={showPatientMenu} onClose={() => setShowPatientMenu(false)} paciente={pacienteParam} apiHost={apiHost} selectedItem={'recordatorios'} />
        </View>
    );

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
    backButton: { backgroundColor: Colors.primarySuave, padding: Spacing.s, borderRadius: 8, borderWidth: 1, borderColor: '#000' },
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
});
