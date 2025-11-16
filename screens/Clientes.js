import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../variables';

export default function Clientes() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clientes</Text>
      <Text style={styles.subtitle}>Aquí verás la lista de clientes.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background || '#fff',
    padding: Spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.h2,
    color: Colors.text || '#000',
    fontWeight: '700',
    marginBottom: Spacing.s,
  },
  subtitle: {
    fontSize: Typography.body,
    color: Colors.textSecondary || '#666',
  },
});
