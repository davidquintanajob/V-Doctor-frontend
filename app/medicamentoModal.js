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
    Platform,
    Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import TopBar from '../components/TopBar';
import DataTable from '../components/DataTable';
import { Colors, Spacing, Typography } from '../variables';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRScannerModal from '../components/QRScannerModal';
import DropdownGenerico from '../components/DropdownGenerico';
import eventBus from '../utils/eventBus';

const { width: screenWidth } = Dimensions.get('window');

export default function MedicamentoModalScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const mode = params.mode; // 'ver' | 'editar' | 'crear'
    const medicamentoParam = params.medicamento ? JSON.parse(params.medicamento) : null;

    const [medicamentoData, setMedicamentoData] = useState({
        id_comerciable: medicamentoParam?.id_comerciable || null,
        nombre: medicamentoParam?.producto?.nombre || '',
        codigo: medicamentoParam?.producto?.codigo ? String(medicamentoParam.producto.codigo) : '',
        tipo_medicamento: medicamentoParam?.tipo_medicamento || '',
        unidad_medida: medicamentoParam?.unidad_medida || '',
        posologia: medicamentoParam?.posologia || '',
        costo_usd: medicamentoParam?.producto?.costo_usd ? String(medicamentoParam.producto.costo_usd) : '',
        costo_cup: medicamentoParam?.producto?.costo_cup ? String(medicamentoParam.producto.costo_cup) : '',
        categoria: medicamentoParam?.producto?.categoria || '',
        nota: medicamentoParam?.producto?.nota || '',
        cantidad: medicamentoParam?.producto?.cantidad ? String(medicamentoParam.producto.cantidad) : '',
        precio_usd: medicamentoParam?.producto?.comerciable?.precio_usd ? String(medicamentoParam.producto.comerciable.precio_usd) : '',
        precio_cup: medicamentoParam?.producto?.comerciable?.precio_cup ? String(medicamentoParam.producto.comerciable.precio_cup) : ''
    });

    const tiposMedicamento = [
        { id: 1, nombre: "vacuna" },
        { id: 2, nombre: "antiparasitario" },
        { id: 3, nombre: "antibiótico" },
        { id: 4, nombre: "digestivo" },
        { id: 5, nombre: "vitaminico" },
        { id: 6, nombre: "anestesico" },
        { id: 7, nombre: "sedante" },
        { id: 8, nombre: "crema" },
        { id: 9, nombre: "oftalmico" },
        { id: 10, nombre: "otico" },
        { id: 11, nombre: "energizante" },
        { id: 12, nombre: "inmuno }estimulante" },
        { id: 13, nombre: "anticeptico" },
        { id: 14, nombre: "desinfectante" }
    ];
    const allRoles = ['Administrador', 'Médico', 'Técnico', 'Estilista'];
    const [rolesSelected, setRolesSelected] = useState([]);
    const [showScannerModal, setShowScannerModal] = useState(false);
    const [cambioMoneda, setCambioMoneda] = useState(null);

    const [entradasPage, setEntradasPage] = useState(1);
    const [ventasPage, setVentasPage] = useState(1);
    const itemsPerPage = 10;
    const [isAdmin, setIsAdmin] = useState(false);

    const entradasList = medicamentoParam?.producto?.entradas || [];
    const ventasList = medicamentoParam?.producto?.comerciable?.venta || [];

    const isEditable = mode !== 'ver';

    useEffect(() => {
        const getApiHost = async () => {
            try {
                const raw = await AsyncStorage.getItem('@config');
                if (raw) {
                    const config = JSON.parse(raw);
                    try {
                        const user = config.usuario || config.user || {};
                        setIsAdmin((user && user.rol && String(user.rol) === 'Administrador'));
                    } catch (e) {
                        setIsAdmin(false);
                    }
                    try {
                        const cambioRaw = await AsyncStorage.getItem('@CambioMoneda');
                        if (cambioRaw) {
                            const num = Number(String(cambioRaw).replace(/,/g, '.'));
                            if (!isNaN(num) && num > 0) setCambioMoneda(num);
                        }
                    } catch (e) {
                        console.log('Error reading @CambioMoneda:', e);
                    }
                }
            } catch (error) {
                console.error('Error getting apiHost:', error);
            }
        };
        getApiHost();
    }, []);

    useEffect(() => {
        if (medicamentoParam) {
            setMedicamentoData({
                id_comerciable: medicamentoParam?.id_comerciable || null,
                nombre: medicamentoParam?.producto?.nombre || '',
                codigo: medicamentoParam?.producto?.codigo ? String(medicamentoParam.producto.codigo) : '',
                tipo_medicamento: medicamentoParam?.tipo_medicamento || '',
                unidad_medida: medicamentoParam?.unidad_medida || '',
                posologia: medicamentoParam?.posologia || '',
                costo_usd: medicamentoParam?.producto?.costo_usd ? String(medicamentoParam.producto.costo_usd) : '',
                costo_cup: medicamentoParam?.producto?.costo_cup ? String(medicamentoParam.producto.costo_cup) : '',
                categoria: medicamentoParam?.producto?.categoria || '',
                nota: medicamentoParam?.producto?.nota || '',
                cantidad: medicamentoParam?.producto?.cantidad ? String(medicamentoParam.producto.cantidad) : '',
                precio_usd: medicamentoParam?.producto?.comerciable?.precio_usd ? String(medicamentoParam.producto.comerciable.precio_usd) : '',
                precio_cup: medicamentoParam?.producto?.comerciable?.precio_cup ? String(medicamentoParam.producto.comerciable.precio_cup) : ''
            });
            try {
                const rolesStr = medicamentoParam?.producto?.comerciable?.roles_autorizados || medicamentoParam?.roles_autorizados || '';
                const parsed = String(rolesStr).split(',').map(s => s.trim()).filter(s => s.length > 0);
                setRolesSelected(parsed.filter(r => allRoles.includes(r)));
            } catch (e) {
                setRolesSelected([]);
            }
        }
    }, [params.medicamento]);

    // If creating a medicamento, fetch unique product code and set it into the codigo field
    useEffect(() => {
        const fetchUniqueCode = async () => {
            if (mode !== 'crear') return;
            try {
                const raw = await AsyncStorage.getItem('@config');
                if (!raw) return;
                const config = JSON.parse(raw);
                const host = config.api_host || config.apihost || config.apiHost;
                const token = config.token;
                if (!host) return;
                const url = `${host.replace(/\/+$/, '')}/producto/unique-code`;
                const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
                if (!res.ok) {
                    console.log('No se pudo obtener unique-code', res.status);
                    return;
                }
                const data = await res.json().catch(() => null);
                if (data && data.code) {
                    setMedicamentoData(prev => ({ ...prev, codigo: String(data.code) }));
                }
            } catch (err) {
                console.error('Error fetching unique-code:', err);
            }
        };
        fetchUniqueCode();
    }, [mode]);

    const parseNumber = (s) => {
        if (s === null || typeof s === 'undefined') return null;
        const n = Number(String(s).replace(/,/g, '.'));
        return isNaN(n) ? null : n;
    };

    const handleCostoCUPChange = (t) => {
        const cleaned = t.replace(/[^0-9\.]/g, '');
        setMedicamentoData(prev => {
            let costo_usd = prev.costo_usd;
            const cup = parseNumber(cleaned);
            if (cup != null && cambioMoneda && cambioMoneda > 0) {
                costo_usd = String((cup / cambioMoneda).toFixed(2));
            } else if (cleaned === '') {
                costo_usd = '';
            }
            return { ...prev, costo_cup: cleaned, costo_usd };
        });
    };

    const handleCostoUSDChange = (t) => {
        const cleaned = t.replace(/[^0-9\.]/g, '');
        setMedicamentoData(prev => {
            let costo_cup = prev.costo_cup;
            const usd = parseNumber(cleaned);
            if (usd != null && cambioMoneda && cambioMoneda > 0) {
                costo_cup = String(Math.round((usd * cambioMoneda) * 100) / 100);
            } else if (cleaned === '') {
                costo_cup = '';
            }
            return { ...prev, costo_usd: cleaned, costo_cup };
        });
    };

    const handlePrecioCUPChange = (t) => {
        const cleaned = t.replace(/[^0-9\.]/g, '');
        setMedicamentoData(prev => {
            let precio_usd = prev.precio_usd;
            const cup = parseNumber(cleaned);
            if (cup != null && cambioMoneda && cambioMoneda > 0) {
                precio_usd = String((cup / cambioMoneda).toFixed(2));
            } else if (cleaned === '') {
                precio_usd = '';
            }
            return { ...prev, precio_cup: cleaned, precio_usd };
        });
    };

    const handlePrecioUSDChange = (t) => {
        const cleaned = t.replace(/[^0-9\.]/g, '');
        setMedicamentoData(prev => {
            let precio_cup = prev.precio_cup;
            const usd = parseNumber(cleaned);
            if (usd != null && cambioMoneda && cambioMoneda > 0) {
                precio_cup = String(Math.round((usd * cambioMoneda) * 100) / 100);
            } else if (cleaned === '') {
                precio_cup = '';
            }
            return { ...prev, precio_usd: cleaned, precio_cup };
        });
    };

    const handleBack = () => router.back();

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
            const token = config.token;
            if (!host) {
                Alert.alert('Configuración requerida', 'Debes configurar la API primero');
                router.replace('/config');
                return;
            }

            if (!medicamentoData.nombre || !medicamentoData.nombre.trim()) {
                Alert.alert('Error', 'El nombre del medicamento es requerido');
                return;
            }
            if (rolesSelected.length === 0) {
                Alert.alert('Error', 'Se debe elegir almenos un rol autorizado a comercializar el medicamento');
                return;
            }

            const body = {
                nombre: medicamentoData.nombre,
                costo_usd: medicamentoData.costo_usd ? Number(medicamentoData.costo_usd) : 0,
                costo_cup: medicamentoData.costo_cup ? Number(medicamentoData.costo_cup) : 0,
                categoria: medicamentoData.categoria,
                nota: medicamentoData.nota,
                precio_usd: medicamentoData.precio_usd ? Number(medicamentoData.precio_usd) : 0,
                precio_cup: medicamentoData.precio_cup ? Number(medicamentoData.precio_cup) : 0,
                roles_autorizados: rolesSelected.join(', '),
                tipo_medicamento: medicamentoData.tipo_medicamento.nombre,
                unidad_medida: medicamentoData.unidad_medida,
                posologia: medicamentoData.posologia
            };

            // En 'crear' incluir codigo (aunque sea null).
            // En 'editar' incluir codigo solo si fue modificado respecto al código original.
            if (mode === 'crear') {
                body.codigo = medicamentoData.codigo ? Number(medicamentoData.codigo) : null;
            } else if (mode === 'editar') {
                const originalCodigo = medicamentoParam?.producto?.codigo ?? medicamentoParam?.codigo ?? null;
                if (medicamentoData.codigo && String(medicamentoData.codigo) !== String(originalCodigo)) {
                    body.codigo = Number(medicamentoData.codigo);
                }
            }

            const base = host.replace(/\/+$/, '');
            let url;
            let method = 'POST';
            if (mode === 'editar') {
                const id = medicamentoData.id_comerciable || medicamentoParam?.id_comerciable || medicamentoParam?.id;
                if (!id) {
                    Alert.alert('Error', 'No se pudo identificar el medicamento a actualizar');
                    return;
                }
                url = `${base}/medicamento/UpdateMedicamento/${id}`;
                method = 'PUT';
            } else {
                url = `${base}/medicamento/CreateMedicamento/`;
                method = 'POST';
            }

            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const res = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(body)
            });

            if (res.status === 403) {
                router.replace('/login');
                return;
            }

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
                ToastAndroid.show(mode === 'editar' ? 'Medicamento actualizado' : 'Medicamento creado', ToastAndroid.SHORT);
            } else {
                Alert.alert('Éxito', mode === 'editar' ? 'Medicamento actualizado' : 'Medicamento creado');
            }

            try { eventBus.emit('refreshProductosMedicamentos'); } catch (e) { /* ignore */ }

            router.back();

        } catch (error) {
            console.error('Error guardando medicamento:', error);
            Alert.alert('Error de conexión', 'No se pudo conectar con el servidor');
        }
    };
    const entradasColumns = [
        { key: 'fecha', label: 'Fecha', width: 140, cellRenderer: (v) => <Text style={styles.cellText}>{v ? (new Date(v)).toLocaleDateString() : 'N/A'}</Text> },
        { key: 'cantidad', label: 'Cantidad', width: 100, cellRenderer: (v) => <Text style={styles.cellText}>{v ?? '0'}</Text> },
        { key: 'costo_usd', label: 'Costo USD', width: 120, cellRenderer: (v) => <Text style={styles.cellText}>{v ? `$${Number(v).toFixed(2)}` : '0'}</Text> },
        { key: 'costo_cup', label: 'Costo CUP', width: 120, cellRenderer: (v) => <Text style={styles.cellText}>{v ? `$${Number(v).toFixed(2)}` : '0'}</Text> },
        { key: 'nombre_proveedor', label: 'Proveedor', width: 180, cellRenderer: (v) => <Text style={styles.cellText}>{v || ''}</Text> }
    ];

    const ventasColumns = [
        { key: 'fecha', label: 'Fecha', width: 140, cellRenderer: (v) => <Text style={styles.cellText}>{v ? (new Date(v)).toLocaleDateString() : 'N/A'}</Text> },
        { key: 'cantidad', label: 'Cantidad', width: 100, cellRenderer: (v) => <Text style={styles.cellText}>{v ?? '0'}</Text> },
        { key: 'precio_original_comerciable_cup', label: 'Precio Original CUP', width: 120, cellRenderer: (v) => <Text style={styles.cellText}>{v || '0'}</Text> },
        { key: 'precio_cobrado_cup', label: 'Precio Cobrado', width: 120, cellRenderer: (v) => <Text style={styles.cellText}>{v || '0'}</Text> }
    ];

    const entradasSummary = entradasList.reduce((acc, e) => {
        const cantidad = Number(e.cantidad) || 0;
        const costo_cup = e.costo_cup != null ? Number(e.costo_cup) || 0 : 0;
        const costo_usd = e.costo_usd != null ? Number(e.costo_usd) || 0 : 0;
        acc.totalCantidad += cantidad;
        acc.totalCostoCup += costo_cup;
        acc.totalCostoUsd += costo_usd;
        return acc;
    }, { totalCantidad: 0, totalCostoCup: 0, totalCostoUsd: 0 });

    const ventasSummary = ventasList.reduce((acc, v) => {
        const cantidad = Number(v.cantidad) || 0;
        const precio_cobrado = v.precio_cobrado_cup != null ? Number(v.precio_cobrado_cup) || 0 : 0;
        const precio_original = v.precio_original_comerciable_cup != null ? Number(v.precio_original_comerciable_cup) || 0 : 0;
        const forma = v.forma_pago || '';
        acc.totalCantidad += cantidad;
        acc.totalPrecioCobrado += precio_cobrado * cantidad;
        acc.totalPlus += (precio_cobrado - precio_original) * cantidad;
        if (String(forma).toLowerCase() === 'efectivo') acc.efectivoCount += 1;
        acc.totalVentas += 1;
        return acc;
    }, { totalCantidad: 0, totalPrecioCobrado: 0, totalPlus: 0, efectivoCount: 0, totalVentas: 0 });

    const efectivoPercent = ventasSummary.totalVentas > 0 ? Math.round((ventasSummary.efectivoCount / ventasSummary.totalVentas) * 100) : 0;

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 80}>
            <View style={styles.container}>
                <TopBar />
                <ScrollView contentContainerStyle={[styles.scrollContentContainer, { paddingBottom: Spacing.page }]} keyboardShouldPersistTaps="handled">
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                            <Image source={require('../assets/images/arrow-left.png')} style={styles.icon} resizeMode="contain" />
                        </TouchableOpacity>
                        <Text style={styles.title}>{mode === 'ver' ? 'Detalles de Medicamento' : mode === 'editar' ? 'Editar Medicamento' : 'Crear Medicamento'}</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.label}>Nombre *</Text>
                        <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={medicamentoData.nombre} onChangeText={(t) => setMedicamentoData(prev => ({ ...prev, nombre: t }))} editable={isEditable} placeholder="Nombre del medicamento" />

                        <View style={styles.twoColumnRow}>
                            <View style={styles.column}>
                                <Text style={styles.label}>Código *</Text>
                                <View style={styles.codigoInputRow}>
                                    <TextInput style={[styles.input, styles.codigoInput, !isEditable && styles.disabledInput]} value={medicamentoData.codigo} onChangeText={(t) => setMedicamentoData(prev => ({ ...prev, codigo: t.replace(/[^0-9]/g, '') }))} keyboardType="numeric" editable={isEditable} placeholder="Código" />
                                    <TouchableOpacity style={styles.cameraButton} onPress={() => setShowScannerModal(true)}>
                                        <Image source={require('../assets/images/camera.png')} style={styles.cameraIcon} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View style={styles.column}>
                                <Text style={styles.label}>Categoría *</Text>
                                <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={medicamentoData.categoria} onChangeText={(t) => setMedicamentoData(prev => ({ ...prev, categoria: t }))} editable={isEditable} placeholder="Categoría" />
                            </View>
                        </View>

                        <View style={styles.twoColumnRow}>
                            <View style={styles.column}>
                                <Text style={styles.label}>Tipo de Medicamento *</Text>
                                <DropdownGenerico
                                    data={tiposMedicamento}
                                    value={medicamentoData.tipo_medicamento}
                                    onValueChange={(t) => setMedicamentoData(prev => ({ ...prev, tipo_medicamento: t }))}
                                    placeholder="Tip Medicam"
                                    displayKey="nombre"
                                    searchKey="nombre"
                                    disabled={( mode === "ver" )}
                                />
                            </View>
                            <View style={styles.column}>
                                <Text style={styles.label}>Unidad de Medida *</Text>
                                <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={medicamentoData.unidad_medida} onChangeText={(t) => setMedicamentoData(prev => ({ ...prev, unidad_medida: t }))} editable={isEditable} placeholder="Ej: Tableta" />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Posología</Text>
                            <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={medicamentoData.posologia} onChangeText={(t) => setMedicamentoData(prev => ({ ...prev, posologia: t }))} editable={isEditable} placeholder="Ej: 1 tab cada 8 horas" />
                        </View>

                        {isAdmin && (<View style={styles.twoColumnRow}>
                            <View style={styles.column}>
                                <Text style={styles.label}>Costo USD *</Text>
                                <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={medicamentoData.costo_usd} onChangeText={handleCostoUSDChange} keyboardType="decimal-pad" editable={isEditable} placeholder="0.00" />
                            </View>
                            <View style={styles.column}>
                                <Text style={styles.label}>Costo CUP *</Text>
                                <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={medicamentoData.costo_cup} onChangeText={handleCostoCUPChange} keyboardType="decimal-pad" editable={isEditable} placeholder="0" />
                            </View>
                        </View>)}

                        {isAdmin && (<View style={styles.twoColumnRow}>
                            <View style={styles.column}>
                                <Text style={styles.label}>Precio USD *</Text>
                                <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={medicamentoData.precio_usd} onChangeText={handlePrecioUSDChange} keyboardType="decimal-pad" editable={isEditable} placeholder="0.00" />
                            </View>
                            <View style={styles.column}>
                                <Text style={styles.label}>Precio CUP *</Text>
                                <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={medicamentoData.precio_cup} onChangeText={handlePrecioCUPChange} keyboardType="decimal-pad" editable={isEditable} placeholder="0" />
                            </View>
                        </View>)}

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Roles autorizados *</Text>
                            <View style={styles.rolesRow}>
                                {allRoles.map(role => {
                                    const selected = rolesSelected.includes(role);
                                    return (
                                        <TouchableOpacity
                                            key={role}
                                            style={[styles.roleBox, selected && styles.roleBoxSelected, !isEditable && styles.disabledRole]}
                                            onPress={() => {
                                                if (!isEditable) return;
                                                setRolesSelected(prev => {
                                                    if (prev.includes(role)) return prev.filter(r => r !== role);
                                                    return [...prev, role];
                                                });
                                            }}
                                        >
                                            <Text style={[styles.roleText, selected && styles.roleTextSelected]}>{role}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {(mode === "ver" || mode === "editar") && (<View style={styles.inputGroup}>
                            <Text style={styles.label}>Cantidad</Text>
                            <TextInput style={[styles.input, styles.disabledInput]} value={medicamentoData.cantidad} keyboardType="numeric" editable={false} placeholder="0" />
                        </View>)}

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nota</Text>
                            <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={medicamentoData.nota} onChangeText={(t) => setMedicamentoData(prev => ({ ...prev, nota: t }))} editable={isEditable} placeholder="Nota opcional" />
                        </View>
                        {isEditable && (
                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>{mode === 'editar' ? 'Actualizar Medicamento' : 'Crear Medicamento'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Entradas table */}
                    {(isAdmin && (mode !== "crear")) && (<View style={styles.section}>
                        <Text style={styles.sectionTitle}>Entradas</Text>
                        <DataTable
                            columns={entradasColumns}
                            items={entradasList || []}
                            actions={[]}
                            totalItems={(entradasList || []).length}
                            itemsPerPage={itemsPerPage}
                            currentPage={entradasPage}
                            isLoading={false}
                            onPageChange={(p) => setEntradasPage(p)}
                        />
                        <View style={styles.infoBox}>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Total cantidad (entradas):</Text>
                                <Text style={styles.infoValue}>{entradasSummary.totalCantidad}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Total costo CUP(cantidad * costo):</Text>
                                <Text style={styles.infoValue}>${(entradasSummary.totalCostoCup * entradasSummary.totalCantidad).toFixed(2)}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Total costo USD(cantidad * costo):</Text>
                                <Text style={styles.infoValue}>${(entradasSummary.totalCostoUsd * entradasSummary.totalCantidad).toFixed(2)}</Text>
                            </View>
                        </View>
                    </View>)}

                    {/* Ventas table (visual only) */}
                    {(isAdmin && (mode !== "crear")) && (<View style={styles.section}>
                        <Text style={styles.sectionTitle}>Ventas</Text>
                        <DataTable
                            columns={ventasColumns}
                            items={ventasList || []}
                            actions={[]}
                            totalItems={(ventasList || []).length}
                            itemsPerPage={itemsPerPage}
                            currentPage={ventasPage}
                            isLoading={false}
                            onPageChange={(p) => setVentasPage(p)}
                        />
                        <View style={styles.infoBox}>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Total cantidad (ventas):</Text>
                                <Text style={styles.infoValue}>{ventasSummary.totalCantidad}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Total precio cobrado (CUP):</Text>
                                <Text style={styles.infoValue}>${ventasSummary.totalPrecioCobrado.toFixed(2)}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Total de Plus (CUP):</Text>
                                <Text style={styles.infoValue}>${ventasSummary.totalPlus.toFixed(2)}</Text>
                            </View>
                            <View style={[styles.infoRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                                <Text style={styles.infoLabel}>Porcentaje en Efectivo:</Text>
                                <View style={styles.percentBarContainer}>
                                    <View style={[styles.percentBarFill, { width: `${efectivoPercent}%` }]} />
                                </View>
                                <Text style={styles.percentText}>{efectivoPercent}% Efectivo ({ventasSummary.efectivoCount}/{ventasSummary.totalVentas})</Text>
                            </View>
                        </View>
                    </View>)}
                </ScrollView>

                <QRScannerModal
                    visible={showScannerModal}
                    onClose={() => setShowScannerModal(false)}
                    onCodeScanned={(code) => {
                        try {
                            setMedicamentoData(prev => ({ ...prev, codigo: String(code) }));
                        } catch (e) {
                            console.log('Error setting scanned code:', e);
                        }
                        setShowScannerModal(false);
                    }}
                />
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    scrollContentContainer: { padding: Spacing.m },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.m },
    backButton: { padding: 8, backgroundColor: Colors.primarySuave, borderRadius: 8, marginRight: Spacing.s },
    icon: { width: 20, height: 20, tintColor: Colors.textPrimary },
    title: { fontSize: Typography.h3, fontWeight: '700', color: Colors.textSecondary },
    section: { backgroundColor: '#fff', padding: Spacing.m, borderRadius: 8, marginBottom: Spacing.m, borderWidth: 1, borderColor: '#000' },
    label: { fontSize: Typography.body, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#000', borderRadius: 8, paddingHorizontal: Spacing.m, paddingVertical: 10, fontSize: Typography.body, color: Colors.textSecondary, minHeight: 44 },
    disabledInput: { backgroundColor: '#f5f5f5' },
    twoColumnRow: { flexDirection: 'row', gap: Spacing.s, marginBottom: Spacing.s },
    column: { flex: 1 },
    inputGroup: { marginBottom: Spacing.m },
    sectionTitle: { fontSize: Typography.h4, fontWeight: '700', marginBottom: Spacing.s, color: Colors.textSecondary },
    saveButton: { backgroundColor: Colors.boton_azul, paddingVertical: Spacing.m, paddingHorizontal: Spacing.m, borderRadius: 8, alignItems: 'center', marginTop: Spacing.m, borderWidth: 1, borderColor: '#000' },
    saveButtonText: { color: '#fff', fontSize: Typography.body, fontWeight: '600' },
    cellText: { fontSize: Typography.small, color: Colors.textSecondary },
    infoBox: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: Colors.primarySuave,
        padding: Spacing.m,
        borderRadius: 8,
        marginTop: Spacing.s
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
        width: '100%'
    },
    infoLabel: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
        fontWeight: '600'
    },
    infoValue: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
        fontWeight: '700'
    },
    percentBarContainer: {
        width: '100%',
        height: 12,
        backgroundColor: '#eee',
        borderRadius: 6,
        overflow: 'hidden',
        marginTop: Spacing.xs,
        marginBottom: Spacing.xs
    },
    percentBarFill: {
        height: '100%',
        backgroundColor: Colors.boton_azul
    },
    percentText: {
        fontSize: Typography.small,
        color: Colors.textSecondary,
        marginTop: Spacing.xs
    },
    rolesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.s,
        marginTop: Spacing.xs
    },
    roleBox: {
        paddingVertical: Spacing.s,
        paddingHorizontal: Spacing.m,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.primarySuave,
        backgroundColor: '#fff',
        marginRight: Spacing.s
    },
    roleBoxSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary
    },
    roleText: {
        color: Colors.textSecondary,
        fontWeight: '600'
    },
    roleTextSelected: {
        color: Colors.textPrimary
    },
    disabledRole: {
        opacity: 0.6
    },
    codigoInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
    },
    codigoInput: {
        flex: 1,
    },
    cameraButton: {
        backgroundColor: Colors.boton_azul,
        borderRadius: 8,
        padding: Spacing.s,
        height: 44,
        width: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#000',
    },
    cameraIcon: {
        width: 24,
        height: 24,
        tintColor: '#fff',
    }
});
