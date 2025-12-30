import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
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

    const motivosFallecimiento = [
        { id: 1, nombre: 'Eutanasia' },
        { id: 2, nombre: 'Accidente' },
        { id: 3, nombre: 'Enfermedad' },
        { id: 4, nombre: 'Vejez' },
        { id: 5, nombre: 'Otros' }
    ];

    const sexos = [
        { id: 1, nombre: 'masculino' },
        { id: 2, nombre: 'femenino' },
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
                    setLoadedImageUri(imageUrl);

                    // Verificar que la imagen existe
                    const response = await fetch(imageUrl, { method: 'HEAD' });
                    if (!response.ok) {
                        setLoadedImageUri(null);
                    }
                } catch (error) {
                    console.error('Error cargando imagen del paciente:', error);
                    setLoadedImageUri(null);
                }
            } else {
                setLoadedImageUri(null);
            }
        };

        loadPatientImage();
    }, [pacienteData.foto_ruta, apiHost]);

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
                // Intentar leer la imagen en base64 para enviarla al backend (maneja content:// y EncodingType faltante)
                try {
                    const base = await uriToBase64(uri);
                    if (base) setImagenBase64(base);
                    else setImagenBase64(null);
                } catch (err) {
                    console.warn('No se pudo leer la imagen en base64:', err);
                    setImagenBase64(null);
                }
            }
        } catch (err) {
            console.error('Error opening camera', err);
            Alert.alert('Error', 'No se pudo abrir la cámara.');
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
            ToastAndroid.show('Paciente guardado correctamente', ToastAndroid.SHORT);
            router.back();
        } catch (err) {
            console.error(err);
            Alert.alert('Error', err.message || 'No se pudo guardar el paciente');
        }
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
                                        style={[styles.input, styles.disabledInput]}
                                        value={pacientePeso}
                                        onChangeText={(text) => setPacientePeso(text.replace(/[^0-9\.]/g, ''))}
                                        placeholder="0.0"
                                        placeholderTextColor="#999"
                                        keyboardType="decimal-pad"
                                        editable={false}
                                    />
                                </View>
                            </View>

                            {/* Descuento */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Descuento (%)</Text>
                                <TextInput
                                    style={[styles.input, (isView ||           !isAdmin) && styles.disabledInput]}
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
                                        <TouchableOpacity style={styles.photoButton} onPress={openCamera}>
                                            <Text style={styles.photoButtonText}>Tomar foto</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.deletePhotoButton, (!photoUri && !loadedImageUri) && styles.deletePhotoButtonDisabled]}
                                            onPress={() => {
                                                removePhoto();
                                                setLoadedImageUri(null); // También eliminar la imagen cargada
                                            }}
                                            disabled={!photoUri && !loadedImageUri}
                                        >
                                            <Text style={styles.deletePhotoButtonText}>Eliminar</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Mostrar la nueva foto tomada O la imagen cargada */}
                                {(photoUri || loadedImageUri) && (
                                    <View style={styles.photoPreviewContainer}>
                                        <Image
                                            source={{ uri: photoUri || loadedImageUri }}
                                            style={styles.photoPreview}
                                            resizeMode="cover"
                                            onError={() => {
                                                console.warn('Error cargando imagen');
                                                setLoadedImageUri(null);
                                            }}
                                        />
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
});