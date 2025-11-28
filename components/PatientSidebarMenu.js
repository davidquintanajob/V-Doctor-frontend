import React, { useState, useEffect } from 'react';
import {
    View,
    TouchableOpacity,
    Image,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
    ScrollView,
    Alert,
    Platform,
    Linking
} from 'react-native';
import { Colors, Spacing, Typography } from '../variables';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Application from 'expo-application';
import { especies } from '../app/pacientes';

const { width } = Dimensions.get('window');
const MENU_WIDTH = width * 0.78;

const PatientSidebarMenu = ({ isOpen, onClose, paciente, apiHost, selectedItem = 'pacienteModal' }) => {
    const router = useRouter();
    const slideAnim = React.useRef(new Animated.Value(-MENU_WIDTH)).current;
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [epsonIPrintStatus, setEpsonIPrintStatus] = useState('checking'); // 'checking', 'installed', 'not_installed'

    const menuItems = [
        { name: 'Datos del Paciente', icon: require('../assets/images/folder.png'), link: 'pacienteModal' },
        { name: 'Historia Clínica', icon: require('../assets/images/historial-medico.png'), link: 'NoDisponible' },
        { name: 'Recetas', icon: require('../assets/images/receta.png'), link: 'NoDisponible' },
        { name: 'Vacunas', icon: require('../assets/images/inyeccion.png'), link: 'NoDisponible' },
        { name: 'Antiparasitarios', icon: require('../assets/images/sangre.png'), link: 'NoDisponible' },
        { name: 'Recordatorios', icon: require('../assets/images/despertador.png'), link: 'NoDisponible' },
        { name: 'Estetica y Baños', icon: require('../assets/images/bath.png'), link: 'NoDisponible' },
    ];

    React.useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: isOpen ? 0 : -MENU_WIDTH,
            duration: 250,
            useNativeDriver: false,
        }).start();
    }, [isOpen]);

    // Verificar si Epson iPrint está instalado usando múltiples métodos
    useEffect(() => {
        checkEpsonIPrintAvailability();
    }, []);

    const checkEpsonIPrintAvailability = async () => {
        if (Platform.OS !== 'android') {
            setEpsonIPrintStatus('installed');
            return;
        }

        try {
            console.log('🔍 Verificando Epson iPrint...');

            // Método 1: Intentar abrir la app directamente
            const epsonUrls = [
                'epsoniprint://',
                'com.epson.iprint://',
                'intent://scan/#Intent;package=epson.print;end',
                'intent://print/#Intent;package=epson.print;end'
            ];

            let isInstalled = false;

            // Probar diferentes URLs de Epson iPrint
            for (const url of epsonUrls) {
                try {
                    const canOpen = await Linking.canOpenURL(url);
                    if (canOpen) {
                        console.log(`✅ Epson iPrint detectado con URL: ${url}`);
                        isInstalled = true;
                        break;
                    }
                } catch (error) {
                    console.log(`❌ URL fallida: ${url}`, error);
                }
            }

            // Método 2: Si ningún URL funciona, asumir que está instalado pero usar método alternativo
            if (!isInstalled) {
                console.log('⚠️ No se pudo detectar Epson iPrint con URLs, usando método alternativo');
                // En lugar de marcar como no instalado, usamos un enfoque optimista
                // Muchas veces la app SÍ está instalada pero canOpenURL no la detecta
                setEpsonIPrintStatus('likely_installed');
            } else {
                setEpsonIPrintStatus('installed');
            }

        } catch (error) {
            console.log('❌ Error en verificación Epson iPrint:', error);
            // En caso de error, asumimos que podría estar instalado
            setEpsonIPrintStatus('likely_installed');
        }
    };

    const installEpsonIPrint = () => {
        if (Platform.OS === 'android') {
            Linking.openURL('market://details?id=epson.print');
        } else {
            Linking.openURL('https://apps.apple.com/app/epson-iprint/id325942910');
        }
    };

    // Función para generar el PDF real
    const generarPDFReal = async () => {
        if (!paciente) {
            Alert.alert('Error', 'No hay información del paciente disponible');
            return;
        }

        setIsGeneratingPDF(true);
        try {
            // Preparar datos para el PDF
            const datosPDF = {
                numeroHistoria: paciente.numero_clinico || 'N/A',
                nombrePaciente: paciente.nombre || 'Sin nombre',
                fechaGeneracion: new Date().toLocaleDateString('es-ES'),
                horaGeneracion: new Date().toLocaleTimeString('es-ES'),
                especie: paciente.especie || 'No especificada',
                raza: paciente.raza || 'No especificada',
                sexo: paciente.sexo ? paciente.sexo.charAt(0).toUpperCase() + paciente.sexo.slice(1) : 'No especificado',
                fechaNacimiento: paciente.fecha_nacimiento ? new Date(paciente.fecha_nacimiento).toLocaleDateString('es-ES') : 'No especificada',
                edad: calcularEdad(paciente.fecha_nacimiento),
                peso: paciente.peso_actual || 'No registrado',
                cliente: paciente.clientes && paciente.clientes[0] ? paciente.clientes[0].nombre : 'No asignado',
                telefono: paciente.clientes && paciente.clientes[0] ? paciente.clientes[0].telefono : 'No especificado',
                direccion: paciente.clientes && paciente.clientes[0] ? paciente.clientes[0].direccion : 'No especificada',
                chip: paciente.chip || 'No tiene',
                castrado: paciente.castrado ? 'Sí' : 'No',
                agresividad: paciente.agresividad ? `${paciente.agresividad}%` : 'No evaluada',
                historialMedico: paciente.historia_clinica || 'Sin historial médico registrado',
                compradoAdoptado: paciente.comprado_adoptado ? paciente.comprado_adoptado.charAt(0).toUpperCase() + paciente.comprado_adoptado.slice(1) : 'No especificado'
            };

            // Generar el contenido HTML para el PDF
            const htmlContent = generarHTMLPDF(datosPDF);

            // Generar el PDF
            const { uri } = await Print.printToFileAsync({
                html: htmlContent,
                width: 612,
                height: 792,
                margins: {
                    left: 36,
                    top: 36,
                    right: 36,
                    bottom: 36,
                },
            });

            console.log('PDF generado en:', uri);
            // Mostrar opciones de impresión mejoradas
            mostrarOpcionesImpresion(uri);

        } catch (error) {
            console.error('Error generando PDF:', error);
            Alert.alert('Error', 'No se pudo generar el PDF de la historia clínica');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    // Función mejorada para mostrar opciones de impresión
    const mostrarOpcionesImpresion = (uri) => {
        const opciones = [
            {
                text: '🖨️ Imprimir con Epson iPrint',
                onPress: () => imprimirConEpsonIPrint(uri)
            },
            {
                text: '👀 Previsualizar',
                onPress: () => previsualizarPDF(uri)
            },
            {
                text: '📲 Descargar Epson iPrint',
                onPress: () => descargarEpsonIPrint()
            }
        ];

        // Solo mostrar opción de instalación si estamos seguros de que no está instalado
        if (epsonIPrintStatus === 'not_installed' && Platform.OS === 'android') {
            opciones.unshift({
                text: '📲 Instalar Epson iPrint',
                onPress: installEpsonIPrint
            });
        }

        opciones.push({
            text: 'Cancelar',
            style: 'cancel'
        });

        Alert.alert(
            '✅ PDF Generado Exitosamente',
            `Historia clínica de ${paciente.nombre} ha sido generada.\n\n¿Qué deseas hacer?`,
            opciones
        );
    };

    // Función para descargar Epson iPrint
    const descargarEpsonIPrint = () => {
    Alert.alert(
        '📲 Descargar Epson iPrint',
        'Esta opción te llevará a Google Play Store para descargar la aplicación Epson iPrint, necesaria para imprimir con tu impresora Epson.',
        [
            {
                text: 'Ir a Play Store',
                onPress: () => {
                    if (Platform.OS === 'android') {
                        Linking.openURL('market://details?id=epson.print');
                    } else {
                        Linking.openURL('https://apps.apple.com/app/epson-iprint/id325942910');
                    }
                }
            },
            {
                text: 'Cancelar',
                style: 'cancel'
            }
        ]
    );
};

    // Función MEJORADA para imprimir usando Epson iPrint
    const imprimirConEpsonIPrint = async (uri) => {
        try {
            console.log('🖨️ Intentando imprimir con Epson iPrint...');

            // Enfoque optimista: Intentar directamente con Epson iPrint
            // Si falla, ofrecer alternativas

            if (Platform.OS === 'android') {
                // Intentar con intent específico para Epson
                try {
                    await Linking.openURL(`intent://print/#Intent;package=epson.print;type=application/pdf;uri=${uri};end`);
                    return; // Si funciona, salir de la función
                } catch (intentError) {
                    console.log('Intent específico falló, intentando método genérico...');
                }

                // Método genérico de compartir
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Imprimir con Epson iPrint - ${paciente.nombre}`,
                    UTI: 'com.adobe.pdf'
                });
            } else {
                // En iOS
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Imprimir Historia Clínica - ${paciente.nombre}`
                });
            }

        } catch (error) {
            console.error('❌ Error abriendo con Epson iPrint:', error);

            // Fallback inteligente
            Alert.alert(
                '⚠️ No se pudo abrir Epson iPrint directamente',
                'Puedes:\n\n1. Usar "Compartir PDF" y seleccionar Epson iPrint manualmente\n2. Intentar imprimir directamente\n3. Instalar Epson iPrint si no lo tienes',
                [
                    {
                        text: '📤 Compartir y Seleccionar Manualmente',
                        onPress: () => compartirPDF(uri)
                    },
                    {
                        text: '🖨️ Imprimir Directamente',
                        onPress: () => imprimirDirectamente(uri)
                    },
                    {
                        text: '📲 Instalar Epson iPrint',
                        onPress: installEpsonIPrint
                    },
                    {
                        text: 'Cancelar',
                        style: 'cancel'
                    }
                ]
            );
        }
    };

    // Función para imprimir directamente
    const imprimirDirectamente = async (uri) => {
        try {
            console.log('Imprimiendo directamente...');
            await Print.printAsync({
                uri,
                orientation: Print.Orientation.portrait
            });
        } catch (error) {
            console.error('Error en impresión directa:', error);
            Alert.alert(
                '❌ Error al Imprimir',
                'No se pudo imprimir el documento. Por favor, intenta:\n\n1. Verificar que la impresora esté conectada a la misma red WiFi\n2. Usar la opción "Compartir PDF" para imprimir desde Epson iPrint\n3. Guardar el PDF e imprimirlo más tarde',
                [
                    {
                        text: 'Compartir PDF',
                        onPress: () => compartirPDF(uri)
                    },
                    {
                        text: 'Aceptar',
                        style: 'cancel'
                    }
                ]
            );
        }
    };

    // Función para previsualizar el PDF
    const previsualizarPDF = async (uri) => {
        try {
            await Print.printAsync({
                uri,
                orientation: Print.Orientation.portrait
            });
        } catch (error) {
            console.error('Error previsualizando PDF:', error);
            Alert.alert('Error', 'No se pudo abrir la previsualización');
        }
    };

    // Función para compartir el PDF
    const compartirPDF = async (uri) => {
        try {
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Historia Clínica - ${paciente.nombre}`,
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

    // Función para generar el HTML del PDF (sin cambios - mantener tu código original)
    const generarHTMLPDF = (datos) => {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 25px;
            color: #333;
            line-height: 1.4;
          }
          .header {
            text-align: center;
            margin-bottom: 25px;
            border-bottom: 2px solid #2c3e50;
            padding-bottom: 15px;
          }
          .clinic-name {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
          }
          .clinic-location {
            font-size: 14px;
            color: #7f8c8d;
            margin-bottom: 8px;
            font-weight: 600;
          }
          .document-title {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
          }
          .document-number {
            font-size: 14px;
            color: #7f8c8d;
            margin-bottom: 8px;
          }
          .patient-info {
            font-size: 12px;
            color: #7f8c8d;
          }
          .section {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 12px;
            border-bottom: 1px solid #bdc3c7;
            padding-bottom: 5px;
          }
          .data-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .data-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            padding: 3px 0;
          }
          .data-label {
            font-weight: bold;
            color: #34495e;
            font-size: 13px;
          }
          .data-value {
            color: #2c3e50;
            font-size: 13px;
          }
          .clinical-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .clinical-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #ecf0f1;
          }
          .medical-history {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 10px;
            border-left: 4px solid #3498db;
          }
          .disclaimer {
            font-size: 11px;
            color: #95a5a6;
            font-style: italic;
            text-align: center;
          }
          .footer {
            margin-top: 25px;
            padding-top: 15px;
            border-top: 1px solid #bdc3c7;
            text-align: center;
            font-size: 11px;
            color: #7f8c8d;
          }
          @media print {
            body { 
              margin: 0; 
              padding: 20px;
            }
            .section { 
              page-break-inside: avoid; 
            }
          }
        </style>
      </head>
      <body>
        <!-- Encabezado -->
        <div class="header">
          <div class="clinic-name">Gati Vet</div>
          <div class="clinic-location">ALAJUELA, COSTA RICA</div>
          <div class="document-title">HISTORIAL CLÍNICO</div>
          <div class="document-number">N°: ${datos.numeroHistoria}</div>
          <div class="patient-info">
            Nombre: ${datos.nombrePaciente} • Fecha: ${datos.fechaGeneracion} ${datos.horaGeneracion}
          </div>
        </div>

        <!-- Datos del Cliente -->
        <div class="section">
          <div class="section-title">DATOS DEL CLIENTE</div>
          <div class="data-grid">
            <div class="data-row">
              <span class="data-label">Nombre:</span>
              <span class="data-value">${datos.cliente}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Dirección:</span>
              <span class="data-value">${datos.direccion}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Teléfono:</span>
              <span class="data-value">${datos.telefono}</span>
            </div>
          </div>
        </div>

        <!-- Datos del Paciente -->
        <div class="section">
          <div class="section-title">DATOS DEL PACIENTE</div>
          <div class="data-grid">
            <div class="data-row">
              <span class="data-label">Especie:</span>
              <span class="data-value">${datos.especie}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Raza:</span>
              <span class="data-value">${datos.raza}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Sexo:</span>
              <span class="data-value">${datos.sexo}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Edad:</span>
              <span class="data-value">${datos.edad}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Fecha Nacimiento:</span>
              <span class="data-value">${datos.fechaNacimiento}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Peso:</span>
              <span class="data-value">${datos.peso}</span>
            </div>
          </div>
        </div>

        <!-- Aspectos Clínicos Relevantes -->
        <div class="section">
          <div class="section-title">ASPECTOS CLÍNICOS RELEVANTES</div>
          <div class="clinical-grid">
            <div class="clinical-row">
              <span class="data-label">Fecha de nacimiento</span>
              <span class="data-value">${datos.fechaNacimiento}</span>
            </div>
            <div class="clinical-row">
              <span class="data-label">Chip</span>
              <span class="data-value">${datos.chip}</span>
            </div>
            <div class="clinical-row">
              <span class="data-label">¿Está castrado?</span>
              <span class="data-value">${datos.castrado}</span>
            </div>
            <div class="clinical-row">
              <span class="data-label">Origen</span>
              <span class="data-value">${datos.compradoAdoptado}</span>
            </div>
            <div class="clinical-row">
              <span class="data-label">Nivel de agresividad</span>
              <span class="data-value">${datos.agresividad}</span>
            </div>
          </div>
        </div>

        <!-- Historial Médico -->
        <div class="section">
          <div class="section-title">HISTORIAL MÉDICO</div>
          <div class="medical-history">
            ${datos.historialMedico}
          </div>
          <div class="disclaimer">
            (No incluye métodos complementarios)
          </div>
        </div>

        <!-- Pie de página -->
        <div class="footer">
          <div>Página 1 - 1</div>
          <div>Generado el ${datos.fechaGeneracion} a las ${datos.horaGeneracion}</div>
        </div>
      </body>
      </html>
    `;
    };

    const calcularEdad = (fechaNacimiento) => {
        // Tu código existente...
        if (!fechaNacimiento) return 'No especificada';

        const nacimiento = new Date(fechaNacimiento);
        const hoy = new Date();

        let años = hoy.getFullYear() - nacimiento.getFullYear();
        let meses = hoy.getMonth() - nacimiento.getMonth();

        if (meses < 0) {
            años--;
            meses += 12;
        }

        return `${años} Años ${meses} Meses`;
    };

    const handleItemPress = (link) => {
        try {
            const pacienteStr = paciente ? encodeURIComponent(JSON.stringify(paciente)) : '';
            const path = pacienteStr ? `/${link}?paciente=${pacienteStr}` : `/${link}`;
            router.push(path);
            onClose && onClose();
        } catch (err) {
            console.warn('Error navegando desde PatientSidebarMenu:', err);
            onClose && onClose();
        }
    };

    const getPatientImageSource = () => {
        if (!paciente) {
            return require('../assets/images/especies/huella.png');
        }

        if (paciente.foto_ruta) {
            const cleaned = String(paciente.foto_ruta).replace(/\\/g, '/').replace(/^\/+/, '');
            if (/^https?:\/\//i.test(cleaned)) {
                return { uri: cleaned };
            } else if (apiHost) {
                const baseHost = apiHost.replace(/\/+$/, '');
                const cleanPath = cleaned.replace(/^\/+/, '');
                const finalUrl = `${baseHost}/${cleanPath}`;
                return { uri: finalUrl };
            }
        }

        if (paciente.especie) {
            const especieEncontrada = especies.find(esp =>
                esp.nombre.toLowerCase() === paciente.especie.toLowerCase()
            );

            if (especieEncontrada && especieEncontrada.image) {
                return especieEncontrada.image;
            }
        }

        return require('../assets/images/especies/huella.png');
    };

    const hasPatientImage = paciente && (paciente.photoUri || paciente.foto_url || paciente.foto_ruta);
    const firstClient = (paciente && paciente.clientes && paciente.clientes.length > 0) ? paciente.clientes[0] : null;

    return (
        <>
            {isOpen && (
                <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1} />
            )}

            <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
                {/* Header con imagen y nombre centrado */}
                <View style={styles.patientHeader}>
                    <View style={[
                        styles.patientImageContainer,
                        !hasPatientImage && styles.patientImageContainerNoPhoto
                    ]}>
                        <Image
                            source={getPatientImageSource()}
                            style={styles.patientImage}
                            resizeMode="cover"
                        />
                    </View>

                    <Text style={styles.patientName}>{paciente?.nombre || 'Paciente'}</Text>

                    {/* ✅ BOTÓN MEJORADO CON DETECCIÓN INTELIGENTE */}
                    <TouchableOpacity
                        style={[
                            styles.pdfButton
                        ]}
                        onPress={generarPDFReal}
                        disabled={isGeneratingPDF}
                    >
                        <Image
                            source={require('../assets/images/impresora.png')}
                            style={[
                                styles.pdfButtonIcon,
                                isGeneratingPDF && styles.pdfButtonIconDisabled
                            ]}
                            resizeMode="contain"
                        />
                        {isGeneratingPDF && (
                            <Text style={styles.pdfButtonText}>...</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Información del cliente */}
                {firstClient && (
                    <View style={styles.clientSection}>
                        <View style={styles.clientInfoItem}>
                            <Image
                                source={require('../assets/images/identificacion-de-usuario.png')}
                                style={styles.clientInfoIcon}
                                resizeMode="contain"
                            />
                            <Text style={styles.clientInfoText}>{firstClient.nombre}</Text>
                        </View>

                        <View style={styles.clientInfoItem}>
                            <Image
                                source={require('../assets/images/llamada-telefonica.png')}
                                style={styles.clientInfoIcon}
                                resizeMode="contain"
                            />
                            <Text style={styles.clientInfoText}>
                                {firstClient.telefono || 'Teléfono no especificado'}
                            </Text>
                        </View>

                        {firstClient.direccion && (
                            <View style={styles.clientInfoItem}>
                                <Image
                                    source={require('../assets/images/ubicacion.png')}
                                    style={styles.clientInfoIcon}
                                    resizeMode="contain"
                                />
                                <Text style={styles.clientInfoText}>{firstClient.direccion}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Menú de opciones */}
                <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                    {menuItems.map((item, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[
                                styles.menuItem,
                                selectedItem === item.link && styles.menuItemSelected
                            ]}
                            onPress={() => handleItemPress(item.link)}
                        >
                            <Image
                                source={typeof item.icon === 'string' ? { uri: item.icon } : item.icon}
                                style={styles.itemIcon}
                                resizeMode="contain"
                            />
                            <Text style={styles.itemText}>
                                {item.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </Animated.View>
        </>
    );
};

// Agrega estos nuevos estilos
const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 50,
    },
    sidebar: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: MENU_WIDTH,
        height: '100%',
        backgroundColor: Colors.primarySuave,
        zIndex: 51,
    },
    container: {
        flex: 1,
        paddingHorizontal: Spacing.m,
        paddingTop: Spacing.s,
    },
    patientHeader: {
        alignItems: 'center',
        paddingVertical: Spacing.l,
        paddingHorizontal: Spacing.m,
        backgroundColor: Colors.primary,
        borderBottomWidth: 1,
        borderBottomColor: Colors.primaryDark,
        position: 'relative',
    },
    patientImageContainer: {
        marginBottom: Spacing.s,
    },
    patientImageContainerNoPhoto: {
        backgroundColor: '#fff',
        borderRadius: 40,
        padding: 10,
    },
    patientImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: '#fff',
    },
    patientName: {
        fontSize: Typography.h3,
        color: Colors.textPrimary,
        fontWeight: '700',
        textAlign: 'center',
    },
    pdfButton: {
        position: 'absolute',
        top: Spacing.m,
        right: Spacing.m,
        marginTop: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.boton_azul,
        width: 40,
        height: 40,
        borderRadius: 23,
        borderWidth: 1,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 7,
    },
    pdfButtonWarning: {
        backgroundColor: '#FFA500',
    },
    pdfButtonIcon: {
        width: 22,
        height: 22,
        tintColor: Colors.textPrimary,
    },
    pdfButtonIconDisabled: {
        opacity: 0.5,
    },
    pdfButtonText: {
        fontSize: Typography.small,
        color: Colors.textPrimary,
        marginTop: 2,
        fontWeight: '600',
    },
    warningDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FF0000',
        borderWidth: 1,
        borderColor: '#fff',
    },
    clientSection: {
        backgroundColor: Colors.primaryClaro,
        padding: Spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: Colors.primary,
    },
    clientInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.s,
        paddingVertical: Spacing.xs,
    },
    clientInfoIcon: {
        width: 20,
        height: 20,
        marginRight: Spacing.m,
        tintColor: Colors.primary,
    },
    clientInfoText: {
        fontSize: Typography.small,
        color: Colors.textSecondary,
        fontWeight: '500',
        flex: 1,
    },
    epsonWarning: {
        backgroundColor: '#FFF3CD',
        padding: Spacing.s,
        borderBottomWidth: 1,
        borderBottomColor: '#FFEAA7',
    },
    epsonWarningText: {
        fontSize: Typography.small,
        color: '#856404',
        textAlign: 'center',
        fontWeight: '500',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.m,
        paddingHorizontal: Spacing.s,
        marginVertical: Spacing.xs,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderLeftWidth: 0,
    },
    menuItemSelected: {
        borderLeftWidth: 4,
        borderLeftColor: Colors.boton_verde,
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    itemIcon: {
        width: 26,
        height: 26,
        marginRight: Spacing.m,
        tintColor: Colors.textSecondary,
    },
    itemText: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
        fontWeight: '600',
        flex: 1,
    },
    epsonStatus: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.s,
        borderBottomWidth: 1,
    },
    epsonStatusInstalled: {
        backgroundColor: '#E8F5E8',
        borderBottomColor: '#4CAF50',
    },
    epsonStatusLikely: {
        backgroundColor: '#FFF3CD',
        borderBottomColor: '#FFA500',
    },
    epsonStatusNotInstalled: {
        backgroundColor: '#FFEBEE',
        borderBottomColor: '#F44336',
    },
    epsonStatusText: {
        fontSize: Typography.small,
        fontWeight: '500',
        flex: 1,
    },
    installButtonSmall: {
        backgroundColor: '#2196F3',
        paddingHorizontal: Spacing.s,
        paddingVertical: 4,
        borderRadius: 4,
    },
    installButtonSmallText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default PatientSidebarMenu;