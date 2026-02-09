import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    Linking,
    ToastAndroid,
    ActivityIndicator,
    Modal
    ,
    Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import TopBar from '../components/TopBar';
import DropdownGenerico from '../components/DropdownGenerico';
import { Colors, Spacing, Typography, ColorsData } from '../variables';
// Image is available from the main react-native import above
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';

const { width: screenWidth } = Dimensions.get('window');

export default function ClienteModalScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Parsear parámetros
    const mode = params.mode;
    const cliente = params.cliente ? JSON.parse(params.cliente) : null;

    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showPacienteColorPicker, setShowPacienteColorPicker] = useState(false);
    const [showPacienteInfo, setShowPacienteInfo] = useState(false);

    // Estado para los datos del cliente
    const [clienteData, setClienteData] = useState({
        nombre: cliente?.nombre || '',
        telefono: cliente?.telefono || '',
        direccion: cliente?.direccion || '',
        color: cliente?.color || ColorsData.blanco
    });

    // Estado para datos de pacientes
    const [pacienteData, setPacienteData] = useState({
        nombre: '',
        especie: '',
        raza: '',
        color: ColorsData.blanco,
        fecha_nacimiento: '',
        sexo: ''
    });

    // Campos para edad aproximada
    const [pacienteYears, setPacienteYears] = useState('');
    const [pacienteMonths, setPacienteMonths] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    // Campos adicionales solicitados
    const [pacienteChip, setPacienteChip] = useState('');
    const [pacientePeso, setPacientePeso] = useState('');
    // Número clínico eliminado (no necesario)
    const [descuento, setDescuento] = useState('');
    const [photoUri, setPhotoUri] = useState(null);
    const [agresividad, setAgresividad] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    // Estado para lista de pacientes y estado/razón (Adoptado / Fallecido / Comprado)
    const [estadoPaciente, setEstadoPaciente] = useState(''); // '', 'Adoptado','Fallecido','Comprado'
    const [motivoFallecimiento, setMotivoFallecimiento] = useState(null);
    const [pacientesList, setPacientesList] = useState([]);

    const [especieSeleccionada, setEspecieSeleccionada] = useState(null);
    const [sexoSeleccionado, setSexoSeleccionado] = useState(null);

    // Host de la API para cargar fotos cuando estemos en modo 'ver'
    const [apiHost, setApiHost] = useState(null);

    // Datos de Sexo para el Dropdown
    const sexos = [
        { id: 1, nombre: 'macho' },
        { id: 2, nombre: 'hembra' },
        { id: 3, nombre: 'otros' }
    ];
    // Datos de Especies para el Dropdown
    const especies = [
        { id: 1, nombre: 'Canino', image: require('../assets/images/especies/canino.png') },
        { id: 2, nombre: 'Felino', image: require('../assets/images/especies/gato-egipcio.png') },
        { id: 3, nombre: 'Ave', image: require('../assets/images/especies/gorrion.png') },
        { id: 4, nombre: 'Roedor', image: require('../assets/images/especies/huella.png') },
        { id: 5, nombre: 'Peces', image: require('../assets/images/especies/huella.png') },
        { id: 6, nombre: 'Caprino', image: require('../assets/images/especies/huella.png') },
        { id: 7, nombre: 'Porcino', image: require('../assets/images/especies/cerdo.png') },
        { id: 8, nombre: 'Ovino', image: require('../assets/images/especies/huella.png') },
        { id: 9, nombre: 'Otros', image: require('../assets/images/especies/huella.png') },
    ];

    const motivosFallecimiento = [
        { id: 1, nombre: 'Eutanasia' },
        { id: 2, nombre: 'Accidente' },
        { id: 3, nombre: 'Enfermedad' },
        { id: 4, nombre: 'Vejez' },
        { id: 5, nombre: 'Otros' }
    ];

    const handleMenuNavigate = (link) => {
        // Navegación del menú si es necesario
    };

    const handleBack = () => {
        router.back();
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
            Alert.alert('Error', 'No se pudo iniciar la llamada.');
        }
    };

    const handleColorSelect = (color) => {
        if (mode !== 'ver') {
            setClienteData(prev => ({ ...prev, color }));
            setShowColorPicker(false);
        }
    };

    const handlePacienteColorSelect = (color) => {
        if (mode !== 'ver') {
            setPacienteData(prev => ({ ...prev, color }));
            setShowPacienteColorPicker(false);
        }
    };

    const formatDateToYMD = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const calculateAgeFromDate = (date) => {
        const now = new Date();
        let years = now.getFullYear() - date.getFullYear();
        let months = now.getMonth() - date.getMonth();
        if (now.getDate() < date.getDate()) {
            months -= 1;
        }
        if (months < 0) {
            years -= 1;
            months += 12;
        }
        return { years, months };
    };

    const onDateSelected = (event, selectedDate) => {
        // On Android the event may be 'dismissed' with undefined date
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            const formatted = formatDateToYMD(selectedDate);
            setPacienteData(prev => ({ ...prev, fecha_nacimiento: formatted }));
            const age = calculateAgeFromDate(selectedDate);
            setPacienteYears(String(age.years));
            setPacienteMonths(String(age.months));
        }
    };

    const updateDateFromYearsMonths = (yearsStr, monthsStr) => {
        const years = parseInt(yearsStr) || 0;
        const months = parseInt(monthsStr) || 0;
        const now = new Date();
        // Subtract years and months from today to estimate birthdate
        const estimated = new Date(now.getFullYear() - years, now.getMonth() - months, now.getDate());
        setPacienteData(prev => ({ ...prev, fecha_nacimiento: formatDateToYMD(estimated) }));
    };

    const clampDescuento = (value) => {
        let n = parseInt(value, 10);
        if (isNaN(n)) return '';
        if (n < 1) n = 1;
        if (n > 100) n = 100;
        return String(n);
    };

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
            });

            // SDK newer uses result.assets
            const uri = result.assets && result.assets[0] ? result.assets[0].uri : result.uri;
            if (uri) {
                setPhotoUri(uri);
            }
        } catch (err) {
            console.error('Error opening camera', err);
            Alert.alert('Error', 'No se pudo abrir la cámara.');
        }
    };

    const removePhoto = () => {
        if (!photoUri) return;
        Alert.alert(
            'Eliminar foto',
            '¿Deseas eliminar la foto seleccionada?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => setPhotoUri(null) }
            ]
        );
    };

    useEffect(() => {
        // If fecha_nacimiento is initialized from props, compute years/months
        if (pacienteData.fecha_nacimiento) {
            const parts = pacienteData.fecha_nacimiento.split('-');
            if (parts.length === 3) {
                const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                if (!isNaN(d.getTime())) {
                    const age = calculateAgeFromDate(d);
                    setPacienteYears(String(age.years));
                    setPacienteMonths(String(age.months));
                }
            }
        }
    }, [pacienteData.fecha_nacimiento]);

    // Cargar host de API desde la configuración en AsyncStorage (para construir URLs de fotos)
    useEffect(() => {
        (async () => {
            try {
                const rawConfig = await AsyncStorage.getItem('@config');
                if (!rawConfig) return;
                const parsed = JSON.parse(rawConfig);
                const host = parsed?.api_host || parsed?.apihost || parsed?.apiHost;
                if (!host) return;
                let finalHost = host;
                // Si la configuración apunta a localhost y estamos en Android emulador, ajustar
                if (Platform.OS === 'android' && (finalHost.includes('localhost') || finalHost.includes('127.0.0.1'))) {
                    finalHost = finalHost.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
                }
                setApiHost(finalHost);
            } catch (e) {
                // no crítico, simplemente no mostraremos fotos remotas si falla
                console.warn('No se pudo leer @config para apiHost', e);
            }
        })();
    }, []);

    // Ajustar la base URL según plataforma (Android emulator suele necesitar 10.0.2.2)
    const mapEstadoToCompradoAdoptado = (estado) => {
        if (!estado) return '';
        const e = estado.toLowerCase();
        if (e === 'comprado') return 'comprado';
        if (e === 'comprado' || e === 'comprado') return 'comprado';
        if (e === 'adoptado' || e === 'adoptado') return 'adoptado';
        if (e === 'fallecido' || e === 'fallecido') return 'fallecido';
        // Otros casos: devolver en minúsculas
        return e;
    };

    const uriToBase64 = async (uri) => {
        if (!uri) return '';
        try {
            // Intento 1: leer directamente (algunas versiones de expo-file-system no exponen EncodingType)
            const enc = (FileSystem.EncodingType && FileSystem.EncodingType.Base64) ? FileSystem.EncodingType.Base64 : 'base64';
            try {
                const b64 = await FileSystem.readAsStringAsync(uri, { encoding: enc });
                return b64;
            } catch (readErr) {
                // Intento 2: descargar a archivo temporal y leer desde allí (sirve para content:// URIs en Android)
                try {
                    const tmpPath = FileSystem.documentDirectory + `tmp_image_${Date.now()}`;
                    const dl = await FileSystem.downloadAsync(uri, tmpPath);
                    const b64 = await FileSystem.readAsStringAsync(dl.uri, { encoding: 'base64' });
                    // intentar eliminar temporal (no crítico)
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

    const handleSave = async () => {
        // Mostrar overlay de guardado inmediatamente
        setIsSaving(true);
        // Verificar configuración de API (igual que en login.js)
        try {
            const rawConfig = await AsyncStorage.getItem('@config');
            if (!rawConfig) {
                setIsSaving(false);
                Alert.alert('Configuración requerida', 'Debes configurar la API primero');
                router.replace('/config');
                return;
            }

            const parsedConfig = JSON.parse(rawConfig);
            const host = parsedConfig?.api_host || parsedConfig?.apihost || parsedConfig?.apiHost;
            if (!host) {
                setIsSaving(false);
                Alert.alert('Configuración requerida', 'Debes configurar la API primero');
                router.replace('/config');
                return;
            }

            // Validaciones básicas para cliente
            if (!clienteData.nombre || !clienteData.nombre.trim()) {
                setIsSaving(false);
                Alert.alert('Error', 'El nombre del cliente es requerido');
                return;
            }
            if (!clienteData.telefono || !clienteData.telefono.trim()) {
                setIsSaving(false);
                Alert.alert('Error', 'El teléfono del cliente es requerido');
                return;
            }

            // Construir lista de pacientes a enviar: usar los agregados y, si hay datos en el formulario actual, incluirlos también
            const patientsToSend = [...pacientesList];
            if (pacienteData.nombre && pacienteData.nombre.trim()) {
                patientsToSend.push({
                    ...pacienteData,
                    especie: especieSeleccionada,
                    sexo: sexoSeleccionado,
                    estado: estadoPaciente,
                    motivoFallecimiento,
                    chip: pacienteChip,
                    peso: pacientePeso,
                    descuento,
                    agresividad,
                    photoUri
                });
            }

            // Convertir cada paciente al formato de la API, incluyendo imagen en base64
            const pacientesApi = [];
            for (const p of patientsToSend) {
                const imagenBase64 = p.photoUri ? await uriToBase64(p.photoUri) : '';
                let auxComprado_Adoptado = mapEstadoToCompradoAdoptado(p.estado);
                if (auxComprado_Adoptado === "fallecido") {
                    auxComprado_Adoptado = "";
                }

                pacientesApi.push({
                    nombre: p.nombre || '',
                    sexo: p.sexo?.nombre || (typeof p.sexo === 'string' ? p.sexo : ''),
                    raza: p.raza || '',
                    especie: p.especie?.nombre || (p.especie && p.especie.nombre) || (typeof p.especie === 'string' ? p.especie : ''),
                    fecha_nacimiento: p.fecha_nacimiento || '',
                    comprado_adoptado: auxComprado_Adoptado,
                    historia_clinica: p.historia_clinica || '',
                    motivo_fallecimiento: p.motivoFallecimiento?.nombre || p.motivoFallecimiento || '',
                    chip: p.chip || p.chip || '',
                    agresividad: Number(p.agresividad) || 0,
                    descuento: Number(p.descuento) || 0,
                    imagen: imagenBase64 || ''
                });
            }

            const body = {
                nombre: clienteData.nombre,
                telefono: clienteData.telefono,
                color: clienteData.color,
                direccion: clienteData.direccion,
                pacientes: pacientesApi
            };

            const base = host.replace(/\/+$/, '');
            // Si estamos en modo editar, usar endpoint UpdateCliente/{id}
            const clienteId = cliente?.id_cliente || cliente?.id || cliente?.idCliente || cliente?.cliente_id;
            let url;
            let method = 'POST';
            if (mode === 'editar') {
                if (!clienteId) {
                    Alert.alert('Error', 'No se pudo identificar el cliente a actualizar');
                    return;
                }
                url = `${base}/cliente/UpdateCliente/${clienteId}`;
                method = 'PUT';
            } else {
                url = `${base}/cliente/CreateClienteWithPatients`;
                method = 'POST';
            }

            // Preparar headers (añadir Authorization si existe token en config)
            const headers = { 'Content-Type': 'application/json' };
            if (parsedConfig.token) {
                headers['Authorization'] = `Bearer ${parsedConfig.token}`;
            }

            // Enviar petición
            const res = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(body)
            });

            if (res.status === 403) {
                // Sesión expirada
                router.replace('/login');
                return;
            }

            const responseData = await res.json().catch(() => null);
            if (!res.ok) {
                // Manejar errores de la API
                let errorMessage = 'Error desconocido';
                if (responseData && responseData.errors && Array.isArray(responseData.errors)) {
                    errorMessage = responseData.errors.join('\n• ');
                } else if (responseData && (responseData.message || responseData.description)) {
                    errorMessage = responseData.message || responseData.description;
                } else if (responseData) {
                    errorMessage = JSON.stringify(responseData);
                }
                Alert.alert(`Error ${res.status}`, errorMessage);
                return;
            }

            // Exito - mensajes distintos según crear/editar
            if (mode === 'editar') {
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Cliente actualizado correctamente', ToastAndroid.SHORT);
                } else {
                    Alert.alert('Éxito', 'Cliente actualizado correctamente');
                }
            } else {
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Cliente creado correctamente', ToastAndroid.SHORT);
                } else {
                    Alert.alert('Éxito', 'Cliente creado correctamente');
                }
            }
            router.back();

        } catch (err) {
            console.error('Error al crear cliente:', err);
            if (err.message && err.message.includes('Network request failed')) {
                Alert.alert('Error de conexión', 'No se pudo conectar al servidor');
            } else {
                Alert.alert('Error', err.message || 'Error en la petición');
            }
        } finally {
            // Ocultar overlay en cualquier caso (error o éxito)
            setIsSaving(false);
        }
    };

    const handleAddToList = () => {
        // Validar campos obligatorios (marcados con *)
        if (!pacienteData.nombre.trim()) {
            Alert.alert('Error', 'El nombre del paciente es requerido');
            return;
        }
        if (!sexoSeleccionado) {
            Alert.alert('Error', 'El sexo del paciente es requerido');
            return;
        }
        if (!pacienteData.raza.trim()) {
            Alert.alert('Error', 'La raza del paciente es requerida');
            return;
        }
        if (!especieSeleccionada) {
            Alert.alert('Error', 'La especie del paciente es requerida');
            return;
        }
        if (!pacienteData.fecha_nacimiento) {
            Alert.alert('Error', 'La fecha de nacimiento del paciente es requerida');
            return;
        }

        // Construir objeto de paciente que se agregará a la lista
        const nuevoPaciente = {
            nombre: pacienteData.nombre.trim(),
            especie: especieSeleccionada,
            sexo: sexoSeleccionado,
            raza: pacienteData.raza.trim(),
            color: pacienteData.color,
            fecha_nacimiento: pacienteData.fecha_nacimiento,
            chip: pacienteChip,
            peso: pacientePeso,
            descuento,
            agresividad,
            photoUri,
            estado: estadoPaciente,
            motivoFallecimiento: motivoFallecimiento,
            createdAt: new Date().toISOString()
        };

        setPacientesList(prev => [...prev, nuevoPaciente]);

        // Limpiar campos después de agregar
        setPacienteData({
            nombre: '',
            especie: '',
            raza: '',
            color: ColorsData.blanco,
            fecha_nacimiento: '',
            sexo: ''
        });
        setPacienteYears('');
        setPacienteMonths('');
        setPacienteChip('');
        setPacientePeso('');
        setDescuento('');
        setPhotoUri(null);
        setAgresividad(0);
        setEspecieSeleccionada(null);
        setSexoSeleccionado(null);
        setEstadoPaciente('');
        setMotivoFallecimiento(null);

        Alert.alert('Éxito', 'Paciente agregado a la lista');
    };

    const deletePaciente = (index) => {
        Alert.alert(
            'Eliminar paciente',
            '¿Deseas eliminar este paciente de la lista?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar', style: 'destructive', onPress: () => {
                        setPacientesList(prev => prev.filter((_, i) => i !== index));
                    }
                }
            ]
        );
    };

    const computeAgeString = (birthYMD) => {
        if (!birthYMD) return '';
        const parts = birthYMD.split('-');
        if (parts.length !== 3) return '';
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
    };

    const isEditable = mode !== 'ver';
    const isCreateMode = mode === 'crear';
    const showPacienteInputs = isCreateMode; // solo mostrar inputs de paciente al crear
    const showPacientesListInViewMode = mode === 'ver'; // mostrar lista from cliente en ver

    // Determinar color del icono basado en el color de fondo
    const getIconTintColor = (backgroundColor) => {
        // Si el color de fondo es blanco, usar color oscuro, sino usar blanco
        return backgroundColor === ColorsData.blanco ? Colors.textSecondary : '#ffffff';
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.container}>
                    <TopBar onMenuNavigate={handleMenuNavigate} />

                    {isSaving && (
                        <Modal transparent={true} visible={isSaving} animationType="fade">
                            <View style={styles.loadingOverlay}>
                                <ActivityIndicator size="large" color="#fff" />
                            </View>
                        </Modal>
                    )}

                    <ScrollView
                        style={styles.scrollContent}
                        contentContainerStyle={[styles.scrollContentContainer, { paddingBottom: Spacing.page }]}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        nestedScrollEnabled={true}
                    >
                        {/* Datos del Cliente */}
                        <View style={[styles.section, { borderColor: clienteData.color ? clienteData.color : '#000000' }]}>
                            <View style={styles.clienteHeader}>
                                {/* Botón de volver */}
                                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                                    <Image
                                        source={require('../assets/images/arrow-left.png')}
                                        style={styles.icon}
                                        resizeMode="contain"
                                    />
                                </TouchableOpacity>

                                <Text style={styles.sectionTitle}>
                                    {mode === 'ver' ? 'Detalles de Cliente' :
                                        mode === 'editar' ? 'Editar Cliente' : 'Crear Cliente'}
                                </Text>

                                {/* Color Picker Button - Solo mostrar si no es modo "ver" */}
                                <View style={styles.colorPickerContainer}>
                                    <TouchableOpacity
                                        style={[
                                            styles.colorButton,
                                            { backgroundColor: clienteData.color }
                                        ]}
                                        onPress={() => setShowColorPicker(!showColorPicker)}
                                    >
                                        <Image
                                            source={require('../assets/images/paleta-de-color.png')}
                                            style={[
                                                styles.colorIcon,
                                                { tintColor: getIconTintColor(clienteData.color) }
                                            ]}
                                            resizeMode="contain"
                                        />
                                    </TouchableOpacity>

                                    {/* Color Picker Dropdown */}
                                    {showColorPicker && (
                                        <View style={styles.colorDropdown}>
                                            {Object.entries(ColorsData).map(([name, color]) => (
                                                <TouchableOpacity
                                                    key={name}
                                                    style={[styles.colorOption, { backgroundColor: color }]}
                                                    onPress={() => handleColorSelect(color)}
                                                />
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Nombre *</Text>
                                <View style={styles.inputWithIcon}>
                                    <TextInput
                                        style={[styles.input, !isEditable && styles.disabledInput]}
                                        value={clienteData.nombre}
                                        onChangeText={(text) => setClienteData(prev => ({ ...prev, nombre: text }))}
                                        placeholder="Nombre del cliente"
                                        editable={isEditable}
                                        placeholderTextColor="#999"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Teléfono *</Text>
                                <View style={styles.inputWithIcon}>
                                    <TextInput
                                        style={[styles.input, !isEditable && styles.disabledInput]}
                                        value={clienteData.telefono}
                                        onChangeText={(text) => setClienteData(prev => ({ ...prev, telefono: text }))}
                                        placeholder="Teléfono"
                                        keyboardType="phone-pad"
                                        editable={isEditable}
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
                                        style={[styles.input, !isEditable && styles.disabledInput]}
                                        value={clienteData.direccion}
                                        onChangeText={(text) => setClienteData(prev => ({ ...prev, direccion: text }))}
                                        placeholder="Dirección"
                                        editable={isEditable}
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
                            <View style={styles.inputGroup}>
                                {/* Botón de llamada en modo ver */}
                                {mode === 'ver' && cliente?.telefono && (
                                    <TouchableOpacity onPress={() => makePhoneCall(cliente.telefono)} style={styles.phoneButton}>
                                        <Image source={require('../assets/images/llamada-telefonica.png')} style={styles.icon} resizeMode="contain" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Datos de Pacientes - Solo mostrar inputs en modo crear */}
                        {showPacienteInputs && (
                            <View style={[styles.section, { borderColor: pacienteData.color ? pacienteData.color : '#000000' }]}>
                                <View style={styles.pacienteHeader}>
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
                                    <Text style={styles.sectionTitle}>Datos de Pacientes</Text>

                                    {/* Paciente Color Picker */}
                                    <View style={{
                                        position: 'relative',
                                        zIndex: 1001,
                                        marginLeft: 20
                                    }}>
                                        <TouchableOpacity
                                            style={[
                                                styles.colorButton,
                                                { backgroundColor: pacienteData.color }
                                            ]}
                                            onPress={() => setShowPacienteColorPicker(!showPacienteColorPicker)}
                                        >
                                            <Image
                                                source={require('../assets/images/paleta-de-color.png')}
                                                style={[
                                                    styles.colorIcon,
                                                    { tintColor: getIconTintColor(pacienteData.color) }
                                                ]}
                                                resizeMode="contain"
                                            />
                                        </TouchableOpacity>

                                        {showPacienteColorPicker && (
                                            <View style={[styles.colorDropdown]}>
                                                {Object.entries(ColorsData).map(([name, color]) => (
                                                    <TouchableOpacity
                                                        key={name}
                                                        style={[styles.colorOption, { backgroundColor: color }]}
                                                        onPress={() => handlePacienteColorSelect(color)}
                                                    />
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {showPacienteInfo && (
                                    <View style={styles.infoBox}>
                                        <Text style={styles.infoText}>
                                            Estos datos son opcionales y crearán uno o varios pacientes asociados a este cliente
                                        </Text>
                                    </View>
                                )}

                                {/* Campos de paciente en 2 columnas */}
                                <View style={styles.twoColumnRow}>
                                    <View style={[styles.inputGroup, styles.column]}>
                                        <Text style={styles.label}>Nombre *</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={pacienteData.nombre}
                                            onChangeText={(text) => setPacienteData(prev => ({ ...prev, nombre: text }))}
                                            placeholder="Nom mascota"
                                            placeholderTextColor="#999"
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
                                            searchable={true}
                                            requiresSelection={true}
                                        />
                                    </View>
                                </View>

                                <View style={styles.twoColumnRow}>
                                    <View style={[styles.inputGroup, styles.column]}>
                                        <Text style={styles.label}>Raza *</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={pacienteData.raza}
                                            onChangeText={(text) => setPacienteData(prev => ({ ...prev, raza: text }))}
                                            placeholder="Raza"
                                            placeholderTextColor="#999"
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
                                            searchable={true}
                                            requiresSelection={true}
                                        />
                                    </View>
                                </View>

                                {/* Separador visible antes de Fecha de Nacimiento */}
                                <View style={[styles.separatorContainer]}>
                                    <View style={[styles.separator, { backgroundColor: pacienteData.color ? pacienteData.color : '#000' }]} />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Fecha de Nacimiento *</Text>
                                    <TouchableOpacity
                                        style={[styles.input, styles.datePickerTouchable]}
                                        onPress={() => { if (isEditable) setShowDatePicker(true); }}
                                        activeOpacity={isEditable ? 0.7 : 1}
                                    >
                                        <Text style={{ color: pacienteData.fecha_nacimiento ? Colors.textSecondary : '#999' }}>
                                            {pacienteData.fecha_nacimiento || 'YYYY-MM-DD'}
                                        </Text>
                                    </TouchableOpacity>

                                    {showDatePicker && (
                                        <DateTimePicker
                                            value={pacienteData.fecha_nacimiento ? new Date(...pacienteData.fecha_nacimiento.split('-').map((p, i) => i === 1 ? Number(p) - 1 : Number(p))) : new Date(2025, 0, 1)}
                                            mode="date"
                                            display="default"
                                            maximumDate={new Date()}
                                            onChange={onDateSelected}
                                        />
                                    )}
                                </View>

                                {/* Años y Meses aproximados - interactúan con la fecha */}
                                <View style={styles.twoColumnRow}>
                                    <View style={[styles.inputGroup, styles.column]}>
                                        <Text style={styles.label}>Años aproximados</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={pacienteYears}
                                            onChangeText={(text) => setPacienteYears(text.replace(/[^0-9]/g, ''))}
                                            onEndEditing={() => updateDateFromYearsMonths(pacienteYears, pacienteMonths)}
                                            placeholder="0"
                                            keyboardType="numeric"
                                        />
                                    </View>

                                    <View style={[styles.inputGroup, styles.column]}>
                                        <Text style={styles.label}>Meses aproximados</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={pacienteMonths}
                                            onChangeText={(text) => setPacienteMonths(text.replace(/[^0-9]/g, ''))}
                                            onEndEditing={() => updateDateFromYearsMonths(pacienteYears, pacienteMonths)}
                                            placeholder="0"
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>

                                <View style={[styles.separatorContainer]}>
                                    <View style={[styles.separator, { backgroundColor: pacienteData.color ? pacienteData.color : '#000' }]} />
                                </View>

                                {/* Nueva fila: Chip y Peso (lado a lado) */}
                                <View style={styles.twoColumnRow}>
                                    <View style={[styles.inputGroup, styles.column]}>
                                        <Text style={styles.label}>Chip</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={pacienteChip}
                                            onChangeText={(text) => setPacienteChip(text)}
                                            placeholder="Chip"
                                            placeholderTextColor="#999"
                                        />
                                    </View>

                                    <View style={[styles.inputGroup, styles.column]}>
                                        <Text style={styles.label}>Peso (kg)(No disp)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={pacientePeso}
                                            onChangeText={(text) => setPacientePeso(text.replace(/[^0-9\.]/g, ''))}
                                            placeholder="0.0"
                                            placeholderTextColor="#999"
                                            keyboardType="decimal-pad"
                                            editable={false}
                                        />
                                    </View>
                                </View>

                                {/* Descuento (%) */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Descuento (%)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={descuento}
                                        onChangeText={(text) => setDescuento(clampDescuento(text.replace(/[^0-9]/g, '')))}
                                        placeholder="0"
                                        placeholderTextColor="#999"
                                        keyboardType="numeric"
                                    />
                                </View>

                                {/* Botón para abrir la cámara (ocupa todo el ancho) */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Foto del paciente</Text>
                                    <View style={styles.photoButtonsRow}>
                                        <TouchableOpacity style={styles.photoButton} onPress={openCamera}>
                                            <Text style={styles.photoButtonText}>Tomar foto</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.deletePhotoButton, !photoUri && styles.deletePhotoButtonDisabled]}
                                            onPress={removePhoto}
                                            disabled={!photoUri}
                                        >
                                            <Text style={styles.deletePhotoButtonText}>Eliminar</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {photoUri && (
                                        <View style={styles.photoPreviewContainer}>
                                            <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                                        </View>
                                    )}

                                    <View style={styles.agresividadContainer}>
                                        <Text style={styles.label}>Agresividad:</Text>
                                        <Slider
                                            style={{ width: '100%', height: 40 }}
                                            minimumValue={0}
                                            maximumValue={100}
                                            step={1}
                                            value={agresividad}
                                            onValueChange={(val) => { setAgresividad(val); }}
                                            minimumTrackTintColor={Colors.primary ? Colors.primary : '#000'}
                                            maximumTrackTintColor={Colors.primarySuave}
                                            thumbTintColor={Colors.primary ? Colors.primary : '#000'} // Funciona igual
                                        />
                                    </View>

                                    {/* Estado del paciente: Adoptado / Fallecido / Comprado */}
                                    <View style={styles.estadoButtonsRow}>
                                        {['Adoptado', 'Fallecido', 'Comprado'].map((e) => (
                                            <TouchableOpacity
                                                key={e}
                                                style={[styles.estadoButton, estadoPaciente === e && styles.estadoButtonSelected]}
                                                onPress={() => setEstadoPaciente(prev => prev === e ? '' : e)}
                                            >
                                                <Text style={[styles.estadoButtonText, estadoPaciente === e && styles.estadoButtonTextSelected]}>{e}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    {/* Motivo de fallecimiento - mostrar si se selecciona Fallecido */}
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
                                                searchable={false}
                                                requiresSelection={true}
                                            />
                                        </View>
                                    )}
                                </View>

                                {/* Botón Agregar a la lista */}
                                <TouchableOpacity style={styles.addToListButton} onPress={handleAddToList}>
                                    <Text style={styles.addToListButtonText}>+ Agregar a la lista</Text>
                                </TouchableOpacity>

                                <Text style={{
                                    fontSize: Typography.h3,
                                    fontWeight: 'bold',
                                    color: Colors.textSecondary,
                                }}>Lista de Pacientes</Text>

                                {/* Lista de pacientes agregados */}
                                {pacientesList.length > 0 && (
                                    <View style={styles.pacientesListContainer}>
                                        {pacientesList.map((p, idx) => {
                                            // Priorizar imagen local tomada (`photoUri`), luego `foto_ruta` remota (si tenemos `apiHost`),
                                            // y finalmente la imagen por especie o placeholder.
                                            let imgSource;
                                            if (p.photoUri) {
                                                imgSource = { uri: p.photoUri };
                                            } else if (p.foto_ruta) {
                                                const cleaned = String(p.foto_ruta).replace(/\\/g, '/').replace(/^\/+/, '');
                                                if (/^https?:\/\//i.test(cleaned)) {
                                                    imgSource = { uri: cleaned };
                                                } else if (apiHost) {
                                                    imgSource = { uri: `${apiHost.replace(/\/+$/, '')}/${cleaned}` };
                                                } else {
                                                    imgSource = (p.especie && p.especie.image) ? p.especie.image : require('../assets/images/especies/huella.png');
                                                }
                                            } else {
                                                imgSource = (p.especie && p.especie.image) ? p.especie.image : require('../assets/images/especies/huella.png');
                                            }

                                            return (
                                                <View key={idx} style={styles.pacienteItem}>
                                                    <Image source={imgSource} style={styles.pacienteImage} resizeMode="cover" />
                                                    <View style={styles.pacienteInfo}>
                                                        <Text style={styles.pacienteName}>
                                                            {p.nombre}
                                                            {(mode === 'ver' || mode === 'editar') && p.numero_clinico ? <Text style={{ fontWeight: '700' }}> - {p.numero_clinico}</Text> : null}
                                                        </Text>
                                                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Especie:</Text> {p.especie?.nombre}</Text>
                                                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Sexo:</Text> {p.sexo?.nombre}</Text>
                                                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Raza:</Text> {p.raza}</Text>
                                                        <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Fecha de nacimiento:</Text> {p.fecha_nacimiento} - <Text style={styles.pacienteAgeBold}>{computeAgeString(p.fecha_nacimiento)}</Text></Text>
                                                    </View>
                                                    {isCreateMode && (
                                                        <TouchableOpacity style={styles.pacienteDeleteButton} onPress={() => deletePaciente(idx)}>
                                                            <Text style={styles.pacienteDeleteX}>✕</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            )
                                        })}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Mostrar lista de pacientes asociados cuando el modal está en modo 'ver' */}
                        {showPacientesListInViewMode && cliente && Array.isArray(cliente.pacientes) && cliente.pacientes.length > 0 && (
                            <View style={[styles.section, { borderColor: cliente.color ? cliente.color : '#000000' }]}>
                                <Text style={{
                                    fontSize: Typography.h3,
                                    fontWeight: 'bold',
                                    color: Colors.textSecondary,
                                }}>Lista de Pacientes</Text>
                                <View style={styles.pacientesListContainer}>
                                    {cliente.pacientes.map((p, idx) => {
                                        // determinar imagen: si la API devuelve `foto_ruta`, construir URL completa usando `apiHost`.
                                        const especieMatch = especies.find(e => e.nombre && String(e.nombre).toLowerCase() === String(p.especie).toLowerCase());
                                        let imgSource;
                                        if (p.foto_ruta) {
                                            const cleaned = String(p.foto_ruta).replace(/\\/g, '/').replace(/^\/+/, '');
                                            if (/^https?:\/\//i.test(cleaned)) {
                                                imgSource = { uri: cleaned };
                                            } else if (apiHost) {
                                                imgSource = { uri: `${apiHost.replace(/\/+$/, '')}/${cleaned}` };
                                            } else {
                                                imgSource = especieMatch ? especieMatch.image : require('../assets/images/especies/huella.png');
                                            }
                                        } else {
                                            imgSource = especieMatch ? especieMatch.image : require('../assets/images/especies/huella.png');
                                        }
                                        const fechaYMD = p.fecha_nacimiento ? (new Date(p.fecha_nacimiento).toISOString().split('T')[0]) : '';
                                        return (
                                            <View key={idx} style={styles.pacienteItem}>
                                                <Image source={imgSource} style={styles.pacienteImage} resizeMode="cover" />
                                                <View style={styles.pacienteInfo}>
                                                    <Text style={styles.pacienteName}>
                                                        {p.nombre}
                                                        {(mode === 'ver' || mode === 'editar') && p.numero_clinico ? <Text style={{ fontWeight: '700' }}> - {p.numero_clinico}</Text> : null}
                                                    </Text>
                                                    <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Especie:</Text> {p.especie}</Text>
                                                    <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Sexo:</Text> {p.sexo}</Text>
                                                    <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Raza:</Text> {p.raza}</Text>
                                                    <Text style={styles.pacienteText}><Text style={{ fontWeight: '600' }}>Fecha de nacimiento:</Text> {fechaYMD} - <Text style={styles.pacienteAgeBold}>{computeAgeString(fechaYMD)}</Text></Text>
                                                </View>
                                            </View>
                                        )
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Botón de Guardar (solo en editar/crear) */}
                        {isEditable && (
                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>
                                    {mode === 'editar' ? 'Actualizar Cliente' : 'Crear cliente con Pacientes'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContent: {
        flex: 1,
    },
    scrollContentContainer: {
        flexGrow: 1,
        padding: Spacing.m,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primarySuave,
        paddingVertical: Spacing.s,
        paddingHorizontal: Spacing.m,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
        alignSelf: 'flex-start',
    },
    icon: {
        width: 20,
        height: 20,
        tintColor: Colors.textPrimary,
    },
    backButtonText: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    phoneButton: {
        width: "100%",
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primaryDark,
        borderWidth: 1,
        borderColor: '#000',
    },
    section: {
        backgroundColor: '#fff',
        padding: Spacing.m,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
        marginBottom: Spacing.m,
    },
    clienteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.m,
    },
    pacienteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.m,
    },
    sectionTitle: {
        fontSize: Typography.h3,
        fontWeight: 'bold',
        color: Colors.textSecondary,
    },
    colorPickerContainer: {
        position: 'relative',
        zIndex: 1001, // ← AÑADE ESTO, más alto que el dropdown
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
        width: "80%",
        height: "80%",
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: 200,
        zIndex: 1002, // ← AUMENTA ESTE VALOR
    },
    pacienteColorDropdown: {
        right: 'auto',
        left: 0,
    },
    colorOption: {
        width: 25,
        height: 25,
        borderRadius: 12.5,
        margin: 2,
        borderWidth: 1,
        borderColor: '#000',
    },
    infoButton: {
        width: 35,
        height: 35,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.s,
    },
    infoIcon: {
        fontSize: 16,
        color: '#fff',
        fontWeight: 'bold',
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
    inputWithIcon: {
        position: 'relative',
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 8,
        paddingHorizontal: Spacing.m,
        paddingVertical: 10,
        fontSize: Typography.body,
        color: Colors.textSecondary,
        minHeight: 40,
    },
    inputDropdown: {
        backgroundColor: '#f8f9fa',
        borderWidth: 2,
        borderColor: '#007bff',
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        minHeight: 50,
        marginVertical: 8,
    },
    customDropdown: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#007bff',
        borderRadius: 10,
    },
    customItem: {
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    customText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    inputIcon: {
        position: 'absolute',
        right: 12,
        top: 10,
        width: 20,
        height: 20,
        tintColor: Colors.textSecondary,
    },
    disabledInput: {
        backgroundColor: '#f5f5f5',
        color: Colors.textSecondary,
    },
    // Estilos para las 2 columnas
    twoColumnRow: {
        flexDirection: 'row',
        gap: Spacing.s,
        marginBottom: Spacing.s,
    },
    column: {
        flex: 1,
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
    saveButton: {
        backgroundColor: Colors.boton_azul,
        paddingVertical: Spacing.m,
        paddingHorizontal: Spacing.m,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: Spacing.m,
        borderWidth: 1,
        borderColor: '#000',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: Typography.body,
        fontWeight: '600',
    },
    separatorContainer: {
        alignItems: 'center',
        marginVertical: Spacing.s,
    },
    separator: {
        width: '90%',
        height: 1,
        backgroundColor: '#000',
        borderRadius: 1,
    },
    datePickerTouchable: {
        justifyContent: 'center',
        minHeight: 40,
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
    photoButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
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
    }
    ,
    pacienteDeleteX: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14
    }
});