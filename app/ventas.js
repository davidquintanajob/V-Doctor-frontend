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
import { useRouter, useFocusEffect } from 'expo-router';
import TopBar from '../components/TopBar';
import DataTable from '../components/DataTable';
import DropdownGenerico from '../components/DropdownGenerico';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Spacing, Typography } from '../variables';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth } = Dimensions.get('window');

export default function VentasScreen() {
    const router = useRouter();
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    // principales
    const [nombre_producto, setNombreProducto] = useState('');
    const [descripcion_servicio, setDescripcionServicio] = useState('');

    // filtros adicionales
    const todayIso = new Date().toISOString();

    const [filters, setFilters] = useState({
        fecha_desde: todayIso,
        fecha_hasta: todayIso,
        precio_original_comerciable_cup_min: '',
        precio_original_comerciable_cup_max: '',
        precio_original_comerciable_usd_min: '',
        precio_original_comerciable_usd_max: '',
        costo_producto_cup_min: '',
        costo_producto_cup_max: '',
        precio_cobrado_cup_min: '',
        precio_cobrado_cup_max: '',
        nombre_usuario: '',
        nombre_cliente: '',
        nombre_paciente: '',
        nota: ''
    });

    const [formaPago, setFormaPago] = useState(null);
    const [tipoComerciable, setTipoComerciable] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerField, setDatePickerField] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 10;

    const [ventasData, setVentasData] = useState([]);

    const formaPagoOptions = [
        { id: 1, nombre: 'Efectivo' },
        { id: 2, nombre: 'Transferencia' }
    ];

    const tipoComerciableOptions = [
        { id: 1, nombre: 'producto' },
        { id: 2, nombre: 'medicamento' },
        { id: 3, nombre: 'servicio' },
        { id: 4, nombre: 'servicio complejo' }
    ];

    const handleMenuNavigate = (link) => {};

    const fetchVentas = async (page = currentPage) => {
        setIsLoading(true);
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

            const url = `${host.replace(/\/+$/, '')}/venta/Filter/${itemsPerPage}/${page}`;

            const body = {
                ...(fechaSafe(filters.fecha_desde) && { fecha_desde: formatDateOnly(filters.fecha_desde) }),
                ...(fechaSafe(filters.fecha_hasta) && { fecha_hasta: formatDateOnly(filters.fecha_hasta) }),
                ...(nombre_producto && { nombre_producto }),
                ...(descripcion_servicio && { descripcion_servicio }),
                ...(filters.precio_original_comerciable_cup_min !== '' && { precio_original_comerciable_cup_min: Number(filters.precio_original_comerciable_cup_min) }),
                ...(filters.precio_original_comerciable_cup_max !== '' && { precio_original_comerciable_cup_max: Number(filters.precio_original_comerciable_cup_max) }),
                ...(filters.precio_original_comerciable_usd_min !== '' && { precio_original_comerciable_usd_min: Number(filters.precio_original_comerciable_usd_min) }),
                ...(filters.precio_original_comerciable_usd_max !== '' && { precio_original_comerciable_usd_max: Number(filters.precio_original_comerciable_usd_max) }),
                ...(filters.costo_producto_cup_min !== '' && { costo_producto_cup_min: Number(filters.costo_producto_cup_min) }),
                ...(filters.costo_producto_cup_max !== '' && { costo_producto_cup_max: Number(filters.costo_producto_cup_max) }),
                ...(filters.precio_cobrado_cup_min !== '' && { precio_cobrado_cup_min: Number(filters.precio_cobrado_cup_min) }),
                ...(filters.precio_cobrado_cup_max !== '' && { precio_cobrado_cup_max: Number(filters.precio_cobrado_cup_max) }),
                ...(filters.nombre_usuario && { nombre_usuario: filters.nombre_usuario }),
                ...(filters.nombre_cliente && { nombre_cliente: filters.nombre_cliente }),
                ...(filters.nombre_paciente && { nombre_paciente: filters.nombre_paciente }),
                ...(filters.nota && { nota: filters.nota }),
                ...(formaPago?.nombre && { forma_pago: formaPago.nombre }),
                ...(tipoComerciable?.nombre && { tipo_comerciable: tipoComerciable.nombre })
            };
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(body),
                timeout: 10000
            });

            if (response.status === 403) {
                router.replace('/login');
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            const ventas = (data.data || []).map(item => {
                const normalized = { ...item };
                Object.keys(normalized).forEach(k => {
                    if (normalized[k] === null) normalized[k] = '';
                });
                normalized.id = normalized.id_venta ?? normalized.id;
                return normalized;
            });

            setVentasData(ventas);
            const pagination = data.pagination || {};
            setTotalItems(pagination.total || ventas.length);
            setCurrentPage(pagination.page || page);
        } catch (error) {
            console.error('Error fetching ventas:', error);
            ToastAndroid.show('❌ Error al cargar ventas', ToastAndroid.SHORT);
        } finally {
            setIsLoading(false);
        }
    };

    const fechaSafe = (v) => {
        return v !== null && v !== undefined && v !== '';
    };

    const formatDateOnly = (iso) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d)) return '';
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            return '';
        }
    };

    const handleSearch = () => {
        setCurrentPage(1);
        fetchVentas(1);
    };

    const isScreenFocused = useRef(false);
    useFocusEffect(
        React.useCallback(() => {isScreenFocused.current = true;
            fetchVentas(currentPage);
            return () => { isScreenFocused.current = false; };
        }, [])
    );

    useEffect(() => {if (isScreenFocused.current) fetchVentas(currentPage);
    }, [currentPage]);

    const handleMoreOptions = () => setShowMoreOptions(!showMoreOptions);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const clearFilters = () => {
        setNombreProducto('');
        setDescripcionServicio('');
        setFilters({
            fecha_desde: todayIso,
            fecha_hasta: todayIso,
            precio_original_comerciable_cup_min: '',
            precio_original_comerciable_cup_max: '',
            precio_original_comerciable_usd_min: '',
            precio_original_comerciable_usd_max: '',
            costo_producto_cup_min: '',
            costo_producto_cup_max: '',
            precio_cobrado_cup_min: '',
            precio_cobrado_cup_max: '',
            nombre_usuario: '',
            nombre_cliente: '',
            nombre_paciente: '',
            nota: ''
        });
        setFormaPago(null);
        setTipoComerciable(null);
    };

    const handlePageChange = (page) => setCurrentPage(page);
    // log page changes triggered by DataTable
    const handlePageChangeLogged = (page) => {
        setCurrentPage(page);
    };

    const handleRowClick = (venta) => {
        router.push({ pathname: '/ventaModal', params: { mode: 'ver', venta: JSON.stringify(venta) } });
    };

    const formatDateUTC = (value) => {
        if (!value) return '';
        try {
            const d = new Date(value);
            if (isNaN(d)) return '';
            try {
                // Prefer locale formatting but force UTC timezone to avoid local offset
                return d.toLocaleDateString(undefined, { timeZone: 'UTC' });
            } catch (e) {
                // Fallback to manual UTC components
                const day = String(d.getUTCDate()).padStart(2, '0');
                const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                const year = d.getUTCFullYear();
                return `${day}/${month}/${year}`;
            }
        } catch (e) {
            return '';
        }
    };

    const columns = [
        {
            key: 'fecha',
            label: 'Fecha',
            width: 120,
            cellRenderer: (value, item) => (
                <Text style={styles.cellText}>{formatDateUTC(value)}</Text>
            )
        },
        {
            key: 'nombre',
            label: 'Producto/Servicio',
            width: 200,
            cellRenderer: (value, item) => {
                const nombre = item.comerciable?.producto?.nombre || item.comerciable?.servicio?.descripcion || '';
                return <Text style={styles.cellText}>{nombre}</Text>;
            }
        },
        {
            key: 'cantidad',
            label: 'Cantidad',
            width: 80,
            cellRenderer: (value, item) => (<Text style={styles.cellText}>{item.cantidad ?? ''}</Text>)
        },
        {
            key: 'precio_cobrado_cup',
            label: 'Precio',
            width: 100,
            cellRenderer: (value, item) => (<Text style={styles.cellText}>{(item.precio_cobrado_cup - (item.precio_cobrado_cup * item.descuento / 100)) || 0}</Text>)
        },
        {
            key: 'total',
            label: 'Total',
            width: 100,
            cellRenderer: (value, item) => {
                const cantidad = Number(item.cantidad || 0);
                const precio = Number((item.precio_cobrado_cup - (item.precio_cobrado_cup * item.descuento / 100)) || 0);
                return <Text style={styles.cellText}>{cantidad * precio}</Text>;
            }
        },
        {
            key: 'forma_pago',
            label: 'Forma pago',
            width: 120,
            cellRenderer: (value, item) => (<Text style={styles.cellText}>{item.forma_pago || ''}</Text>)
        },
        {
            key: 'plus',
            label: 'Plus',
            width: 100,
            cellRenderer: (value, item) => {
                const cantidad = Number(item.cantidad || 0);
                const precioCobrado = Number(item.precio_cobrado_cup || 0);
                const precioOriginal = Number(item.precio_original_comerciable_cup || 0);
                const plus = (precioCobrado * cantidad) - (precioOriginal * cantidad);
                return <Text style={styles.cellText}>{plus > 0 ? plus : 0}</Text>;
            }
        }
        ,
        {
            key: 'usuarios_count',
            label: 'Usuarios',
            width: 80,
            cellRenderer: (value, item) => {
                const count = Array.isArray(item.usuarios) ? item.usuarios.length : (item.usuarios ? 1 : 0);
                return <Text style={styles.cellText}>{count}</Text>;
            }
        }
    ];

    const actions = [
        {
            handler: (venta) => {
                router.push({ pathname: '/ventaModal', params: { mode: 'editar', venta: JSON.stringify(venta) } });
            },
            icon: (<Image source={require('../assets/images/editar.png')} style={{ width: 16, height: 16, tintColor: Colors.textPrimary }} resizeMode="contain" />),
            buttonStyle: styles.editButton
        },
        {
            handler: (venta) => {
                const itemLabel = venta?.comerciable?.producto?.nombre ?? venta?.comerciable?.servicio?.descripcion ?? '';
                const message = itemLabel ? `¿Eliminar venta ${itemLabel}?` : '¿Eliminar venta?';
                Alert.alert('Confirmar eliminación', message, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: async () => {
                        try {
                            const raw = await AsyncStorage.getItem('@config');
                            if (!raw) { Alert.alert('Error', 'No se encontró configuración'); return; }
                            const config = JSON.parse(raw);
                            const host = config.api_host || config.apihost || config.apiHost;
                            const token = config.token;
                            if (!host) { Alert.alert('Error', 'No se encontró host en la configuración'); return; }
                            const ventaId = venta.id_venta || venta.id;
                            if (!ventaId) { Alert.alert('Error', 'No se pudo identificar la venta'); return; }
                            const url = `${host.replace(/\/+$/, '')}/venta/delete/${ventaId}`;

                            const res = await fetch(url, {
                                method: 'DELETE',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                }
                            });

                            let responseData = null;
                            try { responseData = await res.json(); } catch (e) { responseData = null; }

                            if (res.status === 403) { Alert.alert('Sesión expirada'); router.replace('/login'); return; }

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

                            ToastAndroid.show('✅ Venta eliminada', ToastAndroid.LONG);
                            setVentasData(prev => prev.filter(v => (v.id_venta || v.id) !== (venta.id_venta || venta.id)));
                            setTotalItems(prev => Math.max(0, prev - 1));
                        } catch (error) {
                            Alert.alert('Error de conexión', 'No se pudo conectar con el servidor');
                        }
                    } }
                ]);
            },
            icon: (<Image source={require('../assets/images/basura.png')} style={{ width: 16, height: 16, tintColor: Colors.textPrimary }} resizeMode="contain" />),
            buttonStyle: styles.deleteButton
        }
    ];

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
            <TopBar onMenuNavigate={handleMenuNavigate} />
            <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
                <View style={styles.searchContainer}>
                    <TouchableOpacity onPress={() => { router.replace('/'); }} style={styles.backButton}>
                        <Image source={require('../assets/images/arrow-left.png')} style={styles.backButtonImage} resizeMode="contain" />
                    </TouchableOpacity>

                    <Text style={styles.searchTitle}>Opciones de búsqueda</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Nombre producto</Text>
                        <TextInput style={styles.searchInput} placeholder="Nombre del producto" value={nombre_producto} onChangeText={setNombreProducto} placeholderTextColor="#999" />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Descripción servicio</Text>
                        <TextInput style={styles.searchInput} placeholder="Descripción del servicio" value={descripcion_servicio} onChangeText={setDescripcionServicio} placeholderTextColor="#999" />
                    </View>

                    <View style={styles.buttonsContainer}>
                        <TouchableOpacity style={styles.moreOptionsButton} onPress={handleMoreOptions}>
                            <Image source={ showMoreOptions ? require('../assets/images/arrow-top.png') : require('../assets/images/arrow-button.png') } style={styles.moreOptionsIcon} resizeMode="contain" />
                            <Text style={styles.moreOptionsText}>{showMoreOptions ? 'Menos opciones' : 'Más opciones'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                            <Image source={require('../assets/images/loupe.png')} style={styles.searchIcon} resizeMode="contain" />
                            <Text style={styles.searchButtonText}>Buscar</Text>
                        </TouchableOpacity>
                    </View>

                    {showMoreOptions && (
                        <View style={styles.additionalOptions}>
                            <View style={styles.additionalRow}>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Fecha desde</Text>
                                    <TouchableOpacity style={styles.searchInput} onPress={() => { setDatePickerField('fecha_desde'); setShowDatePicker(true); }}>
                                        <Text style={{ color: filters.fecha_desde ? Colors.textSecondary : '#999' }}>{filters.fecha_desde ? formatDateUTC(filters.fecha_desde) : 'Seleccionar fecha'}</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Fecha hasta</Text>
                                    <TouchableOpacity style={styles.searchInput} onPress={() => { setDatePickerField('fecha_hasta'); setShowDatePicker(true); }}>
                                        <Text style={{ color: filters.fecha_hasta ? Colors.textSecondary : '#999' }}>{filters.fecha_hasta ? formatDateUTC(filters.fecha_hasta) : 'Seleccionar fecha'}</Text>
                                    </TouchableOpacity>
                                </View>

                                {showDatePicker && (
                                    <DateTimePicker
                                        value={ (filters[datePickerField] && new Date(filters[datePickerField])) || new Date() }
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                        onChange={(event, selectedDate) => {
                                            setShowDatePicker(Platform.OS === 'ios');
                                            if (event.type === 'dismissed') return;
                                            if (selectedDate) {
                                                handleFilterChange(datePickerField, selectedDate.toISOString());
                                            }
                                        }}
                                    />
                                )}
                            </View>

                            <View style={styles.additionalRow}>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Precio original CUP min</Text>
                                    <TextInput style={styles.searchInput} keyboardType="numeric" placeholder="Min" value={filters.precio_original_comerciable_cup_min} onChangeText={(v) => handleFilterChange('precio_original_comerciable_cup_min', v)} placeholderTextColor="#999" />
                                </View>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Precio original CUP max</Text>
                                    <TextInput style={styles.searchInput} keyboardType="numeric" placeholder="Max" value={filters.precio_original_comerciable_cup_max} onChangeText={(v) => handleFilterChange('precio_original_comerciable_cup_max', v)} placeholderTextColor="#999" />
                                </View>
                            </View>

                            <View style={styles.additionalRow}>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Costo producto CUP min</Text>
                                    <TextInput style={styles.searchInput} keyboardType="numeric" placeholder="Min" value={filters.costo_producto_cup_min} onChangeText={(v) => handleFilterChange('costo_producto_cup_min', v)} placeholderTextColor="#999" />
                                </View>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Costo producto CUP max</Text>
                                    <TextInput style={styles.searchInput} keyboardType="numeric" placeholder="Max" value={filters.costo_producto_cup_max} onChangeText={(v) => handleFilterChange('costo_producto_cup_max', v)} placeholderTextColor="#999" />
                                </View>
                            </View>

                            <View style={styles.additionalRow}>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Precio cobrado CUP min</Text>
                                    <TextInput style={styles.searchInput} keyboardType="numeric" placeholder="Min" value={filters.precio_cobrado_cup_min} onChangeText={(v) => handleFilterChange('precio_cobrado_cup_min', v)} placeholderTextColor="#999" />
                                </View>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Precio cobrado CUP max</Text>
                                    <TextInput style={styles.searchInput} keyboardType="numeric" placeholder="Max" value={filters.precio_cobrado_cup_max} onChangeText={(v) => handleFilterChange('precio_cobrado_cup_max', v)} placeholderTextColor="#999" />
                                </View>
                            </View>

                            <View style={styles.additionalRow}>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Nombre usuario</Text>
                                    <TextInput style={styles.searchInput} placeholder="Nombre usuario" value={filters.nombre_usuario} onChangeText={(v) => handleFilterChange('nombre_usuario', v)} placeholderTextColor="#999" />
                                </View>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Nombre cliente</Text>
                                    <TextInput style={styles.searchInput} placeholder="Nombre cliente" value={filters.nombre_cliente} onChangeText={(v) => handleFilterChange('nombre_cliente', v)} placeholderTextColor="#999" />
                                </View>
                            </View>

                            <View style={styles.additionalRow}>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Nombre paciente</Text>
                                    <TextInput style={styles.searchInput} placeholder="Nombre paciente" value={filters.nombre_paciente} onChangeText={(v) => handleFilterChange('nombre_paciente', v)} placeholderTextColor="#999" />
                                </View>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Nota</Text>
                                    <TextInput style={styles.searchInput} placeholder="Nota" value={filters.nota} onChangeText={(v) => handleFilterChange('nota', v)} placeholderTextColor="#999" />
                                </View>
                            </View>

                            <View style={styles.additionalRow}>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Forma de pago</Text>
                                    <DropdownGenerico data={formaPagoOptions} value={formaPago} onValueChange={setFormaPago} placeholder="Seleccionar" displayKey="nombre" searchKey="nombre" searchable={false} requiresSelection={false} />
                                </View>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Tipo comerciable</Text>
                                    <DropdownGenerico data={tipoComerciableOptions} value={tipoComerciable} onValueChange={setTipoComerciable} placeholder="Seleccionar" displayKey="nombre" searchKey="nombre" searchable={false} requiresSelection={false} />
                                </View>
                            </View>

                            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                                <Text style={styles.clearButtonText}>Limpiar Filtros</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={styles.actionsContainer}>
                    <TouchableOpacity style={styles.addButton} onPress={() => router.push({ pathname: '/ventaModal', params: { mode: 'crear' } })}>
                        <Text style={styles.addButtonText}>+ Agregar Venta</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.tableContainer}>
                    <DataTable columns={columns} items={ventasData || []} actions={actions} totalItems={totalItems} itemsPerPage={itemsPerPage} currentPage={currentPage} isLoading={isLoading} onPageChange={handlePageChangeLogged} onRowClick={handleRowClick} />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    scrollContent: { flex: 1 },
    scrollContentContainer: { flexGrow: 1 },
    searchContainer: { backgroundColor: Colors.primaryClaro, margin: Spacing.m, padding: Spacing.m, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, overflow: 'hidden' },
    backButton: { position: 'absolute', left: 10, top: 10, padding: 8, backgroundColor: Colors.primarySuave, borderRadius: 8, zIndex: 1 },
    backButtonImage: { width: 20, height: 20, tintColor: Colors.textPrimary },
    searchTitle: { fontSize: Typography.h3, fontWeight: 'bold', color: Colors.primary, marginBottom: Spacing.m, textAlign: 'center', marginTop: 10 },
    inputGroup: { marginBottom: Spacing.m },
    responsiveInputGroup: { flex: 1, minWidth: 0 },
    inputLabel: { fontSize: Typography.body, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs },
    searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.primarySuave, borderRadius: 8, paddingHorizontal: Spacing.m, paddingVertical: Spacing.s, fontSize: Typography.body, color: Colors.textSecondary, minHeight: 44, width: '100%' },
    buttonsContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.s, marginTop: Spacing.s },
    moreOptionsButton: { backgroundColor: Colors.primary, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.s, paddingHorizontal: Spacing.m, borderRadius: 8, elevation: 1, gap: Spacing.xs, minHeight: 44 },
    moreOptionsIcon: { width: 16, height: 16, tintColor: Colors.textPrimary },
    moreOptionsText: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '600' },
    searchButton: { backgroundColor: Colors.boton_azul, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.s, paddingHorizontal: Spacing.m, borderRadius: 8, elevation: 1, gap: Spacing.xs, minHeight: 44 },
    searchIcon: { width: 16, height: 16, tintColor: Colors.textPrimary },
    searchButtonText: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '600' },
    actionsContainer: { flexDirection: 'row', justifyContent: 'flex-start', gap: Spacing.s, marginHorizontal: Spacing.m, marginBottom: Spacing.s },
    addButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.boton_azul, paddingVertical: Spacing.s, paddingHorizontal: Spacing.s, borderRadius: 8, width: '100%' },
    addButtonText: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '600' },
    additionalOptions: { marginTop: Spacing.m, paddingTop: Spacing.m, borderTopWidth: 1, borderTopColor: Colors.primarySuave },
    additionalRow: { flexDirection: 'row', gap: Spacing.s, marginBottom: Spacing.m, flexWrap: 'wrap' },
    clearButton: { backgroundColor: Colors.boton_rojo_opciones, paddingVertical: Spacing.s, paddingHorizontal: Spacing.m, borderRadius: 8, alignItems: 'center', marginTop: Spacing.s, alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
    clearButtonText: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: 'bold' },
    tableContainer: { margin: Spacing.m, height: 560, marginBottom: 100 },
    cellText: { fontSize: Typography.small, color: Colors.textSecondary, textAlign: 'left' },
    editButton: { backgroundColor: Colors.boton_azul, alignItems: 'center' },
    deleteButton: { backgroundColor: Colors.boton_rojo_opciones, alignItems: 'center' }
});
