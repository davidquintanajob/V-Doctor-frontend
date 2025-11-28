import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Dimensions
} from 'react-native';
import { Colors, Spacing, Typography } from '../variables';

const { width: screenWidth } = Dimensions.get('window');

const DropdownGenerico = ({
  // Props básicos
  data = [],
  value,
  onValueChange,
  placeholder = "Seleccionar...",

  // Props para mostrar y buscar
  displayKey,        // Clave para mostrar en la lista
  searchKey,         // Clave para buscar
  searchable = true, // Si permite búsqueda
  requiresSelection = false, // Si requiere selección obligatoria

  // Props de estilo
  style,
  dropdownStyle,
  itemStyle,
  textStyle,

  // Props para modo texto libre
  enableFreeText = false,
  onFreeTextChange,
  freeTextValue = '',

  // Otros props
  disabled = false,
  maxHeight = 400,
  noResultsText = "No se encontraron resultados"
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredData, setFilteredData] = useState(data);
  const inputRef = useRef(null);

  // Filtrar datos basado en búsqueda
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredData(data);
    } else {
      const filtered = data.filter(item => {
        const searchField = searchKey ? item[searchKey] : item;
        const searchString = typeof searchField === 'string' ?
          searchField.toLowerCase() : String(searchField).toLowerCase();
        return searchString.includes(searchText.toLowerCase());
      });
      setFilteredData(filtered);
    }
  }, [searchText, data, searchKey]);

  // Manejar selección de item
  const handleSelectItem = (item) => {
    if (onValueChange) {
      onValueChange(item);
    }
    if (enableFreeText && onFreeTextChange) {
      // En modo texto libre, actualizar el texto con el item seleccionado
      const displayValue = displayKey ? item[displayKey] : item;
      onFreeTextChange(typeof displayValue === 'string' ? displayValue : String(displayValue));
    }
    setIsVisible(false);
    setSearchText('');
  };

  // Manejar cambio de texto libre
  const handleFreeTextChange = (text) => {
    setSearchText(text);
    if (onFreeTextChange) {
      onFreeTextChange(text);
    }
    if (!isVisible && text.length > 0) {
      setIsVisible(true);
    }
  };

  // Obtener texto a mostrar
  const getDisplayValue = () => {
    if (enableFreeText && freeTextValue) {
      return freeTextValue;
    }

    if (!value) return placeholder;

    if (displayKey && typeof value === 'object') {
      return value[displayKey] || placeholder;
    }

    return value || placeholder;
  };

  // Renderizar item de la lista
  const renderItem = ({ item }) => {
    const displayText = displayKey ? item[displayKey] : item;
    const displayString = typeof displayText === 'string' ? displayText : String(displayText);

    return (
      <TouchableOpacity
        style={[styles.item, itemStyle]}
        onPress={() => handleSelectItem(item)}
      >
        <Text style={[styles.itemText, textStyle]}>{displayString}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* Input/Trigger del dropdown */}
      <TouchableOpacity
        style={[
          styles.trigger,
          disabled && styles.disabled,
          isVisible && styles.triggerFocused
        ]}
        onPress={() => !disabled && setIsVisible(!isVisible)}
        disabled={disabled}
      >
        {enableFreeText ? (
          <TextInput
            ref={inputRef}
            style={[styles.input, textStyle]}
            value={freeTextValue}
            onChangeText={handleFreeTextChange}
            placeholder={placeholder}
            onFocus={() => setIsVisible(true)}
            editable={!disabled}
            placeholderTextColor="#999"
          />
        ) : (
          <Text style={[styles.displayText, textStyle, !value && styles.placeholder]}>
            {getDisplayValue()}
          </Text>
        )}

        {/* Icono de flecha */}
        <View style={styles.arrow}>
          <Text style={styles.arrowText}>{isVisible ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {/* Modal del dropdown */}
      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsVisible(false)}
        >
          <View style={[styles.dropdown, dropdownStyle, { maxHeight }]}>
            {/* Campo de búsqueda */}
            {searchable && (
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar..."
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholderTextColor="#999"
                  autoFocus={!enableFreeText}
                />
              </View>
            )}

            {/* Lista de resultados */}
            <FlatList
              data={filteredData}
              renderItem={renderItem}
              keyExtractor={(item, index) =>
                (typeof item === 'object' ? item.id || index : String(item)) + index
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{noResultsText}</Text>
                </View>
              }
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    borderRadius: 8,
    paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.s,
    minHeight: 42,
  },
  triggerFocused: {
    borderColor: Colors.primary,
  },
  disabled: {
    backgroundColor: '#eee',
    color: '#888',
    opacity: 0.6,
  },
  input: {
    flex: 1,
    fontSize: Typography.body,
    color: Colors.textSecondary,
    padding: 0,
    margin: 0,
  },
  displayText: {
    flex: 1,
    fontSize: Typography.body,
    color: Colors.textSecondary,
  },
  placeholder: {
    color: '#999',
  },
  arrow: {
    marginLeft: Spacing.s,
  },
  arrowText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.m,
  },
  dropdown: {
    width: screenWidth - Spacing.m * 2,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchContainer: {
    padding: Spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: Colors.textSecondary,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.s,
    fontSize: Typography.body,
    color: Colors.textSecondary,
  },
  item: {
    paddingVertical: Spacing.m,
    paddingHorizontal: Spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    padding: Spacing.m,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default DropdownGenerico;