import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    ToastAndroid,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import TopBar from '../components/TopBar';
import ApiAutocomplete from '../components/ApiAutocomplete';
import DataTable from '../components/DataTable';
import { Colors, Spacing, Typography } from '../variables';

export default function AsociarPacienteClienteScreen() {
    const router = useRouter();

    const [showPacienteInfo, setShowPacienteInfo] = useState(false);
    const [activeTab, setActiveTab] = useState('pacientes'); // 'pacientes' o 'clientes'

    // Estados para la sección de Pacientes
    const [apiHost, setApiHost] = useState('');
    const [selectedPaciente, setSelectedPaciente] = useState(null);
    const [clienteNombreFilter, setClienteNombreFilter] = useState('');

    // Estados para la sección de Clientes
    const [selectedCliente, setSelectedCliente] = useState(null);
    const [clientesAsociados, setClientesAsociados] = useState([]);

    useEffect(() => {
        const getApiHost = async () => {
            try {
                const raw = await AsyncStorage.getItem('@config');
                if (raw) {
                    const config = JSON.parse(raw);
                    const host = config.api_host || config.apihost || config.apiHost;
                    setApiHost(host || '');
                }
            } catch (error) {
                console.error('Error getting apiHost:', error);
            }
        };
        getApiHost();
    }, []);

    // Columnas para la tabla de clientes
    const columns = [
        { key: 'nombre', label: 'Nombre', width: 150 },
        { key: 'telefono', label: 'Teléfono', width: 150 },
    ];

    // Acciones para la tabla de clientes
    const actions = [
        {
            name: "Eliminar",
            handler: (cliente) => {
                Alert.alert(
                    'Confirmar eliminación',
                    `¿Está seguro de eliminar a ${cliente.nombre} de la lista?`,
                    [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                            text: 'Eliminar',
                            style: 'destructive',
                            onPress: () => {
                                const clienteId = cliente.id_cliente || cliente.id;
                                setClientesAsociados(prev =>
                                    prev.filter(c => {
                                        const cId = c.id_cliente || c.id;
                                        return cId !== clienteId;
                                    })
                                );
                                ToastAndroid.show('Cliente eliminado de la lista', ToastAndroid.SHORT);
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
            buttonStyle: { backgroundColor: Colors.boton_rojo_opciones }
        }
    ];

    // Función para manejar la selección de un paciente
    const handlePacienteSelect = (paciente) => {
        if (paciente === null) {
            // Cuando se limpia la selección, eliminar todos los clientes de la lista
            setSelectedPaciente(null);
            setClientesAsociados([]); // Limpiar la lista de clientes
            return;
        }

        setSelectedPaciente(paciente);

        // Si el paciente tiene clientes asociados, agregarlos a la lista
        if (paciente.clientes && paciente.clientes.length > 0) {
            // Filtrar clientes duplicados antes de agregar usando la misma lógica de comparación
            const nuevosClientes = paciente.clientes.filter(cliente => {
                const nuevoClienteId = cliente.id_cliente || cliente.id;
                return !clientesAsociados.some(c => {
                    const clienteExistenteId = c.id_cliente || c.id;
                    return clienteExistenteId === nuevoClienteId;
                });
            });

            if (nuevosClientes.length > 0) {
                setClientesAsociados(prev => [...prev, ...nuevosClientes]);
                ToastAndroid.show(`Paciente seleccionado: ${paciente.nombre}. ${nuevosClientes.length} cliente(s) agregado(s) automáticamente`, ToastAndroid.SHORT);
            } else {
                ToastAndroid.show(`Paciente seleccionado: ${paciente.nombre}`, ToastAndroid.SHORT);
            }
        } else {
            ToastAndroid.show(`Paciente seleccionado: ${paciente.nombre} (sin clientes asociados)`, ToastAndroid.SHORT);
        }
    };

    // Función para manejar la selección de un cliente
    const handleClienteSelect = (cliente) => {
        if (cliente === null) {
            // Cuando se limpia la selección
            setSelectedCliente(null);
            return;
        }

        // Verificar si el cliente ya está en la lista
        const exists = clientesAsociados.some(c =>
            c.id_cliente === cliente.id_cliente || c.id_cliente === cliente.id_cliente
        );

        if (exists) {
            ToastAndroid.show('Este cliente ya está en la lista', ToastAndroid.SHORT);
            return;
        }

        // Agregar el cliente a la lista
        setClientesAsociados(prev => [...prev, cliente]);
        setSelectedCliente(null); // Limpiar la selección del autocomplete
        ToastAndroid.show('Cliente agregado a la lista', ToastAndroid.SHORT);
    };

    // Función para asociar clientes al paciente
    // Función para asociar clientes al paciente
    const handleAsociarClientes = async () => {
        if (!selectedPaciente) {
            ToastAndroid.show('Debe seleccionar un paciente primero', ToastAndroid.SHORT);
            return;
        }

        if (clientesAsociados.length === 0) {
            ToastAndroid.show('Debe agregar al menos un cliente a la lista', ToastAndroid.SHORT);
            return;
        }

        try {
            const raw = await AsyncStorage.getItem('@config');
            if (!raw) throw new Error('No hay configuración de API');
            const config = JSON.parse(raw);
            const host = config.api_host || config.apihost || config.apiHost;
            const token = config.token;
            if (!host) throw new Error('Host no configurado');

            // Obtener el ID del paciente
            const pacienteId = selectedPaciente.id_paciente || selectedPaciente.id;

            // Obtener los IDs de los clientes
            const clientesIds = clientesAsociados.map(cliente =>
                cliente.id_cliente || cliente.id
            );

            // Preparar el body según el formato requerido
            const body = {
                clientes: clientesIds,
                pacientes: [pacienteId] // El paciente seleccionado como array
            };

            const url = `${host.replace(/\/+$/, '')}/cliente_paciente/Sync`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `Error al asociar clientes: ${response.status}`;

                try {
                    // Intentar parsear el error como JSON si es posible
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorJson.error || errorText;
                } catch {
                    // Si no es JSON, usar el texto plano
                    errorMessage = `${errorMessage} - ${errorText}`;
                }

                throw new Error(errorMessage);
            }

            const result = await response.json();

            // Mostrar mensaje de éxito
            ToastAndroid.show(
                `¡Éxito! ${clientesAsociados.length} cliente(s) asociado(s) al paciente correctamente`,
                ToastAndroid.LONG
            );

            // Limpiar completamente el formulario
            setSelectedPaciente(null);
            setClientesAsociados([]);
            setClienteNombreFilter('');
            setSelectedCliente(null);

        } catch (error) {
            console.error('Error asociando clientes:', error);

            // Mostrar alerta con el error detallado
            Alert.alert(
                'Error al asociar clientes',
                error.message || 'No se pudieron asociar los clientes al paciente. Por favor, intente nuevamente.',
                [
                    {
                        text: 'Entendido',
                        style: 'default'
                    }
                ]
            );
        }
    };

    return (
        <View style={styles.container}>
            <TopBar onMenuNavigate={() => { }} />

            <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
                {/* Título y botón de información */}
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Image
                            source={require('../assets/images/arrow-left.png')}
                            style={styles.icon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>

                    <Text style={styles.sectionTitle}>Asociar Clientes y Pacientes</Text>

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
                </View>

                {showPacienteInfo && (
                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>
                            Esta función permite asociar múltiples clientes a un paciente existente en el sistema. Seleccione Pacientes para asociar clientes a un paciente o Clientes para asociar pacientes a un cliente.
                        </Text>
                    </View>
                )}

                {/* Pestañas Pacientes y Clientes */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'pacientes' && styles.activeTab]}
                        onPress={() => setActiveTab('pacientes')}
                    >
                        <Text style={[styles.tabText, activeTab === 'pacientes' && styles.activeTabText]}>Pacientes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'clientes' && styles.activeTab]}
                        onPress={() => setActiveTab('clientes')}
                    >
                        <Text style={[styles.tabText, activeTab === 'clientes' && styles.activeTabText]}>Clientes</Text>
                    </TouchableOpacity>
                </View>

                {/* Contenido de la pestaña de Pacientes */}
                {activeTab === 'pacientes' && (
                    <View style={styles.tabContent}>
                        {/* Subcontenedor para buscar paciente */}
                        <View style={styles.subContainer}>
                            <Text style={styles.subTitle}>Buscar Paciente</Text>

                            {/* Paciente seleccionado */}
                            {selectedPaciente && (
                                <View style={styles.selectedItemContainer}>
                                    <Text style={styles.selectedItemText}>
                                        Paciente seleccionado: <Text style={styles.boldText}>{selectedPaciente.nombre}</Text>
                                    </Text>
                                    {selectedPaciente.clientes && selectedPaciente.clientes.length > 0 && (
                                        <Text style={styles.clientesInfoText}>
                                            {selectedPaciente.clientes.length} cliente(s) asociado(s) - se han agregado automáticamente a la lista
                                        </Text>
                                    )}
                                </View>
                            )}

                            {/* Autocomplete para pacientes */}
                            <ApiAutocomplete
                                endpoint="/paciente/Filter/5/1"
                                body={{
                                    nombre: '',
                                    raza: '',
                                    nombre_cliente: clienteNombreFilter || "",
                                }}
                                displayFormat={(item) => `${item.nombre} - ${item.sexo} - ${item.especie}`}
                                onItemSelect={handlePacienteSelect}
                                placeholder="Buscar paciente por nombre..."
                                delay={500}
                            />

                            {/* Campo para filtrar por nombre de cliente */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Filtrar por nombre de cliente</Text>
                                <TextInput
                                    style={styles.input}
                                    value={clienteNombreFilter}
                                    onChangeText={setClienteNombreFilter}
                                    placeholder="Ingrese el nombre del cliente"
                                    placeholderTextColor="#999"
                                />
                            </View>
                        </View>

                        {/* Subcontenedor para agregar clientes */}
                        <View style={styles.subContainer}>
                            <Text style={styles.subTitle}>Agregar Clientes a la lista asociada</Text>

                            {/* Autocomplete para clientes */}
                            <ApiAutocomplete
                                endpoint="/cliente/filter/5/1"
                                body={{
                                    nombre: '',
                                }}
                                displayFormat={(item) => item.nombre}
                                onItemSelect={handleClienteSelect}
                                placeholder="Buscar cliente por nombre..."
                                delay={500}
                            />

                            {/* Tabla de clientes asociados */}
                            {clientesAsociados.length > 0 && (
                                <View style={styles.clientesSection}>
                                    <Text style={[styles.sectionTitle, { marginBottom: Spacing.s }]}>Clientes a asociar ({clientesAsociados.length})</Text>
                                    <DataTable
                                        columns={columns}
                                        items={clientesAsociados}
                                        totalItems={clientesAsociados.length}
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
                            )}
                        </View>

                        {/* Botón para asociar */}
                        <TouchableOpacity
                            style={[
                                styles.asociarButton,
                                (!selectedPaciente || clientesAsociados.length === 0) && styles.asociarButtonDisabled
                            ]}
                            onPress={handleAsociarClientes}
                            disabled={!selectedPaciente || clientesAsociados.length === 0}
                        >
                            <Text style={styles.asociarButtonText}>Asociar Clientes a Paciente</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Contenido de la pestaña de Clientes (por ahora vacío) */}
                {activeTab === 'clientes' && (
                    <View style={styles.tabContent}>
                        <Text style={styles.comingSoonText}>
                            Funcionalidad de Clientes - Próximamente
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    scrollContent: {
        flex: 1
    },
    scrollContentContainer: {
        flexGrow: 1,
        padding: Spacing.m
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.m,
    },
    infoButton: {
        padding: 8,
    },
    sectionTitle: {
        fontSize: Typography.h3,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        flex: 1,
        textAlign: 'center',
    },
    backButton: {
        backgroundColor: Colors.primarySuave,
        padding: Spacing.s,
        height: 40,
        width: 40,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
    },
    icon: {
        width: 20,
        height: 20,
        tintColor: Colors.textPrimary,
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
    tabsContainer: {
        flexDirection: 'row',
        marginBottom: Spacing.m,
        backgroundColor: Colors.primarySuave,
        borderRadius: 8,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: Spacing.s,
        alignItems: 'center',
        borderRadius: 6,
    },
    activeTab: {
        backgroundColor: Colors.primary,
    },
    tabText: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: Colors.textPrimary,
    },
    tabContent: {
        // Estilos para el contenido de la pestaña
    },
    subContainer: {
        backgroundColor: Colors.primaryClaro,
        padding: Spacing.m,
        borderRadius: 8,
        marginBottom: Spacing.m,
    },
    subTitle: {
        fontSize: Typography.h4,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        marginBottom: Spacing.s,
    },
    selectedItemContainer: {
        marginBottom: Spacing.m,
        padding: Spacing.s,
        backgroundColor: '#e8f5e9',
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: Colors.boton_verde,
    },
    selectedItemText: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
    },
    boldText: {
        fontWeight: 'bold',
    },
    clientesInfoText: {
        fontSize: Typography.small,
        color: Colors.boton_verde,
        fontStyle: 'italic',
        marginTop: 4,
    },
    inputGroup: {
        marginTop: Spacing.m,
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
        paddingVertical: 10,
        fontSize: Typography.body,
        color: Colors.textSecondary,
    },
    clientesSection: {
        marginTop: Spacing.m,
    },
    asociarButton: {
        backgroundColor: Colors.boton_azul,
        paddingVertical: Spacing.m,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: Spacing.s,
        borderWidth: 1,
        borderColor: '#000',
    },
    asociarButtonDisabled: {
        backgroundColor: Colors.primarySuave,
        opacity: 0.6,
    },
    asociarButtonText: {
        color: '#fff',
        fontSize: Typography.body,
        fontWeight: '700',
    },
    comingSoonText: {
        textAlign: 'center',
        fontSize: Typography.body,
        color: Colors.textSecondary,
        fontStyle: 'italic',
        padding: Spacing.xl,
    },
});