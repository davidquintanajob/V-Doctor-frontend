import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import TopBar from '../components/TopBar';
import { Colors, Spacing, Typography } from '../variables';

const NoDisponibleScreen = () => {
  const router = useRouter();

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <View style={styles.container}>
      {/* TopBar */}
      <TopBar 
        title="Función No Disponible"
        showBackButton={true}
        onBackPress={handleGoBack}
      />

      {/* Contenido */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🚧</Text>
        </View>

        <Text style={styles.title}>Función en Desarrollo</Text>
        
        <Text style={styles.description}>
          Esta funcionalidad se encuentra actualmente en desarrollo y no está disponible por el momento.
        </Text>

        <Text style={styles.subDescription}>
          Nuestro equipo está trabajando para implementar esta característica lo antes posible. 
          Agradecemos tu paciencia y comprensión.
        </Text>

        {/* Botón para volver */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleGoBack}
        >
          <Text style={styles.backButtonText}>Volver Atrás</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.l,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.l,
  },
  icon: {
    fontSize: 80,
    textAlign: 'center',
  },
  title: {
    fontSize: Typography.h2,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.m,
  },
  description: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.m,
  },
  subDescription: {
    fontSize: Typography.small,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  featuresList: {
    backgroundColor: Colors.primaryClaro,
    padding: Spacing.l,
    borderRadius: 12,
    marginBottom: Spacing.xl,
    width: '100%',
  },
  featuresTitle: {
    fontSize: Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.m,
  },
  featureItem: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.s,
    lineHeight: 20,
  },
  backButton: {
    backgroundColor: Colors.boton_verde,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.m,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backButtonText: {
    fontSize: Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});

export default NoDisponibleScreen;