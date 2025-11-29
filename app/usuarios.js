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
    Platform
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import TopBar from '../components/TopBar';
import DataTable from '../components/DataTable';
import DropdownGenerico from '../components/DropdownGenerico';
import { Colors, Spacing, Typography, ColorsData } from '../variables';
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth } = Dimensions.get('window');

export default function UsuariosScreen() {
    const router = useRouter();
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [filters, setFilters] = useState({
        rol: null,
        activo: null
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 10;

    const [usuariosData, setUsuariosData] = useState([]);

    // Datos para el dropdown de roles
    const roles = [
        { id: 1, nombre: 'Administrador' },
        { id: 2, nombre: 'Médico' },
        { id: 3, nombre: 'Técnico' },
        { id: 4, nombre: 'Estilista' }
    ];

    // Datos para los radio buttons de activo
    const activoOptions = [
        { id: 1, nombre: 'Activo', value: true },
        { id: 2, nombre: 'Inactivo', value: false }
    ];

    const handleMenuNavigate = (link) => {
        // Navegación del menú
    };

    // Llamada al endpoint para obtener usuarios
    const fetchUsers = async (page = currentPage, isSearch = false) => {
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

            const url = `${host.replace(/\/+$/, '')}/usuario/filter/${itemsPerPage}/${page}`;

            const body = {
                ...(searchText && { nombre_natural: searchText }),
                ...(filters.rol?.nombre && { rol: filters.rol.nombre }),
                ...(filters.activo !== null && filters.activo !== undefined && filters.activo !== '' && { activo: filters.activo.value })
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(body),
                timeout: 10000 // 10 segundos de timeout
            });

            if (response.status === 403) {
                // Sesión expirada
                router.replace('/login');
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Normalizar datos: sustituir null por "" y mapear id
            const usuarios = (data.data || []).map(item => {
                const normalized = { ...item };
                // Reemplazar null por cadena vacía en propiedades de primer nivel
                Object.keys(normalized).forEach(k => {
                    if (normalized[k] === null) normalized[k] = '';
                });
                // mapear id_usuario -> id
                normalized.id = normalized.id_usuario ?? normalized.id;
                return normalized;
            });

            setUsuariosData(usuarios);
            const pagination = data.pagination || {};
            setTotalItems(pagination.total || usuarios.length);
            setCurrentPage(pagination.currentPage || page);

        } catch (error) {
            console.error('Error fetching usuarios:', error);
            ToastAndroid.show(
                '❌ Error al cargar usuarios',
                ToastAndroid.SHORT
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Modificar handleSearch para indicar que es una búsqueda
    const handleSearch = () => {
        // Reiniciar pagina y buscar
        setCurrentPage(1);
        fetchUsers(1, true); // true indica que es una búsqueda
    };

    // Control de enfoque: llamar a fetchUsers cuando la vista recibe focus
    const isScreenFocused = useRef(false);

    useFocusEffect(
        React.useCallback(() => {
            isScreenFocused.current = true;
            // Al enfocar la pantalla, cargar la página actual
            fetchUsers(currentPage, false);
            return () => {
                isScreenFocused.current = false;
            };
        }, [])
    );

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
            rol: null,
            activo: null
        });
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    // Fetch when page changes, pero solo si la pantalla está enfocada
    useEffect(() => {
        if (isScreenFocused.current) {
            fetchUsers(currentPage, false);
        }
    }, [currentPage]);

    const handleRowClick = (usuario) => {
        router.push({
            pathname: '/usuarioModal',
            params: {
                mode: 'ver',
                usuario: JSON.stringify(usuario)
            }
        });
    };

    // Columnas de la tabla
    const columns = [
        {
            key: 'nombre_natural',
            label: 'Nombre',
            width: 150,
            cellRenderer: (value, item) => (
                <Text style={styles.cellText}>{value || 'Sin nombre'}</Text>
            )
        },
        {
            key: 'rol',
            label: 'Rol',
            width: 120,
            cellRenderer: (value, item) => (
                <Text style={styles.cellText}>{value || 'Sin rol'}</Text>
            )
        },
        {
            key: 'activo',
            label: 'Estado',
            width: 100,
            cellRenderer: (value, item) => (
                <Text style={[styles.cellText, { color: value ? Colors.boton_azul : Colors.boton_rojo_opciones }]}>
                    {value ? 'Activo' : 'Inactivo'}
                </Text>
            )
        }
    ];

    // Acciones para la tabla
    const actions = [
        {
            handler: (usuario) => {
                router.push({
                    pathname: '/usuarioModal',
                    params: {
                        mode: 'editar',
                        usuario: JSON.stringify(usuario)
                    }
                });
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
            handler: (usuario) => {
                // Mostrar alerta de confirmación
                Alert.alert(
                    'Confirmar eliminación',
                    `¿Está seguro de eliminar al usuario ${usuario.nombre_natural}?`,
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
                                    // Obtener configuración
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

                                    // Usar id_usuario si está disponible, sino usar id
                                    const usuarioId = usuario.id_usuario || usuario.id;

                                    if (!usuarioId) {
                                        Alert.alert('Error', 'No se pudo identificar el usuario a eliminar');
                                        return;
                                    }

                                    const url = `${host.replace(/\/+$/, '')}/usuario/DeleteUsuario/${usuarioId}`;

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
                                        // Eliminación exitosa
                                        ToastAndroid.show('✅ Usuario eliminado con éxito', ToastAndroid.LONG);

                                        // Eliminar de la lista local
                                        setUsuariosData(prev => prev.filter(u => {
                                            const currentId = u.id_usuario || u.id;
                                            const targetId = usuario.id_usuario || usuario.id;
                                            return currentId !== targetId;
                                        }));

                                        // Actualizar el total de items
                                        setTotalItems(prev => prev - 1);

                                    } else {
                                        // Manejar errores - el endpoint devuelve una lista de errores
                                        let errorMessage = `Error ${response.status}`;
                                        try {
                                            const errorData = await response.json();
                                            // Capturar lista de errores (puede ser "error" o "errors")
                                            const errorList = errorData.errors || errorData.error || [];
                                            if (Array.isArray(errorList) && errorList.length > 0) {
                                                errorMessage = errorList.join('\n• ');
                                            } else if (errorData.message) {
                                                errorMessage = errorData.message;
                                            }
                                        } catch (parseError) {
                                            console.log('Error parseando respuesta:', parseError);
                                        }

                                        Alert.alert(
                                            'Error al eliminar usuario',
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

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <TopBar onMenuNavigate={handleMenuNavigate} />

            <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
                {/* Contenedor de opciones de búsqueda */}
                <View style={styles.searchContainer}>
                    <TouchableOpacity onPress={() => { router.replace('/'); }} style={styles.backButton}>
                        <Image
                            source={require('../assets/images/arrow-left.png')}
                            style={styles.backButtonImage}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>

                    <Text style={styles.searchTitle}>Opciones de búsqueda</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Buscar por nombre</Text>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Ingresa el nombre del usuario"
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
                            <View style={styles.additionalRow}>
                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Rol</Text>
                                    <DropdownGenerico
                                        data={roles}
                                        value={filters.rol}
                                        onValueChange={(value) => handleFilterChange('rol', value)}
                                        placeholder="Seleccionar rol"
                                        displayKey="nombre"
                                        searchKey="nombre"
                                        searchable={true}
                                        requiresSelection={false}
                                    />
                                </View>

                                <View style={[styles.inputGroup, styles.responsiveInputGroup]}>
                                    <Text style={styles.inputLabel}>Estado</Text>
                                    <View style={styles.radioButtonsContainer}>
                                        {activoOptions.map((option) => (
                                            <TouchableOpacity
                                                key={option.id}
                                                style={styles.radioButtonWrapper}
                                                onPress={() => {
                                                    // Toggle: si ya está seleccionado, deseleccionar
                                                    if (filters.activo?.value === option.value) {
                                                        handleFilterChange('activo', null);
                                                    } else {
                                                        handleFilterChange('activo', option);
                                                    }
                                                }}
                                            >
                                                <View style={[
                                                    styles.radioButton,
                                                    filters.activo?.value === option.value && styles.radioButtonSelected
                                                ]}>
                                                    {filters.activo?.value === option.value && (
                                                        <View style={styles.radioButtonInner} />
                                                    )}
                                                </View>
                                                <Text style={styles.radioButtonLabel}>{option.nombre}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.clearButton}
                                onPress={clearFilters}
                            >
                                <Text style={styles.clearButtonText}>Limpiar Filtros</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Botones de acciones arriba de la tabla */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity style={styles.addButton} onPress={() => {
                        router.push({
                            pathname: '/usuarioModal',
                            params: {
                                mode: 'crear'
                            }
                        });
                    }}>
                        <Text style={styles.addButtonText}>+ Agregar Usuario</Text>
                    </TouchableOpacity>
                </View>

                {/* Tabla de usuarios - asegurar que items siempre sea un array */}
                <View style={styles.tableContainer}>
                    <DataTable
                        columns={columns}
                        items={usuariosData || []}
                        actions={actions}
                        totalItems={totalItems}
                        itemsPerPage={10}
                        currentPage={currentPage}
                        isLoading={isLoading}
                        onPageChange={handlePageChange}
                        onRowClick={handleRowClick}
                    />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContent: {
        flex: 1,
    },
    scrollContentContainer: {
        flexGrow: 1,
    },
    searchContainer: {
        backgroundColor: Colors.primaryClaro,
        margin: Spacing.m,
        padding: Spacing.m,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        overflow: 'hidden',
    },
    backButton: {
        position: 'absolute',
        left: 10,
        top: 10,
        padding: 8,
        backgroundColor: Colors.primarySuave,
        borderRadius: 8,
        zIndex: 1,
    },
    backButtonImage: {
        width: 20,
        height: 20,
        tintColor: Colors.textPrimary,
    },
    searchTitle: {
        fontSize: Typography.h3,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: Spacing.m,
        textAlign: 'center',
        marginTop: 10,
    },
    inputGroup: {
        marginBottom: Spacing.m,
    },
    responsiveInputGroup: {
        flex: 1,
        minWidth: 0,
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
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: Spacing.s,
        marginHorizontal: Spacing.m,
        marginBottom: Spacing.s,
    },
    addButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.boton_azul,
        paddingVertical: Spacing.s,
        paddingHorizontal: Spacing.s,
        borderRadius: 8,
        width: '100%',
    },
    addButtonText: {
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
    additionalRow: {
        flexDirection: 'row',
        gap: Spacing.s,
        marginBottom: Spacing.m,
        flexWrap: 'wrap',
    },
    radioButtonsContainer: {
        flexDirection: 'row',
        gap: Spacing.m,
    },
    radioButtonWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioButtonSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    radioButtonInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
    },
    radioButtonLabel: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
        fontWeight: '500',
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
    tableContainer: {
        margin: Spacing.m,
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
