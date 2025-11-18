import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import TopBar from '../components/TopBar';

export default function PacientesScreen() {
  const router = useRouter();

  const handleMenuNavigate = (link) => {
      console.log('Navegando a:', link);
      Alert.alert('Navegación', `Irías a la vista: ${link}`);
    };

  return (
    <View style={styles.container}>
      <TopBar onMenuNavigate={handleMenuNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});