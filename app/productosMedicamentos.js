import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    Image
} from 'react-native';
import { useRouter } from 'expo-router';
import TopBar from '../components/TopBar';
import ProductosTab from '../components/ProductosTab';
import MedicamentosTab from '../components/MedicamentosTab';
import { Colors, Spacing, Typography } from '../variables';

const { width: screenWidth } = Dimensions.get('window');

export default function ProductosScreen() {
    const router = useRouter();
    const [showInfo, setShowInfo] = useState(false);
    const [activeTab, setActiveTab] = useState('productos');

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <TopBar onMenuNavigate={(link) => { }} />

            <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
                {/* Header con back, título e info */}
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Image
                            source={require('../assets/images/arrow-left.png')}
                            style={styles.icon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>

                    <Text style={styles.sectionTitle}>Productos y Medicamentos</Text>

                    <TouchableOpacity
                        onPress={() => setShowInfo(!showInfo)}
                        style={styles.infoButton}
                    >
                        <Image
                            source={require('../assets/images/information.png')}
                            style={styles.infoIcon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                </View>

                {/* Info Box */}
                {showInfo && (
                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>
                            Vista de gestión de productos y medicamentos. Seleccione "Productos" o "Medicamentos" según quiera tratar con uno o con el otro.
                        </Text>
                    </View>
                )}

                {/* Tabs: Productos y Medicamentos */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'productos' && styles.activeTab]}
                        onPress={() => setActiveTab('productos')}
                    >
                        <Text style={[styles.tabText, activeTab === 'productos' && styles.activeTabText]}>
                            Productos
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'medicamentos' && styles.activeTab]}
                        onPress={() => setActiveTab('medicamentos')}
                    >
                        <Text style={[styles.tabText, activeTab === 'medicamentos' && styles.activeTabText]}>
                            Medicamentos
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* TAB: PRODUCTOS */}
                {activeTab === 'productos' && <ProductosTab />}

                {/* TAB: MEDICAMENTOS */}
                {activeTab === 'medicamentos' && <MedicamentosTab />}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        flex: 1,
    },
    scrollContentContainer: {
        paddingBottom: Spacing.l,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.m,
    },
    backButton: {
        position: 'absolute',
        left: 10,
        top: 10,
        padding: 8,
        backgroundColor: Colors.primarySuave,
        borderRadius: 8,
        zIndex: 1,
        marginLeft: 20
    },
    icon: {
        width: 20,
        height: 20,
        tintColor: Colors.textPrimary,
    },
    sectionTitle: {
        fontSize: Typography.header1,
        fontWeight: 'bold',
        color: Colors.text,
        flex: 1,
        textAlign: 'center',
    },
    infoButton: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoIcon: {
        width: 40,
        height: 40,
    },
    infoBox: {
        backgroundColor: Colors.infoBackground,
        borderRadius: 8,
        padding: Spacing.m,
        marginHorizontal: Spacing.m,
        marginBottom: Spacing.m,
        borderLeftWidth: 4,
        borderLeftColor: Colors.infoText,
    },
    infoText: {
        fontSize: Typography.body,
        color: Colors.infoText,
        lineHeight: 20,
    },
    tabsContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        marginBottom: Spacing.m,
    },
    tab: {
        flex: 1,
        paddingVertical: Spacing.m,
        paddingHorizontal: Spacing.s,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: Colors.boton_azul,
    },
    tabText: {
        fontSize: Typography.body,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    activeTabText: {
        color: Colors.boton_azul,
        fontWeight: 'bold',
    },
    tabContent: {
        paddingHorizontal: Spacing.m,
    },
    comingSoonText: {
        textAlign: 'center',
        fontSize: Typography.body,
        color: Colors.textSecondary,
        fontStyle: 'italic',
        padding: Spacing.xl,
    },
});
