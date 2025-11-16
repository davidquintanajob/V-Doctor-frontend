import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { useState } from 'react';

export default function App() {
  const [sound, setSound] = useState(null);

  const playSound = async () => {
    try {
      console.log('Cargando sonido...');
      
      // Configurar el modo de audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Cargar el sonido desde tu archivo local
      const { sound: soundObject } = await Audio.Sound.createAsync(
        require('./assets/sounds/beep.mp3')
      );

      setSound(soundObject);
      
      console.log('Reproduciendo sonido...');
      await soundObject.playAsync();
      
      // Limpiar el sonido cuando termine de reproducirse
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

  // Función para detener el sonido si es necesario
  const stopSound = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>¡V-Doctor App!</Text>
      <Text style={styles.subtitle}>Presiona para reproducir el sonido</Text>
      
      {/* Botón para reproducir sonido */}
      <TouchableOpacity 
        style={styles.button}
        onPress={playSound}
      >
        <Text style={styles.buttonText}>🔊 Reproducir Beep</Text>
      </TouchableOpacity>

      {/* Botón opcional para detener el sonido */}
      {sound && (
        <TouchableOpacity 
          style={[styles.button, styles.stopButton]}
          onPress={stopSound}
        >
          <Text style={styles.buttonText}>⏹️ Detener Sonido</Text>
        </TouchableOpacity>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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