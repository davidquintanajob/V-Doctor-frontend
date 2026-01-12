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
    Image,
    Modal
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
    const [costoFormula, setCostoFormula] = useState(null);

    // Modal & pending save state
    const [modalVisible, setModalVisible] = useState(false);
    const [modalTestValue, setModalTestValue] = useState(null);
    const [pendingRequest, setPendingRequest] = useState(null);

    // Calcular costos totales auxiliares
    const calcularCostoTotalCUP = () => {
        const cant = parseNumber(cantidad) || 0;
        const costoUnit = parseNumber(costo_cup) || 0;
        return String(Math.round(cant * costoUnit * 100) / 100);
    };

    // Al confirmar en el modal: opcionalmente actualizar producto (PUT) con los costos calculados,
    // luego crear la entrada (POST) con el body original (valores ingresados por el usuario).
    const proceedWithSave = async (applyTestValue) => {
        if (!pendingRequest) return;
        try {
            // Si el usuario escogió aplicar la fórmula, calcular y llamar al endpoint UpdateProducto
            if (applyTestValue && (costoFormula === 'Promedio ponderado' || costoFormula === 'Primero en entrar, primero en salir')) {
                let newCosts = null;
                if (costoFormula === 'Promedio ponderado') {
                    newCosts = getCostoPromedioPonderado();
                } else {
                    newCosts = await getCostoFIFOTest();
                }

                const prodId = selectedComerciable?.id_comerciable || selectedComerciable?.id;
                if (!prodId) {
                    Alert.alert('Error', 'No se pudo obtener el id del producto para actualizar');
                    return;
                }

                const updateUrl = `${apiHost.replace(/\/+$/, '')}/producto/UpdateProducto/${prodId}`;
                const updateHeaders = { 'Content-Type': 'application/json' };
                if (pendingRequest.headers && pendingRequest.headers.Authorization) updateHeaders.Authorization = pendingRequest.headers.Authorization;
                else if (token) updateHeaders.Authorization = `Bearer ${token}`;

                const updateBody = {
                    costo_usd: Number(newCosts.costo_usd) || 0,
                    costo_cup: Number(newCosts.costo_cup) || 0
                };

                const updRes = await fetch(updateUrl, { method: 'PUT', headers: updateHeaders, body: JSON.stringify(updateBody) });
                if (updRes.status === 403) { setModalVisible(false); router.replace('/login'); return; }
                const updRespData = await updRes.json().catch(() => null);
                if (!updRes.ok) {
                    let errorMessage = 'Error desconocido';
                    if (updRespData && updRespData.errors && Array.isArray(updRespData.errors)) {
                        errorMessage = updRespData.errors.join('\n• ');
                    } else if (updRespData && typeof updRespData.error === 'string') {
                        errorMessage = updRespData.error;
                    } else if (updRespData && (updRespData.message || updRespData.description)) {
                        errorMessage = updRespData.message || updRespData.description;
                    } else if (updRespData) {
                        errorMessage = JSON.stringify(updRespData);
                    }
                    Alert.alert(`Error ${updRes.status}`, errorMessage);
                    return;
                }
            }

            // Luego crear la entrada usando el body original
            const { url, headers, body } = pendingRequest;
            const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
            if (res.status === 403) { setModalVisible(false); router.replace('/login'); return; }
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
                setModalVisible(false);
                setPendingRequest(null);
                return;
            }

            if (Platform.OS === 'android') {
                ToastAndroid.show('Entrada creada', ToastAndroid.SHORT);
            } else {
                Alert.alert('Éxito', 'Entrada creada');
            }

            try { eventBus.emit('refreshProductosMedicamentos'); } catch (e) { }
            setModalVisible(false);
            setPendingRequest(null);
            router.back();

        } catch (error) {
            console.error('Error en proceedWithSave:', error);
            Alert.alert('Error de conexión', 'No se pudo conectar con el servidor');
            setModalVisible(false);
            setPendingRequest(null);
        }
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
                    try {
                        const redondeoRaw = await AsyncStorage.getItem('@redondeoConfig');
                        if (redondeoRaw) {
                            const rc = JSON.parse(redondeoRaw);
                            if (rc && typeof rc.costoFormula === 'string') setCostoFormula(rc.costoFormula);
                        }
                    } catch (e) {
                        console.log('Error reading @redondeoConfig', e);
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

    // Métodos de prueba para calcular costo según la fórmula
    const getCostoPromedioPonderado = () => {
        try {
            const cantActual = parseNumber(selectedComerciable?.producto?.cantidad) || 0;
            const cppActual = parseNumber(selectedComerciable?.producto?.costo_cup) || 0;
            const cantEntrada = parseNumber(cantidad) || 0;
            const costoEntrada = parseNumber(costo_cup) || 0;

            const denom = (cantActual + cantEntrada);
            let cppCup = 0;
            if (denom > 0) {
                cppCup = ((cantActual * cppActual) + (cantEntrada * costoEntrada)) / denom;
            } else {
                cppCup = costoEntrada || cppActual || 0;
            }

            // Cambiado de 100 a 100000 para redondear a 5 decimales
            const cppCupRounded = Math.round(cppCup * 100000) / 100000;

            // Cambiado toFixed(2) a toFixed(5) para mostrar 5 decimales
            const costoUsd = (cambioMoneda && cambioMoneda > 0)
                ? String((cppCupRounded / cambioMoneda).toFixed(5))
                : '0.00000';

            return {
                costo_cup: String(cppCupRounded.toFixed(5)),
                costo_usd: costoUsd
            };
        } catch (e) {
            return {
                costo_cup: '0.00000',
                costo_usd: '0.00000'
            };
        }
    };

    const getCostoFIFOTest = async () => {
        try {
            const prodId = selectedComerciable?.id_comerciable || selectedComerciable?.id;
            if (!prodId) return { costo_cup: '0.00', costo_usd: '0.00' };

            const headers = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

            const entradasUrl = `${apiHost.replace(/\/+$/, '')}/entrada/comerciable/${prodId}`;
            const ventasUrl = `${apiHost.replace(/\/+$/, '')}/venta/comerciable/${prodId}`;

            const [entradasRes, ventasRes] = await Promise.all([
                fetch(entradasUrl, { method: 'GET', headers }),
                fetch(ventasRes ? ventasUrl : ventasUrl, { method: 'GET', headers })
            ]);

            const entradas = await entradasRes.json().catch(() => []);
            const ventas = await ventasRes.json().catch(() => []);

            // Normalize entradas: each layer {cantidad, costo_cup}
            const layers = (Array.isArray(entradas) ? entradas : []).map(e => ({
                cantidad: Number(e.cantidad) || 0,
                costo_cup: (e.costo_cup != null) ? Number(e.costo_cup) : (Number(e.producto?.costo_cup) || 0),
                fecha: e.fecha ? new Date(e.fecha) : null
            })).sort((a,b) => (a.fecha||0) - (b.fecha||0));

            // Sort ventas chronologically
            const sales = (Array.isArray(ventas) ? ventas : []).map(v => ({
                cantidad: Number(v.cantidad) || 0,
                fecha: v.fecha ? new Date(v.fecha) : null
            })).sort((a,b) => (a.fecha||0) - (b.fecha||0));

            // Apply sales to layers (FIFO consumption)
            let layersCopy = layers.map(l => ({ ...l }));
            for (const s of sales) {
                let qtyToConsume = s.cantidad;
                for (let i = 0; i < layersCopy.length && qtyToConsume > 0; i++) {
                    const layer = layersCopy[i];
                    if (layer.cantidad <= 0) continue;
                    const take = Math.min(layer.cantidad, qtyToConsume);
                    layer.cantidad -= take;
                    qtyToConsume -= take;
                }
            }

            // After consumption, append new incoming entry (the current entrada being created)
            const entradaCantidad = parseNumber(cantidad) || 0;
            const entradaCostoCup = parseNumber(costo_cup) || 0;
            if (entradaCantidad > 0) {
                layersCopy.push({ cantidad: entradaCantidad, costo_cup: entradaCostoCup });
            }

            // Compute weighted average cost across remaining layers
            let totalQty = 0;
            let totalCost = 0;
            for (const l of layersCopy) {
                if (l.cantidad > 0) {
                    totalQty += l.cantidad;
                    totalCost += l.cantidad * (Number(l.costo_cup) || 0);
                }
            }

            let cppCup = 0;
            if (totalQty > 0) cppCup = totalCost / totalQty;
            const cppCupRounded = Math.round(cppCup * 100000) / 100000;
            const costoUsd = (cambioMoneda && cambioMoneda > 0) ? String((cppCupRounded / cambioMoneda).toFixed(5)) : '0.00000';

            return { costo_cup: String(cppCupRounded.toFixed(5)), costo_usd: costoUsd };
        } catch (e) {
            console.error('Error getCostoFIFOTest', e);
            return { costo_cup: '0.00000', costo_usd: '0.00000' };
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

            // Preparar petición pendiente y mostrar modal para preguntar si desea modificar costos
            let testValue = null;
            if (costoFormula === 'Promedio ponderado') {
                testValue = getCostoPromedioPonderado();
            } else if (costoFormula === 'Primero en entrar, primero en salir') {
                testValue = await getCostoFIFOTest();
            }

            setModalTestValue(testValue);
            setPendingRequest({ url, headers, body });
            setModalVisible(true);
            return;

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
                    <Modal visible={modalVisible} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalBox}>
                                <TouchableOpacity
                                    style={styles.modalCloseButton}
                                    onPress={() => { setModalVisible(false); setPendingRequest(null); }}
                                >
                                    <Text style={styles.modalCloseText}>✕</Text>
                                </TouchableOpacity>
                                <Text style={styles.modalTitle}>Modificar costos según fórmula</Text>
                                <Text style={styles.modalText}>{selectedComerciable ? (selectedComerciable.producto?.nombre || selectedComerciable.nombre) : ''}</Text>
                                <Text style={styles.modalText}>Fórmula: {costoFormula || 'N/A'}</Text>
                                <Text style={styles.modalText}>Valor sugerido: {modalTestValue ? `CUP ${modalTestValue.costo_cup} — USD ${modalTestValue.costo_usd}` : 'N/A'}</Text>
                                <Text style={[styles.modalText, styles.modalCurrentLabel]}>Valor actual:</Text>
                                <Text style={styles.modalText}>CUP {String(selectedComerciable?.producto?.costo_cup ?? selectedComerciable?.costo_cup ?? '0.00')} — USD {String(selectedComerciable?.producto?.costo_usd ?? selectedComerciable?.costo_usd ?? '0.00')}</Text>
                                <View style={styles.modalButtons}>
                                    <TouchableOpacity style={styles.modalButton} onPress={() => proceedWithSave(true)}>
                                        <Text style={styles.modalButtonText}>Modificar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.modalButtonAux} onPress={() => proceedWithSave(false)}>
                                        <Text style={styles.modalButtonText}>No modificar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
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
    ,
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalBox: { backgroundColor: '#fff', padding: Spacing.m, borderRadius: 8, width: '90%', position: 'relative' },
    modalTitle: { fontSize: Typography.h4 || 18, fontWeight: '700', marginBottom: Spacing.s },
    modalText: { fontSize: Typography.body, marginBottom: Spacing.xs },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.m },
    modalButton: { flex: 1, paddingVertical: Spacing.s, backgroundColor: Colors.boton_azul, borderRadius: 8, marginHorizontal: 4, alignItems: 'center' },
    modalButtonAux: { flex: 1, paddingVertical: Spacing.s, backgroundColor: Colors.boton_rojo_opciones, borderRadius: 8, marginHorizontal: 4, alignItems: 'center' },
    modalButtonText: { color: '#fff', fontWeight: '700' }
    ,
    modalCurrentLabel: { fontWeight: '700', marginTop: Spacing.s }
    ,
    modalCloseButton: { position: 'absolute', top: 8, left: 8, padding: 6, borderRadius: 16, zIndex: 10 },
    modalCloseText: { fontSize: 18, color: Colors.textSecondary, fontWeight: '700' }
});
