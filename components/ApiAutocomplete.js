// components/ApiAutocomplete.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography } from '../variables';

const ApiAutocomplete = ({
  endpoint,
  body = {},
  displayKey = 'nombre',
  displayFormat,
  onItemSelect,
  placeholder = 'Buscar...',
  delay = 500,
  style,
  inputStyle,
  resultsContainerStyle,
  itemStyle,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState(null);
  
  const timeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Función para buscar en la API
  const searchApi = async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const raw = await AsyncStorage.getItem('@config');
      if (!raw) throw new Error('No hay configuración de API');
      
      const config = JSON.parse(raw);
      const host = config.api_host || config.apihost || config.apiHost;
      const token = config.token;
      
      if (!host) throw new Error('Host API no configurado');

      // Construir la URL completa
      const url = `${host.replace(/\/+$/, '')}${endpoint}`;

      // Combinar el body base con la query de búsqueda
      const requestBody = {
        ...body,
        nombre: searchQuery, // Puedes ajustar esto según lo que espere tu API
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Asumimos que los datos vienen en data.data, pero podríamos hacerlo configurable
      const items = data.data || [];
      setResults(items);
      setShowResults(items.length > 0);
    } catch (err) {
      console.error('Error en ApiAutocomplete:', err);
      setError(err.message);
      setResults([]);
      setShowResults(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Efecto para manejar la búsqueda con delay
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (query) {
      timeoutRef.current = setTimeout(() => {
        searchApi(query);
      }, delay);
    } else {
      setResults([]);
      setShowResults(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, delay]);

  const handleItemSelect = (item) => {
    setSelectedItem(item);
    setQuery(displayFormat ? displayFormat(item) : item[displayKey]);
    setShowResults(false);
    setResults([]);
    
    if (onItemSelect) {
      onItemSelect(item);
    }
    
    Keyboard.dismiss();
  };

  const clearSelection = () => {
    setSelectedItem(null);
    setQuery('');
    setResults([]);
    setShowResults(false);
    
    if (onItemSelect) {
      onItemSelect(null);
    }
  };

  const handleInputFocus = () => {
    if (query && results.length > 0) {
      setShowResults(true);
    }
  };

  const handleInputChange = (text) => {
    setQuery(text);
    if (!text) {
      clearSelection();
    }
  };

  // Función para formatear el display del item
  const getDisplayText = (item) => {
    if (displayFormat) {
      return displayFormat(item);
    }
    return item[displayKey] || 'Sin nombre';
  };

  return (
    <View style={[styles.container, style]}>
      {/* Input con loader y botón de limpiar */}
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={[styles.input, inputStyle]}
          value={query}
          onChangeText={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          placeholderTextColor="#999"
        />
        
        <View style={styles.inputIcons}>
          {isLoading && (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.loader} />
          )}
          
          {selectedItem && (
            <TouchableOpacity onPress={clearSelection} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Lista de resultados */}
      {showResults && (
        <View style={[styles.resultsContainer, resultsContainerStyle]}>
          <ScrollView 
            style={styles.resultsList}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {results.map((item, index) => (
              <TouchableOpacity
                key={item.id_paciente ?? item.id ?? index}
                style={[styles.resultItem, itemStyle]}
                onPress={() => handleItemSelect(item)}
              >
                <Text style={styles.resultText}>
                  {getDisplayText(item)}
                </Text>
                
                {/* Mostrar información adicional si está disponible */}
                {(item.especie || item.raza) && (
                  <Text style={styles.resultSubtext}>
                    {[item.especie, item.raza].filter(Boolean).join(' • ')}
                  </Text>
                )}
                
                {/* Mostrar clientes si existen */}
                {item.clientes && item.clientes.length > 0 && (
                  <Text style={styles.resultClients}>
                    Dueño: {item.clientes[0].nombre}
                    {item.clientes.length > 1 && ` +${item.clientes.length - 1} más`}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Mensaje de error */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Mensaje cuando no hay resultados */}
      {showResults && results.length === 0 && !isLoading && !error && (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsText}>No se encontraron resultados</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    paddingHorizontal: Spacing.m,
    paddingVertical: 12,
    fontSize: Typography.body,
    color: Colors.textSecondary,
    minHeight: 44,
  },
  inputIcons: {
    position: 'absolute',
    right: Spacing.m,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  loader: {
    marginRight: Spacing.xs,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  resultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    maxHeight: 200,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    marginTop: 4,
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    padding: Spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  resultSubtext: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
    opacity: 0.7,
    marginBottom: 2,
  },
  resultClients: {
    fontSize: Typography.small,
    color: Colors.primary,
    fontStyle: 'italic',
  },
  errorContainer: {
    marginTop: Spacing.xs,
    padding: Spacing.s,
    backgroundColor: '#ffebee',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#f44336',
  },
  errorText: {
    fontSize: Typography.small,
    color: '#d32f2f',
  },
  noResultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    padding: Spacing.m,
    marginTop: 4,
  },
  noResultsText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ApiAutocomplete;