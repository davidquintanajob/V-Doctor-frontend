import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { useState } from 'react';
import TopBar from './components/TopBar';

export default function App() {
  const [sound, setSound] = useState(null);

  const playSound = async () => {
    try {
      console.log('Cargando sonido...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { sound: soundObject } = await Audio.Sound.createAsync(
        require('./assets/sounds/beep.mp3')
      );

      setSound(soundObject);
      console.log('Reproduciendo sonido...');
      await soundObject.playAsync();

      soundObject.setOnPlaybackStatusUpdate((playbackStatus) => {
        if (playbackStatus.didJustFinish) {
          soundObject.unloadAsync();
          setSound(null);
        }
      });
    } catch (error) {
      console.error('Error al reproducir el sonido:', error);
      Alert.alert('Error', 'No se pudo reproducir el sonido');
    }
  };

  const stopSound = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
  };

  const handleMenuNavigate = (link) => {
    console.log('Navegando a:', link);
    Alert.alert('Navegación', `Irías a la vista: ${link}`);
  };

  return (
    <View style={styles.container}>
      <TopBar onMenuNavigate={handleMenuNavigate} />
      <View style={styles.content}>
        <Text style={styles.title}>¡V-Doctor App!</Text>
        <Text style={styles.subtitle}>Presiona para reproducir el sonido</Text>

        {sound && (
          <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopSound}>
            <Text style={styles.buttonText}>⏹️ Detener Sonido</Text>
          </TouchableOpacity>
        )}
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 0,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    color: '#666',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 15,
    minWidth: 200,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});