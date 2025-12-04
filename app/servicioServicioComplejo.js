import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import TopBar from '../components/TopBar';
import ServiciosTab from '../components/ServiciosTab';
import ServicioComplejoTab from '../components/ServicioComplejoTab';
import { Colors, Spacing, Typography } from '../variables';

const { width: screenWidth } = Dimensions.get('window');

export default function ServicioServicioComplejoScreen() {
  const router = useRouter();
  const [showInfo, setShowInfo] = useState(false);
  const [activeTab, setActiveTab] = useState('servicios');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <TopBar onMenuNavigate={() => { }} />

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        {/* Header con back, título e info */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Image source={require('../assets/images/arrow-left.png')} style={styles.icon} resizeMode="contain" />
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Servicios y Servicios Complejos</Text>

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
              Vista de gestión de servicios y servicios complejos. Seleccione "Servicios" o "Servicios Complejos" según quiera tratar con uno o con el otro.
            </Text>
          </View>
        )}

        {/* Tabs: Servicios y Servicios Complejos */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'servicios' && styles.activeTab]}
            onPress={() => setActiveTab('servicios')}
          >
            <Text style={[styles.tabText, activeTab === 'servicios' && styles.activeTabText]}>
              Servicios
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'servicioComplejo' && styles.activeTab]}
            onPress={() => setActiveTab('servicioComplejo')}
          >
            <Text style={[styles.tabText, activeTab === 'servicioComplejo' && styles.activeTabText]}>
              Servicios Complejos
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB: SERVICIOS */}
        {activeTab === 'servicios' && <ServiciosTab />}

        {/* TAB: SERVICIOS COMPLEJOS */}
        {activeTab === 'servicioComplejo' && <ServicioComplejoTab />}
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
});