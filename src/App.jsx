import React, { useState, useEffect } from 'react';
import { Download, Plus, DollarSign, TrendingUp, Calendar, RefreshCw, Cloud, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

// Configuración de Google Sheets
const GOOGLE_SHEETS_CONFIG = {
  apiKey: 'AIzaSyDxw9tR8DnfS0uaoTsXbl_NvgfU_fVCRHA', // El usuario deberá configurar esto
  spreadsheetId: '1Y3Umco6kDUd4vhEqW8lN9l8kfGdToZ50ET1c3J1g778', // El usuario deberá configurar esto
  range: 'Libro Diario!A5:G', // Rango para leer/escribir datos
};

export default function ConstruccionTracker() {
  const [movimientos, setMovimientos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState('gasto');
  const [configurado, setConfigurado] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState(null);
  const [error, setError] = useState(null);
  
  const [config, setConfig] = useState({
    apiKey: localStorage.getItem('sheets-api-key') || '',
    spreadsheetId: localStorage.getItem('sheets-spreadsheet-id') || ''
  });

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    categoria: 'Materiales',
    montoPesos: '',
    montoUSD: '',
    tipoCambio: '',
    moneda: 'USD',
    notas: ''
  });

  const categorias = {
    gasto: ['Materiales', 'Mano de obra', 'Arquitectos', 'Tramite Municipalidad', 'Trabajos Preliminares', 'Honorarios', 'Permisos', 'Servicios', 'Otros'],
    entrega: ['Entrega arquitecto', 'Anticipo', 'Pago parcial', 'Fondos propios']
  };

  // Verificar si está configurado
  useEffect(() => {
    const apiKey = localStorage.getItem('sheets-api-key');
    const spreadsheetId = localStorage.getItem('sheets-spreadsheet-id');
    
    if (apiKey && spreadsheetId) {
      setConfigurado(true);
      GOOGLE_SHEETS_CONFIG.apiKey = apiKey;
      GOOGLE_SHEETS_CONFIG.spreadsheetId = spreadsheetId;
      cargarDesdeGoogleSheets();
    }
  }, []);

  // Guardar configuración
  const guardarConfiguracion = () => {
    if (!config.apiKey || !config.spreadsheetId) {
      alert('Por favor completá ambos campos');
      return;
    }
    
    localStorage.setItem('sheets-api-key', config.apiKey);
    localStorage.setItem('sheets-spreadsheet-id', config.spreadsheetId);
    GOOGLE_SHEETS_CONFIG.apiKey = config.apiKey;
    GOOGLE_SHEETS_CONFIG.spreadsheetId = config.spreadsheetId;
    
    setConfigurado(true);
    setMostrarConfig(false);
    cargarDesdeGoogleSheets();
  };

  // Cargar datos desde Google Sheets
  const cargarDesdeGoogleSheets = async () => {
    setSincronizando(true);
    setError(null);
    
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.spreadsheetId}/values/${GOOGLE_SHEETS_CONFIG.range}?key=${GOOGLE_SHEETS_CONFIG.apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Error al cargar datos. Verificá tu API Key y Spreadsheet ID.');
      }
      
      const data = await response.json();
      
      if (data.values && data.values.length > 0) {
        const movimientosCargados = data.values
          .filter(row => row[0]) // Filtrar filas vacías
          .map(row => {
            const montoPesos = row[5] ? parseFloat(row[5]) : 0;
            const montoUSD = row[4] ? parseFloat(row[4]) : 0;
            const tipoCambio = row[6] ? parseFloat(row[6]) : null;
            
            return {
              id: parseInt(row[0]) || Date.now(),
              fecha: row[1] ? new Date(row[1]).toISOString().split('T')[0] : '',
              concepto: row[2] || '',
              categoria: row[3] || 'Otros',
              montoUSD: montoUSD,
              montoPesos: montoPesos,
              tipoCambio: tipoCambio,
              moneda: montoPesos > 0 ? 'ARS' : 'USD',
              tipo: categorias.gasto.includes(row[3]) ? 'gasto' : 'entrega',
              notas: ''
            };
          })
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        setMovimientos(movimientosCargados);
        setUltimaSync(new Date());
      }
      
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setSincronizando(false);
    }
  };

  // Guardar movimiento en Google Sheets
  const guardarEnGoogleSheets = async (nuevoMovimiento) => {
    try {
      // Obtener el último ID
      const ultimoId = movimientos.length > 0 
        ? Math.max(...movimientos.map(m => m.id)) 
        : 0;
      
      const proximoId = ultimoId + 1;
      
      // Formatear fecha para Google Sheets (DD/MM/YYYY)
      const [year, month, day] = nuevoMovimiento.fecha.split('-');
      const fechaFormateada = `${day}/${month}/${year}`;
      
      // Preparar la fila según el formato del Excel
      const nuevaFila = [
        proximoId,
        fechaFormateada,
        nuevoMovimiento.concepto,
        nuevoMovimiento.categoria,
        nuevoMovimiento.moneda === 'USD' ? nuevoMovimiento.montoUSD : `=F${proximoId + 4}/G${proximoId + 4}`,
        nuevoMovimiento.moneda === 'ARS' ? nuevoMovimiento.montoPesos : `=E${proximoId + 4}*G${proximoId + 4}`,
        nuevoMovimiento.tipoCambio || ''
      ];
      
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.spreadsheetId}/values/Libro Diario!A${proximoId + 4}:append?valueInputOption=USER_ENTERED&key=${GOOGLE_SHEETS_CONFIG.apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [nuevaFila]
        })
      });
      
      if (!response.ok) {
        throw new Error('Error al guardar en Google Sheets');
      }
      
      // Recargar datos
      await cargarDesdeGoogleSheets();
      
    } catch (err) {
      console.error('Error al guardar:', err);
      alert('Error al guardar en Google Sheets. Verificá tu configuración.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };

    if (name === 'montoPesos' || name === 'tipoCambio') {
      const pesos = parseFloat(name === 'montoPesos' ? value : formData.montoPesos) || 0;
      const tc = parseFloat(name === 'tipoCambio' ? value : formData.tipoCambio) || 0;
      if (pesos > 0 && tc > 0) {
        newFormData.montoUSD = (pesos / tc).toFixed(2);
      }
    }

    setFormData(newFormData);
  };

  const agregarMovimiento = async () => {
    if (!formData.concepto || (!formData.montoUSD && !formData.montoPesos)) {
      alert('Por favor completá el concepto y el monto');
      return;
    }

    const nuevoMovimiento = {
      id: Date.now(),
      tipo: tipoMovimiento,
      fecha: formData.fecha,
      concepto: formData.concepto,
      categoria: formData.categoria,
      montoPesos: formData.moneda === 'ARS' ? parseFloat(formData.montoPesos) : 0,
      montoUSD: formData.moneda === 'USD' ? parseFloat(formData.montoUSD) : parseFloat(formData.montoUSD) || 0,
      tipoCambio: formData.moneda === 'ARS' ? parseFloat(formData.tipoCambio) : null,
      moneda: formData.moneda,
      notas: formData.notas
    };

    if (configurado) {
      await guardarEnGoogleSheets(nuevoMovimiento);
    } else {
      setMovimientos([...movimientos, nuevoMovimiento].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
    }
    
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      categoria: 'Materiales',
      montoPesos: '',
      montoUSD: '',
      tipoCambio: '',
      moneda: 'USD',
      notas: ''
    });
    setMostrarForm(false);
  };

  const descargarExcel = () => {
    const datosExcel = movimientos.map(m => ({
      ID: movimientos.indexOf(m) + 1,
      Fecha: m.fecha,
      Concepto: m.concepto,
      Categoría: m.categoria,
      'Monto USD': m.montoUSD,
      'Monto ARS': m.montoPesos || '-',
      'Tipo Cambio': m.tipoCambio || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Libro Diario');
    
    const fechaHoy = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `construccion-${fechaHoy}.xlsx`);
  };

  const totales = {
    gastosUSD: movimientos.filter(m => m.tipo === 'gasto').reduce((sum, m) => sum + m.montoUSD, 0),
    entregasUSD: movimientos.filter(m => m.tipo === 'entrega').reduce((sum, m) => sum + m.montoUSD, 0)
  };

  const saldoUSD = totales.entregasUSD - totales.gastosUSD;

  // Panel de configuración
  if (mostrarConfig || !configurado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Configuración de Google Sheets</h1>
          <p className="text-slate-600 mb-6">Conectá tu Google Sheet para sincronizar automáticamente</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Google Sheets API Key
              </label>
              <input
                type="text"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Spreadsheet ID
              </label>
              <input
                type="text"
                value={config.spreadsheetId}
                onChange={(e) => setConfig({ ...config, spreadsheetId: e.target.value })}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lo encontrás en la URL: docs.google.com/spreadsheets/d/<strong>ESTE-ES-EL-ID</strong>/edit
              </p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
              <h3 className="font-semibold text-blue-900 mb-2">📋 Instrucciones rápidas:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Creá una copia del template de Google Sheet que te voy a dar</li>
                <li>Conseguí tu API Key desde Google Cloud Console</li>
                <li>Copiá el ID de tu spreadsheet desde la URL</li>
                <li>Pegá ambos valores acá arriba</li>
              </ol>
              <p className="text-xs text-blue-700 mt-3">
                💡 Vas a recibir instrucciones detalladas en un archivo aparte
              </p>
            </div>
          </div>
          
          <div className="flex gap-3 mt-8">
            <button
              onClick={guardarConfiguracion}
              className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 transition-colors"
            >
              Guardar y Conectar
            </button>
            {configurado && (
              <button
                onClick={() => setMostrarConfig(false)}
                className="flex-1 bg-gray-200 text-gray-700 rounded-lg py-3 font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Control de Obra</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-600">Construcción Alcanfores</p>
                {configurado && (
                  <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    <Cloud size={12} />
                    Sincronizado
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {configurado && (
                <button
                  onClick={cargarDesdeGoogleSheets}
                  disabled={sincronizando}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                >
                  <RefreshCw size={20} className={sincronizando ? 'animate-spin' : ''} />
                  {sincronizando ? 'Sincronizando...' : 'Actualizar'}
                </button>
              )}
              <button
                onClick={descargarExcel}
                disabled={movimientos.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Download size={20} />
                Excel
              </button>
            </div>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-800 font-medium">Error de sincronización</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
                <button
                  onClick={() => setMostrarConfig(true)}
                  className="text-xs text-red-700 underline mt-2"
                >
                  Revisar configuración
                </button>
              </div>
            </div>
          )}

          {/* Última sincronización */}
          {ultimaSync && (
            <p className="text-xs text-gray-500 mb-4">
              Última actualización: {ultimaSync.toLocaleTimeString('es-AR')}
            </p>
          )}

          {/* Totales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-700 mb-1">
                <TrendingUp size={18} />
                <span className="text-sm font-medium">Entregas</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">
                USD {totales.entregasUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700 mb-1">
                <DollarSign size={18} />
                <span className="text-sm font-medium">Gastos</span>
              </div>
              <p className="text-2xl font-bold text-red-900">
                USD {totales.gastosUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className={`${saldoUSD >= 0 ? 'bg-green-50' : 'bg-orange-50'} rounded-lg p-4`}>
              <div className={`flex items-center gap-2 ${saldoUSD >= 0 ? 'text-green-700' : 'text-orange-700'} mb-1`}>
                <Calendar size={18} />
                <span className="text-sm font-medium">Saldo</span>
              </div>
              <p className={`text-2xl font-bold ${saldoUSD >= 0 ? 'text-green-900' : 'text-orange-900'}`}>
                USD {saldoUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Botón agregar */}
        {!mostrarForm && (
          <button
            onClick={() => setMostrarForm(true)}
            className="w-full bg-blue-600 text-white rounded-xl p-4 mb-6 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={24} />
            <span className="font-semibold">Agregar Movimiento</span>
          </button>
        )}

        {/* Formulario */}
        {mostrarForm && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Nuevo Movimiento</h2>
            
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTipoMovimiento('gasto')}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  tipoMovimiento === 'gasto'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Gasto
              </button>
              <button
                onClick={() => setTipoMovimiento('entrega')}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  tipoMovimiento === 'entrega'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Entrega
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    name="fecha"
                    value={formData.fecha}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                  <select
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {categorias[tipoMovimiento].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Concepto</label>
                <input
                  type="text"
                  name="concepto"
                  value={formData.concepto}
                  onChange={handleInputChange}
                  placeholder="Ej: Hierro 8mm, Pago quincenal albañil, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, moneda: 'USD', montoPesos: '', tipoCambio: '' })}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                      formData.moneda === 'USD'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    USD
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, moneda: 'ARS', montoUSD: '' })}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                      formData.moneda === 'ARS'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    ARS
                  </button>
                </div>
              </div>

              {formData.moneda === 'USD' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monto USD</label>
                  <input
                    type="number"
                    name="montoUSD"
                    value={formData.montoUSD}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monto ARS</label>
                    <input
                      type="number"
                      name="montoPesos"
                      value={formData.montoPesos}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Cambio</label>
                    <input
                      type="number"
                      name="tipoCambio"
                      value={formData.tipoCambio}
                      onChange={handleInputChange}
                      placeholder="1200"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {formData.montoUSD && (
                    <div className="col-span-3 bg-blue-50 rounded-lg p-3">
                      <p className="text-sm text-blue-700">
                        Equivalente: <span className="font-bold">USD {formData.montoUSD}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={agregarMovimiento}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 transition-colors"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setMostrarForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 rounded-lg py-3 font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de movimientos */}
        <div className="space-y-3">
          {movimientos.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <p className="text-gray-500">No hay movimientos registrados todavía</p>
              <p className="text-sm text-gray-400 mt-2">
                {configurado ? 'La sincronización con Google Sheets está activa' : 'Agregá tu primer movimiento para comenzar'}
              </p>
            </div>
          ) : (
            movimientos.map(mov => (
              <div
                key={mov.id}
                className={`bg-white rounded-xl shadow-sm p-4 ${
                  mov.tipo === 'gasto' ? 'border-l-4 border-red-500' : 'border-l-4 border-blue-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        mov.tipo === 'gasto' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {mov.tipo === 'gasto' ? 'GASTO' : 'ENTREGA'}
                      </span>
                      <span className="text-xs text-gray-500">{mov.fecha}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500 capitalize">{mov.categoria}</span>
                    </div>
                    <h3 className="font-semibold text-slate-800">{mov.concepto}</h3>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-xl font-bold text-slate-800">
                      USD {mov.montoUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    {mov.montoPesos > 0 && (
                      <p className="text-xs text-gray-500">
                        ARS {mov.montoPesos.toLocaleString('es-AR')} @ {mov.tipoCambio}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Botón de configuración flotante */}
        <button
          onClick={() => setMostrarConfig(true)}
          className="fixed bottom-6 right-6 bg-gray-800 text-white p-4 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
          title="Configuración"
        >
          <Cloud size={24} />
        </button>
      </div>
    </div>
  );
}
