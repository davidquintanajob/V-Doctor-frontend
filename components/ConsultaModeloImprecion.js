import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Image, TextInput } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors, Spacing, Typography } from '../variables';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as RNImage } from 'react-native';

export default function ConsultaModeloImprecion({ isOpen, onClose, consulta = {}, paciente = {} }) {
    const [local, setLocal] = useState({});
    const [apiHost, setApiHost] = useState('');
    const [storageUser, setStorageUser] = useState(null);
    const [logoUri, setLogoUri] = useState(null);
    const [customTotal, setCustomTotal] = useState(''); // Nuevo estado para el total editable

    useEffect(() => {
        const c = consulta || {};
        setLocal({
            motivo: c.motivo || '',
            diagnostico: c.diagnostico || '',
            tratamiento: c.tratamiento || '',
            fecha: c.fecha ? (c.fecha.split && c.fecha.split('T') ? c.fecha.split('T')[0] : c.fecha) : '',
            usuario: (c.usuario && c.usuario.nombre_natural) || '',
            observaciones: c.observaciones || ''
        });
        
        // Calcular y establecer el total inicial
        const ventas = Array.isArray(c.venta) ? c.venta : [];
        const calculatedTotal = ventas.reduce((s, it) => s + (Number(it.precio_cobrado_cup) || 0), 0);
        setCustomTotal(calculatedTotal.toString());
    }, [consulta, isOpen]);

    // load AsyncStorage config (api host and user) and resolve logo asset URI
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem('@config');
                const raw2 = await AsyncStorage.getItem('userConfig');
                const cfg = raw ? JSON.parse(raw) : (raw2 ? JSON.parse(raw2) : null);
                if (mounted && cfg) {
                    const host = cfg.api_host || cfg.apihost || cfg.apiHost || '';
                    setApiHost(host || '');
                    setStorageUser(cfg.user || cfg.usuario || cfg || null);
                }
            } catch (e) {
                // ignore
            }

            try {
                const resolved = RNImage.resolveAssetSource(require('../assets/images/logo(con_borde_blanco).png'));
                if (mounted && resolved && resolved.uri) setLogoUri(resolved.uri);
            } catch (e) {
                // asset may not exist
            }
        })();
        return () => { mounted = false; };
    }, [isOpen]);

    const generateHTML = () => {
        const pacienteNombre = paciente?.nombre || (consulta?.paciente && consulta.paciente.nombre) || '';
        const pacienteSexo = consulta.paciente?.sexo || paciente.sexo || '';
        const pacienteEspecie = consulta.paciente?.especie || paciente.especie || '';
        const pacienteNum = consulta.paciente?.numero_clinico ?? paciente.numero_clinico ?? '';
        const userName = (storageUser && (storageUser.nombre || storageUser.nombre_natural || storageUser.user?.nombre)) || '';
        const userId = (storageUser && (storageUser.id_usuario || storageUser.id_user || storageUser.id)) || '';
        const firmaUrl = apiHost ? apiHost.replace(/\/+$/, '') + '/fotos/usuariofirma/' + userId + '.jpg' : '';
        const logo = logoUri || '';

        const ventas = Array.isArray(consulta.venta) ? consulta.venta : [];
        // Usar el total personalizado si existe, de lo contrario calcularlo
        const total = customTotal ? parseFloat(customTotal) || 0 : ventas.reduce((s, it) => s + (Number(it.precio_cobrado_cup) || 0), 0);

        return `
        <!doctype html>
        <html>
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
                @page { margin: 10px; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; font-size: 25px; color: #222; margin: 0; padding: 0; }
                .container { width: 100%; box-sizing: border-box; padding: 17px; }
                .top-section { display: flex; width: 100%; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
                .left-header { display: flex; align-items: center; flex: 1; }
                .logo { max-width: 180px; height: auto; filter: grayscale(100%); margin-right: 17px; }
                .doctor-info { flex: 1; }
                .doctor-label { font-size: 22px; color: #666; }
                .doctor-name { font-weight: 700; font-size: 25px; color: #222; }
                .date-container { text-align: right; font-size: 24px; color: #444; }
                .hr { border-top: 1px solid #ccc; margin: 13px 0; }
                .patient-info { margin-top: 8px; }
                .patient-info-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
                .patient-label { font-weight: 600; color: #444; }
                .patient-value { font-weight: 700; color: #222; }
                .patient-value-clinic { font-weight: 900; color: #000; font-size: 27px; }
                .clinical-info { margin-top: 17px; }
                .clinical-section { margin-bottom: 13px; }
                .clinical-label { font-weight: 700; color: #333; font-size: 24px; margin-bottom: 4px; display: block; }
                .clinical-value { color: #222; font-size: 25px; line-height: 1.3; padding-left: 8px; border-left: 3px solid #ccc; }
                .sales-section { margin-top: 17px; }
                .sales-header { font-weight: 700; font-size: 25px; margin-bottom: 8px; border-bottom: 2px solid #333; padding-bottom: 3px; }
                .sales-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #eee; }
                .sales-item:last-child { border-bottom: none; }
                .item-name { flex: 2; }
                .item-qty { flex: 1; text-align: center; }
                .total-row { display: flex; justify-content: space-between; align-items: center; margin-top: 13px; padding-top: 8px; border-top: 2px solid #333; font-size: 27px; }
                .signature-section { display: flex; justify-content: space-between; align-items: center; margin-top: 25px; padding-top: 13px; border-top: 1px solid #ccc; }
                .firma { width: 126px; height: auto; filter: grayscale(100%); }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="top-section">
                    <div class="left-header">
                        ${logo ? `<img class="logo" src="${logo}" alt="Logo" />` : ''}
                        <div class="doctor-info">
                            <div class="doctor-label">Especialista:</div>
                            <div class="doctor-name">${escapeHtml(userName)}</div>
                        </div>
                    </div>
                    <div class="date-container">${escapeHtml(local.fecha || '')}</div>
                </div>

                <div class="hr"></div>

                <div class="patient-info">
                    <div class="patient-info-row">
                        <span class="patient-label">Paciente:</span>
                        <span class="patient-value">${escapeHtml(pacienteNombre)}</span>
                    </div>
                    <div class="patient-info-row">
                        <span class="patient-label">Especie:</span>
                        <span class="patient-value">${escapeHtml(pacienteEspecie)}</span>
                    </div>
                    <div class="patient-info-row">
                        <span class="patient-label">Número Clínico:</span>
                        <span class="patient-value-clinic">${escapeHtml(String(pacienteNum))}</span>
                    </div>
                </div>

                <div class="clinical-info">
                    ${local.motivo ? `<div class="clinical-section"><span class="clinical-label">Motivo de la consulta:</span><div class="clinical-value">${escapeHtml(local.motivo)}</div></div>` : ''}
                    ${local.diagnostico ? `<div class="clinical-section"><span class="clinical-label">Diagnóstico:</span><div class="clinical-value">${escapeHtml(local.diagnostico)}</div></div>` : ''}
                    ${local.tratamiento ? `<div class="clinical-section"><span class="clinical-label">Tratamiento:</span><div class="clinical-value">${escapeHtml(local.tratamiento)}</div></div>` : ''}
                </div>

                <div class="hr"></div>

                <div class="sales-section">
                    <div class="sales-header"></div>
                    ${ventas.map(v => {
            const comp = v.comerciable || {};
            const prod = comp.producto;
            const serv = comp.servicio;
            const label = prod ? prod.nombre : (serv ? (serv.descripcion || serv.nombre) : 'Ítem');
            return `<div class="sales-item"><div class="item-name">${escapeHtml(label)}</div><div class="item-qty">${escapeHtml(String(v.cantidad || '1'))}</div></div>`;
        }).join('')}
                    
                    <div class="total-row">
                        <span>TOTAL:</span>
                        <span><strong>$ ${parseFloat(total).toFixed(2)}</strong></span>
                    </div>
                </div>

                ${firmaUrl ? `<div class="signature-section"><div class="total">Firma del especialista:</div><div><img class="firma" src="${firmaUrl}" alt="Firma" /></div></div>` : ''}
            </div>
        </body>
        </html>
    `;
    };

    const escapeHtml = (unsafe) => {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const handlePrint = async () => {
        try {
            const html = generateHTML();
            const { uri } = await Print.printToFileAsync({ html });
            if (!uri) throw new Error('No se pudo generar el archivo');
            await compartirPDF(uri);
        } catch (error) {
            console.error('Error generando/imprimiendo:', error);
            Alert.alert('Error', 'No se pudo generar el documento: ' + (error.message || ''));
        }
    };

    const compartirPDF = async (uri) => {
        try {
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Historia Clínica - ${paciente?.nombre || ''}`,
                    UTI: 'com.adobe.pdf'
                });
            } else {
                Alert.alert('Info', 'La función de compartir no está disponible en este dispositivo');
            }
        } catch (error) {
            console.error('Error compartiendo PDF:', error);
            Alert.alert('Error', 'No se pudo compartir el PDF');
        }
    };

    if (!isOpen) return null;

    return (
        <Modal visible={!!isOpen} animationType="slide" onRequestClose={onClose} transparent>
            <View style={styles.container}>
                <View style={styles.modalBox}>
                    <View style={styles.headerRowModal}>
                        <Text style={styles.headerTitle}>Vista impresión</Text>
                        <View style={styles.headerButtonsRight}>
                            <TouchableOpacity style={[styles.headerButton, { backgroundColor: Colors.boton_azul }]} onPress={handlePrint}>
                                <Text style={styles.headerButtonText}>Imprimir</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.closeCircle} onPress={onClose}>
                                <Text style={styles.closeCircleText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Fecha:</Text>
                            <Text style={styles.fieldValue}>{local.fecha}</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Motivo:</Text>
                            <Text style={styles.fieldValue}>{local.motivo}</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Diagnóstico:</Text>
                            <Text style={styles.fieldValue}>{local.diagnostico || '-'}</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Tratamiento:</Text>
                            <Text style={styles.fieldValue}>{local.tratamiento || '-'}</Text>
                        </View>

                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Patología:</Text>
                            <Text style={styles.fieldValue}>{consulta.patologia || '-'}</Text>
                        </View>

                        <View style={styles.patientBox}>
                            <Text style={[styles.fieldLabel, { fontWeight: '700' }]}>Paciente</Text>
                            <Text style={styles.patientText}>Nombre: {consulta.paciente?.nombre || paciente.nombre || '-'}</Text>
                            <Text style={styles.patientText}>Sexo: {consulta.paciente?.sexo || paciente.sexo || '-'}</Text>
                            <Text style={styles.patientText}>Raza: {consulta.paciente?.raza || paciente.raza || '-'}</Text>
                            <Text style={styles.patientText}>Especie: {consulta.paciente?.especie || paciente.especie || '-'}</Text>
                            <Text style={styles.patientText}>Num: {consulta.paciente?.numero_clinico ?? paciente.numero_clinico ?? '-'}</Text>
                        </View>

                        <View style={styles.ventasBox}>
                            <Text style={[styles.fieldLabel, { fontWeight: '700' }]}>Ventas</Text>
                            {Array.isArray(consulta.venta) && consulta.venta.length > 0 ? consulta.venta.map((v, i) => {
                                const comp = v.comerciable || {};
                                const prod = comp.producto;
                                const serv = comp.servicio;
                                const label = prod ? prod.nombre : (serv ? (serv.descripcion || serv.nombre) : 'Ítem');
                                return (
                                    <View key={v.id_venta ?? i} style={styles.ventaRow}>
                                        <Text style={styles.ventaName}>{label}</Text>
                                        <Text style={styles.ventaQty}>{String(v.cantidad || '')}</Text>
                                        <Text style={styles.ventaPrice}>{(v.precio_cobrado_cup != null) ? String(v.precio_cobrado_cup) + ' CUP' : '-'}</Text>
                                    </View>
                                );
                            }) : <Text style={styles.fieldValue}>Sin ventas</Text>}

                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Total:</Text>
                                <TextInput
                                    style={styles.totalInput}
                                    value={customTotal}
                                    onChangeText={setCustomTotal}
                                    keyboardType="numeric"
                                    placeholder="Ingrese el total"
                                />
                                <Text style={styles.totalCurrency}>CUP</Text>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    modalBox: { width: '88%', maxHeight: '84%', backgroundColor: '#f7f7f7', borderRadius: 12, overflow: 'hidden' },
    headerRowModal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.m, borderBottomWidth: 1, borderColor: '#eee' },
    headerTitle: { fontSize: Typography.h3, fontWeight: '700', color: Colors.textSecondary },
    headerButtonsRight: { flexDirection: 'row', alignItems: 'center' },
    headerButton: { paddingHorizontal: Spacing.m, paddingVertical: Spacing.s, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    headerButtonText: { color: '#fff', fontWeight: '700' },
    closeCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.boton_rojo_opciones, alignItems: 'center', justifyContent: 'center' },
    closeCircleText: { color: '#fff', fontWeight: '700', fontSize: 18 },
    content: { padding: Spacing.m },
    fieldRow: { marginBottom: Spacing.s },
    fieldLabel: { fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
    fieldValue: { color: Colors.textSecondary },
    patientBox: { backgroundColor: '#fff', padding: Spacing.s, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: Spacing.m },
    patientText: { color: Colors.textSecondary, marginBottom: 4 },
    ventasBox: { marginTop: Spacing.m, backgroundColor: '#fff', padding: Spacing.s, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
    ventaItemRow: { marginBottom: Spacing.xs },
    ventaText: { color: Colors.textSecondary },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.s },
    totalLabel: { fontWeight: '700', fontSize: 16 },
    totalInput: { 
        flex: 1, 
        marginHorizontal: Spacing.s, 
        paddingHorizontal: Spacing.s, 
        paddingVertical: Spacing.xs, 
        backgroundColor: '#fff', 
        borderWidth: 1, 
        borderColor: '#ddd', 
        borderRadius: 4,
        fontSize: 16,
        textAlign: 'right'
    },
    totalCurrency: { fontWeight: '700', fontSize: 16, minWidth: 40 },
    totalValue: { fontWeight: '700' },
    ventaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, borderBottomWidth: 0, borderColor: '#eee' },
    ventaName: { flex: 3, color: Colors.textSecondary },
    ventaQty: { flex: 1, textAlign: 'center', color: Colors.textSecondary },
    ventaPrice: { flex: 1, textAlign: 'right', color: Colors.textSecondary },
});