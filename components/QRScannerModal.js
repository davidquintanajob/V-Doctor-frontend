import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Alert,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, Typography, Spacing } from '../variables';

export default function QRScannerModal({ visible, onClose, onCodeScanned }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const cameraRef = useRef(null);
    const [manualCode, setManualCode] = useState('');

    useEffect(() => {
        if (visible && permission === null) {
            requestPermission();
        }
    }, [visible, permission]);

    const handleBarCodeScanned = ({ data }) => {
        if (!scanned) {
            setScanned(true);
            onCodeScanned(data);
            onClose();
        }
    };

    const handleManualSubmit = () => {
        if (manualCode.trim()) {
            onCodeScanned(manualCode.trim());
            setManualCode('');
            onClose();
        } else {
            Alert.alert('Error', 'Por favor ingresa un código');
        }
    };

    const handleClose = () => {
        setScanned(false);
        setManualCode('');
        onClose();
    };

    if (!visible) {
        return null;
    }

    if (permission === null) {
        return (
            <Modal visible={visible} transparent={true} animationType="fade">
                <View style={styles.container}>
                    <View style={styles.messageBox}>
                        <Text style={styles.messageText}>Solicitando permisos de cámara...</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                            <Text style={styles.closeButtonText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    if (!permission?.granted) {
        return (
            <Modal visible={visible} transparent={true} animationType="fade">
                <View style={styles.container}>
                    <View style={styles.messageBox}>
                        <Text style={styles.messageText}>
                            Se requieren permisos de cámara para escanear códigos QR o de barras.
                        </Text>
                        <TouchableOpacity 
                            style={styles.permissionButton} 
                            onPress={requestPermission}
                        >
                            <Text style={styles.permissionButtonText}>Otorgar Permisos</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                            <Text style={styles.closeButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} transparent={true} animationType="fade">
            <View style={styles.container}>
                <View style={styles.cameraContainer}>
                    <CameraView
                        ref={cameraRef}
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        style={styles.camera}
                    />

                    {/* Overlay para mostrar área de escaneo */}
                    <View style={styles.scanAreaOverlay}>
                        <View style={styles.scanAreaFrame} />
                    </View>

                    {/* Header con botón de cerrar */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Escanear Código</Text>
                        <View style={{ width: 50 }} />
                    </View>

                    {/* Footer con instrucciones */}
                    <View style={styles.footer}>
                        <Text style={styles.instructionText}>
                            Apunta la cámara al código QR o de barras
                        </Text>
                    </View>

                    {/* Mostrar mensaje si ya fue escaneado */}
                    {scanned && (
                        <View style={styles.scannedMessage}>
                            <Text style={styles.scannedText}>Código escaneado ✓</Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraContainer: {
        flex: 1,
        width: '100%',
        position: 'relative',
    },
    camera: {
        flex: 1,
    },
    scanAreaOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanAreaFrame: {
        width: 280,
        height: 280,
        borderWidth: 3,
        borderColor: Colors.boton_azul,
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 40,
        paddingHorizontal: Spacing.m,
        paddingBottom: Spacing.m,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    headerTitle: {
        color: '#fff',
        fontSize: Typography.h3,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
    },
    closeButton: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.boton_rojo_opciones,
        borderRadius: 25,
    },
    closeButtonText: {
        color: '#fff',
        fontSize: Typography.h2,
        fontWeight: 'bold',
    },
    permissionButton: {
        backgroundColor: Colors.boton_azul,
        paddingVertical: Spacing.m,
        paddingHorizontal: Spacing.l,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: Spacing.m,
    },
    permissionButtonText: {
        color: '#fff',
        fontSize: Typography.body,
        fontWeight: 'bold',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingVertical: Spacing.m,
        paddingHorizontal: Spacing.m,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        alignItems: 'center',
    },
    instructionText: {
        color: '#fff',
        fontSize: Typography.body,
        textAlign: 'center',
        fontWeight: '500',
    },
    scannedMessage: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -80 }, { translateY: -30 }],
        backgroundColor: Colors.boton_verde || '#4CAF50',
        paddingVertical: Spacing.m,
        paddingHorizontal: Spacing.xl,
        borderRadius: 10,
    },
    scannedText: {
        color: '#fff',
        fontSize: Typography.body,
        fontWeight: 'bold',
    },
    messageBox: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: Spacing.xl,
        marginHorizontal: Spacing.m,
        alignItems: 'center',
        gap: Spacing.m,
    },
    messageText: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
});
