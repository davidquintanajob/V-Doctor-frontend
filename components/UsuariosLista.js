import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DropdownGenerico from './DropdownGenerico';
import { Colors, Spacing, Typography } from '../variables';

const UsuariosLista = forwardRef(({ data = [], initialSelected = [], isEditable = true, onChange }, ref) => {
    const [selected, setSelected] = useState(initialSelected || []);

    useEffect(() => {
        // if parent changes initialSelected, update
        if (!initialSelected || !Array.isArray(initialSelected)) {
            setSelected([]);
            return;
        }

        // Normalize preselected items to use objects from `data` when possible
        const normalized = initialSelected.map(s => {
            if (!s) return s;
            const found = data.find(d => d.id_usuario === s.id_usuario);
            return found || s;
        });

        setSelected(normalized || []);
    }, [initialSelected, data]);

    useEffect(() => {
        if (onChange) {
            onChange({ totalCobrar: 0, totalProfit: 0, items: selected });
        }
      }, [selected]);

    useImperativeHandle(ref, () => ({
        getItems: () => selected,
        getTotals: () => ({ totalCobrar: 0, totalProfit: 0 }),
    }));

    const availableOptions = data.filter(u => !selected.find(s => s.id_usuario === u.id_usuario));

    const handleSelect = (user) => {
        if (!user) return;
        setSelected(prev => [...prev, user]);
    };

    const handleRemove = (idx) => {
        setSelected(prev => prev.filter((_, i) => i !== idx));
    };

    const renderRow = (item, index) => (
        <View style={styles.itemRow} key={String(item.id_usuario)}>
            <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.nombre_natural}</Text>
                <Text style={styles.role}>{item.rol}</Text>
            </View>
            {isEditable && (
                <TouchableOpacity style={styles.removeButton} onPress={() => handleRemove(index)}>
                    <Text style={styles.removeText}>Eliminar</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Usuarios asignados</Text>
            <DropdownGenerico
                data={availableOptions}
                displayKey="nombre_natural"
                searchKey="nombre_natural"
                placeholder="Buscar usuario..."
                onValueChange={handleSelect}
                disabled={!isEditable || availableOptions.length === 0}
            />

            <View style={{ marginTop: Spacing.s }}>
                {selected && selected.length > 0 ? (
                    selected.map((it, idx) => renderRow(it, idx))
                ) : (
                    <Text style={styles.empty}>No hay usuarios asignados</Text>
                )}
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        padding: Spacing.m,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
        marginBottom: Spacing.m,
    },
    label: {
        fontSize: Typography.body,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.s,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    name: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    role: {
        fontSize: Typography.small,
        color: '#666',
    },
    removeButton: {
        paddingHorizontal: Spacing.s,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.boton_rojo_opciones,
        borderRadius: 6,
    },
    removeText: {
        color: '#fff',
        fontSize: Typography.small,
    },
    empty: {
        fontSize: Typography.small,
        color: '#999',
        fontStyle: 'italic',
        paddingVertical: Spacing.s,
    },
});

export default UsuariosLista;
