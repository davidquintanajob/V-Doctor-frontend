import React, { useState } from 'react';
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
    ToastAndroid
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import TopBar from '../components/TopBar';
import DropdownGenerico from '../components/DropdownGenerico';
import { Colors, Spacing, Typography, ColorsData } from '../variables';
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth } = Dimensions.get('window');

export default function UsuarioModalScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Parsear parámetros
    const mode = params.mode;
    const usuario = params.usuario ? JSON.parse(params.usuario) : null;

    // Datos para el dropdown de roles
    const roles = [
        { id: 1, nombre: 'Administrador' },
        { id: 2, nombre: 'Médico' },
        { id: 3, nombre: 'Técnico' },
        { id: 4, nombre: 'Estilista' }
    ];

    // Estado para los datos del usuario - inicialización directa como en cliente
    const [usuarioData, setUsuarioData] = useState({
        nombre_natural: usuario?.nombre_natural || '',
        nombre_usuario: usuario?.nombre_usuario || '',
        salario_diario: usuario?.salario_diario || ''
    });

    const [rolSeleccionado, setRolSeleccionado] = useState(() => {
        if (usuario?.rol) {
            return roles.find(r => r.nombre === usuario.rol) || null;
        }
        return null;
    });

    const [contrasenna, setContrasenna] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [contrasennaErrors, setContrasennaErrors] = useState([]);
    const [activo, setActivo] = useState(usuario?.activo ?? true);

    const handleMenuNavigate = (link) => {
        // Navegación del menú si es necesario
    };

    const handleBack = () => {
        router.back();
    };

    // Validar contraseña y devolver errores
    const validateContrasenna = (pwd) => {
        const errors = [];
        if (pwd) {
            if (pwd.length < 6) {
                errors.push("La contraseña debe tener al menos 6 caracteres");
            }
            if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pwd)) {
                errors.push("La contraseña debe contener al menos una letra mayúscula, una minúscula y un número");
            }
        }
        return errors;
    };

    const handleContrasennaChange = (text) => {
        setContrasenna(text);
        const errors = validateContrasenna(text);
        setContrasennaErrors(errors);
    };

    const handleSave = async () => {
        // Verificar configuración de API
        try {
            const rawConfig = await AsyncStorage.getItem('@config');
            if (!rawConfig) {
                Alert.alert('Configuración requerida', 'Debes configurar la API primero');
                router.replace('/config');
                return;
            }

            const parsedConfig = JSON.parse(rawConfig);
            const host = parsedConfig?.api_host || parsedConfig?.apihost || parsedConfig?.apiHost;
            if (!host) {
                Alert.alert('Configuración requerida', 'Debes configurar la API primero');
                router.replace('/config');
                return;
            }

            // Validaciones básicas
            if (!usuarioData.nombre_natural || !usuarioData.nombre_natural.trim()) {
                Alert.alert('Error', 'El nombre natural del usuario es requerido');
                return;
            }
            if (!usuarioData.nombre_usuario || !usuarioData.nombre_usuario.trim()) {
                Alert.alert('Error', 'El nombre de usuario es requerido');
                return;
            }
            if (!rolSeleccionado) {
                Alert.alert('Error', 'El rol del usuario es requerido');
                return;
            }

            // Validaciones de contraseña
            if (mode === 'crear') {
                if (!contrasenna || !contrasenna.trim()) {
                    Alert.alert('Error', 'La contraseña es requerida');
                    return;
                }
                const errors = validateContrasenna(contrasenna);
                if (errors.length > 0) {
                    Alert.alert('Error en contraseña', errors.join('\n• '));
                    return;
                }
            } else if (mode === 'editar' && contrasenna.trim()) {
                // En modo editar, solo validar si se proporciona contraseña
                const errors = validateContrasenna(contrasenna);
                if (errors.length > 0) {
                    Alert.alert('Error en contraseña', errors.join('\n• '));
                    return;
                }
            }

            // Construir body
            const body = {
                nombre_natural: usuarioData.nombre_natural,
                nombre_usuario: usuarioData.nombre_usuario,
                rol: rolSeleccionado.nombre,
                salario_diario: Number(usuarioData.salario_diario) || 0
            };

            // Añadir contraseña si se proporciona
            if (contrasenna.trim()) {
                body.contrasenna = contrasenna;
            }

            // Incluir 'activo' solo en modo editar (endpoint UpdateUsuario recibe este campo)
            if (mode === 'editar') {
                body.activo = !!activo;
            }

            const base = host.replace(/\/+$/, '');
            // Si estamos en modo editar, usar endpoint UpdateUsuario/{id}
            const usuarioId = usuario?.id_usuario || usuario?.id;
            let url;
            let method = 'POST';
            if (mode === 'editar') {
                if (!usuarioId) {
                    Alert.alert('Error', 'No se pudo identificar el usuario a actualizar');
                    return;
                }
                url = `${base}/usuario/UpdateUsuario/${usuarioId}`;
                method = 'PUT';
            } else {
                url = `${base}/usuario/CreateUsuario`;
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
                    ToastAndroid.show('Usuario actualizado correctamente', ToastAndroid.SHORT);
                } else {
                    Alert.alert('Éxito', 'Usuario actualizado correctamente');
                }
            } else {
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Usuario creado correctamente', ToastAndroid.SHORT);
                } else {
                    Alert.alert('Éxito', 'Usuario creado correctamente');
                }
            }
            router.back();

        } catch (err) {
            console.error('Error al guardar usuario:', err);
            if (err.message && err.message.includes('Network request failed')) {
                Alert.alert('Error de conexión', 'No se pudo conectar al servidor');
            } else {
                Alert.alert('Error', err.message || 'Error en la petición');
            }
        }
    };

    const isEditable = mode !== 'ver';

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.container}>
                    <TopBar onMenuNavigate={handleMenuNavigate} />

                    <ScrollView
                        style={styles.scrollContent}
                        contentContainerStyle={[styles.scrollContentContainer, { paddingBottom: Spacing.page }]}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        nestedScrollEnabled={true}
                    >
                        {/* Datos del Usuario */}
                        <View style={styles.section}>
                            <View style={styles.header}>
                                {/* Botón de volver */}
                                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                                    <Image
                                        source={require('../assets/images/arrow-left.png')}
                                        style={styles.icon}
                                        resizeMode="contain"
                                    />
                                </TouchableOpacity>

                                <Text style={styles.sectionTitle}>
                                    {mode === 'ver' ? 'Detalles de Usuario' :
                                        mode === 'editar' ? 'Editar Usuario' : 'Crear Usuario'}
                                </Text>
                            </View>

                            {/* Nombre Natural - Ancho completo */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Nombre Natural *</Text>
                                <View style={styles.inputWithIcon}>
                                    <TextInput
                                        style={[styles.input, !isEditable && styles.disabledInput]}
                                        value={usuarioData.nombre_natural}
                                        onChangeText={(text) => setUsuarioData(prev => ({ ...prev, nombre_natural: text }))}
                                        placeholder="Nombre natural del usuario"
                                        editable={isEditable}
                                        placeholderTextColor="#999"
                                    />
                                </View>
                            </View>

                            {/* Nombre de Usuario - Ancho completo */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Nombre de Usuario *</Text>
                                <View style={styles.inputWithIcon}>
                                    <TextInput
                                        style={[styles.input, !isEditable && styles.disabledInput]}
                                        value={usuarioData.nombre_usuario}
                                        onChangeText={(text) => setUsuarioData(prev => ({ ...prev, nombre_usuario: text }))}
                                        placeholder="Nombre de usuario (login)"
                                        editable={isEditable}
                                        placeholderTextColor="#999"
                                    />
                                </View>
                            </View>

                            {/* Contraseña - Ancho completo con validación */}
                            {isEditable && (
                                <>
                                    <View style={[styles.separatorContainer, { marginTop: Spacing.m }]}>
                                        <View style={styles.separator} />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>
                                            {mode === 'crear' ? 'Contraseña *' : 'Nueva Contraseña'}
                                        </Text>
                                        <View style={[
                                            styles.passwordInputContainer,
                                            contrasennaErrors.length > 0 && styles.passwordInputContainerError
                                        ]}>
                                            <TextInput
                                                style={styles.passwordInput}
                                                value={contrasenna}
                                                onChangeText={handleContrasennaChange}
                                                placeholder="Contraseña"
                                                secureTextEntry={!showPassword}
                                                editable={isEditable}
                                                placeholderTextColor="#999"
                                            />
                                            <TouchableOpacity
                                                onPress={() => setShowPassword(!showPassword)}
                                                style={styles.passwordToggle}
                                            >
                                                <Image
                                                    source={showPassword ? require('../assets/images/eye-open.png') : require('../assets/images/eye-closed.png')}
                                                    style={styles.passwordToggleIcon}
                                                    resizeMode="contain"
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Mostrar errores de validación de contraseña */}
                                        {contrasennaErrors.length > 0 && (
                                            <View style={styles.errorBox}>
                                                {contrasennaErrors.map((error, idx) => (
                                                    <Text key={idx} style={styles.errorText}>
                                                        • {error}
                                                    </Text>
                                                ))}
                                            </View>
                                        )}

                                        {/* Requisitos de contraseña */}
                                        <View style={styles.passwordRequirementsBox}>
                                            <Text style={styles.passwordRequirementsTitle}>Requisitos:</Text>
                                            <Text style={styles.passwordRequirementsText}>• Mínimo 6 caracteres</Text>
                                            <Text style={styles.passwordRequirementsText}>• Al menos una letra mayúscula</Text>
                                            <Text style={styles.passwordRequirementsText}>• Al menos una letra minúscula</Text>
                                            <Text style={styles.passwordRequirementsText}>• Al menos un número</Text>
                                        </View>
                                    </View>
                                </>
                            )}

                            {/* Separator antes de los campos de dos columnas */}
                            <View style={[styles.separatorContainer, { marginTop: Spacing.m }]}>
                                <View style={styles.separator} />
                            </View>

                            {/* Salario Diario CUP y Rol - Dos columnas */}
                            <View style={styles.twoColumnRow}>
                                <View style={[styles.inputGroup, styles.column]}>
                                    <Text style={styles.label}>Salario Diario CUP</Text>
                                    <View style={styles.inputWithIcon}>
                                        <TextInput
                                            style={[styles.input, !isEditable && styles.disabledInput]}
                                            value={String(usuarioData.salario_diario)}
                                            onChangeText={(text) => setUsuarioData(prev => ({ ...prev, salario_diario: text.replace(/[^0-9\.]/g, '') }))}
                                            placeholder="0"
                                            keyboardType="decimal-pad"
                                            editable={isEditable}
                                            placeholderTextColor="#999"
                                        />
                                    </View>
                                </View>

                                <View style={[styles.inputGroup, styles.column]}>
                                    <Text style={styles.label}>Rol *</Text>
                                    <DropdownGenerico
                                        data={roles}
                                        value={rolSeleccionado}
                                        onValueChange={setRolSeleccionado}
                                        placeholder="Seleccionar rol"
                                        displayKey="nombre"
                                        searchKey="nombre"
                                        searchable={true}
                                        requiresSelection={true}
                                        disabled={!isEditable}
                                    />
                                </View>
                            </View>

                            {/* Activo / Inactivo - visible en editar y ver */}
                            {(mode === 'editar' || mode === 'ver') && (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Activo</Text>
                                    <View style={styles.radioGroup}>
                                        <TouchableOpacity
                                            style={styles.radioButton}
                                            onPress={() => { if (isEditable) setActivo(true); }}
                                            activeOpacity={isEditable ? 0.6 : 1}
                                        >
                                            <View style={styles.radioOuter}>
                                                {activo && <View style={styles.radioInner} />}
                                            </View>
                                            <Text style={styles.radioLabel}>Activo</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.radioButton}
                                            onPress={() => { if (isEditable) setActivo(false); }}
                                            activeOpacity={isEditable ? 0.6 : 1}
                                        >
                                            <View style={styles.radioOuter}>
                                                {!activo && <View style={styles.radioInner} />}
                                            </View>
                                            <Text style={styles.radioLabel}>Inactivo</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Botón de Guardar (solo en editar/crear) */}
                        {isEditable && (
                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>
                                    {mode === 'editar' ? 'Actualizar Usuario' : 'Crear Usuario'}
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
    section: {
        backgroundColor: '#fff',
        padding: Spacing.m,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
        marginBottom: Spacing.m,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.m,
        gap: Spacing.m,
    },
    sectionTitle: {
        fontSize: Typography.h3,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        flex: 1,
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
        minHeight: 44,
    },
    disabledInput: {
        backgroundColor: '#f5f5f5',
        color: Colors.textSecondary,
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
        alignItems: 'center',
        marginVertical: Spacing.s,
    },
    separator: {
        width: '100%',
        height: 1,
        backgroundColor: '#000',
        borderRadius: 1,
    },
    passwordInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 8,
        paddingRight: Spacing.s,
        backgroundColor: '#fff',
    },
    passwordInputContainerError: {
        borderColor: '#cc0000',
        borderWidth: 2,
    },
    passwordInput: {
        flex: 1,
        paddingHorizontal: Spacing.m,
        paddingVertical: 10,
        fontSize: Typography.body,
        color: Colors.textSecondary,
        minHeight: 44,
    },
    passwordToggle: {
        padding: Spacing.xs,
    },
    passwordToggleIcon: {
        width: 20,
        height: 20,
        tintColor: Colors.textSecondary,
    },
    errorBox: {
        backgroundColor: '#ffe6e6',
        padding: Spacing.m,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cc0000',
        marginTop: Spacing.s,
        marginBottom: Spacing.s,
    },
    errorText: {
        fontSize: Typography.small,
        color: '#900',
        fontWeight: '500',
        marginBottom: 4,
    },
    passwordRequirementsBox: {
        backgroundColor: '#f0f8ff',
        padding: Spacing.m,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.boton_azul,
        marginTop: Spacing.s,
    },
    passwordRequirementsTitle: {
        fontSize: Typography.body,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    passwordRequirementsText: {
        fontSize: Typography.small,
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    radioGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.m,
        marginTop: Spacing.xs,
    },
    radioButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: Spacing.m,
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.s,
        backgroundColor: '#fff',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.boton_azul,
    },
    radioLabel: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
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
});