import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Typography } from '../variables';

export default function SimpleAlert({
    visible,
    title = '',
    message = '',
    type = 'info', // 'info' | 'error' | 'success'
    onClose = () => {},
    buttons = [] // array de {text: string, onPress: () => void}
}) {
    const [internalVisible, setInternalVisible] = useState(visible);

    useEffect(() => {
        setInternalVisible(visible);
    }, [visible]);

    const handleClose = () => {
        setInternalVisible(false);
        onClose();
    };

    // Si no hay botones definidos, mostrar uno por defecto
    const alertButtons = buttons.length > 0 
        ? buttons 
        : [{ text: 'Aceptar', onPress: handleClose }];

    const getBackgroundColor = () => {
        switch(type) {
            case 'error': return Colors.boton_rojo_opciones;
            case 'success': return Colors.boton_azul;
            default: return Colors.boton_azul;
        }
    };

    return (
        <Modal visible={internalVisible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {title ? <Text style={styles.title}>{title}</Text> : null}
                    <Text style={styles.message}>{message}</Text>
                    
                    <View style={styles.buttonsContainer}>
                        {alertButtons.map((button, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.button,
                                    { backgroundColor: getBackgroundColor() },
                                    alertButtons.length > 1 && styles.multiButton
                                ]}
                                onPress={() => {
                                    button.onPress();
                                    handleClose();
                                }}
                            >
                                <Text style={styles.buttonText}>{button.text}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 20,
        width: '100%',
        maxWidth: 300,
    },
    title: {
        fontSize: Typography.h4 || 18,
        fontWeight: '700',
        marginBottom: 10,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    message: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: 20,
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
    multiButton: {
        marginHorizontal: 5,
        flex: 1,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
});