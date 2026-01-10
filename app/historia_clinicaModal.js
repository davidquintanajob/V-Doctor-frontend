import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    FlatList,
    Dimensions,
    ToastAndroid,
    Alert,
    Image,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import TopBar from '../components/TopBar';
import VacunasLista from '../components/VacunasLista';
import AntiparasitariosLista from '../components/AntiparasitariosLista';
import MedicamentosLista from '../components/MedicamentosLista';
import ServiciosLista from '../components/ServiciosLista';
import ProductosList from '../components/ProductosList';
import UsuariosLista from '../components/UsuariosLista';
import { Colors, Spacing, Typography } from '../variables';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Modal from 'react-native/Libraries/Modal/Modal';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import AutocompleteTextInput from '../components/AutocompleteTextInput';

const { width: screenWidth } = Dimensions.get('window');

export default function HistoriaClinicaModalScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const mode = params.mode; // 'crear' | 'editar' | 'ver'
    const consultaParam = params.consulta ? JSON.parse(params.consulta) : null;
    const pacienteParam = params.paciente ? JSON.parse(params.paciente) : null;
    const [cambioMoneda, setCambioMoneda] = useState(null);

    const isView = mode === 'ver';
    const isEditable = mode !== 'ver';

    // Estados principales
    const [consultaData, setConsultaData] = useState({
        id_consulta: consultaParam?.id_consulta ?? null,
        fecha: consultaParam?.fecha ? new Date(consultaParam.fecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        motivo: consultaParam?.motivo ?? '',
        diagnostico: consultaParam?.diagnostico ?? '',
        anamnesis: consultaParam?.anamnesis ?? '',
        tratamiento: consultaParam?.tratamiento ?? '',
        patologia: consultaParam?.patologia ?? '',
        id_paciente: consultaParam?.id_paciente ?? null,
        id_usuario: consultaParam?.id_usuario ?? null,
    });

    const [apiHost, setApiHost] = useState('');
    const [token, setToken] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [loading, setLoading] = useState(false);

    // Estados para grabación de audio
    const [recordingAnamnesis, setRecordingAnamnesis] = useState(null);
    const [isRecordingAnamnesis, setIsRecordingAnamnesis] = useState(false);
    const [recordingTimeAnamnesis, setRecordingTimeAnamnesis] = useState(0);
    const [isProcessingAudioAnamnesis, setIsProcessingAudioAnamnesis] = useState(false);
    const [recordingTimerAnamnesis, setRecordingTimerAnamnesis] = useState(null);

    const [recordingDiagnostico, setRecordingDiagnostico] = useState(null);
    const [isRecordingDiagnostico, setIsRecordingDiagnostico] = useState(false);
    const [recordingTimeDiagnostico, setRecordingTimeDiagnostico] = useState(0);
    const [isProcessingAudioDiagnostico, setIsProcessingAudioDiagnostico] = useState(false);
    const [recordingTimerDiagnostico, setRecordingTimerDiagnostico] = useState(null);

    const [recordingTratamiento, setRecordingTratamiento] = useState(null);
    const [isRecordingTratamiento, setIsRecordingTratamiento] = useState(false);
    const [recordingTimeTratamiento, setRecordingTimeTratamiento] = useState(0);
    const [isProcessingAudioTratamiento, setIsProcessingAudioTratamiento] = useState(false);
    const [recordingTimerTratamiento, setRecordingTimerTratamiento] = useState(null);

    const [recordingPatologia, setRecordingPatologia] = useState(null);
    const [isRecordingPatologia, setIsRecordingPatologia] = useState(false);
    const [recordingTimePatologia, setRecordingTimePatologia] = useState(0);
    const [isProcessingAudioPatologia, setIsProcessingAudioPatologia] = useState(false);
    const [recordingTimerPatologia, setRecordingTimerPatologia] = useState(null);

    // Estados para imágenes de la consulta
    const [fotos, setFotos] = useState([]); // Array de objetos {uri: string, base64: string, nota: string}
    const [mostrarNotaIndex, setMostrarNotaIndex] = useState(null);
    const [notaActual, setNotaActual] = useState('');
    const [imagenFullscreen, setImagenFullscreen] = useState(null);

    // Estados y refs para cámara/galería usando expo-camera y expo-media-library
    const [cameraModalVisible, setCameraModalVisible] = useState(false);
    const cameraRef = React.useRef(null);
    // Guards to avoid multiple openings
    const isCameraOpeningRef = React.useRef(false);
    const isGalleryOpeningRef = React.useRef(false);
    const [cameraType, setCameraType] = useState('back');
    const [cameraReady, setCameraReady] = useState(false);
    const [galleryModalVisible, setGalleryModalVisible] = useState(false);
    const [mediaAssets, setMediaAssets] = useState([]);

    // AGREGAR estos estados después de los otros estados principales (al principio del componente)
    const [initialMedicamentos, setInitialMedicamentos] = useState([]);
    const [initialVacunas, setInitialVacunas] = useState([]);
    const [initialAntiparasitarios, setInitialAntiparasitarios] = useState([]);
    const [initialServicios, setInitialServicios] = useState([]);
    const [initialProductos, setInitialProductos] = useState([]);
    // Configuración de redondeo (desde AsyncStorage @redondeoConfig)
    const [redondeoValue, setRedondeoValue] = useState(null);
    const [isRedondeoFromPlus, setIsRedondeoFromPlus] = useState(false);

    // Refs para las listas
    const vacunasListRef = React.useRef(null);
    const antiparasitariosListRef = React.useRef(null);
    const medicamentosListRef = React.useRef(null);
    const productosListRef = React.useRef(null);
    const serviciosListRef = React.useRef(null);
    const usuariosListRef = React.useRef(null);
    const exedenteRoundedRef = React.useRef(0);

    // Scroll + posiciones para validación y scroll automático
    const scrollRef = React.useRef(null);
    const positionsRef = React.useRef({});
    const autoTratamientoRef = React.useRef({}); // map key -> last generated part

    // Sincronizar automáticamente `tratamiento` en modo 'crear' con las notas de las listas
    React.useEffect(() => {
        if (mode !== 'crear') return;

        let mounted = true;

        const buildTratamientoParts = () => {
            try {
                const refs = [medicamentosListRef, productosListRef, vacunasListRef, antiparasitariosListRef];
                const parts = [];

                refs.forEach(r => {
                    const items = (r && r.current && typeof r.current.getItems === 'function') ? (r.current.getItems() || []) : [];
                    items.forEach(it => {
                        const nota = (it.nota_list ?? it.nota ?? '').toString().trim();
                        if (nota) {
                            const name = (it.selected && (it.selected.producto?.nombre || it.selected.nombre)) || (it.producto && it.producto.nombre) || it.nombre || '';
                            if (name) {
                                // Use stable key per item (prefer id if present, fallback to name)
                                const key = (it.id ?? it.selected?.id ?? `name:${name}`).toString();
                                parts.push({ key, part: `${name}: ${nota}.` });
                            }
                        }
                    });
                });

                return parts; // array of {key, part}
            } catch (err) {
                console.error('Error building tratamiento from lists:', err);
                return [];
            }
        };

        // Initial sync
        const syncNow = () => {
            if (!mounted) return;
            const newParts = buildTratamientoParts();
            if (!Array.isArray(newParts) || newParts.length === 0) return;

            const prevAutoMap = (autoTratamientoRef.current && typeof autoTratamientoRef.current === 'object') ? autoTratamientoRef.current : {};
            const newKeys = newParts.map(p => p.key);

            // We'll update tratamiento by replacing existing auto parts for the same key,
            // or appending if a key is new. We will NOT remove text when items disappear.
            setConsultaData(prev => {
                if (!prev) return prev;
                let text = (prev.tratamiento || '').trim();

                newParts.forEach(({ key, part }) => {
                    const prevPart = prevAutoMap[key];
                    if (prevPart) {
                        // Replace old part occurrence with new part once (avoid multiple replacements)
                        if (prevPart !== part && text.includes(prevPart)) {
                            text = text.replace(prevPart, part);
                        } else if (!text.includes(part)) {
                            // if previous part not found but new part also not present, append
                            text = text ? text + ' ' + part : part;
                        }
                    } else {
                        // new key -> append if not already present
                        if (!text.includes(part)) {
                            text = text ? text + ' ' + part : part;
                        }
                    }

                    // update map for this key
                    prevAutoMap[key] = part;
                });

                // store updated map back
                autoTratamientoRef.current = prevAutoMap;

                return { ...prev, tratamiento: text };
            });
        };

        syncNow();

        // Polling ligero para detectar cambios en las listas (se limpia al desmontar)
        const iv = setInterval(syncNow, 700);
        return () => { mounted = false; clearInterval(iv); };
    }, [mode, medicamentosListRef, productosListRef, vacunasListRef, antiparasitariosListRef]);

    // Estado para datos del paciente (descuento)
    const [pacienteData, setPacienteData] = useState(null);

    // Totales por lista (actualizados por onChange desde cada lista)
    const [listsTotals, setListsTotals] = useState({
        vacunas: { totalCobrar: 0, totalProfit: 0 },
        antiparasitarios: { totalCobrar: 0, totalProfit: 0 },
        medicamentos: { totalCobrar: 0, totalProfit: 0 },
        productos: { totalCobrar: 0, totalProfit: 0 },
        servicios: { totalCobrar: 0, totalProfit: 0 },
        usuarios: { totalCobrar: 0, totalProfit: 0 },
    });

    // Totales originales (no editables directamente) y totales definidos por el usuario
    const originalTotalsRef = useRef({ totalCobrar: 0, totalConDescuento: 0, version: 0 });
    const [userTotals, setUserTotals] = useState({ totalCobrar: null, totalConDescuento: null, version: null });
    const [totalsModalVisible, setTotalsModalVisible] = useState(false);

    // NOTE: original totals are updated inside calculateTotals (no useEffect here)

    // Tipo de pago: 'efectivo' (default) | 'transferencia'
    const [paymentType, setPaymentType] = useState('efectivo');

    // Usuarios (cargados al abrir el modal)
    const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
    const [usuariosLoading, setUsuariosLoading] = useState(false);
    const [usuariosPreseleccionados, setUsuariosPreseleccionados] = useState([]);

    // Validación/progreso al crear/editar consulta
    const [validationVisible, setValidationVisible] = useState(false);
    const [validationProgress, setValidationProgress] = useState(0);
    const [validationTitle, setValidationTitle] = useState('');

    // Estados para el conteo de ventas creadas
    const [ventasCreated, setVentasCreated] = useState(0);
    const [totalVentasToCreate, setTotalVentasToCreate] = useState(0);

    // (List states removed)

    // Función para comprimir imágenes sin pérdida de calidad visible
    const comprimirImagen = async (uri) => {
        try {
            // Obtener información del archivo original
            const fileInfo = await FileSystem.getInfoAsync(uri);
            const sizeBefore = fileInfo.size;
            console.log(`📸 Tamaño original: ${(sizeBefore / 1024 / 1024).toFixed(2)} MB (${sizeBefore} bytes)`);

            // Comprimir imagen
            const result = await ImageManipulator.manipulateAsync(
                uri,
                [
                    // Mantener orientación original
                    { resize: { width: 1024 } } // Redimensionar a ancho máximo de 1024px (mantiene relación de aspecto)
                ],
                {
                    compress: 0.8, // Compresión del 80% (1 = sin compresión, 0 = máxima compresión)
                    format: ImageManipulator.SaveFormat.JPEG,
                    base64: true // Obtener directamente en base64
                }
            );

            // Obtener información del archivo comprimido
            const compressedFileInfo = await FileSystem.getInfoAsync(result.uri);
            const sizeAfter = compressedFileInfo.size;

            console.log(`✅ Tamaño comprimido: ${(sizeAfter / 1024 / 1024).toFixed(2)} MB (${sizeAfter} bytes)`);
            console.log(`📊 Reducción: ${((1 - sizeAfter / sizeBefore) * 100).toFixed(1)}%`);

            return {
                uri: result.uri,
                base64: result.base64,
                width: result.width,
                height: result.height
            };
        } catch (error) {
            console.error('❌ Error en compresión de imagen:', error);
            throw error;
        }
    };

    // Dentro del componente HistoriaClinicaModalScreen, agrega este useEffect:
    useEffect(() => {
        const cargarFotosExistentes = async () => {
            // Solo cargar si tenemos fotos y no las hemos cargado aún
            if (!consultaParam?.foto_consulta || !apiHost || fotos.length > 0) return;

            // Si estamos en modo ver/editar y hay fotos existentes
            if ((mode === 'ver' || mode === 'editar') && consultaParam.foto_consulta.length > 0) {
                try {

                    // Para no bloquear la UI, cargamos las fotos una por una
                    const fotosCargadas = [];

                    for (const foto of consultaParam.foto_consulta) {
                        // Construir URL completa de la imagen
                        const imageUrl = `${apiHost}${foto.ruta}`;

                        // Intentar convertir a base64
                        const base64Data = await uriToBase64(imageUrl);

                        if (base64Data) {
                            fotosCargadas.push({
                                uri: imageUrl, // Guardamos la URL para mostrar
                                base64: base64Data, // Guardamos base64 para enviar
                                nota: foto.nota || '',
                                id_foto_consulta: foto.id_foto_consulta
                            });
                        } else {
                            console.warn('No se pudo cargar la imagen:', imageUrl);
                            // Aún así agregamos la foto con la URL para mostrar (pero sin base64)
                            fotosCargadas.push({
                                uri: imageUrl,
                                base64: '',
                                nota: foto.nota || '',
                                id_foto_consulta: foto.id_foto_consulta
                            });
                        }
                    }

                    setFotos(fotosCargadas);

                } catch (error) {
                    console.error('Error cargando fotos existentes:', error);
                    // Si falla la carga, al menos mostrar las URLs
                    const fotosFallback = consultaParam.foto_consulta.map(foto => ({
                        uri: `${apiHost}${foto.ruta}`,
                        base64: '',
                        nota: foto.nota || '',
                        id_foto_consulta: foto.id_foto_consulta
                    }));
                    setFotos(fotosFallback);
                }
            }
        };

        cargarFotosExistentes();
    }, [consultaParam]);

    // Inicializar API host
    useEffect(() => {
        const getConfig = async () => {
            try {
                const raw = await AsyncStorage.getItem('@config');
                if (raw) {
                    const config = JSON.parse(raw);
                    const host = config.api_host || config.apihost || config.apiHost || '';
                    setApiHost(host);
                    setToken(config.token || null);
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
                // Cargar configuración de redondeo si existe
                try {
                    const redRaw = await AsyncStorage.getItem('@redondeoConfig');
                    if (redRaw) {
                        const redCfg = JSON.parse(redRaw);
                        // .value puede ser por ejemplo 'Normal', 'Exeso 5', etc.
                        setRedondeoValue(redCfg?.value ?? null);
                        setIsRedondeoFromPlus(!!redCfg?.isRedondeoFromPlus);
                    }
                } catch (e) {
                    console.log('Error reading @redondeoConfig:', e);
                }
            } catch (error) {
                console.error('Error getting config:', error);
            }
        };
        const procesarVentasExistentes = () => {
            if (!consultaParam?.venta || !Array.isArray(consultaParam.venta)) {
                return;
            }

            const ventas = consultaParam.venta;

            // Arrays para cada tipo de venta
            const medicamentosItems = [];
            const vacunasItems = [];
            const antiparasitariosItems = [];
            const serviciosItems = [];
            const productosItems = [];

            ventas.forEach((venta, index) => {
                const id = `${Date.now()}_${index}`;
                const comerciable = venta.comerciable || {};
                const producto = comerciable.producto || {};
                const medicamento = producto.medicamento || {};

                // Determinar el tipo de venta
                if (comerciable.servicio) {
                    // Es un servicio
                    serviciosItems.push({
                        id: id,
                        id_venta: venta.id_venta,
                        fecha: venta.fecha,
                        selected: comerciable.servicio,
                        precio_cup: venta.precio_cobrado_cup?.toString() || '',
                        cantidad: venta.cantidad?.toString() || '1',
                        nota_list: venta.nota || "",
                        exedente_redondeo: venta.exedente_redondeo || 0,
                        costo_producto_cup: venta.costo_producto_cup,
                        precio_original_comerciable_cup: (venta.precio_original_comerciable_cup != null) ? String(venta.precio_original_comerciable_cup) : (venta.costo_producto_cup != null ? String(venta.costo_producto_cup) : undefined),
                        precio_original_comerciable_usd: (venta.precio_original_comerciable_usd != null) ? String(venta.precio_original_comerciable_usd) : (venta.costo_producto_usd != null ? String(venta.costo_producto_usd) : undefined)
                    });
                } else if (comerciable.producto) {
                    // Es un producto o medicamento
                    if (medicamento.tipo_medicamento) {
                        // Es un medicamento (antibiótico, vacuna, antiparasitario)
                        const itemData = {
                            id: id,
                            id_venta: venta.id_venta,
                            fecha: venta.fecha,
                            selected: {
                                producto: producto,
                                unidad_medida: medicamento.unidad_medida || '',
                                posologia: medicamento.posologia || ''
                            },
                            unidad_medida: medicamento.unidad_medida || '',
                            categoria: producto.categoria || '',
                            posologia: medicamento.posologia || '',
                            precio_cup: venta.precio_cobrado_cup?.toString() || '',
                            cantidad: venta.cantidad?.toString() || '1',
                            exedente_redondeo: venta.exedente_redondeo || 0,
                            costo_producto_cup: venta.costo_producto_cup,
                            nota_list: venta.nota || "",
                            precio_original_comerciable_cup: (venta.precio_original_comerciable_cup != null) ? String(venta.precio_original_comerciable_cup) : (venta.costo_producto_cup != null ? String(venta.costo_producto_cup) : undefined),
                            precio_original_comerciable_usd: (venta.precio_original_comerciable_usd != null) ? String(venta.precio_original_comerciable_usd) : (venta.costo_producto_usd != null ? String(venta.costo_producto_usd) : undefined)
                        };

                        switch (medicamento.tipo_medicamento) {
                            case 'vacuna':
                                vacunasItems.push(itemData);
                                break;
                            case 'antiparasitario':
                                antiparasitariosItems.push(itemData);
                                break;
                            default: // 'antibiótico' u otros tipos de medicamentos
                                medicamentosItems.push(itemData);
                                break;
                        }
                    } else {
                        // Es un producto normal (no medicamento)
                        // Mapear los datos de la venta a la estructura que espera la lista
                        productosItems.push({
                            id: (venta.id_venta != null) ? String(venta.id_venta) : `${Date.now()}_${index}`,
                            id_venta: venta.id_venta,
                            fecha: venta.fecha,
                            selected: producto,
                            codigo: producto.codigo?.toString() || '',
                            // precio de la venta (lo cobrado)
                            precio_cup: venta.precio_cobrado_cup?.toString() || '',
                            // cantidad vendida
                            cantidad: venta.cantidad?.toString() || '1',
                            nota_list: venta.nota || "",
                            exedente_redondeo: venta.exedente_redondeo || 0,
                            costo_producto_cup: venta.costo_producto_cup,
                            // precio original del comerciable (necesario para calcular el plus)
                            precio_original_comerciable_cup: (venta.precio_original_comerciable_cup != null) ? String(venta.precio_original_comerciable_cup) : (venta.costo_producto_cup != null ? String(venta.costo_producto_cup) : undefined),
                            precio_original_comerciable_usd: (venta.precio_original_comerciable_usd != null) ? String(venta.precio_original_comerciable_usd) : (venta.costo_producto_usd != null ? String(venta.costo_producto_usd) : undefined)
                        });
                    }
                }
            });

            // Actualizar los estados iniciales
            setInitialMedicamentos(medicamentosItems);
            setInitialVacunas(vacunasItems);
            setInitialAntiparasitarios(antiparasitariosItems);
            setInitialServicios(serviciosItems);
            setInitialProductos(productosItems);
        };

        getConfig();
        procesarVentasExistentes();
    }, []);

    // Cargar usuarios al abrir el modal (bloqueante hasta recibir respuesta)
    useEffect(() => {
        const fetchUsuarios = async () => {
            if (!apiHost) return;
            setUsuariosLoading(true);
            try {
                const url = `${apiHost}/usuario`;
                const headers = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch(url, { headers });
                const text = await res.text();
                let json;
                try { json = JSON.parse(text); } catch (e) { console.error('Invalid JSON /usuario response', text); json = null; }

                if (!res.ok || !json) {
                    Alert.alert('Error', `No se pudieron cargar los usuarios`);
                    setUsuariosDisponibles([]);
                    setUsuariosPreseleccionados([]);
                    return;
                }

                setUsuariosDisponibles(json);

                // Construir lista inicial de preseleccionados: posible usuario desde config
                const initialPreselected = [];

                // Revisar config de usuario para preseleccionar si aplica
                // Solo preseleccionar el usuario desde la config si estamos creando una nueva entidad
                if (mode === 'crear') {
                    try {
                        // Try both keys: older code may have stored @config.userConfig, but login stores @config
                        let rawUserCfg = await AsyncStorage.getItem('@config.userConfig');
                        if (!rawUserCfg) rawUserCfg = await AsyncStorage.getItem('@config');
                        if (rawUserCfg) {
                            const userCfg = JSON.parse(rawUserCfg);
                            const currentId = userCfg?.usuario?.id_usuario || userCfg?.usuario?.idUsuario || null;
                            if (currentId) {
                                const found = json.find(u => u.id_usuario === currentId || u.id === currentId);
                                if (found) {
                                    initialPreselected.push(found);
                                }
                            }
                        }
                    } catch (err) {
                        console.error('Error reading config from AsyncStorage', err);
                    }
                }

                // Si el modal recibió una consulta con ventas, extraer todos los usuarios de todas las ventas
                // y agregarlos a la preselección (sin duplicados).
                try {
                    if (consultaParam?.venta && Array.isArray(consultaParam.venta)) {
                        for (const venta of consultaParam.venta) {
                            const ventaUsuarios = venta?.usuarios;
                            if (!ventaUsuarios) continue;

                            if (Array.isArray(ventaUsuarios)) {
                                for (const u of ventaUsuarios) {
                                    const key = u?.id_usuario ?? u?.id;
                                    if (key == null) continue;
                                    // Preferir la entidad completa presente en `json` (usuariosDisponibles) si existe
                                    const foundInAll = json.find(au => au.id_usuario === key || au.id === key);
                                    initialPreselected.push(foundInAll || u);
                                }
                            } else if (typeof ventaUsuarios === 'object') {
                                const u = ventaUsuarios;
                                const key = u?.id_usuario ?? u?.id;
                                if (key != null) {
                                    const foundInAll = json.find(au => au.id_usuario === key || au.id === key);
                                    initialPreselected.push(foundInAll || u);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error extracting usuarios from consultaParam.venta', err);
                }

                // Eliminar duplicados por id_usuario / id y asignar al estado si hay alguno
                if (initialPreselected.length > 0) {
                    const map = new Map();
                    initialPreselected.forEach(u => {
                        const key = u?.id_usuario ?? u?.id;
                        if (key != null && !map.has(String(key))) map.set(String(key), u);
                    });
                    const merged = Array.from(map.values());
                    if (merged.length > 0) setUsuariosPreseleccionados(merged);
                }
            } catch (error) {
                console.error('Error fetching usuarios:', error);
                Alert.alert('Error', 'Fallo al cargar usuarios');
            } finally {
                setUsuariosLoading(false);
            }
        };

        fetchUsuarios();
    }, [apiHost, token]);

    // Limpiar temporizadores al desmontar
    useEffect(() => {
        return () => {
            if (recordingTimerAnamnesis) clearInterval(recordingTimerAnamnesis);
            if (recordingTimerDiagnostico) clearInterval(recordingTimerDiagnostico);
            if (recordingTimerTratamiento) clearInterval(recordingTimerTratamiento);
            if (recordingTimerPatologia) clearInterval(recordingTimerPatologia);
        };
    }, [recordingTimerAnamnesis, recordingTimerDiagnostico, recordingTimerTratamiento, recordingTimerPatologia]);

    // Función para convertir URI a base64
    const uriToBase64 = async (uri) => {
        if (!uri) return '';

        // Si ya es una URI local (comienza con file://, content://, etc.)
        if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith(FileSystem.documentDirectory)) {
            try {
                const enc = (FileSystem.EncodingType && FileSystem.EncodingType.Base64) ? FileSystem.EncodingType.Base64 : 'base64';
                const b64 = await FileSystem.readAsStringAsync(uri, { encoding: enc });
                return b64;
            } catch (readErr) {
                console.warn('Fallo al leer imagen local:', readErr);
                return '';
            }
        }

        // Si es una URL HTTP/HTTPS (imagen remota)
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
            try {
                // 1. Descargar la imagen a un archivo temporal
                const filename = uri.split('/').pop() || `image_${Date.now()}.jpg`;
                const fileUri = FileSystem.cacheDirectory + filename;

                // Configurar headers si es necesario (ej: autenticación)
                const downloadOptions = {};
                if (token) {
                    downloadOptions.headers = {
                        'Authorization': `Bearer ${token}`
                    };
                }

                const downloadResult = await FileSystem.downloadAsync(uri, fileUri, downloadOptions);

                // 2. Leer el archivo descargado como base64
                const b64 = await FileSystem.readAsStringAsync(downloadResult.uri, {
                    encoding: FileSystem.EncodingType.Base64
                });

                // 3. Opcional: limpiar el archivo temporal
                try {
                    await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
                } catch (e) { /* ignorar error de limpieza */ }

                return b64;
            } catch (error) {
                console.warn('Fallo al descargar/convertir imagen remota:', error);
                return '';
            }
        }

        console.warn('URI no reconocida:', uri);
        return '';
    };

    // Función para abrir la cámara: abre un modal con componente Camera
    const openCamera = async () => {
        // Evitar múltiples llamadas simultáneas
        if (isCameraOpeningRef.current || cameraModalVisible) return;
        isCameraOpeningRef.current = true;

        try {
            // Abrir modal
            setCameraModalVisible(true);
            setTimeout(() => { isCameraOpeningRef.current = false; }, 500);
        } catch (error) {
            console.error('Error abriendo cámara:', error);
            Alert.alert('Error', 'No se pudo abrir la cámara: ' + error.message);
            isCameraOpeningRef.current = false;
        }
    };

    // Función para abrir galería: solicita permisos y carga assets para mostrar en modal
    const openGallery = async () => {
        // Evitar múltiples llamadas simultáneas
        if (isGalleryOpeningRef.current || galleryModalVisible) return;
        isGalleryOpeningRef.current = true;

        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Se necesita permiso para acceder a la galería.');
                isGalleryOpeningRef.current = false;
                return;
            }

            // Cargar assets (fotos) recientes
            const res = await MediaLibrary.getAssetsAsync({
                mediaType: ['photo'],
                first: 200,
                sortBy: [MediaLibrary.SortBy.creationTime],
            });

            setMediaAssets(res.assets || []);
            setGalleryModalVisible(true);
            setTimeout(() => { isGalleryOpeningRef.current = false; }, 500);
        } catch (err) {
            console.error('Error opening gallery', err);
            Alert.alert('Error', 'No se pudo abrir la galería.');
            isGalleryOpeningRef.current = false;
        }
    };

    // Función para eliminar una foto
    const removeFoto = (index) => {
        Alert.alert(
            'Eliminar foto',
            '¿Estás seguro de que quieres eliminar esta foto?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: () => {
                        setFotos(prev => prev.filter((_, i) => i !== index));
                        // Si estamos editando una nota, limpiarla
                        if (mostrarNotaIndex === index) {
                            setMostrarNotaIndex(null);
                            setNotaActual('');
                        }
                    }
                }
            ]
        );
    };

    // Función para agregar/editar nota de una foto
    const agregarNota = (index) => {
        setMostrarNotaIndex(index);
        setNotaActual(fotos[index]?.nota || '');
    };

    // Función para guardar la nota
    const guardarNota = (index) => {
        if (notaActual.trim() === '') {
            Alert.alert('Nota vacía', 'Por favor ingresa una nota o cancela');
            return;
        }

        const fotosActualizadas = [...fotos];
        fotosActualizadas[index] = {
            ...fotosActualizadas[index],
            nota: notaActual.trim()
        };
        setFotos(fotosActualizadas);
        setMostrarNotaIndex(null);
        setNotaActual('');
        ToastAndroid.show('Nota guardada', ToastAndroid.SHORT);
    };

    // Función para cancelar la edición de nota
    const cancelarNota = () => {
        setMostrarNotaIndex(null);
        setNotaActual('');
    };

    const formatDateToYMD = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    };

    const handleDateChange = (event, selectedDate) => {
        setShowDatePicker(false);
        if (selectedDate) {
            const formattedDate = formatDateToYMD(selectedDate);
            setConsultaData(prev => ({ ...prev, fecha: formattedDate }));
        }
    };

    const handleChange = (field, value) => {
        setConsultaData(prev => ({ ...prev, [field]: value }));
    };

    // Funciones genéricas para gestionar listas
    // List helpers removed

    // Funciones específicas para cada lista
    // Specific add functions removed

    const startRecording = async (field) => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permiso denegado', 'Se necesitan permisos de micrófono para grabar audio.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            // Configurar estado según el campo
            switch (field) {
                case 'anamnesis':
                    setRecordingAnamnesis(recording);
                    setIsRecordingAnamnesis(true);
                    setRecordingTimeAnamnesis(0);
                    setConsultaData(prev => ({ ...prev, anamnesis: '' }));
                    break;
                case 'diagnostico':
                    setRecordingDiagnostico(recording);
                    setIsRecordingDiagnostico(true);
                    setRecordingTimeDiagnostico(0);
                    setConsultaData(prev => ({ ...prev, diagnostico: '' }));
                    break;
                case 'tratamiento':
                    setRecordingTratamiento(recording);
                    setIsRecordingTratamiento(true);
                    setRecordingTimeTratamiento(0);
                    setConsultaData(prev => ({ ...prev, tratamiento: '' }));
                    break;
                case 'patologia':
                    setRecordingPatologia(recording);
                    setIsRecordingPatologia(true);
                    setRecordingTimePatologia(0);
                    setConsultaData(prev => ({ ...prev, patologia: '' }));
                    break;
            }

            // Iniciar temporizador
            const timer = setInterval(() => {
                switch (field) {
                    case 'anamnesis':
                        setRecordingTimeAnamnesis(prev => prev + 1);
                        break;
                    case 'diagnostico':
                        setRecordingTimeDiagnostico(prev => prev + 1);
                        break;
                    case 'tratamiento':
                        setRecordingTimeTratamiento(prev => prev + 1);
                        break;
                    case 'patologia':
                        setRecordingTimePatologia(prev => prev + 1);
                        break;
                }
            }, 1000);

            // Guardar referencia del temporizador
            switch (field) {
                case 'anamnesis':
                    setRecordingTimerAnamnesis(timer);
                    break;
                case 'diagnostico':
                    setRecordingTimerDiagnostico(timer);
                    break;
                case 'tratamiento':
                    setRecordingTimerTratamiento(timer);
                    break;
                case 'patologia':
                    setRecordingTimerPatologia(timer);
                    break;
            }

            ToastAndroid.show('Grabando... Habla ahora', ToastAndroid.SHORT);
        } catch (error) {
            console.error('Error al iniciar la grabación:', error);
            Alert.alert('Error', 'No se pudo iniciar la grabación');
        }
    };

    const stopRecording = async (field) => {
        let currentRecording;
        let setIsProcessing;

        // Obtener referencias según el campo
        switch (field) {
            case 'anamnesis':
                currentRecording = recordingAnamnesis;
                setIsProcessing = setIsProcessingAudioAnamnesis;
                break;
            case 'diagnostico':
                currentRecording = recordingDiagnostico;
                setIsProcessing = setIsProcessingAudioDiagnostico;
                break;
            case 'tratamiento':
                currentRecording = recordingTratamiento;
                setIsProcessing = setIsProcessingAudioTratamiento;
                break;
            case 'patologia':
                currentRecording = recordingPatologia;
                setIsProcessing = setIsProcessingAudioPatologia;
                break;
        }

        if (!currentRecording) return;

        try {
            setIsProcessing(true);

            // Detener temporizador
            switch (field) {
                case 'anamnesis':
                    if (recordingTimerAnamnesis) {
                        clearInterval(recordingTimerAnamnesis);
                        setRecordingTimerAnamnesis(null);
                    }
                    break;
                case 'diagnostico':
                    if (recordingTimerDiagnostico) {
                        clearInterval(recordingTimerDiagnostico);
                        setRecordingTimerDiagnostico(null);
                    }
                    break;
                case 'tratamiento':
                    if (recordingTimerTratamiento) {
                        clearInterval(recordingTimerTratamiento);
                        setRecordingTimerTratamiento(null);
                    }
                    break;
                case 'patologia':
                    if (recordingTimerPatologia) {
                        clearInterval(recordingTimerPatologia);
                        setRecordingTimerPatologia(null);
                    }
                    break;
            }

            // Detener la grabación
            await currentRecording.stopAndUnloadAsync();
            const uri = currentRecording.getURI();

            // Obtener el archivo de audio en base64
            const audioBase64 = await audioUriToBase64(uri);

            // Enviar al backend para transcripción
            await transcribeAudio(audioBase64, field);

        } catch (error) {
            console.error('Error al detener la grabación:', error);
            Alert.alert('Error', 'No se pudo procesar la grabación');
        } finally {
            // Limpiar estados según el campo
            switch (field) {
                case 'anamnesis':
                    setRecordingAnamnesis(null);
                    setIsRecordingAnamnesis(false);
                    break;
                case 'diagnostico':
                    setRecordingDiagnostico(null);
                    setIsRecordingDiagnostico(false);
                    break;
                case 'tratamiento':
                    setRecordingTratamiento(null);
                    setIsRecordingTratamiento(false);
                    break;
                case 'patologia':
                    setRecordingPatologia(null);
                    setIsRecordingPatologia(false);
                    break;
            }
        }
    };

    const audioUriToBase64 = async (uri) => {
        try {
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64',
            });
            return base64;
        } catch (error) {
            console.error('❌ Error en audioUriToBase64:', error);
            throw error;
        }
    };

    const transcribeAudio = async (audioBase64, field) => {
        if (!apiHost || !token) {
            Alert.alert('Error', 'No hay configuración de API o token');
            return;
        }

        try {
            const url = `${apiHost}/api/speech-to-text/test-file`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    audioBase64: audioBase64
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                console.error('Error del servidor:', result);
                Alert.alert('Error del servidor', result.error || `Error ${response.status}`);
                return;
            }

            if (result.success) {
                const transcription = result.data?.transcription;

                if (transcription) {
                    // SOBREESCRIBIR el contenido del campo con la transcripción
                    setConsultaData(prev => ({
                        ...prev,
                        [field]: transcription
                    }));

                    ToastAndroid.show(`✅ Transcripción agregada al ${field} (${result.data?.processingTime || ''})`, ToastAndroid.SHORT);
                } else {
                    Alert.alert('Error', 'No se recibió transcripción del servidor');
                }
            } else {
                Alert.alert('Error en la transcripción', result.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Error al transcribir audio:', error);

            if (error.message.includes('Network request failed')) {
                Alert.alert('Error de red', 'No se pudo conectar con el servidor. Verifica tu conexión.');
            } else if (error.message.includes('Failed to fetch')) {
                Alert.alert('Error de conexión', 'No se pudo contactar al servidor.');
            } else {
                Alert.alert('Error', error.message || 'Error desconocido');
            }
        } finally {
            // Terminar el procesamiento según el campo
            switch (field) {
                case 'anamnesis':
                    setIsProcessingAudioAnamnesis(false);
                    break;
                case 'diagnostico':
                    setIsProcessingAudioDiagnostico(false);
                    break;
                case 'tratamiento':
                    setIsProcessingAudioTratamiento(false);
                    break;
                case 'patologia':
                    setIsProcessingAudioPatologia(false);
                    break;
            }
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Funciones para calcular totales de las listas
    const calculateTotals = () => {
        let totalCobrar = 0;
        let totalProfit = 0;
        const allSelectedItems = [];

        const refs = [vacunasListRef, antiparasitariosListRef, medicamentosListRef, productosListRef, serviciosListRef];

        refs.forEach(r => {
            try {
                // Caso 1: Si tiene getTotals, usar ese método para totales generales
                if (r.current?.getTotals && typeof r.current.getTotals === 'function') {
                    const t = r.current.getTotals();
                    totalCobrar += parseFloat(t.totalCobrar || 0) || 0;
                    totalProfit += parseFloat(t.totalProfit || 0) || 0;

                    // También recopilar items individuales para calcular porcentajes
                    if (r.current?.items) {
                        r.current.items.forEach(item => {
                            if (item.selected) {
                                const price = parseFloat(item.precio_cup || 0) || 0;
                                const qty = parseFloat(item.cantidad || 0) || 0;
                                const itemTotal = price * qty;

                                // Guardar referencia al item y su total para cálculo de porcentajes
                                allSelectedItems.push({
                                    item: item,
                                    itemTotal: itemTotal
                                });
                            }
                        });
                    }
                }
                // Caso 2: Si no tiene getTotals pero tiene items
                else if (r.current?.items) {
                    r.current.items.forEach(item => {
                        if (item.selected) {
                            const price = parseFloat(item.precio_cup || 0) || 0;
                            const qty = parseFloat(item.cantidad || 0) || 0;
                            const cost = parseFloat(
                                item.selected.producto?.comerciable?.precio_cup ||
                                item.selected.costo_cup ||
                                item.costo_producto_cup ||
                                0
                            ) || 0;
                            const itemTotal = price * qty;

                            totalCobrar += itemTotal;
                            totalProfit += (itemTotal) - (cost * qty);

                            // Guardar referencia al item y su total
                            allSelectedItems.push({
                                item: item,
                                itemTotal: itemTotal
                            });
                        }
                    });
                }
            } catch (err) {
                console.error('Error calculando totales desde ref:', err);
            }
        });

        // Calcular y asignar porcentajes a todos los items seleccionados
        if (totalCobrar > 0) {
            allSelectedItems.forEach(({ item, itemTotal }) => {
                const porcentaje = (itemTotal / totalCobrar) * 100;
                item.partePorcientoTotalSuma = parseFloat(porcentaje);
                // Cuando estamos creando la consulta, inicializamos exedente_redondeo en 0
                // En modo 'editar' o 'ver' este valor debería venir cargado desde las ventas
                if (mode === 'crear') {
                    item.exedente_redondeo = ((parseFloat(porcentaje) / 100) * exedenteRoundedRef.current) || 0;
                }
            });
        }

        const finalTotalCobrar = isNaN(totalCobrar) ? 0 : totalCobrar;
        const finalTotalProfit = isNaN(totalProfit) ? 0 : Math.max(0, totalProfit);

        // Calcular total con descuento y actualizar el ref de totales originales (sin setState)
        const descuentoPaciente = (
            consultaParam?.paciente?.descuento ??
            consultaParam?.descuento ??
            pacienteParam?.descuento ??
            pacienteData?.descuento ??
            0
        );
        const parsedDescuento = parseFloat(descuentoPaciente) || 0;
        const totalConDescuento = finalTotalCobrar - (finalTotalCobrar * (parsedDescuento / 100));

        try {
            const prev = originalTotalsRef.current || { totalCobrar: 0, totalConDescuento: 0, version: 0 };
            if (prev.totalCobrar !== finalTotalCobrar || prev.totalConDescuento !== totalConDescuento) {
                originalTotalsRef.current = { totalCobrar: finalTotalCobrar, totalConDescuento, version: (prev.version || 0) + 1 };
            } else {
                // preserve version
                originalTotalsRef.current = { ...prev, totalCobrar: finalTotalCobrar, totalConDescuento };
            }
        } catch (e) {
            // no-op
        }

        return {
            totalCobrar: finalTotalCobrar,
            totalProfit: finalTotalProfit
        };
    };

    const handleSave = async () => {
        // Validaciones antes de guardar: fecha, motivo, anamnesis y al menos un usuario
        if (!consultaData.fecha || !String(consultaData.fecha).trim()) {
            ToastAndroid.show('La fecha es requerida', ToastAndroid.SHORT);
            if (positionsRef.current.fecha && scrollRef.current) scrollRef.current.scrollTo({ y: Math.max(positionsRef.current.fecha - 10, 0), animated: true });
            return;
        }

        if (!consultaData.motivo || !String(consultaData.motivo).trim()) {
            ToastAndroid.show('El motivo de la visita es requerido', ToastAndroid.SHORT);
            if (positionsRef.current.motivo && scrollRef.current) scrollRef.current.scrollTo({ y: Math.max(positionsRef.current.motivo - 10, 0), animated: true });
            return;
        }

        if (!consultaData.anamnesis || !String(consultaData.anamnesis).trim()) {
            ToastAndroid.show('La anamnesis es requerida', ToastAndroid.SHORT);
            if (positionsRef.current.anamnesis && scrollRef.current) scrollRef.current.scrollTo({ y: Math.max(positionsRef.current.anamnesis - 10, 0), animated: true });
            return;
        }

        // al menos un usuario asignado
        let usuariosSeleccionados = [];
        try {
            if (usuariosListRef.current && typeof usuariosListRef.current.getItems === 'function') {
                usuariosSeleccionados = usuariosListRef.current.getItems() || [];
            }
        } catch (err) { usuariosSeleccionados = []; }

        if (!usuariosSeleccionados || usuariosSeleccionados.length === 0) {
            ToastAndroid.show('Debe asignar al menos un usuario', ToastAndroid.SHORT);
            if (positionsRef.current.usuarios && scrollRef.current) scrollRef.current.scrollTo({ y: Math.max(positionsRef.current.usuarios - 10, 0), animated: true });
            return;
        }

        // Llamar a la función específica según el modo
        if (mode === 'editar') {
            await handleUpdate();
        } else {
            await handleCreate();
        }
    };

    // Función que valida ventas de medicamentos usando /venta/validate
    const validateMedicamentos = async (cfgHost, cfgToken, usuariosIds) => {
        try {
            const meds = (medicamentosListRef.current && typeof medicamentosListRef.current.getItems === 'function')
                ? (medicamentosListRef.current.getItems() || [])
                : [];

            if (!meds || meds.length === 0) return { ok: true };

            setValidationVisible(true);
            setValidationProgress(0);
            setValidationTitle('Validando medicamentos...');

            const total = meds.length;
            let done = 0;

            for (let i = 0; i < meds.length; i++) {
                const entry = meds[i];
                // entry.selected holds the medicamento object as from API
                const sel = entry.selected || {};
                const producto = sel.producto || {};
                const comerciable = producto.comerciable || {};

                const body = {
                    fecha: new Date(consultaData.fecha).toISOString(),
                    precio_original_comerciable_cup: parseFloat(comerciable.precio_cup || 0) || 0,
                    precio_original_comerciable_usd: parseFloat(comerciable.precio_usd || 0) || 0,
                    costo_producto_cup: parseFloat(producto.costo_cup || 0) || 0,
                    cantidad: parseFloat(entry.cantidad || 0) || 0,
                    precio_cobrado_cup: parseFloat(entry.precio_cup || 0) || 0,
                    forma_pago: (paymentType === 'efectivo') ? 'Efectivo' : 'Transferencia',
                    id_comerciable: parseInt(comerciable.id_comerciable || comerciable.id || 0, 10) || 0,
                    id_usuario: usuariosIds || [],
                };

                setValidationTitle(`Validando medicamentos`);

                const url = `${cfgHost.replace(/\/+$/, '')}/venta/validate`;
                const headers = { 'Content-Type': 'application/json' };
                if (cfgToken) headers['Authorization'] = `Bearer ${cfgToken}`;

                const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
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
                    setValidationVisible(false);
                    return { ok: false, error: errorMessage };
                }

                // Avanzar progreso
                done++;
                const pct = Math.round((done / total) * 90); // reservamos últimos 10% para creación
                setValidationProgress(pct);
            }

            // Si llegamos aquí, validaciones de medicamentos pasaron
            setValidationProgress(95);
            setValidationTitle('Validación de medicamentos completada');
            return { ok: true };
        } catch (err) {
            console.error('Error en validateMedicamentos:', err);
            Alert.alert('Error', err.message || 'Error desconocido');
            setValidationVisible(false);
            return { ok: false, error: err.message };
        }
    };

    // Función que valida ventas de servicios usando /venta/validate
    const validateServicios = async (cfgHost, cfgToken, usuariosIds) => {
        try {
            const servicios = (serviciosListRef.current && typeof serviciosListRef.current.getItems === 'function')
                ? (serviciosListRef.current.getItems() || [])
                : [];

            if (!servicios || servicios.length === 0) return { ok: true };

            // Mostrar modal si no estaba visible
            setValidationVisible(true);
            // Empezar desde el progreso actual o desde 95 si es 0
            const base = Math.max(validationProgress, 95);
            setValidationProgress(base);
            setValidationTitle('Validando servicios...');

            const total = servicios.length;
            let done = 0;

            for (let i = 0; i < servicios.length; i++) {
                const entry = servicios[i];
                const sel = entry.selected || entry || {};
                const comerciable = sel.comerciable || {};

                const body = {
                    fecha: new Date(consultaData.fecha).toISOString(),
                    precio_original_comerciable_cup: parseFloat(comerciable.precio_cup || 0) || 0,
                    precio_original_comerciable_usd: parseFloat(comerciable.precio_usd || 0) || 0,
                    costo_producto_cup: 0,
                    cantidad: parseFloat(entry.cantidad || 0) || 0,
                    precio_cobrado_cup: parseFloat(entry.precio_cup || 0) || 0,
                    forma_pago: (paymentType === 'efectivo') ? 'Efectivo' : 'Transferencia',
                    id_comerciable: parseInt(comerciable.id_comerciable || comerciable.id || 0, 10) || 0,
                    id_usuario: usuariosIds || [],
                };

                setValidationTitle(`Validando servicios`);

                const url = `${cfgHost.replace(/\/+$/, '')}/venta/validate`;
                const headers = { 'Content-Type': 'application/json' };
                if (cfgToken) headers['Authorization'] = `Bearer ${cfgToken}`;

                const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
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
                    setValidationVisible(false);
                    return { ok: false, error: errorMessage };
                }

                // Avanzar progreso: reservamos entre base..(base+4) por servicios
                done++;
                const pct = base + Math.round((done / total) * 4);
                setValidationProgress(pct);
            }

            // Si llegamos aquí, validaciones de servicios pasaron
            setValidationProgress(99);
            setValidationTitle('Validación de servicios completada');
            return { ok: true };
        } catch (err) {
            console.error('Error en validateServicios:', err);
            Alert.alert('Error', err.message || 'Error desconocido');
            setValidationVisible(false);
            return { ok: false, error: err.message };
        }
    };

    // Función que valida ventas de productos usando /venta/validate
    const validateProductos = async (cfgHost, cfgToken, usuariosIds) => {
        try {
            const productos = (productosListRef.current && typeof productosListRef.current.getItems === 'function')
                ? (productosListRef.current.getItems() || [])
                : [];

            if (!productos || productos.length === 0) return { ok: true };

            setValidationVisible(true);
            // Empezar desde el progreso actual o desde 99 si es 0
            const base = Math.max(validationProgress, 99);
            setValidationProgress(base);
            setValidationTitle('Validando productos...');

            const total = productos.length;
            let done = 0;

            for (let i = 0; i < productos.length; i++) {
                const entry = productos[i];
                const sel = entry.selected || entry || {};
                const producto = sel.producto || sel || {};
                const comerciable = producto.comerciable || sel.comerciable || {};

                const body = {
                    fecha: new Date(consultaData.fecha).toISOString(),
                    precio_original_comerciable_cup: parseFloat(comerciable.precio_cup || 0) || 0,
                    precio_original_comerciable_usd: parseFloat(comerciable.precio_usd || 0) || 0,
                    costo_producto_cup: parseFloat(producto.costo_cup || producto.costo_producto_cup || 0) || 0,
                    cantidad: parseFloat(entry.cantidad || 0) || 0,
                    precio_cobrado_cup: parseFloat(entry.precio_cup || 0) || 0,
                    forma_pago: (paymentType === 'efectivo') ? 'Efectivo' : 'Transferencia',
                    id_comerciable: parseInt(comerciable.id_comerciable || comerciable.id || 0, 10) || 0,
                    id_usuario: usuariosIds || [],
                };

                setValidationTitle(`Validando productos`);

                const url = `${cfgHost.replace(/\/+$/, '')}/venta/validate`;
                const headers = { 'Content-Type': 'application/json' };
                if (cfgToken) headers['Authorization'] = `Bearer ${cfgToken}`;

                const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
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
                    setValidationVisible(false);
                    return { ok: false, error: errorMessage };
                }

                // Avanzar progreso: añadir 1% por producto dentro del tramo final
                done++;
                const pct = base + Math.round((done / total) * 1);
                setValidationProgress(pct);
            }

            setValidationProgress(100);
            setValidationTitle('Validación de productos completada');
            return { ok: true };
        } catch (err) {
            console.error('Error en validateProductos:', err);
            Alert.alert('Error', err.message || 'Error desconocido');
            setValidationVisible(false);
            return { ok: false, error: err.message };
        }
    };

    // Función que valida ventas de vacunas usando /venta/validate (igual a medicamentos)
    const validateVacunas = async (cfgHost, cfgToken, usuariosIds) => {
        try {
            const items = (vacunasListRef.current && typeof vacunasListRef.current.getItems === 'function')
                ? (vacunasListRef.current.getItems() || [])
                : [];

            if (!items || items.length === 0) return { ok: true };

            setValidationVisible(true);
            setValidationProgress(0);
            setValidationTitle('Validando vacunas...');

            const total = items.length;
            let done = 0;

            for (let i = 0; i < items.length; i++) {
                const entry = items[i];
                const sel = entry.selected || {};
                const producto = sel.producto || {};
                const comerciable = producto.comerciable || {};

                const body = {
                    fecha: new Date(consultaData.fecha).toISOString(),
                    precio_original_comerciable_cup: parseFloat(comerciable.precio_cup || 0) || 0,
                    precio_original_comerciable_usd: parseFloat(comerciable.precio_usd || 0) || 0,
                    costo_producto_cup: parseFloat(producto.costo_cup || 0) || 0,
                    cantidad: parseFloat(entry.cantidad || 0) || 0,
                    precio_cobrado_cup: parseFloat(entry.precio_cup || 0) || 0,
                    forma_pago: (paymentType === 'efectivo') ? 'Efectivo' : 'Transferencia',
                    id_comerciable: parseInt(comerciable.id_comerciable || comerciable.id || 0, 10) || 0,
                    id_usuario: usuariosIds || [],
                };

                setValidationTitle(`Validando vacunas`);

                const url = `${cfgHost.replace(/\/+$/, '')}/venta/validate`;
                const headers = { 'Content-Type': 'application/json' };
                if (cfgToken) headers['Authorization'] = `Bearer ${cfgToken}`;

                const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
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
                    setValidationVisible(false);
                    return { ok: false, error: errorMessage };
                }

                done++;
                const pct = Math.round((done / total) * 90);
                setValidationProgress(pct);
            }

            setValidationProgress(95);
            setValidationTitle('Validación de vacunas completada');
            return { ok: true };
        } catch (err) {
            console.error('Error en validateVacunas:', err);
            Alert.alert('Error', err.message || 'Error desconocido');
            setValidationVisible(false);
            return { ok: false, error: err.message };
        }
    };

    // Función que valida ventas de antiparasitarios usando /venta/validate (igual a medicamentos)
    const validateAntiparasitarios = async (cfgHost, cfgToken, usuariosIds) => {
        try {
            const items = (antiparasitariosListRef.current && typeof antiparasitariosListRef.current.getItems === 'function')
                ? (antiparasitariosListRef.current.getItems() || [])
                : [];

            if (!items || items.length === 0) return { ok: true };

            setValidationVisible(true);
            setValidationProgress(0);
            setValidationTitle('Validando antiparasitarios...');

            const total = items.length;
            let done = 0;

            for (let i = 0; i < items.length; i++) {
                const entry = items[i];
                const sel = entry.selected || {};
                const producto = sel.producto || {};
                const comerciable = producto.comerciable || {};

                const body = {
                    fecha: new Date(consultaData.fecha).toISOString(),
                    precio_original_comerciable_cup: parseFloat(comerciable.precio_cup || 0) || 0,
                    precio_original_comerciable_usd: parseFloat(comerciable.precio_usd || 0) || 0,
                    costo_producto_cup: parseFloat(producto.costo_cup || 0) || 0,
                    cantidad: parseFloat(entry.cantidad || 0) || 0,
                    precio_cobrado_cup: parseFloat(entry.precio_cup || 0) || 0,
                    forma_pago: (paymentType === 'efectivo') ? 'Efectivo' : 'Transferencia',
                    id_comerciable: parseInt(comerciable.id_comerciable || comerciable.id || 0, 10) || 0,
                    id_usuario: usuariosIds || [],
                };

                setValidationTitle(`Validando antiparasitarios`);

                const url = `${cfgHost.replace(/\/+$/, '')}/venta/validate`;
                const headers = { 'Content-Type': 'application/json' };
                if (cfgToken) headers['Authorization'] = `Bearer ${cfgToken}`;

                const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
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
                    setValidationVisible(false);
                    return { ok: false, error: errorMessage };
                }

                done++;
                const pct = Math.round((done / total) * 90);
                setValidationProgress(pct);
            }

            setValidationProgress(95);
            setValidationTitle('Validación de antiparasitarios completada');
            return { ok: true };
        } catch (err) {
            console.error('Error en validateAntiparasitarios:', err);
            Alert.alert('Error', err.message || 'Error desconocido');
            setValidationVisible(false);
            return { ok: false, error: err.message };
        }
    };

    // Función auxiliar para crear ventas de una lista específica
    const createVentasForList = async (cfgHost, cfgToken, id_consulta, itemsList, tipo, usuariosIds) => {
        if (!itemsList || itemsList.length === 0) return { ok: true, count: 0 };

        setValidationTitle(`Creando ventas de ${tipo}...`);
        const total = itemsList.length;
        let done = 0;

        for (let i = 0; i < itemsList.length; i++) {
            const entry = itemsList[i];
            const sel = entry.selected || {};

            // Construir el payload según el tipo de venta
            let body;
            let precioAux = 0;

            const { totalCobrar, totalProfit } = calculateTotals();

            //console.log("Supuesta cantidad del usuario: ",userTotals.totalCobrar);
            //console.log("Total original: ",totalCobrar);
            //console.log(`Resultado de esta venta referente ${entry.partePorcientoTotalSuma}% :`, (((entry.partePorcientoTotalSuma) * (userTotals.totalCobrar)) / 100) / (entry.cantidad));
            //parseFloat(entry.precio_cup || 0) || 0

            if (userTotals.totalCobrar === null) {
                precioAux = parseFloat(entry.precio_cup || 0) || 0;
            } else {
                precioAux = ((entry.partePorcientoTotalSuma * userTotals.totalCobrar) / 100) / (entry.cantidad || 1);
            }

            if (tipo === 'servicios') {
                // Para servicios
                const comerciable = sel.comerciable || {};

                body = {
                    fecha: new Date(consultaData.fecha).toISOString(),
                    precio_original_comerciable_cup: parseFloat(comerciable.precio_cup || 0) || 0,
                    precio_original_comerciable_usd: parseFloat(comerciable.precio_usd || 0) || 0,
                    costo_producto_cup: 0, // Los servicios no tienen costo de producto
                    cantidad: parseFloat(entry.cantidad || 0) || 0,
                    nota: entry.nota_list || "",
                    exedente_redondeo: entry.exedente_redondeo || 0,
                    descuento: pacienteParam.descuento || 0,
                    precio_cobrado_cup: precioAux,
                    forma_pago: (paymentType === 'efectivo') ? 'Efectivo' : 'Transferencia',
                    id_consulta: id_consulta,
                    id_comerciable: parseInt(comerciable.id_comerciable || comerciable.id || 0, 10) || 0,
                    id_usuario: usuariosIds || [],
                };
            } else if (tipo === 'productos') {
                // Para productos
                const producto = sel.producto || sel || {};
                const comerciable = producto.comerciable || sel.comerciable || {};

                body = {
                    fecha: new Date(consultaData.fecha).toISOString(),
                    precio_original_comerciable_cup: parseFloat(comerciable.precio_cup || 0) || 0,
                    precio_original_comerciable_usd: parseFloat(comerciable.precio_usd || 0) || 0,
                    costo_producto_cup: parseFloat(producto.costo_cup || producto.costo_producto_cup || 0) || 0,
                    cantidad: parseFloat(entry.cantidad || 0) || 0,
                    nota: entry.nota_list || "",
                    exedente_redondeo: entry.exedente_redondeo || 0,
                    descuento: pacienteParam.descuento || 0,
                    precio_cobrado_cup: precioAux,
                    forma_pago: (paymentType === 'efectivo') ? 'Efectivo' : 'Transferencia',
                    id_consulta: id_consulta,
                    id_comerciable: parseInt(comerciable.id_comerciable || comerciable.id || 0, 10) || 0,
                    id_usuario: usuariosIds || [],
                };
            } else {
                // Para medicamentos, vacunas y antiparasitarios
                const producto = sel.producto || {};
                const comerciable = producto.comerciable || {};

                body = {
                    fecha: new Date(consultaData.fecha).toISOString(),
                    precio_original_comerciable_cup: parseFloat(comerciable.precio_cup || 0) || 0,
                    precio_original_comerciable_usd: parseFloat(comerciable.precio_usd || 0) || 0,
                    costo_producto_cup: parseFloat(producto.costo_cup || 0) || 0,
                    cantidad: parseFloat(entry.cantidad || 0) || 0,
                    nota: entry.nota_list || "",
                    exedente_redondeo: entry.exedente_redondeo || 0,
                    descuento: pacienteParam.descuento || 0,
                    precio_cobrado_cup: precioAux,
                    forma_pago: (paymentType === 'efectivo') ? 'Efectivo' : 'Transferencia',
                    id_consulta: id_consulta,
                    id_comerciable: parseInt(comerciable.id_comerciable || comerciable.id || 0, 10) || 0,
                    id_usuario: usuariosIds || [],
                };
            }

            setValidationTitle(`Creando venta ${i + 1} de ${tipo}...`);
            setVentasCreated(prev => prev + 1);

            const url = `${cfgHost.replace(/\/+$/, '')}/venta/create`;
            const headers = { 'Content-Type': 'application/json' };
            if (cfgToken) headers['Authorization'] = `Bearer ${cfgToken}`;

            const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
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

                Alert.alert(`Error ${res.status} al crear venta de ${tipo}`, errorMessage);
                return { ok: false, error: errorMessage };
            }

            // Avanzar progreso
            done++;
            const pct = 96 + Math.round((done / total) * 4); // Distribuimos el 4% restante para esta lista
            setValidationProgress(pct);
        }

        return { ok: true, count: total };
    };

    // Crear consulta (usa validaciones) y luego crear las ventas
    const handleCreate = async () => {
        setLoading(true);
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

            // Obtener ids de usuarios seleccionados
            let usuariosSeleccionados = [];
            try {
                if (usuariosListRef.current && typeof usuariosListRef.current.getItems === 'function') {
                    usuariosSeleccionados = usuariosListRef.current.getItems() || [];
                }
            } catch (err) { usuariosSeleccionados = []; }
            const usuariosIds = usuariosSeleccionados.map(u => u.id_usuario || u.id).filter(Boolean);

            // Primero validar Medicamentos
            const vm = await validateMedicamentos(host, token, usuariosIds);
            if (!vm.ok) return;

            // Validar Servicios
            const vs = await validateServicios(host, token, usuariosIds);
            if (!vs.ok) return;

            // Validar Productos
            const vp = await validateProductos(host, token, usuariosIds);
            if (!vp.ok) return;

            // Validar Vacunas
            const vv = await validateVacunas(host, token, usuariosIds);
            if (!vv.ok) return;

            // Validar Antiparasitarios
            const va = await validateAntiparasitarios(host, token, usuariosIds);
            if (!va.ok) return;

            // Crear la consulta en el backend
            setValidationTitle('Creando consulta...');
            setValidationProgress(96);

            // Preparar el array de fotos para el payload
            const fotosPayload = fotos.map(foto => ({
                imagen: foto.base64,
                nota: foto.nota || ''
            }));

            const payload = {
                fecha: new Date(consultaData.fecha).toISOString(),
                motivo: consultaData.motivo,
                diagnostico: consultaData.diagnostico,
                anamnesis: consultaData.anamnesis,
                tratamiento: consultaData.tratamiento,
                patologia: consultaData.patologia,
                id_paciente: consultaData.id_paciente || pacienteParam?.id_paciente || pacienteParam?.id || null,
                id_usuario: cfg.usuario?.id_usuario || cfg.usuario?.id || null,
                fotos: fotosPayload,
            };

            try {
                const urlCreate = `${host.replace(/\/+$/, '')}/consulta/CreateWithPhotos`;
                const headersCreate = { 'Content-Type': 'application/json' };
                if (token) headersCreate['Authorization'] = `Bearer ${token}`;

                const resCreate = await fetch(urlCreate, { method: 'POST', headers: headersCreate, body: JSON.stringify(payload) });
                let responseCreateData = null;
                try { responseCreateData = await resCreate.json(); } catch (e) { responseCreateData = null; }

                if (!resCreate.ok) {
                    let errorMessage = 'Error desconocido';
                    if (responseCreateData && responseCreateData.errors && Array.isArray(responseCreateData.errors)) {
                        errorMessage = responseCreateData.errors.join('\n• ');
                    } else if (responseCreateData && typeof responseCreateData.error === 'string') {
                        errorMessage = responseCreateData.error;
                    } else if (responseCreateData && (responseCreateData.message || responseCreateData.description)) {
                        errorMessage = responseCreateData.message || responseCreateData.description;
                    } else if (responseCreateData) {
                        errorMessage = JSON.stringify(responseCreateData);
                    }
                    Alert.alert(`Error ${resCreate.status}`, errorMessage);
                    setValidationVisible(false);
                    return;
                }

                // Obtener el ID de la consulta creada
                let idConsultaCreada = null;
                if (responseCreateData && responseCreateData.data && responseCreateData.data.id_consulta) {
                    idConsultaCreada = responseCreateData.data.id_consulta;
                } else if (responseCreateData && responseCreateData.id_consulta) {
                    idConsultaCreada = responseCreateData.id_consulta;
                } else if (responseCreateData && responseCreateData.consulta && responseCreateData.consulta.id_consulta) {
                    idConsultaCreada = responseCreateData.consulta.id_consulta;
                }

                if (!idConsultaCreada) {
                    Alert.alert('Error', 'No se pudo obtener el ID de la consulta creada');
                    setValidationVisible(false);
                    return;
                }

                // Ahora crear las ventas para todas las listas
                setValidationProgress(96);

                // Obtener los items de cada lista
                const medicamentosItems = (medicamentosListRef.current && typeof medicamentosListRef.current.getItems === 'function')
                    ? (medicamentosListRef.current.getItems() || [])
                    : [];
                const vacunasItems = (vacunasListRef.current && typeof vacunasListRef.current.getItems === 'function')
                    ? (vacunasListRef.current.getItems() || [])
                    : [];
                const antiparasitariosItems = (antiparasitariosListRef.current && typeof antiparasitariosListRef.current.getItems === 'function')
                    ? (antiparasitariosListRef.current.getItems() || [])
                    : [];
                const serviciosItems = (serviciosListRef.current && typeof serviciosListRef.current.getItems === 'function')
                    ? (serviciosListRef.current.getItems() || [])
                    : [];
                const productosItems = (productosListRef.current && typeof productosListRef.current.getItems === 'function')
                    ? (productosListRef.current.getItems() || [])
                    : [];

                // Filtrar solo los items que tienen un producto/comerciable seleccionado
                const medicamentosFiltrados = medicamentosItems.filter(item => item.selected);
                const vacunasFiltradas = vacunasItems.filter(item => item.selected);
                const antiparasitariosFiltrados = antiparasitariosItems.filter(item => item.selected);
                const serviciosFiltrados = serviciosItems.filter(item => item.selected);
                const productosFiltrados = productosItems.filter(item => item.selected);

                // Calcular el total de ventas a crear
                const totalVentas = medicamentosFiltrados.length + vacunasFiltradas.length + antiparasitariosFiltrados.length +
                    serviciosFiltrados.length + productosFiltrados.length;
                setTotalVentasToCreate(totalVentas);
                setVentasCreated(0);

                if (totalVentas > 0) {
                    // Crear ventas de medicamentos
                    if (medicamentosFiltrados.length > 0) {
                        const resultMed = await createVentasForList(host, token, idConsultaCreada, medicamentosFiltrados, 'medicamentos', usuariosIds);
                        if (!resultMed.ok) {
                            // Error ya fue manejado dentro de la función
                            setValidationVisible(false);
                            return;
                        }
                    }

                    // Crear ventas de vacunas
                    if (vacunasFiltradas.length > 0) {
                        const resultVac = await createVentasForList(host, token, idConsultaCreada, vacunasFiltradas, 'vacunas', usuariosIds);
                        if (!resultVac.ok) {
                            setValidationVisible(false);
                            return;
                        }
                    }

                    // Crear ventas de antiparasitarios
                    if (antiparasitariosFiltrados.length > 0) {
                        const resultAnti = await createVentasForList(host, token, idConsultaCreada, antiparasitariosFiltrados, 'antiparasitarios', usuariosIds);
                        if (!resultAnti.ok) {
                            setValidationVisible(false);
                            return;
                        }
                    }

                    // Crear ventas de servicios
                    if (serviciosFiltrados.length > 0) {
                        const resultServ = await createVentasForList(host, token, idConsultaCreada, serviciosFiltrados, 'servicios', usuariosIds);
                        if (!resultServ.ok) {
                            setValidationVisible(false);
                            return;
                        }
                    }

                    // Crear ventas de productos
                    if (productosFiltrados.length > 0) {
                        const resultProd = await createVentasForList(host, token, idConsultaCreada, productosFiltrados, 'productos', usuariosIds);
                        if (!resultProd.ok) {
                            setValidationVisible(false);
                            return;
                        }
                    }
                }

                setValidationProgress(100);
                setValidationTitle('Consulta y ventas creadas correctamente');

                setTimeout(() => {
                    setValidationVisible(false);
                    ToastAndroid.show('Consulta creada con éxito', ToastAndroid.LONG);

                    // Redirigir o cerrar el modal
                    router.back();
                }, 800);

            } catch (errCreate) {
                console.error('Error creando consulta o ventas:', errCreate);
                Alert.alert('Error', errCreate.message || 'Error desconocido al crear consulta o ventas');
                setValidationVisible(false);
                return;
            }
        } catch (err) {
            console.error('Error en handleCreate:', err);
            Alert.alert('Error', err.message || 'Error desconocido');
            setValidationVisible(false);
        } finally {
            setLoading(false);
        }
    };

    // Actualizar consulta (similar a create pero sin validaciones de ventas)
    const handleUpdate = async () => {
        setLoading(true);
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

            // Obtener ids de usuarios seleccionados (si aplica)
            let usuariosSeleccionados = [];
            try {
                if (usuariosListRef.current && typeof usuariosListRef.current.getItems === 'function') {
                    usuariosSeleccionados = usuariosListRef.current.getItems() || [];
                }
            } catch (err) { usuariosSeleccionados = []; }
            const usuariosIds = usuariosSeleccionados.map(u => u.id_usuario || u.id).filter(Boolean);

            // Preparar el array de fotos para el payload (base64)
            const fotosPayload = fotos.map(foto => ({
                imagen: foto.base64,
                nota: foto.nota || ''
            }));

            // Recolectar items de todas las listas (solo los seleccionados)
            const medicamentosItems = (medicamentosListRef.current && typeof medicamentosListRef.current.getItems === 'function')
                ? (medicamentosListRef.current.getItems() || [])
                : [];
            const vacunasItems = (vacunasListRef.current && typeof vacunasListRef.current.getItems === 'function')
                ? (vacunasListRef.current.getItems() || [])
                : [];
            const antiparasitariosItems = (antiparasitariosListRef.current && typeof antiparasitariosListRef.current.getItems === 'function')
                ? (antiparasitariosListRef.current.getItems() || [])
                : [];
            const serviciosItems = (serviciosListRef.current && typeof serviciosListRef.current.getItems === 'function')
                ? (serviciosListRef.current.getItems() || [])
                : [];
            const productosItems = (productosListRef.current && typeof productosListRef.current.getItems === 'function')
                ? (productosListRef.current.getItems() || [])
                : [];

            // Construir array "ventas" a enviar en el body
            const ventas = [];

            const buildVentaFromEntry = (entry, tipo) => {
                const sel = entry.selected || {};
                let producto = sel.producto || sel || {};

                // Construir el payload según el tipo de venta
                let precioAux = 0;

                //console.log("Supuesta cantidad del usuario: ",userTotals.totalCobrar);
                //console.log("Total original: ",totalCobrar);
                //console.log(`Resultado de esta venta referente ${entry.partePorcientoTotalSuma}% :`, (((entry.partePorcientoTotalSuma) * (userTotals.totalCobrar)) / 100) / (entry.cantidad));
                //parseFloat(entry.precio_cup || 0) || 0

                if (userTotals.totalCobrar === null) {
                    precioAux = parseFloat(entry.precio_cup || 0) || 0;
                } else {
                    precioAux = ((entry.partePorcientoTotalSuma * userTotals.totalCobrar) / 100) / (entry.cantidad || 1);
                }
                return {
                    fecha: entry.fecha || new Date(consultaData.fecha).toISOString(),
                    id_venta: entry.id_venta || null,
                    precio_original_comerciable_cup: parseFloat(entry.precio_original_cup || entry.precio_original_comerciable_cup) || 0,
                    precio_original_comerciable_usd: parseFloat(entry.precio_original_usd || entry.precio_original_comerciable_usd) || 0,
                    costo_producto_cup: entry.costo_producto_cup,
                    cantidad: parseFloat(entry.cantidad || 0) || 0,
                    nota: entry.nota_list || "",
                    exedente_redondeo: entry.exedente_redondeo || 0,
                    descuento: pacienteParam?.descuento || 0,
                    precio_cobrado_cup: precioAux,
                    forma_pago: (paymentType === 'efectivo') ? 'Efectivo' : 'Transferencia',
                    id_comerciable: parseInt(entry.selected?.producto?.id_comerciable || entry.selected?.id_comerciable || 0, 10) || 0,
                    id_usuario: usuariosIds || [],
                };
            };

            medicamentosItems.forEach(e => ventas.push(buildVentaFromEntry(e, 'medicamentos')));
            vacunasItems.forEach(e => ventas.push(buildVentaFromEntry(e, 'vacunas')));
            antiparasitariosItems.forEach(e => ventas.push(buildVentaFromEntry(e, 'antiparasitarios')));
            serviciosItems.forEach(e => ventas.push(buildVentaFromEntry(e, 'servicios')));
            productosItems.forEach(e => ventas.push(buildVentaFromEntry(e, 'productos')));

            // Preparar payload completo para UpdateWithPhotosVentas
            const payload = {
                fecha: new Date(consultaData.fecha).toISOString(),
                motivo: consultaData.motivo,
                diagnostico: consultaData.diagnostico,
                anamnesis: consultaData.anamnesis,
                tratamiento: consultaData.tratamiento,
                patologia: consultaData.patologia,
                id_paciente: consultaData.id_paciente || pacienteParam?.id_paciente || pacienteParam?.id || null,
                id_usuario: cfg.usuario?.id_usuario || cfg.usuario?.id || null,
                ventas: ventas,
            };

            //fotos: fotosPayload,

            // Mostrar modal de progreso mínimo
            setValidationVisible(true);
            setValidationProgress(96);
            setValidationTitle('Preparando actualización...');

            // Construir url
            const urlUpdate = `${host.replace(/\/+$/, '')}/consulta/UpdateWithPhotosVentas/${consultaData.id_consulta || consultaParam?.id_consulta || consultaParam?.id}`;

            // Por ahora commented out la llamada a la API — sólo logs para pruebas
            // Excluir las imágenes (base64) del log por privacidad/volumen
            const payloadForLog = { ...payload };
            if (Array.isArray(payloadForLog.fotos)) {
                payloadForLog.fotos = payloadForLog.fotos.map(f => ({ nota: f.nota || '' }));
            }

            // Ejemplo de la llamada (dejada comentada según petición)
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(urlUpdate, { method: 'PUT', headers, body: JSON.stringify(payload) });
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
                setValidationVisible(false);
                return;
            }

            setValidationProgress(100);
            setValidationTitle('Payload preparado — ver consola');

            setTimeout(() => {
                setValidationVisible(false);
                ToastAndroid.show('Payload preparado — ver consola', ToastAndroid.LONG);
                // No hacer router.back() automáticamente para que el usuario pruebe la consola
            }, 800);

        } catch (err) {
            console.error('Error en handleUpdate:', err);
            Alert.alert('Error', err.message || 'Error desconocido');
            setValidationVisible(false);
        } finally {
            setLoading(false);
        }
    };

    // Función para obtener el tiempo de grabación según el campo
    const getRecordingTime = (field) => {
        switch (field) {
            case 'anamnesis':
                return formatTime(recordingTimeAnamnesis);
            case 'diagnostico':
                return formatTime(recordingTimeDiagnostico);
            case 'tratamiento':
                return formatTime(recordingTimeTratamiento);
            case 'patologia':
                return formatTime(recordingTimePatologia);
            default:
                return '00:00';
        }
    };

    // Función para verificar si está grabando según el campo
    const isRecordingField = (field) => {
        switch (field) {
            case 'anamnesis':
                return isRecordingAnamnesis;
            case 'diagnostico':
                return isRecordingDiagnostico;
            case 'tratamiento':
                return isRecordingTratamiento;
            case 'patologia':
                return isRecordingPatologia;
            default:
                return false;
        }
    };

    // Función para verificar si está procesando según el campo
    const isProcessingField = (field) => {
        switch (field) {
            case 'anamnesis':
                return isProcessingAudioAnamnesis;
            case 'diagnostico':
                return isProcessingAudioDiagnostico;
            case 'tratamiento':
                return isProcessingAudioTratamiento;
            case 'patologia':
                return isProcessingAudioPatologia;
            default:
                return false;
        }
    };

    // Componente de botón de grabación reutilizable
    const AudioRecordButton = ({ field, label }) => {
        const isRecording = isRecordingField(field);
        const isProcessing = isProcessingField(field);
        const recordingTime = getRecordingTime(field);

        return (
            <View style={styles.audioButtonContainer}>
                {isProcessing ? (
                    <View style={styles.audioProcessingSmall}>
                        <TouchableOpacity
                            style={[styles.audioButtonSmall, styles.processingButton]}
                            disabled={true}
                        >
                            <ActivityIndicator size="small" color={Colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.audioProcessingTextSmall}>Procesando...</Text>
                    </View>
                ) : isRecording ? (
                    <View style={styles.recordingActiveContainerSmall}>
                        <TouchableOpacity
                            style={[styles.audioButtonSmall, styles.recordingButton]}
                            onPress={() => stopRecording(field)}
                        >
                            <Image
                                source={require('../assets/images/mic-on.png')}
                                style={styles.micIcon}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                        <Text style={styles.recordingTimerSmall}>{recordingTime}</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.audioButtonSmall, styles.idleButton]}
                        onPress={() => startRecording(field)}
                        disabled={!isEditable}
                    >
                        <Image
                            source={require('../assets/images/mic-off.png')}
                            style={styles.micIcon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                )}
                <Text style={styles.audioButtonLabel}>{label}</Text>
            </View>
        );
    };

    // Modal para vista completa de imagen
    const FullscreenImageModal = () => {
        if (!imagenFullscreen) return null;

        return (
            <Modal visible={!!imagenFullscreen} transparent animationType="fade">
                <View style={styles.fullscreenOverlay}>
                    <View style={styles.fullscreenHeader}>
                        <TouchableOpacity
                            style={styles.fullscreenCloseButton}
                            onPress={() => setImagenFullscreen(null)}
                        >
                            <Text style={styles.fullscreenCloseText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        contentContainerStyle={styles.fullscreenScrollContent}
                        maximumZoomScale={3}
                        minimumZoomScale={1}
                    >
                        <Image
                            source={{ uri: imagenFullscreen }}
                            style={styles.fullscreenImage}
                            resizeMode="contain"
                        />
                    </ScrollView>
                </View>
            </Modal>
        );
    };

    // List components removed

    // Modal para editar totales (abre desde la sección Resumen de Totales)
    const TotalsEditModal = () => {
        const descuentoPaciente = (
            consultaParam?.paciente?.descuento ??
            consultaParam?.descuento ??
            pacienteParam?.descuento ??
            pacienteData?.descuento ??
            0
        );
        const parsedDescuento = parseFloat(descuentoPaciente) || 0;

        const [localTotalCobrar, setLocalTotalCobrar] = useState('');
        const [localTotalConDescuento, setLocalTotalConDescuento] = useState('');
        const [selectionCobrar, setSelectionCobrar] = useState(null);
        const [selectionCon, setSelectionCon] = useState(null);
        // Nuevo: delta input y selección para el nuevo modal
        const [localDelta, setLocalDelta] = useState('0.00');

        useEffect(() => {
            if (!totalsModalVisible) return;
            const orig = originalTotalsRef.current || { totalCobrar: 0, totalConDescuento: 0, version: 0 };
            const useUser = (userTotals.version === orig.version) && (userTotals.totalCobrar !== null);
            const initCobrar = useUser ? userTotals.totalCobrar : orig.totalCobrar;
            const initCon = useUser ? userTotals.totalConDescuento : orig.totalConDescuento;
            setLocalTotalCobrar(String(Number(initCobrar).toFixed(2)));
            setLocalTotalConDescuento(String(Number(initCon).toFixed(2)));
            setSelectionCobrar(null);
            setSelectionCon(null);
            // Inicializar delta en 0 al abrir modal
            setLocalDelta('0.00');
        }, [totalsModalVisible, userTotals]);

        const onChangeCobrar = (text) => {
            const val = parseFloat(text.replace(/,/g, '.')) || 0;
            const con = val - (val * (parsedDescuento / 100));
            setLocalTotalCobrar(text);
            setLocalTotalConDescuento(String(Number(con).toFixed(2)));
            setSelectionCobrar(null);
        };

        const onChangeCon = (text) => {
            const val = parseFloat(text.replace(/,/g, '.')) || 0;
            const denom = (1 - (parsedDescuento / 100));
            const cobrar = denom !== 0 ? (val / denom) : val;
            setLocalTotalConDescuento(text);
            setLocalTotalCobrar(String(Number(cobrar).toFixed(2)));
            setSelectionCon(null);
        };

        const onSave = () => {
            const orig = originalTotalsRef.current || { totalCobrar: 0, totalConDescuento: 0, version: 0 };
            const delta = parseFloat((localDelta || '').toString().replace(/,/g, '.')) || 0;
            const tc = Number(orig.totalCobrar || 0) + delta; // aplicar delta al total original
            const tcd = tc - (tc * (parsedDescuento / 100));
            const ver = (orig && orig.version) || 0;
            setUserTotals({ totalCobrar: tc, totalConDescuento: tcd, version: ver });
            setTotalsModalVisible(false);
        };

        const onReset = () => {
            const orig = originalTotalsRef.current || { totalCobrar: 0, totalConDescuento: 0, version: 0 };
            setUserTotals({ totalCobrar: orig.totalCobrar, totalConDescuento: orig.totalConDescuento, version: orig.version });
            setLocalTotalCobrar(String(Number(orig.totalCobrar).toFixed(2)));
            setLocalTotalConDescuento(String(Number(orig.totalConDescuento).toFixed(2)));
            setLocalDelta('0.00');
        };

        return (
            <Modal visible={totalsModalVisible} transparent animationType="fade">
                <View style={styles.loadingOverlay}>
                    <View style={[styles.loadingBox, { width: 340 }]}>
                        <View style={{ width: '100%', alignItems: 'center', marginBottom: Spacing.s, position: 'relative' }}>
                            <Text style={[styles.loadingText, { fontWeight: '700', textAlign: 'center' }]}>Adicionar o Restar Valor a Totales</Text>
                            <TouchableOpacity
                                onPress={() => setTotalsModalVisible(false)}
                                style={{
                                    position: 'absolute',
                                    right: 8,
                                    top: 8,
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: '#c00',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                accessibilityLabel="Cerrar modal"
                            >
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Mostrar original -> preview */}
                        <View style={{ width: '100%', alignItems: 'center', marginVertical: Spacing.s }}>
                            <Text style={[styles.label, { textAlign: 'center' }]}>Original</Text>
                            <Text style={[styles.summaryValue, { textAlign: 'center' }]}>${Number(originalTotalsRef.current.totalCobrar).toFixed(2)}</Text>
                            <Text style={{ marginVertical: 6 }}>→</Text>
                            <Text style={[styles.label, { textAlign: 'center' }]}>Preview</Text>
                            {/* Preview = original + delta */}
                            <Text style={[styles.summaryValue, { textAlign: 'center' }]}>${Number((originalTotalsRef.current.totalCobrar || 0) + (parseFloat((localDelta || '').toString().replace(/,/g, '.')) || 0)).toFixed(2)}</Text>
                        </View>

                        {/* Campo numérico y botones */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.s }}>
                            <View style={{ flexDirection: 'column', gap: Spacing.xs }}>
                                <TouchableOpacity
                                    style={{ borderWidth: 1, borderColor: '#c00', padding: 8, borderRadius: 6, marginBottom: Spacing.xs }}
                                    onPress={() => {
                                        const curr = parseFloat((localDelta || '').toString().replace(/,/g, '.')) || 0;
                                        const next = curr - 20;
                                        setLocalDelta(String(Number(next).toFixed(2)));
                                    }}
                                >
                                    <Text style={{ color: '#c00', fontWeight: '700' }}>-20</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ borderWidth: 1, borderColor: '#c00', padding: 8, borderRadius: 6 }}
                                    onPress={() => {
                                        const curr = parseFloat((localDelta || '').toString().replace(/,/g, '.')) || 0;
                                        const next = curr - 10;
                                        setLocalDelta(String(Number(next).toFixed(2)));
                                    }}
                                >
                                    <Text style={{ color: '#c00', fontWeight: '700' }}>-10</Text>
                                </TouchableOpacity>
                            </View>

                            <TextInput
                                style={[styles.input, { textAlign: 'center', flex: 1 }]}
                                keyboardType="numeric"
                                value={localDelta}
                                onChangeText={(t) => setLocalDelta(t)}
                            />

                            <View style={{ flexDirection: 'column', gap: Spacing.xs }}>
                                <TouchableOpacity
                                    style={{ borderWidth: 1, borderColor: '#0a0', padding: 8, borderRadius: 6, marginBottom: Spacing.xs }}
                                    onPress={() => {
                                        const curr = parseFloat((localDelta || '').toString().replace(/,/g, '.')) || 0;
                                        const next = curr + 10;
                                        setLocalDelta(String(Number(next).toFixed(2)));
                                    }}
                                >
                                    <Text style={{ color: '#0a0', fontWeight: '700' }}>+10</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ borderWidth: 1, borderColor: '#0a0', padding: 8, borderRadius: 6 }}
                                    onPress={() => {
                                        const curr = parseFloat((localDelta || '').toString().replace(/,/g, '.')) || 0;
                                        const next = curr + 20;
                                        setLocalDelta(String(Number(next).toFixed(2)));
                                    }}
                                >
                                    <Text style={{ color: '#0a0', fontWeight: '700' }}>+20</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: Spacing.s, marginTop: Spacing.m }}>
                            <TouchableOpacity style={[styles.saveButton, { flex: 1, backgroundColor: '#28a745' }]} onPress={onSave}>
                                <Text style={styles.saveButtonText}>Guardar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.saveButton, { flex: 1, backgroundColor: Colors.boton_azul, marginLeft: Spacing.s }]} onPress={onReset}>
                                <Text style={styles.saveButtonText}>Restablecer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };
    const CameraModal = () => {
        // 1. Usa el hook moderno para permisos
        const [permission, requestPermission] = useCameraPermissions();
        const [isCameraReady, setIsCameraReady] = useState(false);

        // 2. Efecto para solicitar permiso al abrir el modal
        useEffect(() => {
            if (cameraModalVisible && permission && !permission.granted) {
                requestPermission();
            }
        }, [cameraModalVisible, permission]);

        const handleCapture = async () => {
            if (!cameraRef.current || !isCameraReady) {
                ToastAndroid.show('Cámara no lista', ToastAndroid.SHORT);
                return;
            }
            try {
                console.log('📸 Iniciando captura de foto...');

                // 1. Tomar la foto
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 1, // Máxima calidad para el procesamiento
                    skipProcessing: false,
                    exif: true
                });

                console.log('🔄 Comprimiendo imagen...');

                // 2. Comprimir la imagen
                const compressedResult = await comprimirImagen(photo.uri);

                // 3. Agregar a la lista de fotos
                setFotos(prev => [...prev, {
                    uri: compressedResult.uri,
                    base64: compressedResult.base64,
                    nota: ''
                }]);

                ToastAndroid.show('✅ Foto agregada con compresión', ToastAndroid.SHORT);
                setCameraModalVisible(false);

            } catch (err) {
                console.error('❌ Error tomando foto:', err);
                Alert.alert('Error', 'No se pudo tomar la foto: ' + err.message);
            }
        };

        if (!cameraModalVisible) return null;

        // Estados del permiso
        if (!permission) {
            // Permisos aún cargando
            return (
                <Modal visible={cameraModalVisible} transparent animationType="slide">
                    <View style={styles.cameraLoadingContainer}>
                        <ActivityIndicator size="large" color="#fff" />
                        <Text style={styles.cameraLoadingText}>Cargando permisos...</Text>
                    </View>
                </Modal>
            );
        }

        if (!permission.granted) {
            // Permisos no concedidos
            return (
                <Modal visible={cameraModalVisible} transparent animationType="slide">
                    <View style={styles.cameraPermissionContainer}>
                        <Text style={styles.cameraPermissionText}>
                            La aplicación necesita acceso a la cámara para tomar fotos de las consultas.
                        </Text>
                        <TouchableOpacity
                            style={styles.cameraPermissionButton}
                            onPress={requestPermission}
                        >
                            <Text style={styles.cameraPermissionButtonText}>Conceder permiso</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.cameraPermissionButton, { backgroundColor: 'transparent', marginTop: 10 }]}
                            onPress={() => setCameraModalVisible(false)}
                        >
                            <Text style={[styles.cameraPermissionButtonText, { color: '#fff' }]}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </Modal>
            );
        }

        // 4. Permisos concedidos: mostrar la cámara con el componente CameraView
        return (
            <Modal visible={cameraModalVisible} transparent animationType="slide">
                <View style={styles.cameraFullScreen}>
                    <View style={styles.cameraHeader}>
                        <TouchableOpacity
                            style={styles.cameraCloseBtn}
                            onPress={() => setCameraModalVisible(false)}
                        >
                            <Text style={styles.cameraCloseText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.cameraContent}>
                        {/* Usa CameraView en lugar de Camera */}
                        <CameraView
                            ref={cameraRef}
                            style={StyleSheet.absoluteFillObject}
                            facing="back" // Tipo simplificado
                            onCameraReady={() => setIsCameraReady(true)}
                        />
                    </View>

                    <View style={styles.cameraFooter}>
                        <TouchableOpacity
                            style={styles.captureBtn}
                            onPress={handleCapture}
                        >
                            <View style={styles.captureBtnInner} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    // Modal para seleccionar imagen de la galería usando expo-media-library
    const GalleryModal = () => {
        if (!galleryModalVisible) return null;

        const handleSelect = async (asset) => {
            try {
                console.log('🖼️ Procesando imagen de galería...');

                // 1. Comprimir la imagen desde la galería
                const compressedResult = await comprimirImagen(asset.uri);

                // 2. Agregar a la lista de fotos
                const nuevaFoto = {
                    uri: compressedResult.uri,
                    base64: compressedResult.base64,
                    nota: ''
                };
                setFotos(prev => [...prev, nuevaFoto]);

                ToastAndroid.show('✅ Foto agregada con compresión', ToastAndroid.SHORT);
            } catch (err) {
                console.error('❌ Error seleccionando imagen:', err);
                Alert.alert('Error', 'No se pudo procesar la imagen: ' + err.message);
            } finally {
                setGalleryModalVisible(false);
            }
        };

        return (
            <Modal visible={galleryModalVisible} transparent animationType="slide">
                <View style={styles.galleryOverlay}>
                    <View style={styles.galleryHeader}>
                        <TouchableOpacity onPress={() => setGalleryModalVisible(false)}>
                            <Text style={styles.notaButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={mediaAssets}
                        numColumns={4}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity onPress={() => handleSelect(item)} style={{ margin: Spacing.xs }}>
                                <Image source={{ uri: item.uri }} style={styles.galleryThumb} />
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </Modal>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            enabled
        >
            <View style={styles.container}>
                <TopBar onMenuNavigate={() => { }} />

                {/* Modal para vista completa de imagen */}
                <FullscreenImageModal />
                {/* Modal para tomar foto */}
                <CameraModal />
                {/* Modal para seleccionar desde galería */}
                <GalleryModal />
                {/* Modal para editar totales */}
                <TotalsEditModal />

                {/* Modal bloqueante mientras se cargan los usuarios */}
                <Modal visible={usuariosLoading} transparent animationType="none">
                    <View style={styles.loadingOverlay}>
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                            <Text style={styles.loadingText}>Cargando usuarios...</Text>
                        </View>
                    </View>
                </Modal>

                {/* Modal de validación/progreso durante creación/edición */}
                <Modal visible={validationVisible} transparent animationType="fade">
                    <View style={styles.loadingOverlay}>
                        <View style={[styles.loadingBox, { width: 300 }]}>
                            <Text style={[styles.loadingText, { fontWeight: '700', marginBottom: Spacing.s }]}>{validationTitle}</Text>

                            {totalVentasToCreate > 0 && (
                                <Text style={[styles.loadingText, { marginBottom: Spacing.s }]}>
                                    {ventasCreated} de {totalVentasToCreate} ventas creadas
                                </Text>
                            )}

                            <View style={{ width: '100%', height: 12, backgroundColor: '#eee', borderRadius: 8, overflow: 'hidden' }}>
                                <View style={{ width: `${validationProgress}%`, height: '100%', backgroundColor: Colors.primary }} />
                            </View>
                            <Text style={[styles.loadingText, { marginTop: Spacing.s }]}>{validationProgress}%</Text>
                        </View>
                    </View>
                </Modal>

                <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">
                    {/* Header */}
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <Image
                                source={require('../assets/images/arrow-left.png')}
                                style={styles.icon}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                        <Text style={styles.sectionTitle}>
                            {mode === 'crear' ? 'Nueva Consulta' : mode === 'editar' ? 'Editar Consulta' : 'Ver Consulta'}
                        </Text>
                    </View>

                    {/* Fecha */}
                    <View style={styles.section} onLayout={(e) => { positionsRef.current.fecha = e.nativeEvent.layout.y; }}>
                        <Text style={styles.label}>Fecha *</Text>
                        {isView ? (
                            <Text style={[styles.input, styles.disabledInput]}>
                                {consultaData.fecha}
                            </Text>
                        ) : (
                            <TouchableOpacity
                                style={[styles.input, styles.datePickerTouchable]}
                                onPress={() => setShowDatePicker(true)}
                                activeOpacity={0.7}
                            >
                                <Text style={{ color: Colors.textSecondary }}>
                                    {consultaData.fecha}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {showDatePicker && (
                            <DateTimePicker
                                value={new Date(consultaData.fecha)}
                                mode="date"
                                display="default"
                                maximumDate={new Date()}
                                onChange={handleDateChange}
                            />
                        )}
                    </View>

                    {/* Motivo */}
                    <View style={styles.section} onLayout={(e) => { positionsRef.current.motivo = e.nativeEvent.layout.y; }}>
                        <Text style={styles.label}>Motivo de la Visita *</Text>
                        {isView ? (
                            <Text style={[styles.input, styles.disabledInput]}>
                                {consultaData.motivo}
                            </Text>
                        ) : (
                            <TextInput
                                style={styles.input}
                                placeholder="Ej: Revisión general, Vacunas, etc."
                                value={consultaData.motivo}
                                onChangeText={(value) => handleChange('motivo', value)}
                                placeholderTextColor="#999"
                                editable={isEditable}
                            />
                        )}
                    </View>

                    {/* Anamnesis */}
                    <View style={styles.section} onLayout={(e) => { positionsRef.current.anamnesis = e.nativeEvent.layout.y; }}>
                        <View style={styles.sectionHeaderWithButton}>
                            <Text style={styles.label}>Anamnesis *</Text>
                            <AudioRecordButton field="anamnesis" label="Grabar" />
                        </View>

                        {isView ? (
                            <Text style={[styles.input, styles.disabledInput, styles.largeInput]}>
                                {consultaData.anamnesis || '-'}
                            </Text>
                        ) : (
                            <AutocompleteTextInput
                                style={[styles.input, styles.largeInput]}
                                placeholder="Describe síntomas, historial y contexto clínico..."
                                value={consultaData.anamnesis}
                                onChangeText={(value) => handleChange('anamnesis', value)}
                                placeholderTextColor="#999"
                                multiline
                                numberOfLines={6}
                                editable={isEditable}
                                textAlignVertical="top"
                            />
                        )}
                    </View>

                    {/* Lista de Vacunas */}
                    <MedicamentosLista
                        ref={medicamentosListRef}
                        isEditable={isEditable}
                        initial={initialMedicamentos}
                        onChange={(t) => setListsTotals(prev => ({ ...prev, medicamentos: t }))}
                    />
                    <ServiciosLista
                        ref={serviciosListRef}
                        isEditable={isEditable}
                        initial={initialServicios}
                        onChange={(t) => setListsTotals(prev => ({ ...prev, servicios: t }))}
                    />
                    <ProductosList
                        ref={productosListRef}
                        isEditable={isEditable}
                        initial={initialProductos}
                        onChange={(t) => setListsTotals(prev => ({ ...prev, productos: t }))}
                    />
                    <VacunasLista
                        ref={vacunasListRef}
                        isEditable={isEditable}
                        initial={initialVacunas}
                        onChange={(t) => setListsTotals(prev => ({ ...prev, vacunas: t }))}
                    />
                    <AntiparasitariosLista
                        ref={antiparasitariosListRef}
                        isEditable={isEditable}
                        initial={initialAntiparasitarios}
                        onChange={(t) => setListsTotals(prev => ({ ...prev, antiparasitarios: t }))}
                    />

                    {/* Contenedor de Resumen de Totales */}
                    {(() => {
                        // Usar totales calculados directamente desde los refs de las listas
                        // Esto evita inconsistencias al cargar datos iniciales (modo ver/editar)
                        const { totalCobrar, totalProfit } = calculateTotals();

                        // Determinar descuento del paciente buscando en distintos lugares según cómo se abrió el modal
                        const descuentoPaciente = (
                            consultaParam?.paciente?.descuento ??
                            consultaParam?.descuento ??
                            pacienteParam?.descuento ??
                            pacienteData?.descuento ??
                            0
                        );

                        const parsedDescuento = parseFloat(descuentoPaciente) || 0;
                        const totalConDescuento = totalCobrar - (totalCobrar * (parsedDescuento / 100));

                        // Preparar valores para mostrar y para redondeo
                        const orig = originalTotalsRef.current || { totalCobrar: totalCobrar, totalConDescuento: totalConDescuento, version: 0 };
                        const useUser = (userTotals.version === orig.version) && (userTotals.totalCobrar !== null);
                        const displayTotalCobrar = useUser ? userTotals.totalCobrar : totalCobrar;
                        const displayTotalCon = useUser ? userTotals.totalConDescuento : totalConDescuento;

                        // Calcular redondeo según redondeoValue
                        let roundedTotalCon = Math.round(Number(displayTotalCon) || 0);
                        try {
                            const rv = (redondeoValue || '').toString();
                            if (/normal/i.test(rv)) {
                                roundedTotalCon = Math.round(Number(displayTotalCon) || 0);
                            } else {
                                const m = rv.match(/\d+/);
                                if (m) {
                                    const inc = parseInt(m[0], 10) || 0;
                                    const base = Math.round(Number(displayTotalCon) || 0);
                                    if (inc > 0) {
                                        if (base % inc === 0) roundedTotalCon = base;
                                        else roundedTotalCon = base + (inc - (base % inc));
                                    } else {
                                        roundedTotalCon = Math.round(Number(displayTotalCon) || 0);
                                    }
                                } else {
                                    roundedTotalCon = Math.round(Number(displayTotalCon) || 0);
                                }
                            }
                        } catch (e) {
                            roundedTotalCon = Math.round(Number(displayTotalCon) || 0);
                        }

                        let exedenteRounded = Number(roundedTotalCon) - Number(displayTotalCon || 0);
                        if (isNaN(exedenteRounded) || exedenteRounded < 0) exedenteRounded = 0;
                        // Persistir el valor para uso en otras partes del componente
                        try { exedenteRoundedRef.current = exedenteRounded; } catch (e) { /* ignore */ }
                        return (
                            <View style={styles.section}>
                                <Text style={styles.label}>Resumen de Cobro</Text>

                                <TouchableOpacity style={styles.summaryRow} onPress={() => { (mode === "crear" || mode === "editar") ? setTotalsModalVisible(true) : {} }}>
                                    <Text style={styles.summaryLabel}>Total a cobrar:</Text>
                                    <Text style={styles.summaryValue}>${Number(displayTotalCobrar).toFixed(2)}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.summaryRow} onPress={() => { (mode === "crear" || mode === "editar") ? setTotalsModalVisible(true) : {} }}>
                                    <View style={styles.summaryLabelContainer}>
                                        <Text style={styles.summaryLabel}>Total con descuento </Text>
                                        <Text style={[styles.summaryLabel, styles.descuentoText]}>({parsedDescuento}%)</Text>
                                        <Text style={styles.summaryLabel}>:</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={{ fontSize: Typography.body, color: Colors.textSecondary }}>${Number(displayTotalCon).toFixed(2)}</Text>
                                        <Text style={styles.summaryValue}>${Number(roundedTotalCon).toFixed(2)}</Text>
                                    </View>
                                </TouchableOpacity>

                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Plus (Ganancia):</Text>
                                    {(() => {
                                        const origRef = originalTotalsRef.current || { totalCobrar: totalCobrar, totalConDescuento: totalConDescuento, version: 0 };
                                        const useUserNow = (userTotals.version === origRef.version) && (userTotals.totalCobrar !== null);
                                        const userVal = useUserNow ? Number(userTotals.totalCobrar) : null;

                                        let plusValue = Number(totalProfit);
                                        if (useUserNow && userVal > Number(origRef.totalCobrar)) {
                                            plusValue = userVal - Number(origRef.totalCobrar);
                                        }

                                        // Si la configuración indica sumar el exedente al plus, hacerlo
                                        try {
                                            if (!isRedondeoFromPlus && typeof exedenteRounded !== 'undefined') {
                                                plusValue = Number(plusValue) + Number(exedenteRounded || 0);
                                            }
                                        } catch (e) { /* ignore */ }

                                        return (
                                            <Text style={styles.summaryValue}>${Number(plusValue).toFixed(2)}</Text>
                                        );
                                    })()}
                                </View>

                                {/* Tipo de pago (radio buttons) */}
                                <View style={styles.paymentContainer}>
                                    <Text style={[styles.label, { marginBottom: 8 }]}>Tipo de pago</Text>
                                    <View style={styles.radioRow}>
                                        <TouchableOpacity
                                            style={styles.radioOption}
                                            onPress={() => setPaymentType('efectivo')}
                                            disabled={!isEditable}
                                        >
                                            <View style={styles.radioCircle}>
                                                {paymentType === 'efectivo' && <View style={styles.radioInner} />}
                                            </View>
                                            <Text style={styles.radioLabel}>Efectivo</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.radioOption}
                                            onPress={() => setPaymentType('transferencia')}
                                            disabled={!isEditable}
                                        >
                                            <View style={styles.radioCircle}>
                                                {paymentType === 'transferencia' && <View style={styles.radioInner} />}
                                            </View>
                                            <Text style={styles.radioLabel}>Transferencia</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        );
                    })()}
                    <View onLayout={(e) => { positionsRef.current.usuarios = e.nativeEvent.layout.y; }}>
                        <UsuariosLista
                            ref={usuariosListRef}
                            data={usuariosDisponibles}
                            initialSelected={usuariosPreseleccionados}
                            isEditable={isEditable}
                            onChange={(t) => setListsTotals(prev => ({ ...prev, usuarios: t }))}
                        />
                    </View>

                    {/* List sections removed */}

                    {/* Fotos Consulta - Galería */}
                    <View style={styles.section}>
                        <View style={styles.fotosHeader}>
                            <Text style={styles.label}>Imágenes de la Consulta</Text>
                            <View style={{ flexDirection: 'row', gap: Spacing.s }}>
                                {(mode === "crear") && (
                                    <>
                                        <TouchableOpacity onPress={openCamera} style={[styles.eyeButton, styles.photoAddButton]}>
                                            <Image
                                                source={require('../assets/images/camera.png')}
                                                style={styles.photoIcon}
                                                resizeMode="contain"
                                            />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={openGallery} style={[styles.eyeButton, styles.photoAddButton]}>
                                            <Image
                                                source={require('../assets/images/galeria-de-imagenes.png')}
                                                style={styles.photoIcon}
                                                resizeMode="contain"
                                            />
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>

                        {fotos.length === 0 ? (
                            <Text style={styles.noFotosText}>
                                No hay imágenes agregadas. {isEditable ? 'Toca los botones para agregar fotos.' : ''}
                            </Text>
                        ) : (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.fotosCarrusel}
                                contentContainerStyle={styles.fotosCarruselContent}
                            >
                                {fotos.map((foto, index) => (
                                    <View key={index} style={styles.fotoItemContainer}>
                                        <TouchableOpacity
                                            style={styles.fotoItem}
                                            onPress={() => setImagenFullscreen(foto.uri)}
                                            activeOpacity={0.7}
                                        >
                                            <Image
                                                source={{ uri: foto.uri }}
                                                style={styles.fotoImage}
                                                resizeMode="cover"
                                            />
                                            {(mode === "crear") && (
                                                <TouchableOpacity
                                                    style={styles.fotoCloseButton}
                                                    onPress={() => removeFoto(index)}
                                                >
                                                    <Text style={styles.fotoCloseX}>✕</Text>
                                                </TouchableOpacity>
                                            )}
                                        </TouchableOpacity>

                                        {/* Nota de la foto */}
                                        {mostrarNotaIndex === index ? (
                                            <View style={styles.notaContainer}>
                                                <TextInput
                                                    style={styles.notaInput}
                                                    value={notaActual}
                                                    onChangeText={setNotaActual}
                                                    placeholder="Agregar nota a la imagen..."
                                                    placeholderTextColor="#999"
                                                    multiline
                                                    numberOfLines={2}
                                                />
                                                <View style={styles.notaButtonsContainer}>
                                                    <TouchableOpacity
                                                        style={[styles.notaButton, styles.notaButtonCancel]}
                                                        onPress={cancelarNota}
                                                    >
                                                        <Text style={styles.notaButtonText}>Cancelar</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.notaButton, styles.notaButtonSave]}
                                                        onPress={() => guardarNota(index)}
                                                    >
                                                        <Text style={styles.notaButtonText}>Guardar</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ) : (
                                            <View style={styles.fotoInfoContainer}>
                                                <Text style={styles.fotoNotaText} numberOfLines={1}>
                                                    {foto.nota || 'Sin nota'}
                                                </Text>
                                                {(mode === "crear") && (
                                                    <TouchableOpacity
                                                        style={styles.addNotaButton}
                                                        onPress={() => agregarNota(index)}
                                                    >
                                                        <Text style={styles.addNotaButtonText}>
                                                            {foto.nota ? 'Editar nota' : 'Agregar nota'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>

                    {/* Diagnóstico */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderWithButton}>
                            <Text style={styles.label}>Diagnóstico</Text>
                            <AudioRecordButton field="diagnostico" label="Grabar" />
                        </View>

                        {isView ? (
                            <Text style={[styles.input, styles.disabledInput, styles.largeInput]}>
                                {consultaData.diagnostico || '-'}
                            </Text>
                        ) : (
                            <AutocompleteTextInput
                                style={[styles.input, styles.largeInput]}
                                placeholder="Describe el diagnóstico..."
                                value={consultaData.diagnostico}
                                onChangeText={(value) => handleChange('diagnostico', value)}
                                placeholderTextColor="#999"
                                multiline
                                numberOfLines={4}
                                editable={isEditable}
                                textAlignVertical="top"
                            />
                        )}
                    </View>

                    {/* Tratamiento */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderWithButton}>
                            <Text style={styles.label}>Tratamiento</Text>
                            <AudioRecordButton field="tratamiento" label="Grabar" />
                        </View>

                        {isView ? (
                            <Text style={[styles.input, styles.disabledInput, styles.largeInput]}>
                                {consultaData.tratamiento || '-'}
                            </Text>
                        ) : (
                            <AutocompleteTextInput
                                style={[styles.input, styles.largeInput]}
                                placeholder="Describe el tratamiento prescrito..."
                                value={consultaData.tratamiento}
                                onChangeText={(value) => handleChange('tratamiento', value)}
                                placeholderTextColor="#999"
                                multiline
                                numberOfLines={4}
                                editable={isEditable}
                                textAlignVertical="top"
                            />
                        )}
                    </View>

                    {/* Patología */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderWithButton}>
                            <Text style={styles.label}>Patología</Text>
                            <AudioRecordButton field="patologia" label="Grabar" />
                        </View>

                        {isView ? (
                            <Text style={[styles.input, styles.disabledInput, styles.largeInput]}>
                                {consultaData.patologia || '-'}
                            </Text>
                        ) : (
                            <AutocompleteTextInput
                                style={[styles.input, styles.largeInput]}
                                placeholder="Describe la patología identificada..."
                                value={consultaData.patologia}
                                onChangeText={(value) => handleChange('patologia', value)}
                                placeholderTextColor="#999"
                                multiline
                                numberOfLines={4}
                                editable={isEditable}
                                textAlignVertical="top"
                            />
                        )}
                    </View>

                    {/* Botones de acción */}
                    {isEditable && (
                        <View style={styles.buttonsContainer}>
                            <TouchableOpacity
                                style={[styles.saveButton, loading && styles.buttonDisabled]}
                                onPress={handleSave}
                                disabled={loading}
                            >
                                <Text style={styles.saveButtonText}>
                                    {mode === 'editar' ? 'Guardar Cambios' : 'Crear Consulta'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContent: {
        padding: Spacing.m,
        paddingBottom: 40,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.m,
        gap: Spacing.s,
    },
    backButton: {
        backgroundColor: Colors.primarySuave,
        padding: Spacing.s,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
    },
    icon: {
        width: 20,
        height: 20,
        tintColor: Colors.textPrimary,
    },
    sectionTitle: {
        fontSize: Typography.h3,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        flex: 1,
        textAlign: 'center',
    },
    section: {
        backgroundColor: '#fff',
        padding: Spacing.m,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
        marginBottom: Spacing.m,
    },
    sectionHeaderWithButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    label: {
        fontSize: Typography.body,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 8,
        paddingHorizontal: Spacing.m,
        paddingVertical: 12,
        fontSize: Typography.body,
        color: Colors.textSecondary,
    },
    largeInput: {
        minHeight: 100,
        paddingVertical: Spacing.m,
    },
    disabledInput: {
        backgroundColor: '#eee',
        color: '#666',
    },
    datePickerTouchable: {
        justifyContent: 'center',
    },
    // Estilos para botones de grabación pequeños
    audioButtonContainer: {
        alignItems: 'center',
    },
    audioButtonSmall: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    idleButton: {
        backgroundColor: Colors.primaryDark,
    },
    recordingButton: {
        backgroundColor: Colors.primary,
    },
    processingButton: {
        backgroundColor: Colors.primarySuave,
    },
    micIcon: {
        width: 24,
        height: 24,
        tintColor: Colors.textPrimary,
    },
    audioButtonLabel: {
        fontSize: Typography.small,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    recordingActiveContainerSmall: {
        alignItems: 'center',
    },
    recordingTimerSmall: {
        fontSize: Typography.small,
        color: Colors.textSecondary,
        marginTop: 4,
        fontWeight: '600',
    },
    audioProcessingSmall: {
        alignItems: 'center',
    },
    audioProcessingTextSmall: {
        fontSize: Typography.small,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    // Estilos para el resumen de totales
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.s,
        borderBottomWidth: 1,
        borderBottomColor: '#e6e6e6',
    },
    summaryLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    summaryLabel: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    descuentoText: {
        color: '#28a745',
        fontWeight: '700',
    },
    summaryValue: {
        fontSize: Typography.body,
        fontWeight: 'bold',
        color: Colors.textSecondary,
    },
    paymentContainer: {
        marginTop: Spacing.m,
        paddingTop: Spacing.s,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    radioRow: {
        flexDirection: 'row',
        gap: Spacing.m,
        marginTop: Spacing.xs,
    },
    radioOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.s,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    radioCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.s,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary,
    },
    radioLabel: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    loadingOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingBox: {
        backgroundColor: '#fff',
        padding: Spacing.m,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    loadingText: {
        marginTop: Spacing.s,
        color: Colors.textSecondary,
        fontSize: Typography.body,
    },
    // Estilos para fotos
    fotosHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.s,
    },
    eyeButton: {
        padding: Spacing.s,
        borderRadius: 8,
        backgroundColor: Colors.primary,
        borderWidth: 1,
        borderColor: '#000',
    },
    photoAddButton: {
        width: 44,
        height: 44,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
    },
    photoIcon: {
        width: 24,
        height: 24,
        tintColor: Colors.textPrimary,
    },
    fotosCarrusel: {
        marginTop: Spacing.s,
    },
    fotosCarruselContent: {
        paddingHorizontal: Spacing.xs,
        gap: Spacing.s,
    },
    fotoItemContainer: {
        marginRight: Spacing.s,
        width: 180,
    },
    fotoItem: {
        width: 180,
        height: 180,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
        overflow: 'hidden',
        position: 'relative',
    },
    fotoImage: {
        width: '100%',
        height: '100%',
    },
    fotoCloseButton: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
        borderWidth: 1,
        borderColor: '#900',
    },
    fotoCloseX: {
        color: '#900',
        fontWeight: '700',
        fontSize: 14,
    },
    fotoInfoContainer: {
        marginTop: Spacing.xs,
        paddingHorizontal: Spacing.xs,
    },
    fotoNotaText: {
        fontSize: Typography.small,
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    addNotaButton: {
        backgroundColor: Colors.primarySuave,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    addNotaButtonText: {
        fontSize: Typography.small,
        color: Colors.textSecondary,
    },
    notaContainer: {
        marginTop: Spacing.xs,
        backgroundColor: '#f9f9f9',
        padding: Spacing.s,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    notaInput: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        paddingHorizontal: Spacing.s,
        paddingVertical: 6,
        fontSize: Typography.small,
        color: Colors.textSecondary,
        minHeight: 60,
        textAlignVertical: 'top',
    },
    notaButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.s,
    },
    notaButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 4,
        borderWidth: 1,
    },
    notaButtonCancel: {
        backgroundColor: '#fff',
        borderColor: '#ccc',
    },
    notaButtonSave: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    notaButtonText: {
        fontSize: Typography.small,
        fontWeight: '600',
    },
    fullscreenOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        paddingTop: Spacing.m,
    },
    fullscreenHeader: {
        height: 48,
        justifyContent: 'flex-start',
        paddingHorizontal: Spacing.s,
    },
    fullscreenCloseButton: {
        padding: Spacing.s,
        alignSelf: 'flex-start',
    },
    fullscreenCloseText: {
        color: '#fff',
        fontSize: Typography.body,
    },
    fullscreenScrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: Spacing.m,
    },
    fullscreenImage: {
        width: screenWidth - 32,
        height: screenWidth - 32,
    },
    noFotosText: {
        fontSize: Typography.small,
        color: '#999',
        textAlign: 'center',
        paddingVertical: Spacing.m,
    },
    buttonsContainer: {
        gap: Spacing.s,
        marginBottom: Spacing.m,
    },
    saveButton: {
        backgroundColor: Colors.boton_azul,
        paddingVertical: Spacing.m,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: Spacing.s,
        borderWidth: 1,
        borderColor: '#000',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: Typography.body,
        fontWeight: '600',
    },
    deleteButton: {
        backgroundColor: Colors.boton_rojo_opciones,
        paddingVertical: Spacing.m,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: Spacing.s,
        borderWidth: 1,
        borderColor: '#000',
    },
    deleteButtonText: {
        color: Colors.textPrimary,
        fontSize: Typography.body,
        fontWeight: '600',
    },
    deletePhotoButton: {
        backgroundColor: '#fff',
        paddingVertical: Spacing.s,
        paddingHorizontal: Spacing.m,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#900',
        marginTop: Spacing.s,
    },
    deletePhotoButtonText: {
        color: '#900',
        fontSize: Typography.body,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    cameraFullScreen: {
        flex: 1,
        backgroundColor: '#000',
    },
    cameraHeader: {
        height: 60,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        paddingHorizontal: 16,
        zIndex: 10,
    },
    cameraCloseBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraCloseText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    cameraContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    cameraWrapper: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    cameraLoading: {
        alignItems: 'center',
        padding: 20,
    },
    cameraLoadingText: {
        color: '#fff',
        marginTop: 10,
        fontSize: 16,
    },
    cameraErrorText: {
        color: '#fff',
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20,
    },
    cameraPreparing: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    cameraPreparingText: {
        color: '#fff',
        marginTop: 10,
        fontSize: 16,
    },
    cameraFooter: {
        height: 120,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureBtn: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderWidth: 3,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureBtnInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#fff',
    },
    cameraActionBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 10,
    },
    cameraActionText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    galleryOverlay: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: Spacing.m,
    },
    galleryHeader: {
        paddingHorizontal: Spacing.m,
        paddingBottom: Spacing.s,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        alignItems: 'flex-end',
    },
    galleryThumb: {
        width: (screenWidth - (Spacing.m * 2) - (Spacing.xs * 6)) / 4,
        height: (screenWidth - (Spacing.m * 2) - (Spacing.xs * 6)) / 4,
        borderRadius: 6,
    },
});