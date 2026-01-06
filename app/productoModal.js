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
    TouchableWithoutFeedback,
    Keyboard,
    Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import TopBar from '../components/TopBar';
import DataTable from '../components/DataTable';
import DropdownGenerico from '../components/DropdownGenerico';
import { Colors, Spacing, Typography } from '../variables';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRScannerModal from '../components/QRScannerModal';
import eventBus from '../utils/eventBus';

const { width: screenWidth } = Dimensions.get('window');

export default function ProductoModalScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const mode = params.mode; // 'ver' | 'editar' | 'crear'
    const productoParam = params.producto ? JSON.parse(params.producto) : null;

    const [productoData, setProductoData] = useState({
        id_comerciable: productoParam?.id_comerciable || null,
        nombre: productoParam?.nombre || '',
        codigo: productoParam?.codigo ? String(productoParam.codigo) : '',
        costo_usd: productoParam?.costo_usd ? String(productoParam.costo_usd) : '',
        costo_cup: productoParam?.costo_cup ? String(productoParam.costo_cup) : '',
        categoria: productoParam?.categoria || '',
        nota: productoParam?.nota || '',
        cantidad: productoParam?.cantidad ? String(productoParam.cantidad) : '',
        precio_usd: productoParam?.comerciable?.precio_usd ? String(productoParam.comerciable.precio_usd) : '',
        precio_cup: productoParam?.comerciable?.precio_cup ? String(productoParam.comerciable.precio_cup) : ''
    });

    // Indica si el usuario modificó manualmente el campo código
    const [codigoModified, setCodigoModified] = useState(false);

    const allRoles = ['Administrador', 'Médico', 'Técnico', 'Estilista'];
    const [rolesSelected, setRolesSelected] = useState([]);
    const [showScannerModal, setShowScannerModal] = useState(false);
    const [cambioMoneda, setCambioMoneda] = useState(null);

    const [entradasPage, setEntradasPage] = useState(1);
    const [ventasPage, setVentasPage] = useState(1);
    const itemsPerPage = 10;
    const [isAdmin, setIsAdmin] = useState(false);

    const entradasList = productoParam?.entradas || [];
    const ventasList = productoParam?.comerciable?.venta || [];

    const isEditable = mode !== 'ver';

    // Inicializar API host
    useEffect(() => {
        const getApiHost = async () => {
            try {
                const raw = await AsyncStorage.getItem('@config');
                if (raw) {
                    const config = JSON.parse(raw);
                    const host = config.api_host || config.apihost || config.apiHost;
                    // Determine if current user is Administrator
                    try {
                        const user = config.usuario || config.user || {};
                        setIsAdmin((user && user.rol && String(user.rol) === 'Administrador'));
                    } catch (e) {
                        setIsAdmin(false);
                    }
                    // Cargar cambio de moneda local si existe
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
        // If productoParam changes (when opening in editar/ver), update local state
        if (productoParam) {
            setProductoData({
                id_comerciable: productoParam?.id_comerciable || null,
                nombre: productoParam?.nombre || '',
                codigo: productoParam?.codigo ? String(productoParam.codigo) : '',
                costo_usd: productoParam?.costo_usd ? String(productoParam.costo_usd) : '',
                costo_cup: productoParam?.costo_cup ? String(productoParam.costo_cup) : '',
                categoria: productoParam?.categoria || '',
                nota: productoParam?.nota || '',
                cantidad: productoParam?.cantidad ? String(productoParam.cantidad) : '',
                precio_usd: productoParam?.comerciable?.precio_usd ? String(productoParam.comerciable.precio_usd) : '',
                precio_cup: productoParam?.comerciable?.precio_cup ? String(productoParam.comerciable.precio_cup) : ''
            });
            // Reiniciar marca de modificación de código cuando se carga el parámetro
            try { setCodigoModified(false); } catch (e) { /* ignore */ }
            // parse roles_autorizados if present
            try {
                const rolesStr = productoParam?.comerciable?.roles_autorizados || productoParam?.roles_autorizados || '';
                const parsed = String(rolesStr).split(',').map(s => s.trim()).filter(s => s.length > 0);
                // filter to known roles
                setRolesSelected(parsed.filter(r => allRoles.includes(r)));
            } catch (e) {
                setRolesSelected([]);
            }
        }
    }, [params.producto]);

    // Handlers para sincronizar CUP <-> USD usando cambioMoneda
    const parseNumber = (s) => {
        if (s === null || typeof s === 'undefined') return null;
        const n = Number(String(s).replace(/,/g, '.'));
        return isNaN(n) ? null : n;
    };

    const handleCostoCUPChange = (t) => {
        const cleaned = t.replace(/[^0-9\.]/g, '');
        setProductoData(prev => {
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
        setProductoData(prev => {
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
        setProductoData(prev => {
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
        setProductoData(prev => {
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

    // If creating a product, fetch unique code once
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
                    setProductoData(prev => ({ ...prev, codigo: String(data.code) }));
                }
            } catch (err) {
                console.error('Error fetching unique-code:', err);
            }
        };
        fetchUniqueCode();
    }, [mode]);

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

            // Basic validation
            if (!productoData.nombre || !productoData.nombre.trim()) {
                Alert.alert('Error', 'El nombre del producto es requerido');
                return;
            }
            if (rolesSelected.length === 0) {
                Alert.alert('Error', 'Se debe elegir almenos un rol autorizado a comercializar el medicamento');
                return;
            }

            const body = {
                nombre: productoData.nombre,
                costo_usd: productoData.costo_usd ? Number(productoData.costo_usd) : 0,
                costo_cup: productoData.costo_cup ? Number(productoData.costo_cup) : 0,
                categoria: productoData.categoria,
                nota: productoData.nota,
                precio_usd: productoData.precio_usd ? Number(productoData.precio_usd) : 0,
                precio_cup: productoData.precio_cup ? Number(productoData.precio_cup) : 0,
                roles_autorizados: rolesSelected.join(', ')
            };

            // In 'editar' mode only include 'codigo' if the user modified it manually
            if (!(mode === 'editar' && !codigoModified)) {
                // include codigo (can be null if empty)
                body.codigo = productoData.codigo ? Number(productoData.codigo) : null;
            }

            const base = host.replace(/\/+$/, '');
            let url;
            let method = 'POST';
            if (mode === 'editar') {
                const id = productoData.id_comerciable || productoParam?.id_comerciable || productoParam?.id;
                if (!id) {
                    Alert.alert('Error', 'No se pudo identificar el producto a actualizar');
                    return;
                }
                url = `${base}/producto/UpdateProducto/${id}`;
                method = 'PUT';
            } else {
                url = `${base}/producto/CreateProducto`;
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
                ToastAndroid.show(mode === 'editar' ? 'Producto actualizado' : 'Producto creado', ToastAndroid.SHORT);
            } else {
                Alert.alert('Éxito', mode === 'editar' ? 'Producto actualizado' : 'Producto creado');
            }

            try { eventBus.emit('refreshProductosMedicamentos'); } catch (e) { /* ignore */ }

            router.back();

        } catch (error) {
            console.error('Error guardando producto:', error);
            Alert.alert('Error de conexión', 'No se pudo conectar con el servidor');
        }
    };

    // Columns for entradas table
    const entradasColumns = [
        { key: 'fecha', label: 'Fecha', width: 140, cellRenderer: (v) => <Text style={styles.cellText}>{v ? (new Date(v)).toLocaleDateString() : 'N/A'}</Text> },
        { key: 'cantidad', label: 'Cantidad', width: 100, cellRenderer: (v) => <Text style={styles.cellText}>{v ?? '0'}</Text> },
        { key: 'costo_usd', label: 'Costo USD', width: 120, cellRenderer: (v) => <Text style={styles.cellText}>{v ? `$${Number(v).toFixed(2)}` : '0'}</Text> },
        { key: 'costo_cup', label: 'Costo CUP', width: 120, cellRenderer: (v) => <Text style={styles.cellText}>{v ? `$${Number(v).toFixed(2)}` : '0'}</Text> },
        { key: 'nombre_proveedor', label: 'Proveedor', width: 180, cellRenderer: (v) => <Text style={styles.cellText}>{v || ''}</Text> }
    ];

    // Columns for ventas (visual only)
    const ventasColumns = [
        { key: 'fecha', label: 'Fecha', width: 140, cellRenderer: (v) => <Text style={styles.cellText}>{v ? (new Date(v)).toLocaleDateString() : 'N/A'}</Text> },
        { key: 'cantidad', label: 'Cantidad', width: 100, cellRenderer: (v) => <Text style={styles.cellText}>{v ?? '0'}</Text> },
        { key: 'precio_original_comerciable_cup', label: 'Precio Original CUP', width: 120, cellRenderer: (v) => <Text style={styles.cellText}>{v || '0'}</Text> },
        { key: 'precio_cobrado_cup', label: 'Precio Cobrado', width: 120, cellRenderer: (v) => <Text style={styles.cellText}>{v || '0'}</Text> }
    ];

    // Resúmenes calculados
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
        // Sumar por unidad: precio * cantidad
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
                        <Text style={styles.title}>{mode === 'ver' ? 'Detalles de Producto' : mode === 'editar' ? 'Editar Producto' : 'Crear Producto'}</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.label}>Nombre *</Text>
                        <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={productoData.nombre} onChangeText={(t) => setProductoData(prev => ({ ...prev, nombre: t }))} editable={isEditable} placeholder="Nombre del producto" />

                        <View style={styles.twoColumnRow}>
                            <View style={styles.column}>
                                <Text style={styles.label}>Código *</Text>
                                <View style={styles.codigoInputRow}>
                                    <TextInput
                                        style={[styles.input, styles.codigoInput, !isEditable && styles.disabledInput]}
                                        value={productoData.codigo}
                                        onChangeText={(t) => {
                                            if (!codigoModified) setCodigoModified(true);
                                            setProductoData(prev => ({ ...prev, codigo: t.replace(/[^0-9]/g, '') }));
                                        }}
                                        keyboardType="numeric"
                                        editable={isEditable}
                                        placeholder="Código"
                                    />
                                    <TouchableOpacity style={styles.cameraButton} onPress={() => setShowScannerModal(true)}>
                                        <Image source={require('../assets/images/camera.png')} style={styles.cameraIcon} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View style={styles.column}>
                                <Text style={styles.label}>Categoría *</Text>
                                <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={productoData.categoria} onChangeText={(t) => setProductoData(prev => ({ ...prev, categoria: t }))} editable={isEditable} placeholder="Categoría" />
                            </View>
                        </View>

                        {isAdmin && (<View style={styles.twoColumnRow}>
                            <View style={styles.column}>
                                <Text style={styles.label}>Costo USD *</Text>
                                <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={productoData.costo_usd} onChangeText={handleCostoUSDChange} keyboardType="decimal-pad" editable={isEditable} placeholder="0.00" />
                            </View>
                            <View style={styles.column}>
                                <Text style={styles.label}>Costo CUP *</Text>
                                <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={productoData.costo_cup} onChangeText={handleCostoCUPChange} keyboardType="decimal-pad" editable={isEditable} placeholder="0" />
                            </View>
                        </View>)}

                        {isAdmin && (<View style={styles.twoColumnRow}>
                            <View style={styles.column}>
                                <Text style={styles.label}>Precio USD *</Text>
                                <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={productoData.precio_usd} onChangeText={handlePrecioUSDChange} keyboardType="decimal-pad" editable={isEditable} placeholder="0.00" />
                            </View>
                            <View style={styles.column}>
                                <Text style={styles.label}>Precio CUP *</Text>
                                <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={productoData.precio_cup} onChangeText={handlePrecioCUPChange} keyboardType="decimal-pad" editable={isEditable} placeholder="0" />
                            </View>
                        </View>)}

                        {/* Roles autorizados */}
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
                            <TextInput style={[styles.input, styles.disabledInput]} value={productoData.cantidad} keyboardType="numeric" editable={false} placeholder="0" />
                        </View>)}

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nota</Text>
                            <TextInput style={[styles.input, !isEditable && styles.disabledInput]} value={productoData.nota} onChangeText={(t) => setProductoData(prev => ({ ...prev, nota: t }))} editable={isEditable} placeholder="Nota opcional" />
                        </View>

                        {isEditable && (
                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>{mode === 'editar' ? 'Actualizar Producto' : 'Crear Producto'}</Text>
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
                        {/* Información resumen Entradas */}
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
                        {/* Información resumen Ventas */}
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
                            setProductoData(prev => ({ ...prev, codigo: String(code) }));
                            // Mark that the code was modified so it will be sent in editar mode
                            try { setCodigoModified(true); } catch (e) { /* ignore */ }
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
    saveButton: { backgroundColor: Colors.boton_azul, paddingVertical: Spacing.m, paddingHorizontal: Spacing.m, borderRadius: 8, alignItems: 'center', marginTop: Spacing.m, borderWidth: 1, borderColor: '#000' },
    saveButtonText: { color: '#fff', fontSize: Typography.body, fontWeight: '600' },
    sectionTitle: { fontSize: Typography.h4, fontWeight: '700', marginBottom: Spacing.s, color: Colors.textSecondary },
    cellText: { fontSize: Typography.small, color: Colors.textSecondary }
    ,
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
    }
    ,
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
    }
    ,
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
