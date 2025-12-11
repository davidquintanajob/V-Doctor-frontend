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
import { Colors, Spacing, Typography } from '../variables';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const { width: screenWidth } = Dimensions.get('window');

export default function HistoriaClinicaModalScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const mode = params.mode; // 'crear' | 'editar' | 'ver'
    const consultaParam = params.consulta ? JSON.parse(params.consulta) : null;
    const pacienteParam = params.paciente ? JSON.parse(params.paciente) : null;

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

    const [fotosConsulta, setFotosConsulta] = useState(consultaParam?.foto_consulta ?? []);
    const [showFotos, setShowFotos] = useState(false);
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

    // Refs para las listas
    const vacunasListRef = React.useRef(null);
    const antiparasitariosListRef = React.useRef(null);
    const medicamentosListRef = React.useRef(null);
    const productosListRef = React.useRef(null);
    const serviciosListRef = React.useRef(null);

    // Estado para datos del paciente (descuento)
    const [pacienteData, setPacienteData] = useState(null);

    // Totales por lista (actualizados por onChange desde cada lista)
    const [listsTotals, setListsTotals] = useState({
        vacunas: { totalCobrar: 0, totalProfit: 0 },
        antiparasitarios: { totalCobrar: 0, totalProfit: 0 },
        medicamentos: { totalCobrar: 0, totalProfit: 0 },
        productos: { totalCobrar: 0, totalProfit: 0 },
        servicios: { totalCobrar: 0, totalProfit: 0 },
    });

    // Tipo de pago: 'efectivo' (default) | 'transferencia'
    const [paymentType, setPaymentType] = useState('efectivo');

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
            } catch (error) {
                console.error('Error getting config:', error);
            }
        };
        getConfig();
    }, []);

    // Limpiar temporizadores al desmontar
    useEffect(() => {
        return () => {
            if (recordingTimerAnamnesis) clearInterval(recordingTimerAnamnesis);
            if (recordingTimerDiagnostico) clearInterval(recordingTimerDiagnostico);
            if (recordingTimerTratamiento) clearInterval(recordingTimerTratamiento);
            if (recordingTimerPatologia) clearInterval(recordingTimerPatologia);
        };
    }, [recordingTimerAnamnesis, recordingTimerDiagnostico, recordingTimerTratamiento, recordingTimerPatologia]);

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

    const buildFotoUrl = (ruta) => {
        if (!ruta) return '';
        let path = ruta.replace(/\\/g, '/');
        if (!path.startsWith('/')) path = '/' + path;
        return `${apiHost}${path}`;
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
        if (!consultaData.motivo.trim()) {
            ToastAndroid.show('El motivo es requerido', ToastAndroid.SHORT);
            return;
        }

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

            let url = `${host}/api/consultas`;
            let method = 'POST';

            if (mode === 'editar' && consultaData.id_consulta) {
                url = `${host}/api/consultas/${consultaData.id_consulta}`;
                method = 'PUT';
            }

            // Preparar datos en formato JSON (listas removidas)
            const payload = {
                fecha: consultaData.fecha,
                motivo: consultaData.motivo,
                diagnostico: consultaData.diagnostico || null,
                anamnesis: consultaData.anamnesis || null,
                tratamiento: consultaData.tratamiento || null,
                patologia: consultaData.patologia || null,
                id_paciente: consultaData.id_paciente,
                id_usuario: consultaData.id_usuario,
                vacunas: null,
                antiparasitarios: null,
                ventas: null,
                servicios: null,
            };

            const headers = {
                'Content-Type': 'application/json',
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const error = await response.text();
                Alert.alert('Error', `Fallo al guardar: ${error}`);
                return;
            }

            ToastAndroid.show(`Consulta ${mode === 'editar' ? 'actualizada' : 'creada'} exitosamente`, ToastAndroid.SHORT);
            router.back();
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
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

    // List components removed

    return (
        <View style={styles.container}>
            <TopBar onMenuNavigate={() => { }} />
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">
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
                <View style={styles.section}>
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
                <View style={styles.section}>
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
                <View style={styles.section}>
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

                {/* List sections removed */}

                {/* Fotos Consulta - Galería */}
                {fotosConsulta && fotosConsulta.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.fotosHeader}>
                            <Text style={styles.label}>Imágenes de la Consulta</Text>
                            <TouchableOpacity
                                onPress={() => setShowFotos(!showFotos)}
                                disabled={fotosConsulta.length === 0}
                                style={styles.eyeButton}
                            >
                                <Image
                                    source={
                                        showFotos
                                            ? require('../assets/images/eye-open.png')
                                            : require('../assets/images/eye-closed.png')
                                    }
                                    style={styles.eyeIcon}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>
                        </View>

                        {showFotos && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.fotosCarrusel}
                                contentContainerStyle={styles.fotosCarruselContent}
                            >
                                {fotosConsulta.map((foto, idx) => {
                                    const fotoUrl = typeof foto === 'string' ? buildFotoUrl(foto) : buildFotoUrl(foto.ruta || foto);
                                    return (
                                        <Image
                                            key={idx}
                                            source={{ uri: fotoUrl }}
                                            style={styles.fotoItem}
                                        />
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                )}

                {/* Si no hay fotos, mostrar botón deshabilitado */}
                {(!fotosConsulta || fotosConsulta.length === 0) && (
                    <View style={styles.section}>
                        <View style={styles.fotosHeader}>
                            <Text style={styles.label}>Imágenes de la Consulta</Text>
                            <TouchableOpacity
                                disabled={true}
                                style={[styles.eyeButton, styles.eyeButtonDisabled]}
                            >
                                <Image
                                    source={require('../assets/images/eye-closed.png')}
                                    style={styles.eyeIcon}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.noFotosText}>No hay imágenes disponibles</Text>
                    </View>
                )}

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
    // List styles removed
    // Estilos existentes para fotos
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
    eyeButtonDisabled: {
        opacity: 0.5,
        backgroundColor: '#ccc',
    },
    eyeIcon: {
        width: 20,
        height: 20,
        tintColor: Colors.textPrimary,
    },
    fotosCarrusel: {
        marginTop: Spacing.s,
    },
    fotosCarruselContent: {
        paddingHorizontal: Spacing.xs,
        gap: Spacing.s,
    },
    fotoItem: {
        width: 150,
        height: 150,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
        marginRight: Spacing.s,
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
    buttonDisabled: {
        opacity: 0.6,
    },
});