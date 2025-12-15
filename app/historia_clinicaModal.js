import React, { useState, useEffect } from 'react';
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
    Image,
    ActivityIndicator,
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
import * as ImagePicker from 'expo-image-picker';

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

    // Refs para las listas
    const vacunasListRef = React.useRef(null);
    const antiparasitariosListRef = React.useRef(null);
    const medicamentosListRef = React.useRef(null);
    const productosListRef = React.useRef(null);
    const serviciosListRef = React.useRef(null);
    const usuariosListRef = React.useRef(null);

    // Scroll + posiciones para validación y scroll automático
    const scrollRef = React.useRef(null);
    const positionsRef = React.useRef({});

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

    // (List states removed)

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
            } catch (error) {
                console.error('Error getting config:', error);
            }
        };
        getConfig();
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

                // Revisar config de usuario para preseleccionar si aplica
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
                                setUsuariosPreseleccionados([found]);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error reading config from AsyncStorage', err);
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

    // Función para abrir la cámara
    const openCamera = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Se necesita permiso para acceder a la cámara.');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                quality: 0.7,
                allowsEditing: true,
                aspect: [4, 3],
                base64: false, // No obtener base64 directamente, lo convertiremos después
            });

            // SDK newer uses result.assets
            const uri = result.assets && result.assets[0] ? result.assets[0].uri : result.uri;
            if (uri) {
                // Convertir a base64
                const base64 = await uriToBase64(uri);
                if (base64) {
                    // Agregar la imagen al array de fotos
                    const nuevaFoto = {
                        uri: uri,
                        base64: base64,
                        nota: '' // Nota inicial vacía
                    };
                    setFotos(prev => [...prev, nuevaFoto]);
                    ToastAndroid.show('Foto agregada', ToastAndroid.SHORT);
                } else {
                    Alert.alert('Error', 'No se pudo procesar la imagen');
                }
            }
        } catch (err) {
            console.error('Error opening camera', err);
            Alert.alert('Error', 'No se pudo abrir la cámara.');
        }
    };

    // Función para abrir la galería
    const openGallery = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Se necesita permiso para acceder a la galería.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                allowsEditing: true,
                aspect: [4, 3],
                base64: false,
            });

            const uri = result.assets && result.assets[0] ? result.assets[0].uri : result.uri;
            if (uri) {
                // Convertir a base64
                const base64 = await uriToBase64(uri);
                if (base64) {
                    // Agregar la imagen al array de fotos
                    const nuevaFoto = {
                        uri: uri,
                        base64: base64,
                        nota: '' // Nota inicial vacía
                    };
                    setFotos(prev => [...prev, nuevaFoto]);
                    ToastAndroid.show('Foto agregada', ToastAndroid.SHORT);
                } else {
                    Alert.alert('Error', 'No se pudo procesar la imagen');
                }
            }
        } catch (err) {
            console.error('Error opening gallery', err);
            Alert.alert('Error', 'No se pudo abrir la galería.');
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

        const refs = [vacunasListRef, antiparasitariosListRef, medicamentosListRef, productosListRef, serviciosListRef];

        refs.forEach(r => {
            try {
                if (r.current?.getTotals && typeof r.current.getTotals === 'function') {
                    const t = r.current.getTotals();
                    totalCobrar += parseFloat(t.totalCobrar || 0) || 0;
                    totalProfit += parseFloat(t.totalProfit || 0) || 0;
                } else if (r.current?.items) {
                    // Fallback: calcular desde items si getTotals no está disponible
                    r.current.items.forEach(item => {
                        if (item.selected) {
                            const price = parseFloat(item.precio_cup || 0) || 0;
                            const qty = parseFloat(item.cantidad || 0) || 0;
                            // intentar diferentes campos de costo
                            const cost = parseFloat(item.selected.producto?.comerciable?.precio_cup || item.selected.costo_cup || 0) || 0;
                            totalCobrar += price * qty;
                            totalProfit += (price * qty) - (cost * qty);
                        }
                    });
                }
            } catch (err) {
                console.error('Error calculando totales desde ref:', err);
            }
        });

        return {
            totalCobrar: isNaN(totalCobrar) ? 0 : totalCobrar,
            totalProfit: isNaN(totalProfit) ? 0 : Math.max(0, totalProfit)
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
    
    // Crear consulta (usa validaciones). Por ahora no realiza la creación final (comentada)
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
            if (!vm.ok) return; // ya mostramos error dentro

            // Validar Servicios
            const vs = await validateServicios(host, token, usuariosIds);
            if (!vs.ok) return; // error mostrado dentro

            // Validar Productos
            const vp = await validateProductos(host, token, usuariosIds);
            if (!vp.ok) return; // error mostrado dentro

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
                fotos: fotosPayload, // Agregar el array de fotos
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

                // Aquí se crearían las ventas (comentado por ahora)
                // TODO: crear ventas usando los endpoints correspondientes

                setValidationProgress(100);
                setValidationTitle('Consulta creada correctamente');
                setTimeout(() => { setValidationVisible(false); }, 800);
                ToastAndroid.show('Consulta creada', ToastAndroid.SHORT);
            } catch (errCreate) {
                console.error('Error creando consulta:', errCreate);
                Alert.alert('Error', errCreate.message || 'Error desconocido');
                setValidationVisible(false);
                return;
            }
        } catch (err) {
            console.error('Error en handleCreate:', err);
            Alert.alert('Error', err.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    // Actualizar consulta (mismo flujo de validación)
    const handleUpdate = async () => {
        // Reuse same flow for now
        await handleCreate();
    };

    const handleDelete = async () => {
        if (!consultaData.id_consulta) return;

        Alert.alert('Confirmar eliminación', '¿Eliminar esta consulta?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar',
                style: 'destructive',
                onPress: async () => {
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

                        const url = `${host}/api/consultas/${consultaData.id_consulta}`;
                        const headers = {};
                        if (token) headers['Authorization'] = `Bearer ${token}`;

                        const response = await fetch(url, { method: 'DELETE', headers });

                        if (!response.ok) {
                            const error = await response.text();
                            Alert.alert('Error', `Fallo al eliminar: ${error}`);
                            return;
                        }

                        ToastAndroid.show('Consulta eliminada', ToastAndroid.SHORT);
                        router.back();
                    } catch (error) {
                        Alert.alert('Error', error.message);
                    } finally {
                        setLoading(false);
                    }
                },
            },
        ]);
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

    return (
        <View style={styles.container}>
            <TopBar onMenuNavigate={() => { }} />

            {/* Modal para vista completa de imagen */}
            <FullscreenImageModal />

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
                        <TextInput
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
                    onChange={(t) => setListsTotals(prev => ({ ...prev, medicamentos: t }))}
                />
                <ServiciosLista
                    ref={serviciosListRef}
                    isEditable={isEditable}
                    onChange={(t) => setListsTotals(prev => ({ ...prev, servicios: t }))}
                />
                <ProductosList
                    ref={productosListRef}
                    isEditable={isEditable}
                    onChange={(t) => setListsTotals(prev => ({ ...prev, productos: t }))}
                />
                <VacunasLista
                    ref={vacunasListRef}
                    isEditable={isEditable}
                    onChange={(t) => setListsTotals(prev => ({ ...prev, vacunas: t }))}
                />
                <AntiparasitariosLista
                    ref={antiparasitariosListRef}
                    isEditable={isEditable}
                    onChange={(t) => setListsTotals(prev => ({ ...prev, antiparasitarios: t }))}
                />

                {/* Contenedor de Resumen de Totales */}
                {(() => {
                    // Usar totales provistos por cada lista (actualizados vía onChange)
                    const totalCobrar = Object.values(listsTotals).reduce((s, v) => s + (parseFloat(v.totalCobrar || 0) || 0), 0);
                    const totalProfit = Object.values(listsTotals).reduce((s, v) => s + (parseFloat(v.totalProfit || 0) || 0), 0);

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

                    return (
                        <View style={styles.section}>
                            <Text style={styles.label}>Resumen de Cobro</Text>

                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Total a cobrar:</Text>
                                <Text style={styles.summaryValue}>${totalCobrar.toFixed(2)}</Text>
                            </View>

                            <View style={styles.summaryRow}>
                                <View style={styles.summaryLabelContainer}>
                                    <Text style={styles.summaryLabel}>Total con descuento </Text>
                                    <Text style={[styles.summaryLabel, styles.descuentoText]}>({parsedDescuento}%)</Text>
                                    <Text style={styles.summaryLabel}>:</Text>
                                </View>
                                <Text style={styles.summaryValue}>${totalConDescuento.toFixed(2)}</Text>
                            </View>

                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Plus (Ganancia):</Text>
                                <Text style={styles.summaryValue}>${totalProfit.toFixed(2)}</Text>
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
                            {isEditable && (
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
                                        {isEditable && (
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
                                            {isEditable && (
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
                        <TextInput
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
                        <TextInput
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
                        <TextInput
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

                        {mode === 'editar' && (
                            <TouchableOpacity
                                style={[styles.deleteButton, loading && styles.buttonDisabled]}
                                onPress={handleDelete}
                                disabled={loading}
                            >
                                <Text style={styles.deleteButtonText}>Eliminar</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
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
});