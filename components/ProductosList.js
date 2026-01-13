import React, { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ToastAndroid } from 'react-native';
import { Colors, Spacing, Typography } from '../variables';
import ApiAutocomplete from './ApiAutocomplete';
import AutocompleteTextInput from './AutocompleteTextInput';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRScannerModal from './QRScannerModal';

const ProductosList = forwardRef(({ isEditable = true, initial = [], onChange }, ref) => {
    const [items, setItems] = useState(initial || []);
    const [apiHost, setApiHost] = useState('');
    const [token, setToken] = useState('');
    const [showScannerModal, setShowScannerModal] = useState(false);
    const [scanningForItemId, setScanningForItemId] = useState(null);

    const computeTotalsFromItems = (itemsArr) => {
        let totalCobrar = 0;
        let totalProfit = 0;
        itemsArr.forEach(item => {
            if (item.selected) {
                const price = parseFloat(item.precio_cup || '0') || 0;
                const qty = parseFloat(item.cantidad || '0') || 0;
                // Preferir el precio original del comerciable (cuando viene en `initial`),
                // luego el costo/precio del producto y como fallback usar el precio del comerciable.
                const cost = parseFloat(item.precio_original_comerciable_cup ?? item.selected?.precio_cup ?? item.selected?.comerciable?.precio_cup ?? '0') || 0;
                totalCobrar += price * qty;
                totalProfit += (price * qty) - (cost * qty);
            }
        });
        return {
            totalCobrar: isNaN(totalCobrar) ? 0 : totalCobrar,
            totalProfit: isNaN(totalProfit) ? 0 : Math.max(0, totalProfit),
        };
    };

    // Exponer items y totales mediante el ref
    useImperativeHandle(ref, () => ({
        items: items,
        getItems: () => items,
        getTotals: () => computeTotalsFromItems(items),
    }));

    // Notificar cambios al padre cuando items cambian
    React.useEffect(() => {
        if (typeof onChange === 'function') {
            onChange(computeTotalsFromItems(items), items);
        }
    }, [items]);

    // Actualizar items cuando initial cambie (asegurar `nota_list`)
    React.useEffect(() => {
        setItems((initial || []).map(it => ({ ...it, nota_list: it.nota_list ?? '' })));
    }, [initial]);

    // Cargar configuración de API
    React.useEffect(() => {
        const loadConfig = async () => {
            try {
                const raw = await AsyncStorage.getItem('@config');
                if (raw) {
                    const config = JSON.parse(raw);
                    setApiHost(config.api_host || config.apihost || config.apiHost || '');
                    setToken(config.token || '');
                }
            } catch (error) {
                console.error('Error cargando configuración:', error);
            }
        };
        loadConfig();
    }, []);

    // Extraer lista de usuarios desde el campo `usuarios` y normalizar a array de objetos
    const extractUsers = (entry) => {
        if (!entry) return [];

        // Priorizar exactamente `usuarios`, con algunos fallbacks si está anidado
        const raw = entry.usuarios ?? entry.selected?.usuarios ?? entry.selected?.producto?.usuarios ?? null;
        if (raw == null) return [];

        // Si ya es un array
        if (Array.isArray(raw)) {
            // Si es array de strings, convertir a objetos con `nombre_usuario`
            if (raw.length > 0 && typeof raw[0] === 'string') {
                return raw.map(s => ({ nombre_usuario: s }));
            }
            // Si es array de objetos asumimos que contienen `nombre_usuario`
            return raw;
        }

        // Si es string, intentar parsear JSON
        if (typeof raw === 'string') {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    if (parsed.length > 0 && typeof parsed[0] === 'string') return parsed.map(s => ({ nombre_usuario: s }));
                    return parsed;
                }
            } catch (e) {
                // no JSON — seguir a fallback
            }

            // Fallback: lista separada por comas de nombres de usuario
            return raw.split(',').map(s => ({ nombre_usuario: s.trim() })).filter(x => x.nombre_usuario);
        }

        return [];
    };

    // Cargar nombre de usuario desde AsyncStorage al montar
    React.useEffect(() => {
        (async () => {
            try {
                let raw = await AsyncStorage.getItem('@config');
                if (!raw) return;
                let parsed = null;

                try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
                const nombre = parsed.usuario.nombre_usuario ?? null;
                if (nombre) setCurrentUserName(nombre);
            } catch (e) {
                // ignore
            }
        })();
    }, []);
    const autocompleteRefs = useRef({});
    const [lastAddedId, setLastAddedId] = useState(null);
    const [currentUserName, setCurrentUserName] = useState(null);

    const addItem = (afterId = null) => {
        const newId = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newItem = {
            id: newId,
            selected: null,
            codigo: '',
            precio_cup: '',
            nota_list: '',
            cantidad: '1'
        };

        setItems(prev => {
            if (!afterId) return [...prev, newItem];
            const idx = prev.findIndex(v => v.id === afterId);
            if (idx === -1) return [...prev, newItem];
            const copy = [...prev];
            copy.splice(idx + 1, 0, newItem);
            return copy;
        });

        setLastAddedId(newId);
    };

    const removeItem = (id) => {
        try { delete autocompleteRefs.current[id]; } catch (e) { }
        setItems(prev => prev.filter(v => v.id !== id));
    };

    const updateItemField = (id, field, value) => {
        setItems(prev => prev.map(v => v.id === id ? ({ ...v, [field]: value }) : v));
    };

    const handleSelect = (id, item) => {
        // Validar cantidad disponible
        const cantidadDisponible = item?.cantidad ?? 0;
        if (cantidadDisponible <= 0) {
            ToastAndroid.show('No hay cantidad de este producto para ser vendido', ToastAndroid.SHORT);
            return;
        }

        const precio = item?.comerciable?.precio_cup ?? '';
        const codigo = item?.codigo ?? '';
        const precio_original_cup = item.comerciable.precio_cup;
        const precio_original_usd = item.comerciable.precio_usd;

        setItems(prev => prev.map(v => v.id === id ? ({
            ...v,
            selected: item,
            codigo: codigo?.toString() ?? '',
            precio_cup: precio?.toString() ?? '',
            cantidad: v.cantidad || '1',
            precio_original_cup: precio_original_cup,
            precio_original_usd: precio_original_usd,
            nota_list: v.nota_list
        }) : v));
    };

    // Enfocar el input del último item agregado
    React.useEffect(() => {
        if (!lastAddedId) return;
        const ref = autocompleteRefs.current[lastAddedId];
        if (ref) {
            setTimeout(() => {
                try { if (typeof ref.focus === 'function') ref.focus(); else if (ref.current && typeof ref.current.focus === 'function') ref.current.focus(); } catch (e) { }
            }, 50);
        }
        setLastAddedId(null);
    }, [items, lastAddedId]);

    const searchProductByCode = async (codigo) => {
        if (!apiHost || !token) {
            ToastAndroid.show('No hay configuración de API', ToastAndroid.SHORT);
            return;
        }

        try {
            const url = `${apiHost}/producto/filter/1/1`;
            const bodyData = { codigo: codigo.toString().trim() };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(bodyData),
            });

            const responseText = await response.text();

            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('❌ Error parsing JSON:', parseError);
                console.error('📋 Raw response:', responseText);
                ToastAndroid.show('Error de respuesta del servidor (respuesta no válida)', ToastAndroid.SHORT);
                return;
            }

            if (!response.ok) {
                console.error('❌ Response not ok:', result);
                const errorMsg = result?.message || 'Error al buscar producto';
                ToastAndroid.show(errorMsg, ToastAndroid.SHORT);
                return;
            }

            // Verificar si hay resultados
            if (!result.data || result.data.length === 0) {
                ToastAndroid.show('No se encontró producto con este código', ToastAndroid.SHORT);
                return;
            }

            // Si hay un resultado, retornarlo
            const producto = result.data[0];
            return producto;

        } catch (error) {
            console.error('❌ Error buscando producto por código:', error);
            console.error('Error details:', error.message);
            ToastAndroid.show('Error de conexión con el servidor', ToastAndroid.SHORT);
        }
    };

    const handleScanCode = (entryId) => {
        setScanningForItemId(entryId);
        setShowScannerModal(true);
    };

    const handleCodeScanned = async (codigo) => {
        setShowScannerModal(false);

        const codigoLimpio = codigo?.trim() || '';

        if (!codigoLimpio) {
            ToastAndroid.show('Por favor ingresa un código', ToastAndroid.SHORT);
            setScanningForItemId(null);
            return;
        }

        const producto = await searchProductByCode(codigoLimpio);
        if (producto && scanningForItemId) {
            handleSelect(scanningForItemId, producto);
            setScanningForItemId(null);
        } else {
            setScanningForItemId(null);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Image source={require('../assets/images/Productos.png')} style={styles.icon} resizeMode="contain" />
                    <Text style={styles.title}>Productos</Text>
                </View>

                {items.length === 0 && (
                    <TouchableOpacity
                        style={[styles.addButton, !isEditable && styles.buttonDisabled]}
                        onPress={() => addItem(null)}
                        disabled={!isEditable}
                    >
                        <Text style={styles.addButtonText}>+ Agregar</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.list}>
                {items.map((entry, idx) => (
                    <View key={entry.id} style={styles.item}>
                        <View style={styles.autocompleteContainer}>
                            <ApiAutocomplete
                                endpoint="/producto/filter/5/1"
                                body={{ nombre: '' }}
                                displayFormat={(it) => `${it.nombre || ''} - ${it.categoria || ''} - $ ${it.comerciable?.precio_cup ?? ''}`}
                                onItemSelect={(it) => handleSelect(entry.id, it)}
                                placeholder="Buscar producto..."
                                delay={400}
                                initialValue={entry.selected}
                                ref={(r) => { autocompleteRefs.current[entry.id] = r; }}
                            />
                        </View>

                        <View style={styles.inputsRow}>
                            <TextInput
                                style={[styles.input, styles.readonlyInput, { flex: 1 }]}
                                value={entry.codigo?.toString() ?? ''}
                                editable={false}
                                placeholderTextColor="#999"
                                placeholder="Código"
                            />
                            <TouchableOpacity
                                style={[styles.cameraButton, !isEditable && styles.buttonDisabled]}
                                onPress={() => handleScanCode(entry.id)}
                                disabled={!isEditable}
                            >
                                <Image
                                    source={require('../assets/images/camera.png')}
                                    style={styles.cameraIcon}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>
                        </View>


                        <AutocompleteTextInput
                            style={[styles.input, { marginBottom: Spacing.s }]}
                            value={entry.nota_list ?? ''}
                            onChangeText={(text) => updateItemField(entry.id, 'nota_list', text)}
                            editable={isEditable}
                            placeholderTextColor="#999"
                            placeholder="Nota"
                        />

                        <View style={styles.inputsRow}>
                            <TextInput
                                style={styles.input}
                                value={entry.precio_cup?.toString() ?? ''}
                                onChangeText={(text) => updateItemField(entry.id, 'precio_cup', text.replace(/[^0-9.]/g, ''))}
                                editable={isEditable}
                                placeholder="Precio CUP"
                                keyboardType="decimal-pad"
                                placeholderTextColor="#999"
                            />
                            <TextInput
                                style={styles.input}
                                value={entry.cantidad?.toString() ?? '1'}
                                onChangeText={(text) => updateItemField(entry.id, 'cantidad', text.replace(/[^0-9.]/g, ''))}
                                editable={isEditable}
                                placeholder="Cantidad"
                                keyboardType="decimal-pad"
                                placeholderTextColor="#999"
                            />
                        </View>

                        {entry.selected && (
                            <View style={{ marginTop: Spacing.s }}>
                                <Text style={{ color: Colors.textSecondary, marginBottom: Spacing.xs }}>
                                    Cantidad restante después de la venta: {(() => {
                                        const exist = parseFloat(entry.selected.cantidad ?? 0);
                                        const qty = parseFloat(entry.cantidad || '0');
                                        const rem = exist - qty;
                                        return isNaN(rem) ? '0' : rem;
                                    })()}
                                </Text>

                                <Text style={{ color: Colors.textSecondary, marginBottom: Spacing.xs }}>
                                    Total a cobrar: {(() => {
                                        const price = parseFloat(entry.precio_cup || '0');
                                        const qty = parseFloat(entry.cantidad || '0');
                                        const total = price * qty;
                                        return isNaN(total) ? '0' : total.toFixed(2);
                                    })()}
                                </Text>

                                <Text style={{ color: Colors.textSecondary }}>
                                    Plus por esta venta: {(() => {
                                        const price = parseFloat(entry.precio_cup || '0');
                                        const qty = parseFloat(entry.cantidad || '0');
                                        // Preferir el precio original del comerciable (cuando viene en `initial`),
                                        // luego el costo/precio del producto y como fallback usar precio del comerciable
                                        const producto_precio = parseFloat(entry.precio_original_comerciable_cup ?? entry.selected?.precio_cup ?? entry.selected?.comerciable?.precio_cup ?? '0');
                                        const profit = (price * qty) - (producto_precio * qty);
                                        return isNaN(profit) ? '0' : Math.max(0, profit).toFixed(2);
                                    })()}
                                </Text>
                            </View>
                        )}

                        <View style={styles.itemButtonsRow}>
                            {/* Botón azul a la extrema derecha; se deshabilita si existe lista de usuarios y coincide el nombre en AsyncStorage */}
                            {(() => {
                                const users = extractUsers(entry);
                                let disabledForCurrent = users.length > 0 && currentUserName && users.some(u => (u.nombre_usuario || u.name || u.usuario) === currentUserName);
                                if (users.length === 0)
                                    disabledForCurrent = true;
                                return (
                                    <TouchableOpacity
                                        style={[styles.actionButtonBlue, (disabledForCurrent || !isEditable) && styles.buttonDisabled, { marginLeft: Spacing.s }]}
                                        onPress={async () => {
                                            try {
                                                const raw = await AsyncStorage.getItem('@config');
                                                if (!raw) {
                                                    ToastAndroid.show('No se encontró configuración de usuario', ToastAndroid.SHORT);
                                                    return;
                                                }
                                                let parsed = null;
                                                try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
                                                const userObj = parsed?.usuario ?? parsed ?? null;
                                                if (!userObj) {
                                                    ToastAndroid.show('Usuario inválido en configuración', ToastAndroid.SHORT);
                                                    return;
                                                }

                                                setItems(prev => prev.map(v => {
                                                    if (v.id !== entry.id) return v;
                                                    const existing = extractUsers(v) || [];
                                                    const username = userObj.nombre_usuario || userObj.name || userObj.usuario || null;
                                                    if (!username) {
                                                        // si no hay nombre de usuario, no agregar
                                                        return v;
                                                    }
                                                    const already = existing.some(u => (u.nombre_usuario || u.name || u.usuario) === username);
                                                    if (already) {
                                                        ToastAndroid.show('Usuario ya en la lista', ToastAndroid.SHORT);
                                                        return v;
                                                    }
                                                    // agregar el objeto tal cual (idealmente incluye id_usuario y nombre_usuario)
                                                    const next = [...existing, userObj];
                                                    return { ...v, usuarios: next };
                                                }));

                                                ToastAndroid.show('Participación registrada', ToastAndroid.SHORT);
                                            } catch (e) {
                                                ToastAndroid.show('Error al registrar participación', ToastAndroid.SHORT);
                                            }
                                        }}
                                        disabled={disabledForCurrent || !isEditable}
                                    >
                                        <Text style={styles.actionButtonText}>Participé</Text>
                                    </TouchableOpacity>
                                );
                            })()}
                            <TouchableOpacity
                                style={[styles.addButton, (!isEditable || !entry.selected || idx !== items.length - 1) && styles.buttonDisabled, { marginRight: Spacing.s }]}
                                onPress={() => addItem(entry.id)}
                                disabled={!isEditable || !entry.selected || idx !== items.length - 1}
                            >
                                <Text style={styles.addButtonText}>+ Agregar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.deleteButton, !isEditable && styles.buttonDisabled]}
                                onPress={() => removeItem(entry.id)}
                                disabled={!isEditable}
                            >
                                <Text style={styles.deleteButtonText}>Eliminar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </View>

            <QRScannerModal
                visible={showScannerModal}
                onClose={() => setShowScannerModal(false)}
                onCodeScanned={handleCodeScanned}
            />
        </View>
    );
});

ProductosList.displayName = 'ProductosList';
export default ProductosList;

const styles = StyleSheet.create({
    container: {
        borderWidth: 1,
        borderColor: Colors.primaryDark,
        backgroundColor: '#fff',
        padding: Spacing.m,
        borderRadius: 8,
        marginBottom: Spacing.m,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.s,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
    },
    icon: {
        width: 26,
        height: 26,
        tintColor: Colors.primaryDark,
    },
    actionButtonBlue: {
        backgroundColor: Colors.boton_azul,
        paddingVertical: 8,
        marginRight: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#0069d9',
    },
    actionButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    title: {
        fontSize: Typography.body,
        fontWeight: '700',
        color: Colors.primaryDark,
    },
    addButton: {
        backgroundColor: Colors.primaryDark,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    addButtonText: {
        color: '#fafafa',
        fontWeight: '600',
    },
    list: {
        width: '100%',
    },
    autocompleteContainer: {
        marginBottom: Spacing.m,
    },
    item: {
        borderWidth: 1,
        borderColor: '#e6e6e6',
        padding: Spacing.s,
        borderRadius: 8,
        marginBottom: Spacing.s,
        backgroundColor: '#fafafa',
    },
    inputsRow: {
        flexDirection: 'row',
        gap: Spacing.s,
        marginBottom: Spacing.s,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        paddingHorizontal: Spacing.m,
        paddingVertical: 8,
        fontSize: Typography.body,
        color: Colors.textSecondary,
    },
    readonlyInput: {
        backgroundColor: '#f3f3f3'
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
    itemButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    deleteButton: {
        backgroundColor: Colors.boton_rojo_opciones || '#c53030',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#922',
    },
    deleteButtonText: {
        color: Colors.textPrimary || '#fff',
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
});