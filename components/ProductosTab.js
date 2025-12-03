import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    ToastAndroid,
    Image,
    Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DataTable from './DataTable';
import QRScannerModal from './QRScannerModal';
import eventBus from '../utils/eventBus';
import { Colors, Spacing, Typography } from '../variables';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import QRCode from 'qrcode';

export default function ProductosTab() {
    const router = useRouter();
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [showScannerModal, setShowScannerModal] = useState(false);
    const [filters, setFilters] = useState({
        codigo: '',
        categoria: '',
        costo_usd_min: '',
        costo_usd_max: '',
        costo_cup_min: '',
        costo_cup_max: '',
        cantidad_min: '',
        cantidad_max: '',
        precio_usd_min: '',
        precio_usd_max: '',
        precio_cup_min: '',
        precio_cup_max: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 10;
    const [productosData, setProductosData] = useState([]);
    const [apiHost, setApiHost] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    const isScreenFocused = useRef(false);

    useEffect(() => {
        const getApiHost = async () => {
            try {
                const raw = await AsyncStorage.getItem('@config');
                if (raw) {
                    const config = JSON.parse(raw);
                    const host = config.api_host || config.apihost || config.apiHost;
                    setApiHost(host || '');
                    try {
                        const user = config.usuario || config.user || {};
                        setIsAdmin((user && user.rol && String(user.rol) === 'Administrador'));
                    } catch (e) {
                        setIsAdmin(false);
                    }
                }
            } catch (error) {
                console.error('Error getting apiHost:', error);
            }
        };
        getApiHost();
    }, []);

    const fetchProducts = async (page = currentPage, isSearch = false) => {
        setIsLoading(true);
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

            const url = `${host.replace(/\/+$/, '')}/producto/filter/${itemsPerPage}/${page}`;

            const body = {
                ...(searchText && { nombre: searchText }),
                ...(filters.categoria && { categoria: filters.categoria }),
                ...(filters.codigo && { codigo: filters.codigo }),
                ...(filters.costo_usd_min && filters.costo_usd_min !== 0 && { costo_usd_min: Number(filters.costo_usd_min) }),
                ...(filters.costo_usd_max && filters.costo_usd_max !== 0 && { costo_usd_max: Number(filters.costo_usd_max) }),
                ...(filters.costo_cup_min && filters.costo_cup_min !== 0 && { costo_cup_min: Number(filters.costo_cup_min) }),
                ...(filters.costo_cup_max && filters.costo_cup_max !== 0 && { costo_cup_max: Number(filters.costo_cup_max) }),
                ...(filters.cantidad_min && filters.cantidad_min !== 0 && { cantidad_min: Number(filters.cantidad_min) }),
                ...(filters.cantidad_max && filters.cantidad_max !== 0 && { cantidad_max: Number(filters.cantidad_max) }),
                ...(filters.precio_usd_min && filters.precio_usd_min !== 0 && { precio_usd_min: Number(filters.precio_usd_min) }),
                ...(filters.precio_usd_max && filters.precio_usd_max !== 0 && { precio_usd_max: Number(filters.precio_usd_max) }),
                ...(filters.precio_cup_min && filters.precio_cup_min !== 0 && { precio_cup_min: Number(filters.precio_cup_min) }),
                ...(filters.precio_cup_max && filters.precio_cup_max !== 0 && { precio_cup_max: Number(filters.precio_cup_max) })
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
                let errorMessage = `Error ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (jsonError) {
                    console.log('No se pudo parsear el error como JSON');
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            const productos = (data.data || []).map(item => ({
                id_comerciable: item.id_comerciable,
                codigo: item.codigo || '',
                nombre: item.nombre || '',
                precio_cup: item.comerciable?.precio_cup || 0,
                cantidad: item.cantidad || 0,
                categoria: item.categoria || '',
                costo_usd: item.costo_usd || 0,
                costo_cup: item.costo_cup || 0,
                precio_usd: item.comerciable?.precio_usd || 0,
                raw: item
            }));

            setProductosData(productos);
            const pagination = data.pagination || {};
            setTotalItems(pagination.total || productos.length);
            setCurrentPage(pagination.currentPage || page);

        } catch (error) {
            console.error('Error fetching productos:', error);
            ToastAndroid.show('❌ Error al cargar productos', ToastAndroid.SHORT);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        isScreenFocused.current = true;
        fetchProducts(currentPage, false);
        // listen global refresh events
        const refreshHandler = () => fetchProducts(1, false);
        eventBus.addListener('refreshProductosMedicamentos', refreshHandler);
        return () => {
            isScreenFocused.current = false;
            eventBus.removeListener('refreshProductosMedicamentos', refreshHandler);
        };
    }, []);

    useEffect(() => {
        if (isScreenFocused.current) {
            fetchProducts(currentPage, false);
        }
    }, [currentPage]);

    const handleSearch = () => {
        setCurrentPage(1);
        fetchProducts(1, true);
    };

    const handleMoreOptions = () => {
        setShowMoreOptions(!showMoreOptions);
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const clearFilters = () => {
        setSearchText('');
        setFilters({
            codigo: '',
            categoria: '',
            costo_usd_min: '',
            costo_usd_max: '',
            costo_cup_min: '',
            costo_cup_max: '',
            cantidad_min: '',
            cantidad_max: '',
            precio_usd_min: '',
            precio_usd_max: '',
            precio_cup_min: '',
            precio_cup_max: ''
        });
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    const handleScanCode = () => {
        setShowScannerModal(true);
    };

    const handleCodeScanned = (code) => {
        handleFilterChange('codigo', code);
        setTimeout(() => {
            setCurrentPage(1);
            fetchProducts(1, true);
        }, 500);
    };

    const columns = [
        {
            key: 'codigo',
            label: 'Código',
            width: 100,
            cellRenderer: (value, item) => (
                <Text style={styles.cellText}>{value || 'N/A'}</Text>
            )
        },
        {
            key: 'nombre',
            label: 'Nombre',
            width: 200,
            cellRenderer: (value, item) => (
                <Text style={styles.cellText}>{value || 'Sin nombre'}</Text>
            )
        },
        {
            key: 'precio_cup',
            label: 'Precio CUP',
            width: 120,
            cellRenderer: (value, item) => (
                <Text style={styles.cellText}>${value?.toFixed(2) || '0.00'}</Text>
            )
        },
        {
            key: 'cantidad',
            label: 'Cantidad',
            width: 100,
            cellRenderer: (value, item) => (
                <Text style={styles.cellText}>{value || '0'}</Text>
            )
        },
        {
            key: 'categoria',
            label: 'Categoría',
            width: 130,
            cellRenderer: (value, item) => (
                <Text style={styles.cellText}>{value || 'Sin categoría'}</Text>
            )
        }
    ];

    const actions = [
        {
            handler: (producto) => {
                try {
                    const payload = producto?.raw ? producto.raw : producto;
                    router.push({
                        pathname: '/productoModal',
                        params: {
                            mode: 'editar',
                            producto: JSON.stringify(payload)
                        }
                    });
                } catch (e) {
                    ToastAndroid.show(`Error abriendo editor: ${e?.message || e}`, ToastAndroid.SHORT);
                }
            },
            icon: (
                <Image
                    source={require('../assets/images/editar.png')}
                    style={{ width: 16, height: 16, tintColor: Colors.textPrimary }}
                    resizeMode="contain"
                />
            ),
            buttonStyle: styles.editButton
        },
        {
            handler: (producto) => {
                Alert.alert(
                    'Confirmar eliminación',
                    `¿Está seguro de eliminar el producto ${producto.nombre}?`,
                    [
                        {
                            text: 'Cancelar',
                            style: 'cancel',
                        },
                        {
                            text: 'Eliminar',
                            style: 'destructive',
                            onPress: async () => {
                                try {
                                    const raw = await AsyncStorage.getItem('@config');
                                    if (!raw) {
                                        Alert.alert('Error', 'No se encontró configuración');
                                        return;
                                    }

                                    const config = JSON.parse(raw);
                                    const host = config.api_host || config.apihost || config.apiHost;
                                    const token = config.token;

                                    if (!host) {
                                        Alert.alert('Error', 'No se encontró host en la configuración');
                                        return;
                                    }

                                    const productoId = producto.id_comerciable || producto.id;

                                    if (!productoId) {
                                        Alert.alert('Error', 'No se pudo identificar el producto a eliminar');
                                        return;
                                    }

                                    const url = `${host.replace(/\/+$/, '')}/producto/DeleteProducto/${productoId}`;

                                    const response = await fetch(url, {
                                        method: 'DELETE',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                        }
                                    });

                                    if (response.status === 403) {
                                        Alert.alert('Sesión expirada', 'Por favor inicie sesión nuevamente');
                                        router.replace('/login');
                                        return;
                                    }

                                    if (response.status === 200) {
                                        ToastAndroid.show('✅ Producto eliminado con éxito', ToastAndroid.LONG);

                                        setProductosData(prev => prev.filter(p => {
                                            const currentId = p.id_comerciable || p.id;
                                            const targetId = productoId;
                                            return currentId !== targetId;
                                        }));

                                        setTotalItems(prev => (prev > 0 ? prev - 1 : 0));

                                    } else {
                                        let errorMessage = `Error ${response.status}`;
                                        try {
                                            const errorData = await response.json().catch(() => null);
                                            if (errorData) {
                                                if (Array.isArray(errorData.errors) && errorData.errors.length > 0) {
                                                    errorMessage = errorData.errors.join('\n• ');
                                                } else if (typeof errorData.error === 'string' && errorData.error.trim()) {
                                                    errorMessage = errorData.error;
                                                } else if (errorData.message) {
                                                    errorMessage = errorData.message;
                                                } else if (typeof errorData === 'string' && errorData.trim()) {
                                                    errorMessage = errorData;
                                                } else if (typeof errorData.error === 'object' && errorData.error !== null) {
                                                    try {
                                                        const vals = Object.values(errorData.error).flat ? Object.values(errorData.error).flat() : Object.values(errorData.error);
                                                        if (Array.isArray(vals) && vals.length > 0) {
                                                            errorMessage = vals.join('\n• ');
                                                        } else {
                                                            errorMessage = JSON.stringify(errorData.error);
                                                        }
                                                    } catch (e) {
                                                        errorMessage = JSON.stringify(errorData.error);
                                                    }
                                                }
                                            }
                                        } catch (parseError) {
                                            console.log('Error parseando respuesta:', parseError);
                                        }

                                        Alert.alert(
                                            'Error al eliminar producto',
                                            `Status: ${response.status}\n\n• ${errorMessage}`,
                                            [{ text: 'Aceptar' }]
                                        );
                                    }

                                } catch (error) {
                                    Alert.alert(
                                        'Error de conexión',
                                        'No se pudo conectar con el servidor',
                                        [{ text: 'Aceptar' }]
                                    );
                                }
                            }
                        }
                    ]
                );
            },
            icon: (
                <Image
                    source={require('../assets/images/basura.png')}
                    style={{ width: 16, height: 16, tintColor: Colors.textPrimary }}
                    resizeMode="contain"
                />
            ),
            buttonStyle: styles.deleteButton
        }
    ];

    const generarHTMLCodigos = (items, type = 'qr') => {
        const cols = 5;
        const gap = 10;
        const imgSize = 100;

        const rowsHtml = items.map((it) => {
            const src = it.imgData || it.img || '';
            const code = String(it.codigo || it.raw?.codigo || '');
            const nombre = (it.nombre || it.raw?.nombre || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<div class="cell">
                <img src="${src}" width="${imgSize}" height="${imgSize}" alt="code" />
                <div class="label">${nombre || code}</div>
            </div>`;
        }).join('\n');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 18px; }
                    .grid { display: flex; flex-wrap: wrap; gap: ${gap}px; }
                    .cell { width: calc(${100 / cols}% - ${gap}px); box-sizing: border-box; text-align: center; margin-bottom: 12px; }
                    img { display: block; margin: 0 auto; }
                    .label { margin-top: 6px; font-size: 11px; color: #333; word-break: break-word; }
                    @media print { .cell { page-break-inside: avoid; } }
                </style>
            </head>
            <body>
                <div class="grid">
                    ${rowsHtml}
                </div>
            </body>
            </html>
        `;

        return html;
    };

    const mostrarOpcionesImpresion = (uri) => {
        const opciones = [
            { text: '🖨️ Imprimir con Epson iPrint', onPress: () => compartirPDF(uri) },
            { text: '👀 Previsualizar', onPress: () => previsualizarPDF(uri) },
            { text: '📤 Compartir', onPress: () => compartirPDF(uri) },
            { text: 'Cancelar', style: 'cancel' }
        ];

        Alert.alert('PDF generado', '¿Qué deseas hacer?', opciones);
    };

    const imprimirDirectamente = async (uri) => {
        try {
            await Print.printAsync({ uri, orientation: Print.Orientation.portrait });
        } catch (error) {
            console.error('Error imprimir:', error);
            Alert.alert('Error al imprimir', 'No se pudo imprimir el documento. Puedes compartirlo o intentar de nuevo.');
        }
    };

    const previsualizarPDF = async (uri) => {
        try {
            await Print.printAsync({ uri, orientation: Print.Orientation.portrait });
        } catch (error) {
            console.error('Error previsualizar:', error);
            Alert.alert('Error', 'No se pudo previsualizar el PDF');
        }
    };

    const compartirPDF = async (uri) => {
        try {
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
            } else {
                Alert.alert('Compartir no disponible', 'La función de compartir no está disponible en este dispositivo');
            }
        } catch (error) {
            console.error('Error compartir:', error);
            Alert.alert('Error', 'No se pudo compartir el PDF');
        }
    };

    const handlePrintCodes = async (type = 'qr') => {
        if (!apiHost) {
            ToastAndroid.show('No hay host configurado', ToastAndroid.SHORT);
            return;
        }

        setIsGeneratingPDF(true);
        try {
            const raw = await AsyncStorage.getItem('@config');
            if (!raw) { Alert.alert('Error', 'No se encontró configuración'); setIsGeneratingPDF(false); return; }
            const config = JSON.parse(raw);
            const host = config.api_host || config.apihost || config.apiHost;
            const token = config.token;
            const base = host.replace(/\/+$/, '');

            const url = `${base}/producto/filter/${totalItems || 1000}/1`;
            
            const body = {
                ...(searchText && { nombre: searchText }),
                ...(filters.categoria && { categoria: filters.categoria }),
                ...(filters.codigo && { codigo: filters.codigo }),
                ...(filters.costo_usd_min && { costo_usd_min: Number(filters.costo_usd_min) }),
                ...(filters.costo_usd_max && { costo_usd_max: Number(filters.costo_usd_max) }),
                ...(filters.costo_cup_min && { costo_cup_min: Number(filters.costo_cup_min) }),
                ...(filters.costo_cup_max && { costo_cup_max: Number(filters.costo_cup_max) }),
                ...(filters.cantidad_min && { cantidad_min: Number(filters.cantidad_min) }),
                ...(filters.cantidad_max && { cantidad_max: Number(filters.cantidad_max) }),
                ...(filters.precio_usd_min && { precio_usd_min: Number(filters.precio_usd_min) }),
                ...(filters.precio_usd_max && { precio_usd_max: Number(filters.precio_usd_max) }),
                ...(filters.precio_cup_min && { precio_cup_min: Number(filters.precio_cup_min) }),
                ...(filters.precio_cup_max && { precio_cup_max: Number(filters.precio_cup_max) })
            };
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: JSON.stringify(body)
            });
            

            if (!response.ok) {
                const err = await response.text().catch(() => null);
                throw new Error(err || `Error ${response.status}`);
            }

            const data = await response.json().catch(() => null);
            const rawItems = (data?.data || []);
            if (!rawItems || rawItems.length === 0) {
                Alert.alert('Sin resultados', 'No se encontraron productos para imprimir.');
                return;
            }

            const itemsWithImages = await Promise.all(rawItems.map(async (it) => {
                const rawCode = String(it.codigo || '');
                const code = encodeURIComponent(rawCode);

                if (type === 'qr') {
                    try {
                        // Generate an inline SVG for the QR code using the `qrcode` package
                        // The returned string is an SVG markup; we convert it to a data URI
                        const svgString = await QRCode.toString(rawCode, { type: 'svg', width: 200, margin: 0 });
                        const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
                        return { codigo: it.codigo, nombre: it.nombre, imgData: dataUri };
                    } catch (e) {
                        console.log('Error generando QR local para codigo', it.codigo, e);
                        // fallback to remote generator if local fails
                        const url = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${code}`;
                        try {
                            const filename = `${FileSystem.cacheDirectory}code_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
                            const dl = await FileSystem.downloadAsync(url, filename);
                            const b64 = await FileSystem.readAsStringAsync(dl.uri, { encoding: FileSystem.EncodingType.Base64 });
                            const dataUri = `data:image/png;base64,${b64}`;
                            return { codigo: it.codigo, nombre: it.nombre, imgData: dataUri };
                        } catch (ee) {
                            console.log('Fallback download error for QR', ee);
                            return { codigo: it.codigo, nombre: it.nombre, img: url };
                        }
                    }
                } else {
                    // For barcodes we keep the existing remote generation (Code128) because
                    // a fully-compatible, lightweight, pure-JS Code128 SVG generator
                    // wasn't added. We preserve current behavior.
                    const url = `https://barcode.tec-it.com/barcode.ashx?data=${code}&code=Code128&dpi=96`;
                    try {
                        const filename = `${FileSystem.cacheDirectory}code_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
                        const dl = await FileSystem.downloadAsync(url, filename);
                        const b64 = await FileSystem.readAsStringAsync(dl.uri, { encoding: FileSystem.EncodingType.Base64 });
                        const dataUri = `data:image/png;base64,${b64}`;
                        return { codigo: it.codigo, nombre: it.nombre, imgData: dataUri };
                    } catch (e) {
                        console.log('Error descargando imagen para codigo', it.codigo, e);
                        return { codigo: it.codigo, nombre: it.nombre, img: url };
                    }
                }
            }));

            const html = generarHTMLCodigos(itemsWithImages, type);
            const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792, margins: { left: 18, right: 18, top: 18, bottom: 18 } });
            mostrarOpcionesImpresion(uri);

        } catch (error) {
            console.error('Error generando/obteniendo códigos:', error);
            Alert.alert('Error', `No se pudo generar el documento: ${error?.message || error}`);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    return (
        <View style={styles.tabContent}>
            <View style={styles.searchContainer}>
                <Text style={styles.searchTitle}>Opciones de búsqueda</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Buscar por nombre</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Ingresa el nombre del producto"
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholderTextColor="#999"
                    />
                </View>

                <View style={styles.buttonsContainer}>
                    <TouchableOpacity
                        style={styles.moreOptionsButton}
                        onPress={handleMoreOptions}
                    >
                        <Image
                            source={
                                showMoreOptions
                                    ? require('../assets/images/arrow-top.png')
                                    : require('../assets/images/arrow-button.png')
                            }
                            style={styles.moreOptionsIcon}
                            resizeMode="contain"
                        />
                        <Text style={styles.moreOptionsText}>
                            {showMoreOptions ? 'Menos opciones' : 'Más opciones'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.searchButton}
                        onPress={handleSearch}
                    >
                        <Image
                            source={require('../assets/images/loupe.png')}
                            style={styles.searchIcon}
                            resizeMode="contain"
                        />
                        <Text style={styles.searchButtonText}>Buscar</Text>
                    </TouchableOpacity>
                </View>

                {showMoreOptions && (
                    <View style={styles.additionalOptions}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Código</Text>
                            <View style={styles.codigoInputRow}>
                                <TextInput
                                    style={[styles.additionalInput, styles.codigoInput]}
                                    placeholder="Ej: 123456"
                                    value={filters.codigo}
                                    onChangeText={(value) => handleFilterChange('codigo', value)}
                                    placeholderTextColor="#999"
                                    keyboardType="numeric"
                                />
                                <TouchableOpacity
                                    style={styles.cameraButton}
                                    onPress={handleScanCode}
                                >
                                    <Image
                                        source={require('../assets/images/camera.png')}
                                        style={styles.cameraIcon}
                                        resizeMode="contain"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Categoría</Text>
                            <TextInput
                                style={styles.additionalInput}
                                placeholder="Ej: Acesorio"
                                value={filters.categoria}
                                onChangeText={(value) => handleFilterChange('categoria', value)}
                                placeholderTextColor="#999"
                            />
                        </View>

                        <View style={styles.rangeRow}>
                            <View style={[styles.inputGroup, styles.halfInput]}>
                                <Text style={styles.inputLabel}>Cantidad Min</Text>
                                <TextInput
                                    style={styles.additionalInput}
                                    placeholder="0"
                                    value={filters.cantidad_min}
                                    onChangeText={(value) => handleFilterChange('cantidad_min', value.replace(/[^0-9]/g, ''))}
                                    placeholderTextColor="#999"
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.inputGroup, styles.halfInput]}>
                                <Text style={styles.inputLabel}>Cantidad Max</Text>
                                <TextInput
                                    style={styles.additionalInput}
                                    placeholder="0"
                                    value={filters.cantidad_max}
                                    onChangeText={(value) => handleFilterChange('cantidad_max', value.replace(/[^0-9]/g, ''))}
                                    placeholderTextColor="#999"
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.rangeRow}>
                            <View style={[styles.inputGroup, styles.halfInput]}>
                                <Text style={styles.inputLabel}>Precio CUP Min</Text>
                                <TextInput
                                    style={styles.additionalInput}
                                    placeholder="0"
                                    value={filters.precio_cup_min}
                                    onChangeText={(value) => handleFilterChange('precio_cup_min', value.replace(/[^0-9\.]/g, ''))}
                                    placeholderTextColor="#999"
                                    keyboardType="decimal-pad"
                                />
                            </View>
                            <View style={[styles.inputGroup, styles.halfInput]}>
                                <Text style={styles.inputLabel}>Precio CUP Max</Text>
                                <TextInput
                                    style={styles.additionalInput}
                                    placeholder="0"
                                    value={filters.precio_cup_max}
                                    onChangeText={(value) => handleFilterChange('precio_cup_max', value.replace(/[^0-9\.]/g, ''))}
                                    placeholderTextColor="#999"
                                    keyboardType="decimal-pad"
                                />
                            </View>
                        </View>

                        {isAdmin && (
                            <>
                                <View style={styles.rangeRow}>
                                    <View style={[styles.inputGroup, styles.halfInput]}>
                                        <Text style={styles.inputLabel}>Costo USD Min</Text>
                                        <TextInput
                                            style={styles.additionalInput}
                                            placeholder="0"
                                            value={filters.costo_usd_min}
                                            onChangeText={(value) => handleFilterChange('costo_usd_min', value.replace(/[^0-9\.]/g, ''))}
                                            placeholderTextColor="#999"
                                            keyboardType="decimal-pad"
                                        />
                                    </View>
                                    <View style={[styles.inputGroup, styles.halfInput]}>
                                        <Text style={styles.inputLabel}>Costo USD Max</Text>
                                        <TextInput
                                            style={styles.additionalInput}
                                            placeholder="0"
                                            value={filters.costo_usd_max}
                                            onChangeText={(value) => handleFilterChange('costo_usd_max', value.replace(/[^0-9\.]/g, ''))}
                                            placeholderTextColor="#999"
                                            keyboardType="decimal-pad"
                                        />
                                    </View>
                                </View>

                                <View style={styles.rangeRow}>
                                    <View style={[styles.inputGroup, styles.halfInput]}>
                                        <Text style={styles.inputLabel}>Costo CUP Min</Text>
                                        <TextInput
                                            style={styles.additionalInput}
                                            placeholder="0"
                                            value={filters.costo_cup_min}
                                            onChangeText={(value) => handleFilterChange('costo_cup_min', value.replace(/[^0-9\.]/g, ''))}
                                            placeholderTextColor="#999"
                                            keyboardType="decimal-pad"
                                        />
                                    </View>
                                    <View style={[styles.inputGroup, styles.halfInput]}>
                                        <Text style={styles.inputLabel}>Costo CUP Max</Text>
                                        <TextInput
                                            style={styles.additionalInput}
                                            placeholder="0"
                                            value={filters.costo_cup_max}
                                            onChangeText={(value) => handleFilterChange('costo_cup_max', value.replace(/[^0-9\.]/g, ''))}
                                            placeholderTextColor="#999"
                                            keyboardType="decimal-pad"
                                        />
                                    </View>
                                </View>

                                <View style={styles.rangeRow}>
                                    <View style={[styles.inputGroup, styles.halfInput]}>
                                        <Text style={styles.inputLabel}>Precio USD Min</Text>
                                        <TextInput
                                            style={styles.additionalInput}
                                            placeholder="0"
                                            value={filters.precio_usd_min}
                                            onChangeText={(value) => handleFilterChange('precio_usd_min', value.replace(/[^0-9\.]/g, ''))}
                                            placeholderTextColor="#999"
                                            keyboardType="decimal-pad"
                                        />
                                    </View>
                                    <View style={[styles.inputGroup, styles.halfInput]}>
                                        <Text style={styles.inputLabel}>Precio USD Max</Text>
                                        <TextInput
                                            style={styles.additionalInput}
                                            placeholder="0"
                                            value={filters.precio_usd_max}
                                            onChangeText={(value) => handleFilterChange('precio_usd_max', value.replace(/[^0-9\.]/g, ''))}
                                            placeholderTextColor="#999"
                                            keyboardType="decimal-pad"
                                        />
                                    </View>
                                </View>
                            </>
                        )}

                        <TouchableOpacity
                            style={styles.clearButton}
                            onPress={clearFilters}
                        >
                            <Text style={styles.clearButtonText}>Limpiar Filtros</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <View style={styles.actionsContainer}>
                <TouchableOpacity style={[styles.addButton, styles.secondaryButton]} onPress={() => {
                    router.push({ pathname: '/productoEntrada' });
                }}>
                    <Text style={styles.addButtonText}>Agregar Entrada a Producto</Text>
                </TouchableOpacity>

                {isAdmin && (<TouchableOpacity style={styles.addButton} onPress={() => {
                    router.push({ pathname: '/productoModal', params: { mode: 'crear' } });
                }}>
                    <Text style={styles.addButtonText}>+ Agregar Producto</Text>
                </TouchableOpacity>)}
            </View>

            {/* Botones de impresión */}
            <View style={[styles.actionsContainer, { marginTop: Spacing.s }]}>
                <TouchableOpacity
                    style={styles.printButton}
                    onPress={() => handlePrintCodes('qr')}
                >
                    <Image
                        source={require('../assets/images/QR_code.png')}
                        style={styles.printButtonIcon}
                        resizeMode="contain"
                    />
                    <Text style={styles.printButtonText}>Imprimir códigos QR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.printButton}
                    onPress={() => handlePrintCodes('barcode')}
                >
                    <Image
                        source={require('../assets/images/barras_code.png')}
                        style={styles.printButtonIcon}
                        resizeMode="contain"
                    />
                    <Text style={styles.printButtonText}>Imprimir códigos de barras</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.tableContainer}>
                <DataTable
                    columns={columns}
                    items={productosData || []}
                    actions={actions}
                    totalItems={totalItems}
                    itemsPerPage={10}
                    currentPage={currentPage}
                    isLoading={isLoading}
                    onPageChange={handlePageChange}
                    onRowClick={(producto) => {
                        try {
                            const payload = producto?.raw ? producto.raw : producto;
                            router.push({
                                pathname: '/productoModal',
                                params: {
                                    mode: 'ver',
                                    producto: JSON.stringify(payload)
                                }
                            });
                        } catch (e) {
                            ToastAndroid.show(`Error abriendo producto: ${e?.message || e}`, ToastAndroid.SHORT);
                        }
                    }}
                />
            </View>

            <QRScannerModal
                visible={showScannerModal}
                onClose={() => setShowScannerModal(false)}
                onCodeScanned={handleCodeScanned}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    tabContent: {
        paddingHorizontal: Spacing.m,
    },
    printButton: {
        backgroundColor: Colors.boton_azul,
        paddingVertical: Spacing.m,
        paddingHorizontal: Spacing.s,
        borderRadius: 8,
        alignItems: 'center',
        flex: 1,
        borderWidth: 1,
        borderColor: '#000',
        minHeight: 50,
        justifyContent: 'center',
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    printButtonIcon: {
        width: 24,
        height: 24,
        tintColor: '#fff',
    },
    printButtonText: {
        color: '#fff',
        fontSize: Typography.body,
        fontWeight: '600',
        textAlign: 'center',
        flexShrink: 1,
    },
    searchContainer: {
        backgroundColor: Colors.primaryClaro,
        padding: Spacing.m,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        overflow: 'hidden',
        marginBottom: Spacing.m,
    },
    searchTitle: {
        fontSize: Typography.h3,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: Spacing.m,
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: Spacing.m,
    },
    inputLabel: {
        fontSize: Typography.body,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    searchInput: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: Colors.primarySuave,
        borderRadius: 8,
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.s,
        fontSize: Typography.body,
        color: Colors.textSecondary,
        minHeight: 44,
        width: '100%',
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: Spacing.s,
        marginTop: Spacing.s,
    },
    moreOptionsButton: {
        backgroundColor: Colors.primary,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.s,
        paddingHorizontal: Spacing.m,
        borderRadius: 8,
        elevation: 1,
        gap: Spacing.xs,
        minHeight: 44,
    },
    moreOptionsIcon: {
        width: 16,
        height: 16,
        tintColor: Colors.textPrimary,
    },
    moreOptionsText: {
        color: Colors.textPrimary,
        fontSize: Typography.body,
        fontWeight: '600',
    },
    searchButton: {
        backgroundColor: Colors.boton_azul,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.s,
        paddingHorizontal: Spacing.m,
        borderRadius: 8,
        elevation: 1,
        gap: Spacing.xs,
        minHeight: 44,
    },
    searchIcon: {
        width: 16,
        height: 16,
        tintColor: Colors.textPrimary,
    },
    searchButtonText: {
        color: Colors.textPrimary,
        fontSize: Typography.body,
        fontWeight: '600',
    },
    additionalOptions: {
        marginTop: Spacing.m,
        paddingTop: Spacing.m,
        borderTopWidth: 1,
        borderTopColor: Colors.primarySuave,
    },
    additionalInput: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: Colors.primarySuave,
        borderRadius: 8,
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.s,
        fontSize: Typography.body,
        color: Colors.textSecondary,
        minHeight: 44,
        width: '100%',
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
    },
    rangeRow: {
        flexDirection: 'row',
        gap: Spacing.s,
    },
    halfInput: {
        flex: 1,
    },
    clearButton: {
        backgroundColor: Colors.boton_rojo_opciones,
        paddingVertical: Spacing.s,
        paddingHorizontal: Spacing.m,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: Spacing.s,
        alignSelf: 'center',
        minHeight: 44,
        justifyContent: 'center',
    },
    clearButtonText: {
        color: Colors.textPrimary,
        fontSize: Typography.body,
        fontWeight: 'bold',
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: Spacing.s,
        marginBottom: Spacing.m,
    },
    addButton: {
        backgroundColor: Colors.boton_azul,
        paddingVertical: Spacing.m,
        paddingHorizontal: Spacing.m,
        borderRadius: 8,
        alignItems: 'center',
        flex: 1,
        borderWidth: 1,
        borderColor: '#000',
        minHeight: 50,
        justifyContent: 'center',
    },
    addButtonText: {
        color: '#fff',
        fontSize: Typography.body,
        fontWeight: '600',
        textAlign: 'center',
    },
    secondaryButton: {
        backgroundColor: Colors.primaryDark,
    },
    tableContainer: {
        marginBottom: Spacing.m,
        height: 560,
    },
    cellText: {
        fontSize: Typography.small,
        color: Colors.textSecondary,
        textAlign: 'left',
    },
    editButton: {
        backgroundColor: Colors.boton_azul,
        alignItems: 'center',
    },
    deleteButton: {
        backgroundColor: Colors.boton_rojo_opciones,
        alignItems: 'center',
    },
});
