import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image } from 'react-native';
import { Colors, Spacing, Typography } from '../variables';
import ApiAutocomplete from './ApiAutocomplete';

const ServiciosLista = forwardRef(({ isEditable = true, initial = [], onChange }, ref) => {
    const [items, setItems] = useState(initial.map((v, i) => ({ id: `${Date.now()}_${i}`, ...v })) || []);

    const computeTotalsFromItems = (itemsArr) => {
        let totalCobrar = 0;
        let totalProfit = 0;
        itemsArr.forEach(item => {
            if (item.selected) {
                const price = parseFloat(item.precio_cup || '0') || 0;
                const qty = parseFloat(item.cantidad || '0') || 0;
                const cost = parseFloat(item.selected.costo_cup || '0') || 0;
                totalCobrar += price * qty;
                totalProfit += (price * qty) - (cost * qty);
            }
        });
        return {
            totalCobrar: isNaN(totalCobrar) ? 0 : totalCobrar,
            totalProfit: isNaN(totalProfit) ? 0 : Math.max(0, totalProfit),
        };
    };

    // Exponer items mediante el ref
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

    const addItem = () => {
        setItems(prev => ([...prev, {
            id: `${Date.now()}_${prev.length}`,
            selected: null,
            unidad_medida: '',
            categoria: '',
            posologia: '',
            precio_cup: '',
            cantidad: '1'
        }]));
    };

    const removeItem = (id) => {
        setItems(prev => prev.filter(v => v.id !== id));
    };

    const updateItemField = (id, field, value) => {
        setItems(prev => prev.map(v => v.id === id ? ({ ...v, [field]: value }) : v));
    };

    const handleSelect = (id, item) => {
        const precio = item?.precio_cup ?? '';
        const unidad = item?.unidad_medida ?? '';
        const categoria = item?.categoria ?? '';
        const posologia = item?.descripcion ?? '';

        setItems(prev => prev.map(v => v.id === id ? ({
            ...v,
            selected: item,
            unidad_medida: unidad,
            categoria: categoria,
            posologia: posologia,
            precio_cup: precio?.toString() ?? '',
            cantidad: v.cantidad || '1'
        }) : v));
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Image source={require('../assets/images/healthcare.png')} style={styles.icon} resizeMode="contain" />
                    <Text style={styles.title}>Servicios</Text>
                </View>

                <TouchableOpacity
                    style={[styles.addButton, (!isEditable || (items.length > 0 && !items[items.length - 1].selected)) && styles.buttonDisabled]}
                    onPress={addItem}
                    disabled={!isEditable || (items.length > 0 && !items[items.length - 1].selected)}
                >
                    <Text style={styles.addButtonText}>+ Agregar</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.list}>
                {items.map((entry, idx) => (
                    <View key={entry.id} style={styles.item}>
                        <View style={styles.autocompleteContainer}>
                            <ApiAutocomplete
                                endpoint="/servicio/filter/5/1"
                                body={{ nombre: '' }}
                                displayFormat={(it) => `${it.nombre || ''} - ${it.categoria || ''} - $ ${it.precio_cup ?? ''}`}
                                onItemSelect={(it) => handleSelect(entry.id, it)}
                                placeholder="Buscar servicio..."
                                delay={400}
                            />
                        </View>

                        <View style={styles.inputsRow}>
                            <TextInput
                                style={[styles.input, styles.readonlyInput]}
                                value={entry.unidad_medida}
                                editable={false}
                                placeholderTextColor="#999"
                                placeholder="Unidad"
                            />
                            <TextInput
                                style={[styles.input, styles.readonlyInput]}
                                value={entry.categoria}
                                editable={false}
                                placeholderTextColor="#999"
                                placeholder="Categoría"
                            />
                        </View>

                        <TextInput
                            style={[styles.input, styles.largeInput, styles.readonlyInput]}
                            value={entry.posologia}
                            editable={false}
                            placeholderTextColor="#999"
                            placeholder="Descripción"
                            multiline
                            numberOfLines={2}
                            textAlignVertical="top"
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
                                        const cost = parseFloat(entry.selected.costo_cup || '0');
                                        const profit = (price * qty) - (cost * qty);
                                        return isNaN(profit) ? '0' : Math.max(0, profit).toFixed(2);
                                    })()}
                                </Text>
                            </View>
                        )}

                        <View style={styles.itemButtonsRow}>
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
        </View>
    );
});

ServiciosLista.displayName = 'ServiciosLista';
export default ServiciosLista;

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
        borderColor: '#1ba179',
    },
    addButtonText: {
        color: '#fff',
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
    largeInput: {
        minHeight: 60,
        paddingVertical: Spacing.s,
        marginBottom: Spacing.s,
    },
    readonlyInput: {
        backgroundColor: '#f3f3f3'
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
