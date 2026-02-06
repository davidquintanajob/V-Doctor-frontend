import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert, ToastAndroid, Modal, FlatList, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PatientSidebarMenu from '../components/PatientSidebarMenu';
import { Colors, Spacing, Typography, ColorsData } from '../variables';
import TopBar from '../components/TopBar';
import { LineChart } from 'react-native-gifted-charts';

export default function Historial_Peso() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const pacienteParam = params.paciente ? JSON.parse(params.paciente) : null;
    const pacienteId = pacienteParam?.id_paciente ?? pacienteParam?.id ?? null;

    const [apiHost, setApiHost] = useState('');
    const [loading, setLoading] = useState(false);
    const [historial, setHistorial] = useState([]);
    const [showPatientMenu, setShowPatientMenu] = useState(false);

    const fetchHistorialPeso = useCallback(async () => {
        if (!pacienteId) return;
        setLoading(true);
        try {
            const raw = await AsyncStorage.getItem('@config');
            const cfg = raw ? JSON.parse(raw) : {};
            const host = cfg.api_host || cfg.apihost || cfg.apiHost || '';
            const token = cfg.token || null;
            setApiHost(host || '');

            let baseHost = host || '';
            while (baseHost.endsWith('/')) baseHost = baseHost.slice(0, -1);
            const url = `${baseHost}/historial_peso/Filter/5/1`;

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ id_paciente: pacienteId })
            });

            if (!res.ok) {
                console.warn('[HistorialPeso] Error fetching:', res.status);
                setHistorial([]);
                return;
            }

            const json = await res.json();
            const items = Array.isArray(json.data) ? json.data : [];

            // Ordenar por fecha ascendente
            items.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

            setHistorial(items);
        } catch (e) {
            console.error('[HistorialPeso] fetch error', e);
            setHistorial([]);
        } finally {
            setLoading(false);
        }
    }, [pacienteId]);

    useEffect(() => { fetchHistorialPeso(); }, [fetchHistorialPeso]);

    useFocusEffect(
        useCallback(() => { fetchHistorialPeso(); return () => {}; }, [fetchHistorialPeso])
    );

    const formatDateLabel = (iso) => {
        try {
            if (!iso) return '';
            const d = new Date(iso);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        } catch (e) { return '' }
    };

    const chartData = historial.map(h => ({ value: Number(h.peso), label: formatDateLabel(h.fecha) }));
    const { width: windowWidth } = useWindowDimensions();
    const containerPadding = (Spacing && typeof Spacing.m === 'number') ? (Spacing.m * 2) : 32;
    const containerWidth = Math.max(300, windowWidth - containerPadding);

    // Calcular ancho del chart para que no deje espacios en blanco a los lados
    const desiredMinPointSpacing = 40; // mínimo espacio entre puntos
    const computedWidth = Math.max(containerWidth, (chartData.length * desiredMinPointSpacing));
    const spacing = chartData.length > 0 ? Math.max(12, Math.floor(computedWidth / Math.max(1, chartData.length))) : 20;

    return (
        <View style={styles.container}>
            <TopBar onMenuNavigate={() => {}} />

            <Modal transparent animationType="fade" visible={loading}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.modalText}>Cargando historial de peso...</Text>
                    </View>
                </View>
            </Modal>

            <FlatList
                data={historial.slice().reverse()}
                contentContainerStyle={styles.scrollContentContainer}
                keyExtractor={(item) => String(item.id_historial_peso || item.id || item.createdAt || Math.random())}
                ListHeaderComponent={() => (
                    <View>
                        <View style={[styles.headerRow, { justifyContent: 'space-between' }] }>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                                <Image source={require('../assets/images/arrow-left.png')} style={styles.icon} resizeMode="contain" />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setShowPatientMenu(true)} style={styles.menuButton}>
                                <Image source={require('../assets/images/menu.png')} style={styles.icon} resizeMode="contain" />
                            </TouchableOpacity>
                            <Text style={styles.sectionTitle}>Historial de Peso</Text>

                        </View>

                        {chartData && chartData.length > 0 ? (
                            <View style={{ padding: Spacing.m, backgroundColor: '#fff', borderRadius: 8 }}>
                                <Text style={{ fontWeight: '700', marginBottom: Spacing.s }}>Peso (kg)</Text>
                                <LineChart
                                    data={chartData}
                                    noOfSections={4}
                                    width={computedWidth}
                                    hideRules
                                    spacing={spacing}
                                    initialSpacing={0}
                                    yAxisLabelSuffix=" kg"
                                    color={Colors.primary}
                                    areaChart
                                    areaColor={`${(Colors.success || '#28C76F')}33`}
                                    showVerticalLines={false}
                                    showPoints
                                    pointColor={ColorsData.azul_oscuro || '#001aff'}
                                />
                            </View>
                        ) : (
                            <View style={{ padding: Spacing.m }}>
                                <Text style={{ color: Colors.textSecondary }}>No hay registros de peso para este paciente.</Text>
                            </View>
                        )}

                        <View style={{ height: Spacing.m }} />

                        <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: Spacing.m }}>
                            <Text style={{ fontWeight: '700', marginBottom: Spacing.s }}>Registros</Text>
                        </View>
                    </View>
                )}
                renderItem={({ item }) => (
                    <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: Spacing.m, marginTop: Spacing.s }}>
                        <Text style={{ fontWeight: '600' }}>{formatDateLabel(item.fecha)}</Text>
                        <Text>{item.peso} {item.unidad_medida || 'kg'}</Text>
                    </View>
                )}
            />

            <PatientSidebarMenu
                isOpen={showPatientMenu}
                onClose={() => setShowPatientMenu(false)}
                paciente={pacienteParam}
                apiHost={apiHost}
            />
        </View>
    );

}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5'},
    scrollContentContainer: { padding: Spacing.m },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.m },
    backButton: { backgroundColor: Colors.primarySuave, padding: Spacing.s, borderRadius: 8, borderWidth: 1, borderColor: '#000' },
    icon: { width: 20, height: 20, tintColor: Colors.textPrimary },
    sectionTitle: { fontSize: Typography.h3, fontWeight: '700', color: Colors.textSecondary, flex: 1, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#fff', padding: Spacing.m, borderRadius: 8, alignItems: 'center', minWidth: 200 },
    modalText: { marginTop: Spacing.s, color: Colors.textSecondary },
    menuButton: { padding: Spacing.s, borderRadius: 8, backgroundColor: Colors.primarySuave, marginLeft: Spacing.s, borderWidth: 1, borderColor: '#000' },
});
