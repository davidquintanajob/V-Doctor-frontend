import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ToastAndroid,
    Alert,
    Platform,
    Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import TopBar from '../components/TopBar';
import ApiAutocomplete from '../components/ApiAutocomplete';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography } from '../variables';
import eventBus from '../utils/eventBus';

export default function AddEntradaScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const [apiHost, setApiHost] = useState('');
    const [token, setToken] = useState(null);
    const [cambioMoneda, setCambioMoneda] = useState(null);

    const [selectedComerciable, setSelectedComerciable] = useState(null);
    const [nombreProveedor, setNombreProveedor] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [cantidad, setCantidad] = useState('0');
    const [costo_cup, setCostoCUP] = useState('0');
    const [costo_usd, setCostoUSD] = useState('0');
    const [comerciableBusqueda, setComercialeBusqueda] = useState('');

    // Calcular costos totales auxiliares
    const calcularCostoTotalCUP = () => {
        const cant = parseNumber(cantidad) || 0;
        const costoUnit = parseNumber(costo_cup) || 0;
        return String(Math.round(cant * costoUnit * 100) / 100);
    };

    const calcularCostoTotalUSD = () => {
        const cant = parseNumber(cantidad) || 0;
        const costoUnit = parseNumber(costo_usd) || 0;
        return String(Math.round(cant * costoUnit * 100) / 100);
    };

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const raw = await AsyncStorage.getItem('@config');
                if (!raw) return;
                const config = JSON.parse(raw);
                const host = config.api_host || config.apihost || config.apiHost || '';
                setApiHost(host);
                setToken(config.token || null);
                try {
                    const cambioRaw = await AsyncStorage.getItem('@CambioMoneda');
                    if (cambioRaw) {
                        const num = Number(String(cambioRaw).replace(/,/g, '.'));
                        if (!isNaN(num) && num > 0) setCambioMoneda(num);
                    }
                } catch (e) {
                    console.log('Error reading @CambioMoneda', e);
                }
            } catch (e) {
                console.error('Error cargando config', e);
            }
        };
        loadConfig();
    }, []);

    const parseNumber = (s) => {
        if (s === null || typeof s === 'undefined') return null;
        const n = Number(String(s).replace(/,/g, '.'));
        return isNaN(n) ? null : n;
    };

    const handleCostoCUPChange = (t) => {
        const cleaned = t.replace(/[^0-9\.]*/g, '');
        setCostoCUP(cleaned);
        const cup = parseNumber(cleaned);
        if (cup != null && cambioMoneda && cambioMoneda > 0) {
            setCostoUSD(String((cup / cambioMoneda).toFixed(2)));
        } else if (cleaned === '') {
            setCostoUSD('');
        }
    };

    const handleCostoUSDChange = (t) => {
        const cleaned = t.replace(/[^0-9\.]*/g, '');
        setCostoUSD(cleaned);
        const usd = parseNumber(cleaned);
        if (usd != null && cambioMoneda && cambioMoneda > 0) {
            setCostoCUP(String(Math.round((usd * cambioMoneda) * 100) / 100));
        } else if (cleaned === '') {
            setCostoCUP('');
        }
    };

    const handleSave = async () => {
        try {
            const raw = await AsyncStorage.getItem('@config');
            if (!raw) {
                Alert.alert('Configuración requerida', 'Debes configurar la API primero');
                router.replace('/config');
                return;
            }
            const config = JSON.parse(raw);
            const host = config.api_host || config.apihost || config.apiHost;
            const tokenLocal = config.token;
            const userId = config?.userconfig?.usuario?.id_usuario || config?.usuario?.id_usuario || config?.user?.id_usuario || config?.user?.id || null;
            if (!host) {
                Alert.alert('Configuración requerida', 'Debes configurar la API primero');
                router.replace('/config');
                return;
            }
            if (!userId) {
                Alert.alert('Error', 'No se pudo obtener el usuario (id_usuario)');
                return;
            }
            if (!selectedComerciable) {
                Alert.alert('Error', 'Debes seleccionar un producto/medicamento');
                return;
            }

            const body = {
                id_usuario: Number(userId),
                id_comerciable: Number(selectedComerciable.id_comerciable || selectedComerciable.id || selectedComerciable.id_comerciable),
                nombre_proveedor: nombreProveedor,
                fecha: fecha,
                cantidad: Number(cantidad) || 0,
                costo_cup: costo_cup ? Number(costo_cup) : 0,
                costo_usd: costo_usd ? Number(costo_usd) : 0
            };

            const url = `${host.replace(/\/+$/, '')}/entrada/CreateEntrada`;
            const headers = { 'Content-Type': 'application/json' };
            if (tokenLocal) headers['Authorization'] = `Bearer ${tokenLocal}`;

            const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
            if (res.status === 403) { router.replace('/login'); return; }
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

            if (Platform.OS === 'android') {
                ToastAndroid.show('Entrada creada', ToastAndroid.SHORT);
            } else {
                Alert.alert('Éxito', 'Entrada creada');
            }

            try { eventBus.emit('refreshProductosMedicamentos'); } catch (e) { }
            router.back();

        } catch (error) {
            console.error('Error creando entrada:', error);
            Alert.alert('Error de conexión', 'No se pudo conectar con el servidor');
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <TopBar />
            <ScrollView contentContainerStyle={{ padding: Spacing.m }} keyboardShouldPersistTaps="handled">
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Image source={require('../assets/images/arrow-left.png')} style={styles.icon} resizeMode="contain" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Agregar Entrada</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Producto / Medicamento *</Text>
                    <ApiAutocomplete
                        endpoint="/comerciable/filter/5/1"
                        body={{ nombre: comerciableBusqueda, isProducto: true }}
                        displayFormat={(item) => `${item.producto?.nombre || item.nombre} - ${item.producto?.categoria || item.categoria || ''}`}
                        onItemSelect={(item) => {
                            setSelectedComerciable(item);
                            setComercialeBusqueda('');
                        }}
                        placeholder="Buscar producto o medicamento..."
                        delay={300}
                    />

                    <Text style={styles.label}>Nombre proveedor</Text>
                    <TextInput style={styles.input} value={nombreProveedor} onChangeText={setNombreProveedor} placeholder="Nombre del proveedor" />

                    <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
                    <TextInput style={styles.input} value={fecha} onChangeText={setFecha} placeholder="YYYY-MM-DD" />

                    <Text style={styles.label}>Cantidad</Text>
                    <TextInput style={styles.input} value={cantidad} onChangeText={(t) => setCantidad(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" />

                    <View style={{ flexDirection: 'row', gap: Spacing.s }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Costo USD Unitario</Text>
                            <TextInput style={styles.input} value={costo_usd} onChangeText={handleCostoUSDChange} keyboardType="decimal-pad" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Costo CUP Unitario</Text>
                            <TextInput style={styles.input} value={costo_cup} onChangeText={handleCostoCUPChange} keyboardType="decimal-pad" />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: Spacing.s }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Costo USD Total</Text>
                            <TextInput style={[styles.input, styles.disabledInput]} value={calcularCostoTotalUSD()} editable={false} keyboardType="decimal-pad" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Costo CUP Total</Text>
                            <TextInput style={[styles.input, styles.disabledInput]} value={calcularCostoTotalCUP()} editable={false} keyboardType="decimal-pad" />
                        </View>
                    </View>

                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                        <Text style={styles.saveButtonText}>Crear Entrada</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    icon: { width: 20, height: 20, tintColor: Colors.textPrimary },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.m },
    backButton: { padding: 8, backgroundColor: Colors.primarySuave, borderRadius: 8, marginRight: Spacing.s },
    title: { fontSize: Typography.h3, fontWeight: '700', color: Colors.textSecondary, flex: 1, textAlign: 'center' },
    section: { backgroundColor: '#fff', padding: Spacing.m, borderRadius: 8, marginBottom: Spacing.m, borderWidth: 1, borderColor: '#000' },
    label: { fontSize: Typography.body, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#000', borderRadius: 8, paddingHorizontal: Spacing.m, paddingVertical: 10, fontSize: Typography.body, color: Colors.textSecondary, minHeight: 44, marginBottom: Spacing.s },
    disabledInput: { backgroundColor: '#f5f5f5' },
    saveButton: { backgroundColor: Colors.boton_azul, paddingVertical: Spacing.m, paddingHorizontal: Spacing.m, borderRadius: 8, alignItems: 'center', marginTop: Spacing.m, borderWidth: 1, borderColor: '#000' },
    saveButtonText: { color: '#fff', fontSize: Typography.body, fontWeight: '600' }
});
