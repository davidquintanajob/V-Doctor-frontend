import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Image,
  Platform,
  findNodeHandle,
  UIManager,
  ToastAndroid,
  Alert,
  Modal
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import ApiAutocomplete from '../components/ApiAutocomplete';
import TopBar from '../components/TopBar';
import UsuariosLista from '../components/UsuariosLista';
import QRScannerModal from '../components/QRScannerModal';
import { Colors, Spacing, Typography } from '../variables';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function VentaModalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const mode = params.mode || 'ver'; // 'ver' | 'crear' | 'editar'
  const ventaParam = params.venta ? JSON.parse(params.venta) : null;

  const [ventaData, setVentaData] = useState(() => ({
    id: ventaParam?.id_venta || ventaParam?.id || null,
    fecha: ventaParam?.fecha || new Date().toISOString().split('T')[0],
    cantidad: ventaParam?.cantidad ? String(ventaParam.cantidad) : '1',
    precio_cobrado_cup: ventaParam?.precio_cobrado_cup ? String(ventaParam.precio_cobrado_cup) : '',
    precio_original_comerciable_cup: ventaParam?.precio_original_comerciable_cup ? String(ventaParam.precio_original_comerciable_cup) : '',
    precio_original_comerciable_usd: ventaParam?.precio_original_comerciable_usd ? String(ventaParam.precio_original_comerciable_usd) : '',
    forma_pago: ventaParam?.forma_pago || 'Efectivo',
    tipo_comerciable: ventaParam?.tipo_comerciable || '',
    comerciable_display: (ventaParam?.comerciable?.producto?.nombre) || (ventaParam?.comerciable?.servicio?.descripcion) || '',
    comerciable_id: ventaParam?.comerciable?.id_comerciable || ventaParam?.comerciable?.id || null,
    nombre_cliente: ventaParam?.nombre_cliente || '',
    nombre_usuario: ventaParam?.nombre_usuario || '',
    nota: ventaParam?.nota || ''
    ,exedente_redondeo: ventaParam?.exedente_redondeo != null ? String(ventaParam.exedente_redondeo) : '0'
  }));

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const isEditable = mode !== 'ver';
  const [comerciableBusqueda, setComercialeBusqueda] = useState('');
  const [selectedComerciable, setSelectedComerciable] = useState(null);
  const [clienteBusqueda, setClienteBusqueda] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [usuariosPreseleccionados, setUsuariosPreseleccionados] = useState([]);
  // Configuración de redondeo leída desde AsyncStorage @redondeoConfig
  const [redondeoValue, setRedondeoValue] = useState(null);
  const [isRedondeoFromPlus, setIsRedondeoFromPlus] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const usuariosListRef = useRef(null);
  const scrollRef = useRef(null);
  const comerciableFieldRef = useRef(null);
  const usuariosFieldRef = useRef(null);
  const cantidadFieldRef = useRef(null);
  const precioFieldRef = useRef(null);
  // Modal para ajustar totales
  const [totalsModalVisible, setTotalsModalVisible] = useState(false);
  const [localDelta, setLocalDelta] = useState('0.00');
  const originalTotalsRef = useRef({ totalCobrar: 0 });

  const formaPagoOptions = [
    { id: 1, nombre: 'Efectivo' },
    { id: 2, nombre: 'Transferencia' }
  ];

  const tipoComerciableOptions = [
    { id: 1, nombre: 'producto' },
    { id: 2, nombre: 'medicamento' },
    { id: 3, nombre: 'servicio' },
    { id: 4, nombre: 'servicio complejo' }
  ];

  useEffect(() => {
    // keep local state in sync if params change
    if (ventaParam) {
      // calcular precio cobrado inicial aplicando descuento si viene en ventaParam
      const descuentoVal = Number(ventaParam?.descuento) || 0;
      let precioCobradoInit = null;
      if (ventaParam?.precio_cobrado_cup != null) precioCobradoInit = Number(ventaParam.precio_cobrado_cup);
      else if (ventaParam?.precio_original_comerciable_cup != null) precioCobradoInit = Number(ventaParam.precio_original_comerciable_cup);
      else if (ventaParam?.comerciable?.precio_cup != null) precioCobradoInit = Number(ventaParam.comerciable.precio_cup);
      else if (ventaParam?.comerciable?.producto?.costo_cup != null) precioCobradoInit = Number(ventaParam.comerciable.producto.costo_cup);
      if (descuentoVal > 0 && precioCobradoInit != null) precioCobradoInit = formatearNumero(precioCobradoInit * (1 - descuentoVal / 100));

      setVentaData(prev => ({
        ...prev,
        ...{
          id: ventaParam?.id_venta || ventaParam?.id || prev.id,
          fecha: ventaParam?.fecha || prev.fecha,
          cantidad: ventaParam?.cantidad ? String(ventaParam.cantidad) : prev.cantidad,
          precio_cobrado_cup: precioCobradoInit != null ? String(precioCobradoInit) : (ventaParam?.precio_cobrado_cup ? String(ventaParam.precio_cobrado_cup) : prev.precio_cobrado_cup),
          precio_original_comerciable_cup: ventaParam?.precio_original_comerciable_cup ? String(ventaParam?.precio_original_comerciable_cup) : prev.precio_original_comerciable_cup,
          precio_original_comerciable_usd: ventaParam?.precio_original_comerciable_usd ? String(ventaParam?.precio_original_comerciable_usd) : prev.precio_original_comerciable_usd,
          forma_pago: ventaParam?.forma_pago || prev.forma_pago,
          tipo_comerciable: ventaParam?.tipo_comerciable || prev.tipo_comerciable,
          comerciable_display: (ventaParam?.comerciable?.producto?.nombre) || (ventaParam?.comerciable?.servicio?.descripcion) || prev.comerciable_display,
          comerciable_id: ventaParam?.comerciable?.id_comerciable || ventaParam?.comerciable?.id || prev.comerciable_id,
          nombre_cliente: ventaParam?.nombre_cliente || prev.nombre_cliente,
          nombre_usuario: ventaParam?.nombre_usuario || prev.nombre_usuario,
          nota: ventaParam?.nota || prev.nota,
          exedente_redondeo: ventaParam?.exedente_redondeo != null ? String(ventaParam.exedente_redondeo) : prev.exedente_redondeo
        }
      }));
      // Inicializar selectedComerciable para que ApiAutocomplete muestre el valor en modo ver/editar
      try {
        if (ventaParam.comerciable) {
          setSelectedComerciable(ventaParam.comerciable);
          try {
            let tipoInit = 'servicio complejo';
            const it = ventaParam.comerciable;
            if (it.producto && it.medicamento) tipoInit = 'medicamento';
            else if (it.producto) tipoInit = 'producto';
            else if (it.servicio) tipoInit = 'servicio';
            handleChange('tipo_comerciable', tipoInit);
          } catch (e) {
            handleChange('tipo_comerciable', ventaParam?.tipo_comerciable || '');
          }
        } else if (ventaParam.comerciable_display || ventaParam.comerciable_id) {
          setSelectedComerciable({ nombre: ventaParam.comerciable_display || '', id_comerciable: ventaParam.comerciable_id || null });
          handleChange('tipo_comerciable', ventaParam?.tipo_comerciable || '');
        }
        // Inicializar cliente si viene en params
        try {
          if (ventaParam.cliente) {
            setSelectedCliente(ventaParam.cliente);
            handleChange('id_cliente', ventaParam.cliente.id_cliente ?? ventaParam.cliente.id ?? null);
            handleChange('nombre_cliente', ventaParam.cliente.nombre || ventaParam.cliente.nombre_cliente || ventaParam.nombre_cliente || '');
          } else if (ventaParam.id_cliente || ventaParam.nombre_cliente) {
            setSelectedCliente({ id_cliente: ventaParam.id_cliente, nombre: ventaParam.nombre_cliente });
            handleChange('id_cliente', ventaParam.id_cliente ?? null);
            handleChange('nombre_cliente', ventaParam.nombre_cliente ?? '');
          }
        } catch (e) {
          // no-op
        }
      } catch (e) {
        // no-op
      }
    }
  }, [params.venta]);

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const rawCfg = await AsyncStorage.getItem('@config');
        const cfg = rawCfg ? JSON.parse(rawCfg) : null;
        // Determinar si el usuario actual es administrador leyendo @config.userConfig.rol === 'Administrador'
        try {
          let userCfgRaw = null;
          try { userCfgRaw = await AsyncStorage.getItem('@config.userConfig'); } catch (e) { userCfgRaw = null; }
          let userObj = null;
          if (userCfgRaw) {
            try { userObj = JSON.parse(userCfgRaw); } catch (e) { userObj = null; }
          }
          if (!userObj) {
            userObj = cfg?.userConfig || cfg?.usuario || cfg?.user || cfg;
          }
          const rolVal = (userObj && (userObj.rol || userObj.role || '')) ? String(userObj.rol || userObj.role || '') : '';
          const isAdmin = /administrador/i.test(rolVal) || !!(userObj && (userObj.isAdmin === true || userObj.is_admin === true || userObj.es_admin === true || userObj.admin === true));
          setIsAdminUser(isAdmin);
        } catch (e) {
          setIsAdminUser(false);
        }
        const host = cfg?.api_host || cfg?.apihost || cfg?.apiHost;
        const token = cfg?.token;

        // Leer configuración de redondeo desde AsyncStorage y guardarla en el estado
        try {
          const rawRed = await AsyncStorage.getItem('@redondeoConfig');
          if (rawRed) {
            const redCfg = JSON.parse(rawRed);
            setRedondeoValue(redCfg?.value ?? null);
            setIsRedondeoFromPlus(!!redCfg?.isRedondeoFromPlus);
          } else {
            setRedondeoValue(null);
            setIsRedondeoFromPlus(false);
          }
        } catch (e) {
          console.error('Error leyendo @redondeoConfig:', e);
          setRedondeoValue(null);
          setIsRedondeoFromPlus(false);
        }

        if (!host) return;
        setUsuariosLoading(true);
        const url = `${host.replace(/\/+$/, '')}/usuario`;
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(url, { headers });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch (e) { json = null; }
        if (!res.ok || !json) {
          setUsuariosDisponibles([]);
          setUsuariosPreseleccionados([]);
          return;
        }

        setUsuariosDisponibles(json);

        const initialPreselected = [];

        // Revisar config de usuario para preseleccionar si aplica
        // Nota: solo preseleccionamos el usuario de config cuando el modal está en modo 'crear'.
        if (mode === 'crear') {
          try {
            let rawUserCfg = await AsyncStorage.getItem('@config.userConfig');
            if (!rawUserCfg) rawUserCfg = await AsyncStorage.getItem('@config');
            if (rawUserCfg) {
              const userCfg = JSON.parse(rawUserCfg);
              const currentId = userCfg?.usuario?.id_usuario || userCfg?.usuario?.idUsuario || null;
              if (currentId) {
                const found = json.find(u => u.id_usuario === currentId || u.id === currentId);
                if (found) initialPreselected.push(found);
              }
            }
          } catch (err) {
            console.error('Error reading config from AsyncStorage', err);
          }
        }

        // Si la venta trae usuarios, agregarlos a la preselección (sin duplicados)
        try {
          if (ventaParam?.usuarios) {
            const ventaUsuarios = ventaParam.usuarios;
            if (Array.isArray(ventaUsuarios)) {
              for (const u of ventaUsuarios) {
                const key = u?.id_usuario ?? u?.id;
                if (key == null) continue;
                const foundInAll = json.find(au => au.id_usuario === key || au.id === key);
                initialPreselected.push(foundInAll || u);
              }
            } else if (typeof ventaUsuarios === 'object') {
              const u = ventaUsuarios;
              const key = u?.id_usuario ?? u?.id;
              if (key != null) {
                const foundInAll = json.find(au => au.id_usuario === key || au.id === key);
                initialPreselected.push(foundInAll || u);
              }
            }
          } else if (ventaParam?.nombre_usuario) {
            // Fallback: intentar preseleccionar por nombre/id si no hay estructura usuarios
            const found = json.find(u => (u.nombre_natural || u.nombre) === ventaParam.nombre_usuario || u.id_usuario === ventaParam?.id_usuario || u.id === ventaParam?.id);
            if (found) initialPreselected.push(found);
          }
        } catch (err) {
          console.error('Error extracting usuarios from ventaParam.usuarios', err);
        }

        // Eliminar duplicados por id_usuario / id y asignar al estado si hay alguno
        if (initialPreselected.length > 0) {
          const map = new Map();
          initialPreselected.forEach(u => {
            const key = u?.id_usuario ?? u?.id;
            if (key != null && !map.has(String(key))) map.set(String(key), u);
          });
          const merged = Array.from(map.values());
          if (merged.length > 0) setUsuariosPreseleccionados(merged);
        }
        // Inicializar originalTotalsRef con el precio actual de la venta (si aplica)
        try {
          const base = Number(ventaData.precio_cobrado_cup) || 0;
          originalTotalsRef.current = { totalCobrar: base };
        } catch (e) {
          originalTotalsRef.current = { totalCobrar: 0 };
        }
      } catch (err) {
        console.error('Error fetching usuarios:', err);
        setUsuariosDisponibles([]);
        setUsuariosPreseleccionados([]);
      } finally {
        setUsuariosLoading(false);
      }
    };

    fetchUsuarios();
  }, []);

  // Cuando se abre el modal, inicializar localDelta y originalTotalsRef
  useEffect(() => {
    if (!totalsModalVisible) return;
    try {
      const base = Number(ventaData.precio_cobrado_cup) || 0;
      originalTotalsRef.current = { totalCobrar: base };
    } catch (e) {
      originalTotalsRef.current = { totalCobrar: 0 };
    }
    setLocalDelta('0.00');
  }, [totalsModalVisible]);

  const onSave = () => {
    const delta = parseFloat((localDelta || '').toString().replace(/,/g, '.')) || 0;
    setVentaData(prev => {
      const prevPrice = Number(prev.precio_cobrado_cup) || 0;
      const next = prevPrice + delta;
      return { ...prev, precio_cobrado_cup: String(formatearNumero(next)) };
    });
    setTotalsModalVisible(false);
  };

  const onReset = () => {
    setLocalDelta('0.00');
  };

  const handleChange = (field, value) => setVentaData(prev => ({ ...prev, [field]: value }));


  const computeRemaining = () => {
    const exist = selectedComerciable?.producto?.cantidad ?? selectedComerciable?.cantidad ?? ventaParam?.comerciable?.producto?.cantidad ?? ventaParam?.comerciable?.cantidad ?? 0;
    const qty = parseFloat(ventaData.cantidad || '0') || 0;
    const rem = Number(exist) - qty;
    return isNaN(rem) ? 0 : rem;
  };

  const parseFechaToDate = (fecha) => {
    if (!fecha) return new Date();
    const m = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(fecha);
  };

  const parseError = (status, responseData) => {
    let errorMessage = 'Error desconocido';
    if (responseData && responseData.errors && Array.isArray(responseData.errors)) {
      errorMessage = responseData.errors.join('\n• ');
    } else if (responseData && typeof responseData.error === 'string') {
      errorMessage = responseData.error;
    } else if (responseData && (responseData.message || responseData.description)) {
      errorMessage = responseData.message || responseData.description;
    } else if (responseData) {
      errorMessage = JSON.stringify(responseData);
    }
    return `Error ${status}\n${errorMessage}`;
  };

  function formatearNumero(num) {
    const n = Number(num);
    if (!isFinite(n) || isNaN(n)) return n;
    const redondeado = Math.round(n * 100000) / 100000;
    const str = redondeado.toString();
    if (redondeado % 1 === 0) {
      return redondeado;
    }
    return parseFloat(redondeado.toFixed(5).replace(/\.?0+$/, ''));
  }

  // Aplicar la misma lógica de redondeo usada en historia_clinicaModal
  const computeRoundedValue = (displayValue) => {
    let rounded = Math.round(Number(displayValue) || 0);
    try {
      const rv = (redondeoValue || '').toString();
      if (/normal/i.test(rv)) {
        rounded = Math.round(Number(displayValue) || 0);
      } else {
        const m = rv.match(/\d+/);
        if (m) {
          const inc = parseInt(m[0], 10) || 0;
          const base = Math.round(Number(displayValue) || 0);
          if (inc > 0) {
            if (base % inc === 0) rounded = base;
            else rounded = base + (inc - (base % inc));
          } else {
            rounded = Math.round(Number(displayValue) || 0);
          }
        } else {
          rounded = Math.round(Number(displayValue) || 0);
        }
      }
    } catch (e) {
      rounded = Math.round(Number(displayValue) || 0);
    }
    return rounded;
  };

  const handleSave = async () => {
    // Validaciones previas: comerciable obligatorio y al menos un usuario asignado
    const idComerciableNow = ventaData.comerciable_id ?? ventaParam?.id_comerciable ?? ventaParam?.comerciable?.id_comerciable ?? ventaParam?.comerciable?.id ?? null;
    if (!idComerciableNow || Number(idComerciableNow) === 0) {
      ToastAndroid.show('Debe seleccionar un comerciable válido', ToastAndroid.LONG);
      try {
        const scrollNode = findNodeHandle(scrollRef.current);
        const childNode = findNodeHandle(comerciableFieldRef.current);
        if (childNode && scrollNode && UIManager && UIManager.measureLayout) {
          UIManager.measureLayout(
            childNode,
            scrollNode,
            () => { scrollRef.current?.scrollTo({ y: 0, animated: true }); },
            (left, top) => { scrollRef.current?.scrollTo({ y: Math.max(0, top - 20), animated: true }); }
          );
        } else {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }
      } catch (e) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      return;
    }

    // Validar cantidad y precio: no vacíos, cantidad > 0, precio >= 0
    const cantidadRaw = ventaData.cantidad;
    const precioRaw = ventaData.precio_cobrado_cup;
    if (String(cantidadRaw).trim() === '') {
      ToastAndroid.show('La cantidad no puede estar vacía', ToastAndroid.LONG);
      try {
        const scrollNode = findNodeHandle(scrollRef.current);
        const childNode = findNodeHandle(cantidadFieldRef.current);
        if (childNode && scrollNode && UIManager && UIManager.measureLayout) {
          UIManager.measureLayout(
            childNode,
            scrollNode,
            () => { scrollRef.current?.scrollTo({ y: 0, animated: true }); },
            (left, top) => { scrollRef.current?.scrollTo({ y: Math.max(0, top - 20), animated: true }); }
          );
        } else {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }
      } catch (e) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      return;
    }

    const cantidadNum = Number(cantidadRaw);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      ToastAndroid.show('La cantidad debe ser un número mayor que 0', ToastAndroid.LONG);
      try {
        const scrollNode = findNodeHandle(scrollRef.current);
        const childNode = findNodeHandle(cantidadFieldRef.current);
        if (childNode && scrollNode && UIManager && UIManager.measureLayout) {
          UIManager.measureLayout(
            childNode,
            scrollNode,
            () => { scrollRef.current?.scrollTo({ y: 0, animated: true }); },
            (left, top) => { scrollRef.current?.scrollTo({ y: Math.max(0, top - 20), animated: true }); }
          );
        } else {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }
      } catch (e) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      return;
    }

    if (String(precioRaw).trim() === '') {
      ToastAndroid.show('El precio no puede estar vacío', ToastAndroid.LONG);
      try {
        const scrollNode = findNodeHandle(scrollRef.current);
        const childNode = findNodeHandle(precioFieldRef.current);
        if (childNode && scrollNode && UIManager && UIManager.measureLayout) {
          UIManager.measureLayout(
            childNode,
            scrollNode,
            () => { scrollRef.current?.scrollTo({ y: 0, animated: true }); },
            (left, top) => { scrollRef.current?.scrollTo({ y: Math.max(0, top - 20), animated: true }); }
          );
        } else {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }
      } catch (e) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      return;
    }

    const precioNum = Number(precioRaw);
    if (isNaN(precioNum) || precioNum < 0) {
      ToastAndroid.show('El precio no puede ser negativo', ToastAndroid.LONG);
      try {
        const scrollNode = findNodeHandle(scrollRef.current);
        const childNode = findNodeHandle(precioFieldRef.current);
        if (childNode && scrollNode && UIManager && UIManager.measureLayout) {
          UIManager.measureLayout(
            childNode,
            scrollNode,
            () => { scrollRef.current?.scrollTo({ y: 0, animated: true }); },
            (left, top) => { scrollRef.current?.scrollTo({ y: Math.max(0, top - 20), animated: true }); }
          );
        } else {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }
      } catch (e) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      return;
    }

    const selectedUsuariosNow = (usuariosListRef && usuariosListRef.current && typeof usuariosListRef.current.getItems === 'function')
      ? usuariosListRef.current.getItems()
      : (usuariosPreseleccionados && usuariosPreseleccionados.length ? usuariosPreseleccionados : (ventaParam?.usuarios ? (Array.isArray(ventaParam.usuarios) ? ventaParam.usuarios : [ventaParam.usuarios]) : []));

    if (!selectedUsuariosNow || selectedUsuariosNow.length === 0) {
      ToastAndroid.show('Debe asignar al menos un usuario a la venta', ToastAndroid.LONG);
      try {
        const scrollNode = findNodeHandle(scrollRef.current);
        const childNode = findNodeHandle(usuariosFieldRef.current);
        if (childNode && scrollNode && UIManager && UIManager.measureLayout) {
          UIManager.measureLayout(
            childNode,
            scrollNode,
            () => { scrollRef.current?.scrollTo({ y: 300, animated: true }); },
            (left, top) => { scrollRef.current?.scrollTo({ y: Math.max(0, top - 20), animated: true }); }
          );
        } else {
          scrollRef.current?.scrollTo({ y: 300, animated: true });
        }
      } catch (e) {
        scrollRef.current?.scrollTo({ y: 300, animated: true });
      }
      return;
    }

    try {
      const raw = await AsyncStorage.getItem('@config');
      if (!raw) { Alert.alert('Error', 'No se encontró configuración'); return; }
      const config = JSON.parse(raw);
      const host = config.api_host || config.apihost || config.apiHost;
      const token = config.token;
      if (!host) { Alert.alert('Error', 'No se encontró host en la configuración'); return; }

      // Construir payload con la estructura esperada por la API
      const fechaIso = (() => {
        try {
          // ventaData.fecha puede ser YYYY-MM-DD o ya ISO
          if (!ventaData.fecha) return new Date().toISOString();
          // Si tiene formato YYYY-MM-DD, convertir a ISO conservando medianoche UTC
          if (/^\d{4}-\d{2}-\d{2}$/.test(ventaData.fecha)) {
            return new Date(`${ventaData.fecha}T00:00:00.000Z`).toISOString();
          }
          return new Date(ventaData.fecha).toISOString();
        } catch (e) { return new Date().toISOString(); }
      })();

      const idCliente = ventaParam?.id_cliente ?? ventaData.id_cliente ?? null;
      const idComerciable = ventaData.comerciable_id ?? ventaParam?.id_comerciable ?? ventaParam?.id_comerciable ?? null;

      // Obtener lista de usuarios seleccionados preferentemente desde el ref del componente
      const selectedUsuarios = (usuariosListRef && usuariosListRef.current && typeof usuariosListRef.current.getItems === 'function')
        ? usuariosListRef.current.getItems()
        : usuariosPreseleccionados;

      const usuarioIds = (selectedUsuarios && selectedUsuarios.length)
        ? selectedUsuarios.map(u => u.id_usuario ?? u.id).filter(Boolean)
        : (ventaParam?.usuarios ? (Array.isArray(ventaParam.usuarios) ? ventaParam.usuarios.map(u => u.id_usuario ?? u.id).filter(Boolean) : [(ventaParam.usuarios.id_usuario ?? ventaParam.usuarios.id)]) : []);

      // Calcular total normal y redondeado para incluir exedente_redondeo en el payload
      const _priceForTotals = parseFloat(ventaData.precio_cobrado_cup || '0') || 0;
      const _qtyForTotals = parseFloat(ventaData.cantidad || '0') || 0;
      const _totalNormal = _priceForTotals * _qtyForTotals;
      const _totalRedondeado = computeRoundedValue(_totalNormal);
      const _excedenteRaw = Number(_totalRedondeado) - Number(_totalNormal);
      const _excedente = Math.max(0, isNaN(_excedenteRaw) ? 0 : _excedenteRaw);

      const payload = {
        fecha: fechaIso,
        precio_original_comerciable_cup: ventaData.precio_original_comerciable_cup ? Number(ventaData.precio_original_comerciable_cup) : (ventaParam?.precio_original_comerciable_cup ?? 0),
        precio_original_comerciable_usd: ventaData.precio_original_comerciable_usd ? Number(ventaData.precio_original_comerciable_usd) : (ventaParam?.precio_original_comerciable_usd ?? 0),
        costo_producto_cup: ventaData.costo_producto_cup ? Number(ventaData.costo_producto_cup) : (ventaParam?.costo_producto_cup ?? 0),
        cantidad: Number(ventaData.cantidad) || 0,
        precio_cobrado_cup: ventaData.precio_cobrado_cup ? Number(ventaData.precio_cobrado_cup) : 0,
        exedente_redondeo: Number(formatearNumero(_excedente)) || 0,
        forma_pago: ventaData.forma_pago || 'Efectivo',
        nota: ventaData.nota || '',
        id_comerciable: idComerciable ?? 0,
        id_usuario: usuarioIds
      };

      // Incluir id_cliente solo si viene especificado y no es cadena vacía
      if (idCliente !== null && idCliente !== undefined && String(idCliente).trim() !== '') {
        payload.id_cliente = idCliente;
      }

      let url = '';
      let method = 'POST';
      if (mode === 'crear') {
        url = `${host.replace(/\/+$/, '')}/venta/create`;
        method = 'POST';
      } else if (mode === 'editar') {
        if (!ventaData.id) { Alert.alert('Error', 'ID de venta inválido'); return; }
        url = `${host.replace(/\/+$/, '')}/venta/update/${ventaData.id}`;
        method = 'PUT';
      } else {
        // view mode - nothing to do
        return router.back();
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      let responseData = null;
      try { responseData = await res.json(); } catch (e) { responseData = null; }

      if (res.status === 403) { Alert.alert('Sesión expirada'); router.replace('/login'); return; }

      if (!res.ok) {
        Alert.alert('Error', parseError(res.status, responseData));
        return;
      }

      ToastAndroid.show(mode === 'crear' ? '✅ Venta creada' : '✅ Venta actualizada', ToastAndroid.LONG);
      router.back();
    } catch (error) {
      Alert.alert('Error de conexión', 'No se pudo conectar con el servidor');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      enabled
    >
      <TopBar />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Image
              source={require('../assets/images/arrow-left.png')}
              style={styles.icon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.title}>{mode === 'ver' ? 'Ver Venta' : mode === 'editar' ? 'Editar Venta' : 'Crear Venta'}</Text>
          <View style={{ width: 44 }} />
        </View>



        <View style={styles.section}>
          <View style={styles.field} ref={comerciableFieldRef}>
            <Text style={styles.label}>Comerciable *</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.s }}>
              <View style={{ flex: 1 }}>
                <ApiAutocomplete
                  endpoint="/comerciable/filter/5/1"
                  body={{ nombre: comerciableBusqueda, isProducto: true }}
                  displayFormat={(item) => {
                    const name = item.producto?.nombre || item.servicio?.descripcion || item.nombre || '';
                    const category = item.producto?.categoria || item.categoria || '';
                    return category ? `${name} - ${category}` : name;
                  }}
                  onItemSelect={(item) => {
                    setSelectedComerciable(item);
                    setComercialeBusqueda('');
                    if (!item) {
                      // limpieza cuando se deselecciona
                      handleChange('comerciable_display', '');
                      handleChange('comerciable_id', null);
                      handleChange('tipo_comerciable', '');
                      handleChange('precio_original_comerciable_cup', '');
                      handleChange('precio_original_comerciable_usd', '');
                      handleChange('precio_cobrado_cup', '');
                      return;
                    }
                    const display = item.producto?.nombre || item.servicio?.descripcion || item.nombre || '';
                    handleChange('comerciable_display', display);
                    handleChange('comerciable_id', item.id_comerciable || item.id || null);
                    handleChange('precio_original_comerciable_cup', item.precio_cup != null ? String(item.precio_cup) : (item.producto?.costo_cup ? String(item.producto.costo_cup) : ''));
                    handleChange('precio_original_comerciable_usd', item.precio_usd != null ? String(item.precio_usd) : (item.producto?.costo_usd ? String(item.producto.costo_usd) : ''));
                    // Determinar tipo de comerciable según la estructura del item
                    try {
                      let tipo = '';
                      if (item.producto) {
                        const isMedicamento = Boolean(item.producto.medicamento || item.producto.isMedicamento || item.producto.tipo === 'medicamento');
                        tipo = isMedicamento ? 'medicamento' : 'producto';
                      } else if (item.servicio) {
                        tipo = 'servicio';
                      } else if (item.tipo) {
                        tipo = item.tipo;
                      }
                      handleChange('tipo_comerciable', tipo);
                    } catch (e) {
                      handleChange('tipo_comerciable', '');
                    }
                    // Autocompletar precio cobrado con el precio por defecto del comerciable
                    try {
                      const rawPrice = item.precio_cup != null ? Number(item.precio_cup) : (item.producto?.costo_cup ? Number(item.producto.costo_cup) : null);
                      const descuento = Number(ventaParam?.descuento) || 0;
                      const finalPrice = (rawPrice != null && descuento > 0) ? (rawPrice * (1 - descuento / 100)) : rawPrice;
                      handleChange('precio_cobrado_cup', finalPrice != null ? String(formatearNumero(finalPrice)) : '');
                    } catch (e) {
                      handleChange('precio_cobrado_cup', item.precio_cup != null ? String(item.precio_cup) : (item.producto?.costo_cup ? String(item.producto.costo_cup) : ''));
                    }
                  }}
                  placeholder="Buscar producto o medicamento..."
                  delay={300}
                  initialValue={selectedComerciable}
                />
              </View>
              <TouchableOpacity style={styles.cameraButton} onPress={() => setShowScannerModal(true)}>
                <Image source={require('../assets/images/camera.png')} style={styles.cameraIcon} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.label}>Precio original</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.infoText}>{`CUP: ${ventaData.precio_original_comerciable_cup || '-'}  •  USD: ${ventaData.precio_original_comerciable_usd || '-'}`}</Text>
              <Text style={styles.infoText}>{`Cant despues de la venta: ${computeRemaining()}`}</Text>
            </View>
            <View style={{ marginTop: Spacing.s }}>
              <Text style={styles.infoText}>{`Tipo comerciable: ${ventaData.tipo_comerciable || ventaParam?.tipo_comerciable || '-'}`}</Text>
            </View>
            {isAdminUser && (mode !== "crear") && (
              <View style={{ marginTop: Spacing.s }}>
                <Text style={[styles.infoText, { color: Colors.primary, fontWeight: '700' }]}>{`Excedente redondeo: ${ventaData.exedente_redondeo ? String(formatearNumero(Number(ventaData.exedente_redondeo))) : '0'}`}</Text>
              </View>
            )}
            {(mode === 'ver' || mode === 'editar') && Number(ventaParam?.descuento) > 0 && (
              <View style={{ marginTop: Spacing.s }}>
                {(() => {
                  const d = Number(ventaParam?.descuento) || 0;
                  const origCup = parseFloat(ventaData.precio_original_comerciable_cup || '0') || 0;
                  const origUsd = parseFloat(ventaData.precio_original_comerciable_usd || '0') || 0;
                  const discCup = (origCup * (1 - d / 100));
                  const discUsd = (origUsd * (1 - d / 100));
                  return (
                    <Text style={[styles.infoText, { color: Colors.success, fontWeight: '700' }]}>{`Con descuento (${d}%): CUP: ${isNaN(discCup) ? '-' : formatearNumero(discCup)}  •  USD: ${isNaN(discUsd) ? '-' : formatearNumero(discUsd)}`}</Text>
                  );
                })()}
              </View>
            )}
          </View>

          {(mode === 'ver' || mode === 'editar') && ventaParam?.consultum && (
            <View style={styles.consultContainer}>
              <Text style={styles.consultText}>
                {`Esta venta está ligada a una consulta del paciente ${ventaParam.consultum?.paciente?.nombre || 'N/A'} por el motivo ${ventaParam.consultum?.motivo || 'N/A'}`}
              </Text>
            </View>
          )}

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1, marginRight: Spacing.s }]} ref={cantidadFieldRef}>
              <Text style={styles.label}>Cantidad *</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={ventaData.cantidad} onChangeText={(t) => handleChange('cantidad', t)} editable={isEditable} />
            </View>

            <View style={[styles.field, { flex: 1 }, styles.rowBetween]} ref={precioFieldRef}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.label}>Precio (CUP) *</Text>
                  {(mode === 'ver' || mode === 'editar') && Number(ventaParam?.descuento) > 0 && (
                    <Text style={{ color: Colors.success, fontWeight: '700' }}>{`${ventaParam.descuento}%`}</Text>
                  )}
                </View>
                <TextInput style={styles.input} keyboardType="numeric" value={ventaData.precio_cobrado_cup} onChangeText={(t) => handleChange('precio_cobrado_cup', t)} editable={isEditable} />
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={() => setTotalsModalVisible(true)}>
            <View style={styles.infoBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Total a cobrar: mostrar antes y después del redondeo */}
                <View style={{ flex: 1, alignItems: 'flex-start' }}>
                  <Text style={[styles.summaryValue, { flexWrap: 'nowrap' }]}>
                    Total:
                    {(() => {
                      const price = parseFloat(ventaData.precio_cobrado_cup || '0') || 0;
                      const qty = parseFloat(ventaData.cantidad || '0') || 0;
                      const total = price * qty;
                      const roundedTotal = computeRoundedValue(total);
                      const before = isNaN(total) ? '0.00' : String(formatearNumero(total));
                      return ` $${before} `;
                    })()}
                    <Text style={{
                      fontWeight: '700',
                      fontSize: Typography.body,
                      color: Colors.textSecondary
                    }}>$
                      {(() => {
                        const price = parseFloat(ventaData.precio_cobrado_cup || '0') || 0;
                        const qty = parseFloat(ventaData.cantidad || '0') || 0;
                        const total = price * qty;
                        const roundedTotal = computeRoundedValue(total);
                        return String(formatearNumero(roundedTotal));
                      })()}
                    </Text>
                  </Text>
                </View>

                {/* Plus: mostrar antes y después del redondeo */}
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  {(() => {
                    const price = parseFloat(ventaData.precio_cobrado_cup || '0') || 0;
                    const qty = parseFloat(ventaData.cantidad || '0') || 0;
                    const original = parseFloat(ventaData.precio_original_comerciable_cup || '0') || 0;
                    const plusVal = (price * qty) - (original * qty);
                    const plus = isNaN(plusVal) ? 0 : Math.max(0, plusVal);
                    const roundedPlus = computeRoundedValue(plus);

                    return (
                      <Text style={[{
                        flexWrap: 'nowrap',
                        fontWeight: 'normal'
                      }]}>
                        Plus:{' '}
                        <Text style={{
                          fontWeight: '700',
                          fontSize: Typography.body,
                          color: Colors.textSecondary
                        }}>
                          {String(formatearNumero(plus))}
                        </Text>
                      </Text>
                    );
                  })()}
                </View>
              </View>
            </View>
          </TouchableOpacity>


          <View style={styles.row}>
            <View style={[styles.field, { flex: 1, marginRight: Spacing.s }]}>
              <Text style={styles.label}>Fecha</Text>
              <TouchableOpacity style={styles.input} onPress={() => isEditable && setShowDatePicker(true)}>
                <Text style={styles.inputText}>{ventaData.fecha ? parseFechaToDate(ventaData.fecha).toLocaleDateString() : ''}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={ventaData.fecha ? parseFechaToDate(ventaData.fecha) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => { setShowDatePicker(Platform.OS === 'ios'); if (d) handleChange('fecha', d.toISOString().split('T')[0]); }}
                />
              )}
            </View>

            {/* Tipo comerciable mostrado en el recuadro de información arriba */}
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Cliente</Text>
              <ApiAutocomplete
                endpoint="/cliente/filter/5/1"
                body={{ nombre: clienteBusqueda }}
                displayFormat={(item) => {
                  const name = item.nombre || '';
                  const phone = item.telefono || item.telefono_contacto || '';
                  return phone ? `${name} - ${phone}` : name;
                }}
                onItemSelect={(item) => {
                  setSelectedCliente(item);
                  setClienteBusqueda('');
                  if (!item) {
                    handleChange('id_cliente', null);
                    handleChange('nombre_cliente', '');
                    return;
                  }
                  handleChange('id_cliente', item.id_cliente ?? item.id ?? null);
                  handleChange('nombre_cliente', item.nombre || '');
                }}
                placeholder="Buscar cliente..."
                delay={300}
                initialValue={selectedCliente}
              />
            </View>
          </View>

          <View style={[styles.field, { flex: 1, marginRight: Spacing.s }]}>
            <View style={styles.paymentContainer}>
              <Text style={[styles.label, { marginBottom: 8 }]}>Forma de pago</Text>
              <View style={styles.radioRow}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => isEditable && handleChange('forma_pago', 'Efectivo')}
                  disabled={!isEditable}
                >
                  <View style={styles.radioCircle}>
                    {ventaData.forma_pago === 'Efectivo' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.radioLabel}>Efectivo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => isEditable && handleChange('forma_pago', 'Transferencia')}
                  disabled={!isEditable}
                >
                  <View style={styles.radioCircle}>
                    {ventaData.forma_pago === 'Transferencia' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.radioLabel}>Transferencia</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.field} ref={usuariosFieldRef}>
            <UsuariosLista
              ref={usuariosListRef}
              data={usuariosDisponibles}
              initialSelected={usuariosPreseleccionados}
              isEditable={isEditable}
              onChange={(p) => {
                const items = p?.items || [];
                // No actualizar `usuariosPreseleccionados` desde onChange para evitar loops.
                const first = items.length > 0 ? (items[0].nombre_natural || items[0].nombre || '') : '';
                handleChange('nombre_usuario', first);
              }}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nota</Text>
            <TextInput style={[styles.input, { minHeight: 80 }]} value={ventaData.nota} onChangeText={(t) => handleChange('nota', t)} editable={isEditable} multiline placeholder="Nota opcional" />
          </View>
        </View>

        {isEditable && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>{mode === 'crear' ? 'Crear Venta' : 'Guardar cambios'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <Modal visible={totalsModalVisible} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingBox, { width: 340 }]}>
            <View style={{ width: '100%', alignItems: 'center', marginBottom: Spacing.s, position: 'relative' }}>
              <Text style={[styles.loadingText, { fontWeight: '700', textAlign: 'center' }]}>Adicionar o Restar Valor a Totales</Text>
              <TouchableOpacity
                onPress={() => setTotalsModalVisible(false)}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#c00',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                accessibilityLabel="Cerrar modal"
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ width: '100%', alignItems: 'center', marginVertical: Spacing.s }}>
              <Text style={[styles.label, { textAlign: 'center' }]}>Original</Text>
              <Text style={[styles.summaryValue, { textAlign: 'center' }]}>${Number(originalTotalsRef.current.totalCobrar).toFixed(2)}</Text>
              <Text style={{ marginVertical: 6 }}>→</Text>
              <Text style={[styles.label, { textAlign: 'center' }]}>Preview</Text>
              <Text style={[styles.summaryValue, { textAlign: 'center' }]}>${Number((originalTotalsRef.current.totalCobrar || 0) + (parseFloat((localDelta || '').toString().replace(/,/g, '.')) || 0)).toFixed(2)}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.s }}>
              <View style={{ flexDirection: 'column', gap: Spacing.xs }}>
                <TouchableOpacity
                  style={{ borderWidth: 1, borderColor: '#c00', padding: 8, borderRadius: 6, marginBottom: Spacing.xs }}
                  onPress={() => {
                    const curr = parseFloat((localDelta || '').toString().replace(/,/g, '.')) || 0;
                    const next = curr - 20;
                    setLocalDelta(String(Number(next).toFixed(2)));
                  }}
                >
                  <Text style={{ color: '#c00', fontWeight: '700' }}>-20</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ borderWidth: 1, borderColor: '#c00', padding: 8, borderRadius: 6 }}
                  onPress={() => {
                    const curr = parseFloat((localDelta || '').toString().replace(/,/g, '.')) || 0;
                    const next = curr - 10;
                    setLocalDelta(String(Number(next).toFixed(2)));
                  }}
                >
                  <Text style={{ color: '#c00', fontWeight: '700' }}>-10</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, { textAlign: 'center', flex: 1 }]}
                keyboardType="numeric"
                value={localDelta}
                onChangeText={(t) => setLocalDelta(t)}
              />

              <View style={{ flexDirection: 'column', gap: Spacing.xs }}>
                <TouchableOpacity
                  style={{ borderWidth: 1, borderColor: '#0a0', padding: 8, borderRadius: 6, marginBottom: Spacing.xs }}
                  onPress={() => {
                    const curr = parseFloat((localDelta || '').toString().replace(/,/g, '.')) || 0;
                    const next = curr + 10;
                    setLocalDelta(String(Number(next).toFixed(2)));
                  }}
                >
                  <Text style={{ color: '#0a0', fontWeight: '700' }}>+10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ borderWidth: 1, borderColor: '#0a0', padding: 8, borderRadius: 6 }}
                  onPress={() => {
                    const curr = parseFloat((localDelta || '').toString().replace(/,/g, '.')) || 0;
                    const next = curr + 20;
                    setLocalDelta(String(Number(next).toFixed(2)));
                  }}
                >
                  <Text style={{ color: '#0a0', fontWeight: '700' }}>+20</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: Spacing.s, marginTop: Spacing.m }}>
              <TouchableOpacity style={[styles.saveButton, { flex: 1, backgroundColor: '#28a745' }]} onPress={onSave}>
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 1, backgroundColor: Colors.boton_azul, marginLeft: Spacing.s }]}
                onPress={() => {
                  setVentaData(prev => {
                    const original = prev.precio_original_comerciable_cup;
                    const newPrice = (original !== null && original !== undefined && String(original).trim() !== '')
                      ? String(formatearNumero(Number(original)))
                      : '';
                    return { ...prev, precio_cobrado_cup: newPrice };
                  });
                  setLocalDelta('0.00');
                }}
              >
                <Text style={styles.saveButtonText}>Restablecer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <QRScannerModal
        visible={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onCodeScanned={async (code) => {
          try {
            const raw = await AsyncStorage.getItem('@config');
            if (!raw) { Alert.alert('Error', 'No se encontró configuración'); setShowScannerModal(false); return; }
            const config = JSON.parse(raw);
            const host = config.api_host || config.apihost || config.apiHost;
            const token = config.token;
            if (!host) { Alert.alert('Error', 'No se encontró host en la configuración'); setShowScannerModal(false); return; }
            console.log("Codigo escanead: ", String(code));

            const url = `${host.replace(/\/+$/, '')}/producto/filter/1/1`;
            const res = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ codigo: String(code) })
            });

            let responseData = null;
            try { responseData = await res.json(); } catch (e) { responseData = null; }
            if (!res.ok || !responseData) {
              Alert.alert('No encontrado', 'No se encontró ningún producto con ese código');
              setShowScannerModal(false);
              return;
            }

            const item = (responseData.data && responseData.data.length > 0) ? responseData.data[0] : null;
            if (!item) {
              Alert.alert('No encontrado', 'No se encontró ningún producto con ese código');
              setShowScannerModal(false);
              return;
            }

            // Simular la selección del item en el Autocomplete
            setSelectedComerciable(item);
            setComercialeBusqueda('');
            const display = item.producto?.nombre || item.servicio?.descripcion || item.nombre || '';
            handleChange('comerciable_display', display);
            handleChange('comerciable_id', item.id_comerciable || item.id || null);
            handleChange('precio_original_comerciable_cup', item.precio_cup != null ? String(item.precio_cup) : (item.producto?.costo_cup ? String(item.producto.costo_cup) : ''));
            handleChange('precio_original_comerciable_usd', item.precio_usd != null ? String(item.precio_usd) : (item.producto?.costo_usd ? String(item.producto.costo_usd) : ''));
            try {
              let tipo = '';
              if (item.producto) {
                const isMedicamento = Boolean(item.producto.medicamento || item.producto.isMedicamento || item.producto.tipo === 'medicamento');
                tipo = isMedicamento ? 'medicamento' : 'producto';
              } else if (item.servicio) {
                tipo = 'servicio';
              } else if (item.tipo) {
                tipo = item.tipo;
              }
              handleChange('tipo_comerciable', tipo);
            } catch (e) {
              handleChange('tipo_comerciable', '');
            }
            try {
              const rawPrice = item.precio_cup != null ? Number(item.precio_cup) : (item.producto?.costo_cup ? Number(item.producto.costo_cup) : null);
              const descuento = Number(ventaParam?.descuento) || 0;
              const finalPrice = (rawPrice != null && descuento > 0) ? (rawPrice * (1 - descuento / 100)) : rawPrice;
              handleChange('precio_cobrado_cup', finalPrice != null ? String(formatearNumero(finalPrice)) : '');
            } catch (e) {
              handleChange('precio_cobrado_cup', item.precio_cup != null ? String(item.precio_cup) : (item.producto?.costo_cup ? String(item.producto.costo_cup) : ''));
            }

            setShowScannerModal(false);
          } catch (err) {
            console.error('Error buscando por código:', err);
            Alert.alert('Error', 'No se pudo buscar el código');
            setShowScannerModal(false);
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: Spacing.m,
    paddingBottom: Spacing.page,
  },
  section: {
    backgroundColor: '#fff',
    padding: Spacing.m,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: Spacing.m,
  },
  infoBox: {
    backgroundColor: '#f0f8ff',
    padding: Spacing.m,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.boton_azul,
    marginBottom: Spacing.m,
  },
  infoText: {
    fontSize: Typography.small,
    color: Colors.textSecondary,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.m,
  },
  title: {
    fontSize: Typography.h3,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: Spacing.m,
    textAlign: 'center'
  },
  field: { marginBottom: Spacing.m },
  label: {
    fontSize: Typography.body,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
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
    minHeight: 44
  },
  inputText: { color: Colors.textSecondary },
  row: { flexDirection: 'row', gap: Spacing.s },
  paymentContainer: {
    marginTop: Spacing.m,
    paddingTop: Spacing.s,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  radioRow: {
    flexDirection: 'row',
    gap: Spacing.m,
    marginTop: Spacing.xs,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.s,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.s,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: Colors.boton_azul,
    paddingVertical: Spacing.m,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: Spacing.s,
    borderWidth: 1,
    borderColor: '#000',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: Typography.body,
    fontWeight: '700',
  },
  backButton: {
    backgroundColor: Colors.primarySuave,
    padding: Spacing.s,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000',
  },
  icon: {
    width: 20,
    height: 20,
    tintColor: Colors.textPrimary,
  },
  consultContainer: {
    backgroundColor: '#fff9e6',
    padding: Spacing.m,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f0dca6',
    marginBottom: Spacing.m,
  },
  consultText: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
  },
  cameraButton: {
    backgroundColor: Colors.boton_azul,
    borderRadius: 8,
    padding: Spacing.s,
    height: 44,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  cameraIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  summaryValue: {
    fontSize: Typography.body,
    fontWeight: 'normal',
    color: Colors.textSecondary,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: '#fff',
    padding: Spacing.m,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  loadingText: {
    marginTop: Spacing.s,
    color: Colors.textSecondary,
    fontSize: Typography.body,
  },
});
