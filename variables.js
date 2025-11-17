// Archivo: variables.js
// Este archivo exporta variables globales (colores, tamaños, tipografía)
// Úsalo importando: `import { Colors, Spacing, Typography } from './variables';`

export const Colors = {
  // Paleta principal
  primary: '#358001',
  primaryDark: '#4CAF50',
  primarySuave: '#a5d6a7',
  primaryClaro: "#deffdf",
  secondary: '#FFFFFF',

  // Texto
  textSecondary: '#000000ff',
  textPrimary: '#FFFFFF',

  // Estados
  success: '#28C76F',
  warning: '#FF9F43',
  error: '#FF6B6B',

  // Otros
  boton_azul: '#4f7bff',
  boton_azul_opciones: "#6d92ff",
  boton_rojo_opciones: "#fe6e6e"
};

export const Spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  page: 20
};

export const Typography = {
  h1: 32,
  h2: 24,
  h3: 20,
  subtitle: 16,
  body: 14,
  small: 12,

  // pesos comunes — en RN normalmente se usan nombres de fuentes
  weightRegular: '400',
  weightMedium: '500',
  weightBold: '700'
};

// Tema por defecto (útil para pasar a ThemeProvider o Context)
export const DefaultTheme = {
  colors: Colors,
  spacing: Spacing,
  typography: Typography
};

export default DefaultTheme;

