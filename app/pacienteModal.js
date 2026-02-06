import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    Alert,
    ToastAndroid,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard,
    Platform,
    Linking,
    Modal,
    FlatList,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import TopBar from '../components/TopBar';
import DropdownGenerico from '../components/DropdownGenerico';
import DataTable from '../components/DataTable';
import PatientSidebarMenu from '../components/PatientSidebarMenu';
import { Colors, Spacing, Typography, ColorsData } from '../variables';

export default function PacienteModalScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const mode = params.mode; // 'crear' | 'editar' | 'ver'
    const pacienteParam = params.paciente ? JSON.parse(params.paciente) : null;

    const isView = mode === 'ver';
    const isEditable = mode !== 'ver';

    // Estados principales
    const [pacienteData, setPacienteData] = useState({
        id: pacienteParam?.id_paciente ?? pacienteParam?.id ?? null,
        nombre: pacienteParam?.nombre ?? '',
        sexo: pacienteParam?.sexo ?? '',
        raza: pacienteParam?.raza ?? '',
        especie: pacienteParam?.especie ?? '',
        numero_clinico: pacienteParam?.numero_clinico ? String(pacienteParam.numero_clinico) : '',
        fecha_nacimiento: pacienteParam?.fecha_nacimiento ?? '',
        comprado_adoptado: pacienteParam?.comprado_adoptado ?? '',
        historia_clinica: pacienteParam?.historia_clinica ?? '',
        foto_ruta: pacienteParam?.foto_ruta ?? null,
        chip: pacienteParam?.chip ?? '',
        agresividad: pacienteParam?.agresividad ?? 0,
        descuento: pacienteParam?.descuento ?? 0,
        color: pacienteParam?.color ?? ColorsData.blanco,
        clientes: (pacienteParam?.clientes || []).map(c => ({ id: c.id_cliente ?? c.id, nombre: c.nombre, telefono: c.telefono }))
    });

    const [apiHost, setApiHost] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [token, setToken] = useState(null);
    const [showPacienteInfo, setShowPacienteInfo] = useState(false);
    const [showPacienteColorPicker, setShowPacienteColorPicker] = useState(false);
    const [showPatientMenu, setShowPatientMenu] = useState(false);
    // Estado para el formulario de cliente dentro del contenedor secundario
    const [clienteData, setClienteData] = useState({
        nombre: '',
        telefono: '',
        direccion: '',
        color: ColorsData.blanco,
    });
    const [showColorPickerCliente, setShowColorPickerCliente] = useState(false);
    const [showPacienteInputs, setShowPacienteInputs] = useState(mode === 'crear');
    const [pacienteYears, setPacienteYears] = useState('');
    const [pacienteMonths, setPacienteMonths] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pacienteChip, setPacienteChip] = useState(pacienteData.chip ? String(pacienteData.chip) : '');
    const [pacientePeso, setPacientePeso] = useState('');
    const [originalPeso, setOriginalPeso] = useState(null);
    const [isLoadingPeso, setIsLoadingPeso] = useState(false);
    const [descuento, setDescuento] = useState(String(pacienteData.descuento ?? ''));
    const [photoUri, setPhotoUri] = useState(null);
    const [imagenBase64, setImagenBase64] = useState(null);
    const [agresividad, setAgresividad] = useState(pacienteData.agresividad ?? 0);
    const [estadoPaciente, setEstadoPaciente] = useState('');
    const [motivoFallecimiento, setMotivoFallecimiento] = useState(null);
    const [pacientesList, setPacientesList] = useState([]);
    const [especieSeleccionada, setEspecieSeleccionada] = useState(pacienteData.especie || null);
    const [sexoSeleccionado, setSexoSeleccionado] = useState(pacienteData.sexo || null);

    const [loadedImageUri, setLoadedImageUri] = useState(null);

    // Camera / Gallery states (use expo-camera + expo-media-library like historia_clinicaModal)
    const cameraRef = useRef(null);
    const [isSaving, setIsSaving] = useState(false);
    // Guards to avoid opening multiple times
    const isCameraOpeningRef = useRef(false);
    const isGalleryOpeningRef = useRef(false);
    const [cameraModalVisible, setCameraModalVisible] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [galleryModalVisible, setGalleryModalVisible] = useState(false);
    const [mediaAssets, setMediaAssets] = useState([]);
    const motivosFallecimiento = [
        { id: 1, nombre: 'Eutanasia' },
        { id: 2, nombre: 'Accidente' },
        { id: 3, nombre: 'Enfermedad' },
        { id: 4, nombre: 'Vejez' },
        { id: 5, nombre: 'Otros' }
    ];

    const sexos = [
        { id: 1, nombre: 'macho' },
        { id: 2, nombre: 'hembra' },
        { id: 3, nombre: 'otros' },
    ];

    const especies = [
        { id: 1, nombre: 'Canino' },
        { id: 2, nombre: 'Felino' },
        { id: 3, nombre: 'Ave' },
        { id: 4, nombre: 'Roedor' },
        { id: 5, nombre: 'Peces' },
        { id: 6, nombre: 'Caprino' },
        { id: 7, nombre: 'Porcino' },
        { id: 8, nombre: 'Ovino' },
        { id: 9, nombre: 'Otros' },
    ];

    // Funciones de utilidad
    const formatDateForDisplay = (dateString) => {
        if (!dateString) return '';

        try {
            // Si ya está en formato YYYY-MM-DD, devolverlo tal cual
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                return dateString;
            }

            // Si viene en formato ISO, extraer solo la parte de la fecha
            if (dateString.includes('T')) {
                return dateString.split('T')[0];
            }

            // Para cualquier otro formato, intentar parsear
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString; // Si no se puede parsear, devolver original

            return formatDateToYMD(date);
        } catch (error) {
            console.error('Error formateando fecha:', error);
            return dateString;
        }
    };

    const getIconTintColor = (backgroundColor) => {
        // Si el color de fondo es blanco, usar color oscuro, sino usar blanco
        return backgroundColor === ColorsData.blanco ? Colors.textSecondary : '#ffffff';
    };

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

    // Función para obtener el valor de comprado_adoptado basado en el estado seleccionado
    const getCompradoAdoptadoValue = (estado) => {
        switch (estado) {
            case 'Adoptado':
                return 'adoptado';
            case 'Comprado':
                return 'comprado';
            case 'Fallecido':
                return null; // Cuando es fallecido, comprado_adoptado debe ser null
            default:
                return null;
        }
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

    const uriToBase64 = async (uri) => {
        if (!uri) return '';
        try {
            const enc = (FileSystem.EncodingType && FileSystem.EncodingType.Base64) ? FileSystem.EncodingType.Base64 : 'base64';
            try {
                const b64 = await FileSystem.readAsStringAsync(uri, { encoding: enc });
                return b64;
            } catch (readErr) {
                try {
                    const tmpPath = FileSystem.documentDirectory + `tmp_image_${Date.now()}`;
                    const dl = await FileSystem.downloadAsync(uri, tmpPath);
                    const b64 = await FileSystem.readAsStringAsync(dl.uri, { encoding: 'base64' });
                    try { await FileSystem.deleteAsync(dl.uri, { idempotent: true }); } catch (e) { }
                    return b64;
                } catch (dlErr) {
                    console.warn('Fallo al descargar/leer imagen para base64', dlErr);
                    return '';
                }
            }
        } catch (err) {
            console.warn('No se pudo convertir imagen a base64', err);
            return '';
        }
    };

    // Función para comprimir imágenes sin pérdida de calidad visible (copiada de historia_clinicaModal)
    const comprimirImagen = async (uri) => {
        try {
            const fileInfo = await FileSystem.getInfoAsync(uri);
            const sizeBefore = fileInfo.size;

            const result = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1024 } }],
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            const compressedFileInfo = await FileSystem.getInfoAsync(result.uri);
            const sizeAfter = compressedFileInfo.size;

            return { uri: result.uri, base64: result.base64, width: result.width, height: result.height };
        } catch (error) {
            console.error('Error en compresión de imagen:', error);
            throw error;
        }
    };

    const clampDescuento = (value) => {
        const num = Number(value || 0);
        if (num < 0) return '0';
        if (num > 100) return '100';
        return String(num);
    };

    // Efecto para cargar la imagen del paciente si tiene foto_ruta
    useEffect(() => {
        const loadPatientImage = async () => {
            if (pacienteData.foto_ruta && apiHost) {
                try {
                    // Normalizar la ruta de la imagen
                    const cleanedPath = String(pacienteData.foto_ruta)
                        .replace(/\\/g, '/')
                        .replace(/^\/+/, '');

                    const imageUrl = `${apiHost.replace(/\/+$/, '')}/${cleanedPath}`;

                    // Añadir cache-buster para evitar imágenes antiguas en cache
                    const cacheBustedUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

                    // Forzar uso de la imagen de la API: limpiar cualquier foto local tomada anteriormente

                    setPhotoUri(null);
                    setImagenBase64(null);

                    setLoadedImageUri(cacheBustedUrl);

                    // Verificar que la imagen existe
                    const response = await fetch(cacheBustedUrl, { method: 'HEAD' });

                    if (!response.ok) {
                        console.warn('[PacienteModal] La imagen remota no existe o devolvió error:', response.status);
                        setLoadedImageUri(null);
                    }
                } catch (error) {
                    console.error('Error cargando imagen del paciente:', error);
                    setLoadedImageUri(null);
                }
            } else {
                // Si no hay foto en la API, mantener cualquier foto local tomada por el usuario
                // (no forzamos a null aquí para preservar una foto recién tomada en la sesión)
                setLoadedImageUri(null);
            }
        };

        loadPatientImage();
    }, [pacienteData.foto_ruta, apiHost]);

    // Log which image source is currently active for preview (API vs local capture)
    useEffect(() => {
        const previewSource = pacienteData.foto_ruta ? 'api:foto_ruta' : (photoUri ? 'local:photoUri' : (loadedImageUri ? 'loadedImageUri' : 'none'));

    }, [pacienteData.foto_ruta, photoUri, loadedImageUri]);

    // Efecto para cargar el estado del paciente y motivo de fallecimiento
    useEffect(() => {
        if (pacienteParam) {
            // Determinar el estado del paciente basado en comprado_adoptado y motivo_fallecimiento
            let estado = '';

            if (pacienteParam.motivo_fallecimiento) {
                estado = 'Fallecido';
                // Buscar el motivo de fallecimiento en el array de motivos
                const motivoEncontrado = motivosFallecimiento.find(
                    m => m.nombre.toLowerCase() === pacienteParam.motivo_fallecimiento?.toLowerCase()
                );
                setMotivoFallecimiento(motivoEncontrado || null);
            } else if (pacienteParam.comprado_adoptado) {
                // Capitalizar la primera letra para que coincida con los botones
                estado = pacienteParam.comprado_adoptado.charAt(0).toUpperCase() +
                    pacienteParam.comprado_adoptado.slice(1).toLowerCase();
            }

            setEstadoPaciente(estado);
        }
    }, [pacienteParam]);

    // Efecto para calcular años/meses cuando cambia fecha_nacimiento
    useEffect(() => {
        if (pacienteData.fecha_nacimiento) {
            try {
                // Usar la fecha formateada para el cálculo
                const formattedDate = formatDateForDisplay(pacienteData.fecha_nacimiento);
                const parts = formattedDate.split('-');

                if (parts.length === 3) {
                    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                    if (!isNaN(d.getTime())) {
                        const age = calculateAgeFromDate(d);
                        setPacienteYears(String(age.years));
                        setPacienteMonths(String(age.meses));
                    }
                }
            } catch (error) {
                console.error('Error calculando edad:', error);
            }
        }
    }, [pacienteData.fecha_nacimiento]);
    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem('@config');
                if (!raw) return;
                const config = JSON.parse(raw);
                try {
                    const user = config.usuario || config.user || {};
                    setIsAdmin((user && user.rol && String(user.rol) === 'Administrador'));
                } catch (e) {
                    setIsAdmin(false);
                }
                setApiHost(config.api_host || config.apihost || config.apiHost || null);
                setToken(config.token || null);
            } catch (e) {
                console.error('Error loading config', e);
            }
        })();
    }, []);

    // Cargar historial de peso cuando se abre en modo 'ver' o 'editar'
    useEffect(() => {
        const fetchPeso = async () => {
            try {
                if (!(mode === 'ver' || mode === 'editar')) return;
                if (!pacienteData?.id) return;
                const raw = await AsyncStorage.getItem('@config');
                if (!raw) return;
                const cfg = JSON.parse(raw);
                const host = cfg.api_host || cfg.apihost || cfg.apiHost;
                const tk = cfg.token;
                if (!host) return;

                setIsLoadingPeso(true);

                const url = `${host.replace(/\/+$/, '')}/historial_peso/Filter/1/1`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(tk ? { Authorization: `Bearer ${tk}` } : {}),
                    },
                    body: JSON.stringify({ id_paciente: pacienteData.id }),
                });

                if (!res.ok) {
                    console.warn('[PacienteModal] Error fetching historial_peso:', res.status);
                    setIsLoadingPeso(false);
                    return;
                }

                const data = await res.json();
                const first = data && data.data && data.data.length > 0 ? data.data[0] : null;
                if (first && typeof first.peso !== 'undefined' && first.peso !== null) {
                    setPacientePeso(String(first.peso));
                    setOriginalPeso(String(first.peso));
                } else {
                    setPacientePeso('');
                    setOriginalPeso(null);
                }
            } catch (err) {
                console.error('[PacienteModal] fetchPeso error', err);
            } finally {
                setIsLoadingPeso(false);
            }
        };

        fetchPeso();
    }, [mode, pacienteData?.id]);

    // Handlers
    const onDateSelected = (event, selectedDate) => {
        try {
            const currentDate = selectedDate || (pacienteData.fecha_nacimiento ? new Date(pacienteData.fecha_nacimiento) : new Date());
            setShowDatePicker(false);
            if (event.type === 'dismissed') return;

            const formattedDate = formatDateToYMD(currentDate);
            setPacienteData(prev => ({ ...prev, fecha_nacimiento: formattedDate }));
        } catch (e) {
            console.error('onDateSelected error', e);
        }
    };

    const openCamera = async () => {
        // Evitar múltiples llamadas simultáneas
        if (isCameraOpeningRef.current || cameraModalVisible) return;
        isCameraOpeningRef.current = true;

        try {
            setCameraModalVisible(true);
            setTimeout(() => { isCameraOpeningRef.current = false; }, 500);
        } catch (err) {
            console.error('Error opening camera', err);
            Alert.alert('Error', 'No se pudo abrir la cámara.');
            isCameraOpeningRef.current = false;
        }
    };

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

    const removePhoto = () => {
        setPhotoUri(null);
        setImagenBase64(null);
    };

    const handleAddToList = () => {
        const p = {
            nombre: pacienteData.nombre || 'Sin nombre',
            especie: especieSeleccionada || { nombre: pacienteData.especie },
            sexo: sexoSeleccionado || { nombre: pacienteData.sexo },
            raza: pacienteData.raza,
            fecha_nacimiento: pacienteData.fecha_nacimiento,
            foto_ruta: pacienteData.foto_ruta,
            photoUri,
        };
        setPacientesList(prev => [...prev, p]);
    };

    const handleColorSelectCliente = (color) => {
        setClienteData(prev => ({ ...prev, color }));
        setShowColorPickerCliente(false);
    };

    const handleAddClienteToList = () => {
        // Validaciones mínimas: nombre y teléfono
        if (!clienteData.nombre || !clienteData.telefono) {
            Alert.alert('Validación', 'Nombre y teléfono son obligatorios para agregar a la lista.');
            return;
        }

        const nuevo = {
            nombre: clienteData.nombre,
            telefono: clienteData.telefono,
            direccion: clienteData.direccion,
            color: clienteData.color,
        };

        setPacienteData(prev => ({
            ...prev,
            clientes: [...(prev.clientes || []), nuevo]
        }));

        // Limpiar campos
        setClienteData({ nombre: '', telefono: '', direccion: '', color: ColorsData.blanco });
        setShowColorPickerCliente(false);
        ToastAndroid.show('Cliente agregado a la lista', ToastAndroid.SHORT);
    };

    const deletePaciente = (index) => {
        setPacientesList(prev => prev.filter((_, i) => i !== index));
    };

    const handleChange = (field, value) => {
        setPacienteData(prev => ({ ...prev, [field]: value }));
    };

    const buildFotoUrl = (ruta) => {
        if (!ruta || !apiHost) return null;
        return `${apiHost.replace(/\/+$/, '')}/${String(ruta).replace(/^\\?\\/, '')}`;
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const raw = await AsyncStorage.getItem('@config');
            if (!raw) throw new Error('No hay configuración de API');
            const cfg = JSON.parse(raw);
            const host = cfg.api_host || cfg.apihost || cfg.apiHost;
            const tk = cfg.token;
            if (!host) throw new Error('Host no configurado');

            const body = {
                nombre: pacienteData.nombre,
                sexo: sexoSeleccionado?.nombre || pacienteData.sexo,
                raza: pacienteData.raza,
                especie: especieSeleccionada?.nombre || pacienteData.especie,
                fecha_nacimiento: pacienteData.fecha_nacimiento || null,
                comprado_adoptado: getCompradoAdoptadoValue(estadoPaciente),
                historia_clinica: pacienteData.historia_clinica || null,
                chip: pacienteData.chip || null,
                agresividad: agresividad,
                descuento: pacienteData.descuento ?? 0,
                motivo_fallecimiento: estadoPaciente === 'Fallecido' ?
                    (motivoFallecimiento?.nombre || null) : null,
                clientes: (pacienteData.clientes || []).map(c => ({
                    nombre: c.nombre,
                    telefono: c.telefono,
                    color: c.color,
                    direccion: c.direccion
                })),
                imagen: imagenBase64 || null,
            };

            // Si estamos creando, usar endpoint CreateWithClientes
            let url;
            let method;
            if (mode === 'crear') {
                url = `${host.replace(/\/+$/, '')}/paciente/CreateWithClients`;
                method = 'POST';
            } else if (mode === 'editar' && pacienteData.id) {
                url = `${host.replace(/\/+$/, '')}/paciente/Update/${pacienteData.id}`;
                method = 'PUT';
            } else {
                url = `${host.replace(/\/+$/, '')}/paciente`;
                method = 'POST';
            }

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(tk ? { Authorization: `Bearer ${tk}` } : {}),
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Error al guardar paciente: ${res.status} ${text}`);
            }

            const result = await res.json();

            // Determinar id del paciente creado/actualizado
            let createdId = null;
            if (mode === 'crear') {
                createdId = result.id_paciente || result.id || (result.data && (result.data.id_paciente || result.data.id)) || (result.paciente && (result.paciente.id_paciente || result.paciente.id)) || null;
            } else if (mode === 'editar') {
                createdId = pacienteData.id;
            }

            // Si estamos en crear y hay un peso ingresado, crear historial_peso
            const tryCreatePeso = async (idPaciente) => {
                try {
                    if (!idPaciente) return;
                    const pesoNum = parseFloat(String(pacientePeso).replace(',', '.'));
                    if (!pesoNum && pesoNum !== 0) return;

                    const payload = {
                        peso: Number(pesoNum.toFixed(2)),
                        fecha: formatDateToYMD(new Date()),
                        unidad_medida: 'kg',
                        id_paciente: Number(idPaciente)
                    };

                    const urlPeso = `${host.replace(/\/+$/, '')}/historial_peso/Create`;
                    const resPeso = await fetch(urlPeso, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(tk ? { Authorization: `Bearer ${tk}` } : {}),
                        },
                        body: JSON.stringify(payload),
                    });

                    if (!resPeso.ok) {
                        const txt = await resPeso.text();
                        console.warn('[PacienteModal] historial_peso/Create error', resPeso.status, txt);
                        throw new Error(`Error creando historial de peso: ${resPeso.status}`);
                    }

                    ToastAndroid.show('Historial de peso guardado', ToastAndroid.SHORT);
                } catch (err) {
                    console.error('[PacienteModal] tryCreatePeso error', err);
                    Alert.alert('Advertencia', 'No se pudo guardar el historial de peso: ' + (err.message || ''));
                }
            };

            if (mode === 'crear') {
                if (createdId && pacientePeso && pacientePeso !== '') {
                    await tryCreatePeso(createdId);
                }
                ToastAndroid.show('Paciente guardado correctamente', ToastAndroid.SHORT);
                router.back();
            } else if (mode === 'editar') {
                // Si el peso original es distinto al actual, crear un nuevo historial
                const original = originalPeso == null ? null : String(originalPeso);
                const current = pacientePeso == null ? null : String(pacientePeso);
                if ((original || '') !== (current || '')) {
                    await tryCreatePeso(createdId);
                }
                ToastAndroid.show('Paciente actualizado correctamente', ToastAndroid.SHORT);
                router.back();
            } else {
                ToastAndroid.show('Paciente guardado correctamente', ToastAndroid.SHORT);
                router.back();
            }
        } catch (err) {
            console.error(err);
            Alert.alert('Error', err.message || 'No se pudo guardar el paciente');
        } finally {
            // Ocultar overlay en cualquier caso (error o éxito)
            setIsSaving(false);
        }
    };

    // Camera modal (simplified from historia_clinicaModal)
    const CameraModal = () => {
        if (!cameraModalVisible) return null;

        const [permission, requestPermission] = useCameraPermissions();
        const [isCameraReadyLocal, setIsCameraReadyLocal] = useState(false);

        useEffect(() => {
            if (cameraModalVisible && permission && !permission.granted) {
                requestPermission();
            }
        }, [cameraModalVisible, permission]);

        if (!permission) {
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
            return (
                <Modal visible={cameraModalVisible} transparent animationType="slide">
                    <View style={styles.cameraPermissionContainer}>
                        <Text style={styles.cameraPermissionText}>
                            La aplicación necesita acceso a la cámara para tomar fotos.
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

        const handleCapture = async () => {
            if (!cameraRef.current) {
                ToastAndroid.show('Cámara no lista', ToastAndroid.SHORT);
                return;
            }
            try {
                const photo = await cameraRef.current.takePictureAsync({ quality: 1, exif: true });
                const compressed = await comprimirImagen(photo.uri);
                if (compressed) {
                    setPhotoUri(compressed.uri);
                    setImagenBase64(compressed.base64 || null);
                    setLoadedImageUri(null);
                } else {
                    setPhotoUri(photo.uri);
                    setLoadedImageUri(null);
                    try {
                        const b = await uriToBase64(photo.uri);
                        setImagenBase64(b || null);
                    } catch (e) { console.warn('[PacienteModal] Error convirtiendo foto a base64', e); setImagenBase64(null); }
                }
                setCameraModalVisible(false);
            } catch (err) {
                console.error('Error taking photo', err);
                Alert.alert('Error', 'No se pudo tomar la foto.');
            }
        };

        return (
            <Modal visible={cameraModalVisible} transparent animationType="slide">
                <View style={styles.cameraFullScreen}>
                    <View style={styles.cameraHeader}>
                        <TouchableOpacity style={styles.cameraCloseBtn} onPress={() => setCameraModalVisible(false)}>
                            <Text style={styles.cameraCloseText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.cameraContent}>
                        <CameraView
                            ref={cameraRef}
                            style={StyleSheet.absoluteFillObject}
                            facing="back"
                            onCameraReady={() => { setCameraReady(true); setIsCameraReadyLocal(true); }}
                        />
                    </View>

                    <View style={styles.cameraFooter}>
                        <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
                            <View style={styles.captureBtnInner} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    // Gallery modal similar to historia_clinicaModal
    const GalleryModal = () => {
        if (!galleryModalVisible) return null;

        const handleSelect = async (asset) => {
            try {
                const compressedResult = await comprimirImagen(asset.uri);
                if (compressedResult) {
                    setPhotoUri(compressedResult.uri);
                    setImagenBase64(compressedResult.base64 || null);
                    setLoadedImageUri(null);
                } else {
                    setPhotoUri(asset.uri);
                    setLoadedImageUri(null);
                    const b = await uriToBase64(asset.uri);
                    setImagenBase64(b || null);
                }
                ToastAndroid.show('Foto agregada', ToastAndroid.SHORT);
            } catch (err) {
                console.error('Error seleccionando imagen:', err);
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

    const makePhoneCall = async (telefono) => {

        if (!telefono) {
            Alert.alert('Teléfono no disponible');
            return;
        }

        const url = `tel:${telefono}`;

        try {
            const supported = await Linking.canOpenURL(url);

            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert('No disponible', 'No se puede abrir la app de llamadas en este dispositivo.');
            }
        } catch (err) {
            console.error("Error en makePhoneCall:", err);
            Alert.alert('Error', 'No se pudo iniciar la llamada.');
        }
    };

    const columns = [
        { key: 'nombre', label: 'Nombre', width: 120 },
        { key: 'telefono', label: 'Teléfono', width: 100 },
    ];

    // Acciones para la tabla - VERSIÓN DEBUG
    const actions = [
        {
            name: "Llamar",
            handler: (cliente) => {
                makePhoneCall(cliente.telefono);
            },
            icon: (
                <Image
                    source={require('../assets/images/llamada-telefonica.png')}
                    style={{ width: 16, height: 16, tintColor: Colors.textPrimary }}
                    resizeMode="contain"
                />
            ),
            buttonStyle: styles.callButton
        }
    ];

    const clientesItems = (pacienteData.clientes || []).map(c => ({
        ...c,
        id: c.id,
        // Asegurar que las propiedades coincidan con las columnas
        nombre: c.nombre || '',
        telefono: c.telefono || '' // Asegúrate que sea 'telefono' aquí también
    }));

    const Separator = () => (
        <View style={[styles.separatorContainer]}>
            <View style={[styles.separator, { backgroundColor: pacienteData.color }]} />
        </View>
    );

    return (
        <View style={{ flex: 1 }}>
            <TopBar onMenuNavigate={() => { }} />
            {(isSaving || isLoadingPeso) && (
                <Modal transparent={true} visible={(isSaving || isLoadingPeso)} animationType="fade">
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#fff" />
                    </View>
                </Modal>
            )}
            <CameraModal />
            <GalleryModal />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>

                        {/* Sección principal */}
                        <View style={[styles.section, { borderColor: pacienteData.color }]}>

                            {/* Header en fila */}
                            <View style={styles.headerRow}>
                                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                                    <Image
                                        source={require('../assets/images/arrow-left.png')}
                                        style={styles.icon}
                                        resizeMode="contain"
                                    />
                                </TouchableOpacity>

                                {(mode !== "crear") && (
                                    <TouchableOpacity onPress={() => setShowPatientMenu(true)} style={styles.menuButton}>
                                        <Image
                                            source={require('../assets/images/menu.png')}
                                            style={styles.icon}
                                            resizeMode="contain"
                                        />
                                    </TouchableOpacity>
                                )}

                                <Text style={styles.sectionTitle}>
                                    {mode === 'crear' ? 'Crear Paciente' : mode === 'editar' ? 'Editar Paciente' : 'Ver Paciente'}
                                </Text>
                            </View>

                            {showPacienteInfo && (
                                <View style={styles.infoBox}>
                                    <Text style={styles.infoText}>
                                        Estos datos son opcionales y crearán uno o varios pacientes asociados a este cliente
                                    </Text>
                                </View>
                            )}

                            {/* Campos básicos */}
                            <View style={styles.twoColumnRow}>
                                <View style={[styles.inputGroup, styles.column]}>
                                    <Text style={styles.label}>Nombre *</Text>
                                    <TextInput
                                        style={[styles.input, isView && styles.disabledInput]}
                                        value={pacienteData.nombre}
                                        onChangeText={(text) => setPacienteData(prev => ({ ...prev, nombre: text }))}
                                        placeholder="Nom mascota"
                                        placeholderTextColor="#999"
                                        editable={!isView}
                                    />
                                </View>

                                <View style={[styles.inputGroup, styles.column]}>
                                    <Text style={styles.label}>Sexo *</Text>
                                    <DropdownGenerico
                                        data={sexos}
                                        value={sexoSeleccionado}
                                        onValueChange={setSexoSeleccionado}
                                        placeholder="Sexo"
                                        displayKey="nombre"
                                        searchKey="nombre"
                                        disabled={isView}
                                    />
                                </View>
                            </View>

                            <View style={styles.twoColumnRow}>
                                <View style={[styles.inputGroup, styles.column]}>
                                    <Text style={styles.label}>Raza *</Text>
                                    <TextInput
                                        style={[styles.input, isView && styles.disabledInput]}
                                        value={pacienteData.raza}
                                        onChangeText={(text) => setPacienteData(prev => ({ ...prev, raza: text }))}
                                        placeholder="Raza"
                                        placeholderTextColor="#999"
                                        editable={!isView}
                                    />
                                </View>

                                <View style={[styles.inputGroup, styles.column]}>
                                    <Text style={styles.label}>Especie *</Text>
                                    <DropdownGenerico
                                        data={especies}
                                        value={especieSeleccionada}
                                        onValueChange={setEspecieSeleccionada}
                                        placeholder="Especie"
                                        displayKey="nombre"
                                        searchKey="nombre"
                                        disabled={isView}
                                    />
                                </View>
                            </View>

                            {/* Mostrar número clínico en modo ver/editar */}
                            {(mode === 'ver' || mode === 'editar') && (
                                <View style={styles.numeroClinicoContainer}>
                                    <Text style={styles.numeroClinicoLabel}>
                                        N° Clínico: <Text style={styles.numeroClinicoText}>{pacienteData.numero_clinico || '-'}</Text>
                                    </Text>
                                </View>
                            )}

                            <Separator />

                            {/* Fecha de nacimiento */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Fecha de Nacimiento *</Text>
                                <TouchableOpacity
                                    style={[styles.input, styles.datePickerTouchable, isView && styles.disabledInput]}
                                    onPress={() => { if (!isView) setShowDatePicker(true); }}
                                    activeOpacity={!isView ? 0.7 : 1}
                                >
                                    <Text style={{ color: pacienteData.fecha_nacimiento ? Colors.textSecondary : '#999' }}>
                                        {formatDateForDisplay(pacienteData.fecha_nacimiento) || 'YYYY-MM-DD'}
                                    </Text>
                                </TouchableOpacity>

                                {showDatePicker && !isView && (
                                    <DateTimePicker
                                        value={pacienteData.fecha_nacimiento ? new Date(pacienteData.fecha_nacimiento) : new Date(2025, 0, 1)}
                                        mode="date"
                                        display="default"
                                        maximumDate={new Date()}
                                        onChange={onDateSelected}
                                    />
                                )}
                            </View>

                            {/* Años y meses aproximados */}
                            <View style={styles.twoColumnRow}>
                                <View style={[styles.inputGroup, styles.column]}>
                                    <Text style={styles.label}>Años aproximados</Text>
                                    <TextInput
                                        style={[styles.input, isView && styles.disabledInput]}
                                        value={pacienteYears}
                                        onChangeText={(text) => setPacienteYears(text.replace(/[^0-9]/g, ''))}
                                        onEndEditing={() => updateDateFromYearsMonths(pacienteYears, pacienteMonths)}
                                        placeholder="0"
                                        keyboardType="numeric"
                                        editable={!isView}
                                    />
                                </View>

                                <View style={[styles.inputGroup, styles.column]}>
                                    <Text style={styles.label}>Meses aproximados</Text>
                                    <TextInput
                                        style={[styles.input, isView && styles.disabledInput]}
                                        value={pacienteMonths}
                                        onChangeText={(text) => setPacienteMonths(text.replace(/[^0-9]/g, ''))}
                                        onEndEditing={() => updateDateFromYearsMonths(pacienteYears, pacienteMonths)}
                                        placeholder="0"
                                        keyboardType="numeric"
                                        editable={!isView}
                                    />
                                </View>
                            </View>

                            <Separator />

                            {/* Chip y Peso */}
                            <View style={styles.twoColumnRow}>
                                <View style={[styles.inputGroup, styles.column]}>
                                    <Text style={styles.label}>Chip</Text>
                                    <TextInput
                                        style={[styles.input, isView && styles.disabledInput]}
                                        value={pacienteChip}
                                        onChangeText={(text) => setPacienteChip(text)}
                                        placeholder="Chip"
                                        placeholderTextColor="#999"
                                        editable={!isView}
                                    />
                                </View>

                                <View style={[styles.inputGroup, styles.column]}>
                                    <Text style={styles.label}>Peso (kg)(No disp)</Text>
                                    <TextInput
                                        style={[styles.input, isView && styles.disabledInput]}
                                        value={pacientePeso}
                                        onChangeText={(text) => setPacientePeso(text.replace(/[^0-9\.]/g, ''))}
                                        placeholder="0.0"
                                        placeholderTextColor="#999"
                                        keyboardType="decimal-pad"
                                        editable={!isView}
                                    />
                                </View>
                            </View>

                            {/* Descuento */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Descuento (%)</Text>
                                <TextInput
                                    style={[styles.input, (isView || !isAdmin) && styles.disabledInput]}
                                    value={descuento}
                                    onChangeText={(text) => {
                                        const valor = clampDescuento(text.replace(/[^0-9]/g, ''));
                                        setDescuento(valor);
                                        setPacienteData(prev => ({ ...prev, descuento: Number(valor) || 0 }));
                                    }}
                                    placeholder="0"
                                    placeholderTextColor="#999"
                                    keyboardType="numeric"
                                    editable={!isView && isAdmin}
                                />
                            </View>

                            {/* Foto del paciente */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Foto del paciente</Text>

                                {/* Solo mostrar botones de foto si NO está en modo ver */}
                                {!isView && (
                                    <View style={styles.photoButtonsRow}>
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
                                    </View>
                                )}

                                {/* Mostrar la nueva foto tomada O la imagen cargada */}
                                {(photoUri || loadedImageUri) && (
                                    <View style={[styles.photoPreviewContainer, { position: 'relative' }]}>
                                        <Image
                                            // Preferir la foto recién tomada/seleccionada (`photoUri`) sobre la remota (`loadedImageUri`)
                                            source={{ uri: (photoUri || loadedImageUri) }}
                                            style={styles.photoPreview}
                                            resizeMode="cover"
                                            onError={() => {
                                                console.warn('Error cargando imagen');
                                                setLoadedImageUri(null);
                                            }}
                                        />

                                        <TouchableOpacity
                                            onPress={() => { removePhoto(); setLoadedImageUri(null); }}
                                            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#900', zIndex: 1003 }}
                                        >
                                            <Text style={{ color: '#900', fontWeight: '700', fontSize: 14 }}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Agresividad */}
                                <View style={styles.agresividadContainer}>
                                    <Text style={styles.label}>Agresividad:</Text>
                                    <Slider
                                        style={{ width: '100%', height: 40 }}
                                        minimumValue={0}
                                        maximumValue={100}
                                        step={1}
                                        value={agresividad}
                                        onValueChange={(val) => { if (!isView) setAgresividad(val); }}
                                        minimumTrackTintColor={Colors.primary ? Colors.primary : '#000'}
                                        maximumTrackTintColor={Colors.primarySuave}
                                        thumbTintColor={Colors.primary ? Colors.primary : '#000'}
                                        disabled={isView}
                                    />
                                </View>

                                {/* Estado del paciente */}
                                <View style={styles.estadoButtonsRow}>
                                    {['Adoptado', 'Fallecido', 'Comprado'].map((e) => (
                                        <TouchableOpacity
                                            key={e}
                                            style={[styles.estadoButton, estadoPaciente === e && styles.estadoButtonSelected]}
                                            onPress={() => { if (!isView) setEstadoPaciente(prev => prev === e ? '' : e); }}
                                            disabled={isView}
                                        >
                                            <Text style={[styles.estadoButtonText, estadoPaciente === e && styles.estadoButtonTextSelected]}>{e}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Motivo de fallecimiento */}
                                {estadoPaciente === 'Fallecido' && (
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Motivo de fallecimiento</Text>
                                        <DropdownGenerico
                                            data={motivosFallecimiento}
                                            value={motivoFallecimiento}
                                            onValueChange={setMotivoFallecimiento}
                                            placeholder="Seleccionar motivo"
                                            displayKey="nombre"
                                            searchKey="nombre"
                                            disabled={isView}
                                        />
                                    </View>
                                )}
                            </View>
                        </View>

                        {/*Contenedro segundario para agregar clientes*/}
                        {(mode === "crear") && (
                            <View style={[styles.section, { borderColor: pacienteData.color }]}>

                                <View style={styles.headerRow}>
                                    <TouchableOpacity
                                        onPress={() => setShowPacienteInfo(!showPacienteInfo)}
                                        style={styles.infoButton}
                                    >
                                        <Image
                                            source={require('../assets/images/information.png')}
                                            style={{ height: 35, width: 35 }}
                                            resizeMode="contain"
                                        />
                                    </TouchableOpacity>

                                    <Text style={[styles.sectionTitle, { textAlign: 'left', flex: 1, marginLeft: Spacing.s }]}>Datos de Clientes</Text>
                                </View>

                                {showPacienteInfo && (
                                    <View style={styles.infoBox}>
                                        <Text style={styles.infoText}>
                                            Estos datos son opcionales y crearán uno o varios pacientes asociados a este cliente
                                        </Text>
                                    </View>
                                )}

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Nombre *</Text>
                                    <View style={styles.inputWithIcon}>
                                        <TextInput
                                            style={[styles.input]}
                                            value={clienteData.nombre}
                                            onChangeText={(text) => setClienteData(prev => ({ ...prev, nombre: text }))}
                                            placeholder="Nombre del cliente"
                                            placeholderTextColor="#999"
                                        />
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Teléfono *</Text>
                                    <View style={styles.inputWithIcon}>
                                        <TextInput
                                            style={[styles.input]}
                                            value={clienteData.telefono}
                                            onChangeText={(text) => setClienteData(prev => ({ ...prev, telefono: text }))}
                                            placeholder="Teléfono"
                                            keyboardType="phone-pad"
                                            placeholderTextColor="#999"
                                        />
                                        <Image
                                            source={require('../assets/images/llamada-telefonica.png')}
                                            style={styles.inputIcon}
                                            resizeMode="contain"
                                        />
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Dirección</Text>
                                    <View style={styles.inputWithIcon}>
                                        <TextInput
                                            style={[styles.input]}
                                            value={clienteData.direccion}
                                            onChangeText={(text) => setClienteData(prev => ({ ...prev, direccion: text }))}
                                            placeholder="Dirección"
                                            placeholderTextColor="#999"
                                            multiline
                                        />
                                        <Image
                                            source={require('../assets/images/ubicacion.png')}
                                            style={styles.inputIcon}
                                            resizeMode="contain"
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity style={styles.addToListButton} onPress={handleAddClienteToList}>
                                    <Text style={styles.addToListButtonText}>Agregar a la lista</Text>
                                </TouchableOpacity>

                            </View>
                        )}

                        {/* DataTable con clientes asociados */}
                        <View style={styles.clientesSection}>
                            <Text style={[styles.sectionTitle, { marginBottom: Spacing.s }]}>Clientes asociados</Text>
                            <DataTable
                                columns={columns}
                                items={clientesItems}
                                totalItems={clientesItems.length}
                                itemsPerPage={10}
                                currentPage={1}
                                actions={actions}
                                isLoading={false}
                                onPageChange={() => { }}
                                onRowClick={(item) => {
                                    ToastAndroid.show(`Cliente: ${item.nombre} - Tel: ${item.telefono}`, ToastAndroid.SHORT);
                                }}
                            />
                        </View>

                        {/* Botón guardar */}
                        {(mode !== "ver") && (
                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>
                                    {mode === 'editar' ? 'Actualizar Paciente' : 'Crear Paciente con Clientes'}
                                </Text>
                            </TouchableOpacity>
                        )}


                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
            {/* Patient Sidebar Menu overlay */}
            <PatientSidebarMenu
                isOpen={showPatientMenu}
                onClose={() => setShowPatientMenu(false)}
                paciente={pacienteData}
                apiHost={apiHost} />
        </View>
    );
}

const styles = StyleSheet.create({
    callButton: {
        backgroundColor: Colors.primaryDark,
        alignItems: 'center',
        height: "100%",
        width: "100%"
    },
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContent: {
        padding: Spacing.m,
        paddingBottom: 40,
    },
    section: {
        backgroundColor: '#fff',
        padding: Spacing.m,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: Spacing.m,
    },
    clientesSection: {
        margin: Spacing.m,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.m,
    },
    backButton: {
        backgroundColor: Colors.primarySuave,
        padding: Spacing.s,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
    },
    sectionTitle: {
        fontSize: Typography.h3,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        flex: 1,
        textAlign: 'center',
    },
    listaTitle: {
        fontSize: Typography.h3,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        marginTop: Spacing.m,
        marginBottom: Spacing.s,
    },
    colorPickerContainer: {
        position: 'relative',
    },
    colorButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#000',
    },
    colorIcon: {
        width: 24,
        height: 24,
    },
    colorDropdown: {
        position: 'absolute',
        top: 45,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: Spacing.s,
        borderWidth: 1,
        borderColor: '#000',
        elevation: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: 150,
        zIndex: 1000,
    },
    colorOption: {
        width: 25,
        height: 25,
        borderRadius: 12.5,
        margin: 4,
        borderWidth: 1,
        borderColor: '#000',
    },
    infoBox: {
        backgroundColor: '#f0f8ff',
        padding: Spacing.m,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.boton_azul,
        marginBottom: Spacing.m,
    },
    infoText: {
        fontSize: Typography.small,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: Spacing.m,
    },
    label: {
        fontSize: Typography.body,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
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
    disabledInput: {
        backgroundColor: '#eee',
        color: '#888'
    },
    inputWithIcon: {
        position: 'relative',
    },
    inputIcon: {
        position: 'absolute',
        right: 10,
        top: 12,
        width: 20,
        height: 20,
        tintColor: Colors.textSecondary,
    },
    infoButton: {
        padding: Spacing.xs,
        marginRight: Spacing.s,
        alignItems: 'center',
        justifyContent: 'center',
    },
    twoColumnRow: {
        flexDirection: 'row',
        gap: Spacing.s,
        marginBottom: Spacing.s,
    },
    column: {
        flex: 1,
    },
    separatorContainer: {
        marginVertical: Spacing.m,
    },
    separator: {
        height: 2,
        borderRadius: 1,
    },
    datePickerTouchable: {
        justifyContent: 'center',
    },
    photoButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
    },
    photoButton: {
        backgroundColor: Colors.boton_azul,
        paddingVertical: Spacing.s,
        paddingHorizontal: Spacing.m,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: Spacing.s,
        borderWidth: 1,
        borderColor: '#000',
    },
    photoButtonText: {
        color: '#fff',
        fontSize: Typography.body,
        fontWeight: '600',
    },
    deletePhotoButton: {
        backgroundColor: '#fff',
        paddingVertical: Spacing.s,
        paddingHorizontal: Spacing.m,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: Spacing.s,
        borderWidth: 1,
        borderColor: '#900',
    },
    deletePhotoButtonDisabled: {
        opacity: 0.5,
    },
    deletePhotoButtonText: {
        color: '#900',
        fontSize: Typography.body,
        fontWeight: '600',
    },
    photoPreviewContainer: {
        marginTop: Spacing.s,
        alignItems: 'center',
    },
    photoPreview: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
    },
    agresividadContainer: {
        marginTop: Spacing.s,
    },
    estadoButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.s,
        marginBottom: Spacing.s,
    },
    estadoButton: {
        flex: 1,
        paddingVertical: Spacing.s,
        marginHorizontal: 4,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 8,
        alignItems: 'center',
    },
    estadoButtonSelected: {
        backgroundColor: Colors.boton_azul,
    },
    estadoButtonText: {
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    estadoButtonTextSelected: {
        color: '#fff'
    },
    addToListButton: {
        backgroundColor: Colors.primaryDark,
        paddingVertical: Spacing.s,
        paddingHorizontal: Spacing.m,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: Spacing.s,
        borderWidth: 1,
        marginBottom: Spacing.s,
        borderColor: '#000',
    },
    addToListButtonText: {
        color: '#fff',
        fontSize: Typography.body,
        fontWeight: '600',
    },
    pacientesListContainer: {
        marginTop: Spacing.m,
    },
    pacienteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 8,
        marginBottom: Spacing.s,
        overflow: 'hidden',
        position: 'relative',
        minHeight: 110
    },
    pacienteImage: {
        width: 70,
        height: 70,
        borderRadius: 110 / 2,
        marginLeft: 8,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#ddd'
    },
    pacienteInfo: {
        flex: 1,
        padding: Spacing.s,
    },
    pacienteName: {
        fontSize: Typography.body,
        fontWeight: '700',
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    pacienteText: {
        fontSize: Typography.small,
        color: Colors.textSecondary,
        marginBottom: 2,
    },
    pacienteAgeBold: {
        fontWeight: '700'
    },
    pacienteDeleteButton: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#900',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1003
    },
    pacienteDeleteX: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14
    },
    numeroClinicoContainer: {
        backgroundColor: `${Colors.boton_azul}30`, // 50% de transparencia (80 en hexadecimal = 50%)
        borderWidth: 2,
        borderColor: Colors.boton_azul,
        padding: Spacing.m,
        borderRadius: 8,
        marginTop: Spacing.m,
    },
    numeroClinicoLabel: {
        color: Colors.textSecondary,
        fontSize: Typography.body,
    },
    numeroClinicoText: {
        fontWeight: '700',
        color: Colors.textSecondary,
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
        fontWeight: '700',
    },
    icon: {
        width: 20,
        height: 20,
        tintColor: Colors.textPrimary,
    },
    menuButton: {
        padding: Spacing.s,
        borderRadius: 8,
        backgroundColor: Colors.primarySuave,
        marginLeft: 20,
        borderWidth: 1,
        borderColor: '#000',
    },
    eyeButton: {
        padding: Spacing.s,
        borderRadius: 8,
        backgroundColor: Colors.primarySuave,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.s,
        borderWidth: 1,
        borderColor: '#000',
    },
    photoAddButton: {
        width: 42,
        height: 42,
        marginLeft: Spacing.s,
    },
    photoIcon: {
        width: 24,
        height: 24,
        tintColor: Colors.textPrimary,
    },
    // Camera & Gallery styles (copied/adapted from historia_clinicaModal)
    cameraFullScreen: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'space-between',
    },
    cameraHeader: {
        height: 60,
        padding: Spacing.s,
        justifyContent: 'center',
    },
    cameraCloseBtn: {
        alignSelf: 'flex-end',
        padding: Spacing.s,
    },
    cameraCloseText: {
        color: '#fff',
        fontSize: 24,
    },
    cameraContent: {
        flex: 1,
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
    cameraPermissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.m,
        backgroundColor: 'rgba(0,0,0,0.8)'
    },
    cameraPermissionText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: Spacing.m,
    },
    cameraPermissionButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: Spacing.s,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
    },
    cameraPermissionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cameraLoadingContainer: {
        alignItems: 'center',
        padding: 20,
        justifyContent: 'center',
    },
    cameraLoadingText: {
        color: '#fff',
        marginTop: 10,
        fontSize: 16,
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
        width: (Dimensions.get('window').width - (Spacing.m * 2) - (Spacing.xs * 6)) / 4,
        height: (Dimensions.get('window').width - (Spacing.m * 2) - (Spacing.xs * 6)) / 4,
        borderRadius: 6,
    },
    notaButtonText: {
        fontSize: Typography.small,
        fontWeight: '600',
    },
});