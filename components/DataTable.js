import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Colors, Spacing, Typography } from '../variables';

const { width: screenWidth } = Dimensions.get('window');

const DataTable = ({
  columns,
  items,
  actions = [],
  totalItems,
  itemsPerPage = 10,
  currentPage,
  isLoading = false,
  onPageChange,
  onRowClick,
}) => {
  // Cálculos de paginación
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  // Función para obtener valores anidados
  const getNestedValue = (obj, path) => {
    if (!obj || !path) return '';
    return path.split('.').reduce((acc, part) => acc && acc[part], obj) ?? '';
  };

  // Función para renderizar el contenido de la celda
  const renderCellContent = (item, column) => {
    const value = getNestedValue(item, column.key);
    
    if (column.cellRenderer) {
      return column.cellRenderer(value, item);
    }
    
    if (column.format) {
      return column.format(value);
    }
    
    return value?.toString() || '';
  };

  // Navegación de páginas
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Icono de nota
  const NoteIcon = () => (
    <View style={styles.noteIcon}>
      <Text style={styles.noteIconText}>📝</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Tabla */}
      <View style={styles.tableContainer}>
        {/* Scroll horizontal para permitir columnas anchas */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.horizontalScrollContent}
        >
          <View>
            {/* Encabezado */}
            <View style={styles.header}>
              {columns.map((column, index) => (
                  <View 
                    key={column.key} 
                    style={[
                      styles.headerCell,
                      column.width ? { width: column.width } : { flex: column.flex || 1 },
                      index === 0 && styles.firstHeaderCell,
                      index === columns.length - 1 && styles.lastHeaderCell
                    ]}
                  >
                    <Text style={styles.headerText}>{column.label}</Text>
                  </View>
                ))}
              {actions.length > 0 && (
                <View style={[styles.headerCell, styles.actionsHeaderCell]}>
                  <Text style={styles.headerText}>Acciones</Text>
                </View>
              )}
            </View>

            {/* Cuerpo de la tabla (scroll vertical) */}
            <ScrollView style={styles.tableBody}>
          {/* Estado de carga */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Cargando datos...</Text>
            </View>
          )}

          {/* Datos (server-side): mostrar los items tal cual vienen del servidor */}
          {!isLoading && (items || []).map((item, rowIndex) => (
            <TouchableOpacity
              key={item.id ?? rowIndex}
              style={styles.row}
              onPress={() => onRowClick && onRowClick(item)}
              activeOpacity={0.7}
            >
              {columns.map((column, colIndex) => (
                <View 
                  key={column.key}
                  style={[
                    styles.cell,
                    column.width ? { width: column.width } : { flex: column.flex || 1 },
                    colIndex === 0 && styles.firstCell,
                    colIndex === columns.length - 1 && styles.lastCell
                  ]}
                >
                  {/* Contenedor para primera columna con posible icono de nota */}
                  {colIndex === 0 ? (
                    <View style={styles.firstCellContainer}>
                      {/* Barra de color al inicio de la fila si item.color */}
                      <View style={[styles.rowColorBar, { backgroundColor: item?.color || 'transparent' }]} />
                      <View style={styles.cellContent}>
                        <Text style={styles.cellText}>{renderCellContent(item, column)}</Text>
                      </View>
                      {getNestedValue(item, 'nota') && <NoteIcon />}
                    </View>
                  ) : (
                    <View style={styles.cellContent}>
                      {renderCellContent(item, column)}
                    </View>
                  )}
                </View>
              ))}
              
              {/* Columna de acciones */}
              {actions.length > 0 && (
                <View style={[styles.cell, styles.actionsCell]}>
                  <View style={styles.actionsContainer}>
                    {actions
                      .filter(action => !action.visible || action.visible(item))
                      .map((action, actionIndex) => (
                        <TouchableOpacity
                          key={actionIndex}
                          style={[
                            styles.actionButton,
                            action.buttonStyle
                          ]}
                          onPress={() => action.handler(item)}
                        >
                          {action.icon && (
                            <View style={styles.actionIcon}>
                              {action.icon}
                            </View>
                          )}
                          {!action.iconOnly && (
                            <Text style={[
                              styles.actionText,
                              action.textStyle
                            ]}>
                              {action.name}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))}

          {/* Mensaje cuando no hay datos */}
          {!isLoading && items.length === 0 && (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No hay datos disponibles</Text>
            </View>
          )}
        </ScrollView>
          </View>
        </ScrollView>
      </View>

      {/* Paginación */}
      <View style={styles.pagination}>
        <Text style={styles.paginationInfo}>
          {startIndex} - {endIndex} de {totalItems}
        </Text>
        
        <View style={styles.paginationControls}>
          <TouchableOpacity
            style={[
              styles.paginationButton,
              currentPage === 1 && styles.paginationButtonDisabled
            ]}
            onPress={handlePreviousPage}
            disabled={currentPage === 1}
          >
            <Text style={[
              styles.paginationButtonText,
              currentPage === 1 && styles.paginationButtonTextDisabled
            ]}>
              Anterior
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.paginationPageInfo}>
            Página {currentPage} de {totalPages}
          </Text>
          
          <TouchableOpacity
            style={[
              styles.paginationButton,
              currentPage >= totalPages && styles.paginationButtonDisabled
            ]}
            onPress={handleNextPage}
            disabled={currentPage >= totalPages}
          >
            <Text style={[
              styles.paginationButtonText,
              currentPage >= totalPages && styles.paginationButtonTextDisabled
            ]}>
              Siguiente
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginBottom: Spacing.m,
  },
  header: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
  },
  headerCell: {
    paddingVertical: Spacing.m,
    paddingHorizontal: Spacing.s,
    justifyContent: 'center',
  },
  firstHeaderCell: {
    borderTopLeftRadius: 8,
  },
  lastHeaderCell: {
    borderTopRightRadius: 8,
  },
  actionsHeaderCell: {
    flex: 0.8,
    minWidth: 100,
  },
  headerText: {
    fontSize: Typography.small,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  tableBody: {
    maxHeight: 520,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: Spacing.m,
    fontSize: Typography.body,
    color: Colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 48,
  },
  rowColorBar: {
    width: 8,
    height: '100%',
    borderRadius: 4,
    marginRight: Spacing.s,
  },
  rowHover: {
    backgroundColor: '#f8f9fa',
  },
  cell: {
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.s,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
  },
  firstCell: {
    borderLeftWidth: 0,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  actionsCell: {
    flex: 0.8,
    minWidth: 100,
    borderRightWidth: 0,
  },
  firstCellContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  cellContent: {
    flex: 1,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  noteIcon: {
    backgroundColor: Colors.boton_azul,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  noteIconText: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginHorizontal: 2,
  },
  actionIcon: {
    marginRight: 6,
    width: 16,
    height: 16,
  },
  actionText: {
    fontSize: Typography.small,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  noDataContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.s,
  },
  paginationInfo: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.s,
  },
  paginationButton: {
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.m,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  paginationButtonDisabled: {
    backgroundColor: Colors.primarySuave,
    borderColor: Colors.primarySuave,
  },
  paginationButtonText: {
    fontSize: Typography.small,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  paginationButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  paginationPageInfo: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  horizontalScrollContent: {
    flexGrow: 1,
  },
});

export default DataTable;