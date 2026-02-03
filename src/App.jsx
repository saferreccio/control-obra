import React, { useState, useEffect } from 'react';
import { Download, Plus, DollarSign, TrendingUp, RefreshCw, Cloud, AlertCircle, Edit2, Check, X } from 'lucide-react';
import * as XLSX from 'xlsx';

const GOOGLE_SHEETS_CONFIG = {
  apiKey: '',
  spreadsheetId: '',
  range: 'Libro Diario!A5:G',
  scriptUrl: 'https://script.google.com/macros/s/AKfycbwAc2qm-m_UozoXJsaneF8sMUvk0Q5eiIBGnZMn4tdYo-_3Hg6xyCh28OL_DAYH1i4Rhg/exec'
};

export default function ConstruccionTracker() {
  const [movimientos, setMovimientos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [configurado, setConfigurado] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [totalCasa, setTotalCasa] = useState(parseFloat(localStorage.getItem('total-casa')) || 245000);
  const [editandoTotal, setEditandoTotal] = useState(false);
  const [nuevoTotal, setNuevoTotal] = useState(totalCasa);
  
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
    moneda: 'USD'
  });

  const categorias = ['Materiales', 'Mano de obra', 'Arquitectos', 'Tramite Municipalidad', 'Trabajos Preliminares', 'Honorarios', 'Permisos', 'Servicios', 'Otros'];

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

  const actualizarTotalCasa = () => {
    const total = parseFloat(nuevoTotal);
    if (isNaN(total) || total <= 0) {
      alert('Ingresá un monto válido');
      return;
    }
    setTotalCasa(total);
    localStorage.setItem('total-casa', total.toString());
    setEditandoTotal(false);
  };

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
          .filter(row => row[0] && row[4]) // Filtrar filas sin ID o sin monto USD
          .map(row => {
            const montoPesos = row[5] ? parseFloat(row[5].toString().replace(/,/g, '')) : 0;
            const montoUSD = row[4] ? parseFloat(row[4].toString().replace(/,/g, '')) : 0;
            const tipoCambio = row[6] ? parseFloat(row[6].toString().replace(/,/g, '')) : null;
            
            // Parsear fecha - formato "2025-07-17 0:00:00"
            let fecha = '';
            if (row[1]) {
              const fechaStr = row[1].toString();
              if (fechaStr.includes('-')) {
                fecha = fechaStr.split(' ')[0];
              } else if (fechaStr.includes('/')) {
                const [day, month, year] = fechaStr.split('/');
                fecha = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              } else {
                try {
                  const d = new Date(fechaStr);
                  if (!isNaN(d.getTime())) {
                    fecha = d.toISOString().split('T')[0];
                  }
                } catch (e) {
                  console.error('Error parseando fecha:', fechaStr);
                }
              }
            }
            
            return {
              id: parseInt(row[0]) || Date.now(),
              fecha: fecha,
              concepto: row[2] || 'Sin concepto',
              categoria: row[3] || 'Otros',
              montoUSD: montoUSD,
              montoPesos: montoPesos,
              tipoCambio: tipoCambio,
              moneda: montoPesos > 0 ? 'ARS' : 'USD'
            };
          })
          .filter(mov => mov.fecha && mov.montoUSD > 0)
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

  const guardarEnGoogleSheets = async (nuevoMovimiento) => {
    setGuardando(true);
    setError(null);
    
    try {
      const ultimoId = movimientos.length > 0 
        ? Math.max(...movimientos.map(m => m.id)) 
        : 0;
      
      const proximoId = ultimoId + 1;
      
      // Formatear fecha para Google Sheets (DD/MM/YYYY)
      const [year, month, day] = nuevoMovimiento.fecha.split('-');
      const fechaFormateada = `${day}/${month}/${year}`;
      
      // Preparar datos para enviar al Apps Script
      const datosParaEnviar = {
        id: proximoId,
        fecha: fechaFormateada,
        concepto: nuevoMovimiento.concepto,
        categoria: nuevoMovimiento.categoria,
        montoUSD: nuevoMovimiento.moneda === 'USD' ? nuevoMovimiento.montoUSD : nuevoMovimiento.montoUSD,
        montoPesos: nuevoMovimiento.moneda === 'ARS' ? nuevoMovimiento.montoPesos : '',
        tipoCambio: nuevoMovimiento.tipoCambio || ''
      };
      
      // =====================================================
      // FIX: Usar POST con redirect:follow en lugar de no-cors
      // Google Apps Script redirige (302) y el navegador lo sigue
      // automáticamente, lo cual permite leer la respuesta.
      // 
      // El truco: NO enviar Content-Type: application/json
      // porque eso dispara un preflight CORS que Apps Script
      // no maneja. En su lugar, enviamos como text/plain
      // que es un "simple request" y no necesita preflight.
      // Apps Script igual puede leer el body con e.postData.contents.
      // =====================================================
      const response = await fetch(GOOGLE_SHEETS_CONFIG.scriptUrl, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify(datosParaEnviar)
      });
      
      // Intentar leer la respuesta
      let resultado;
      try {
        resultado = await response.json();
      } catch {
        // Si no se puede parsear, asumimos que fue exitoso
        // (a veces la respuesta viene como opaque redirect)
        resultado = { success: true };
      }
      
      if (resultado.success === false) {
        throw new Error(resultado.error || 'Error desconocido al guardar');
      }
      
      // Recargar datos desde Google Sheets
      setTimeout(async () => {
        await cargarDesdeGoogleSheets();
      }, 2000);
      
    } catch (err) {
      console.error('Error al guardar:', err);
      setError('Error al guardar: ' + err.message);
    } finally {
      setGuardando(false);
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
      fecha: formData.fecha,
      concepto: formData.concepto,
      categoria: formData.categoria,
      montoPesos: formData.moneda === 'ARS' ? parseFloat(formData.montoPesos) : 0,
      montoUSD: formData.moneda === 'USD' ? parseFloat(formData.montoUSD) : parseFloat(formData.montoUSD) || 0,
      tipoCambio: formData.moneda === 'ARS' ? parseFloat(formData.tipoCambio) : null,
      moneda: formData.moneda
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
      moneda: 'USD'
    });
    setMostrarForm(false);
  };

  const descargarExcel = () => {
    const datosExcel = movimientos.map((m, idx) => ({
      ID: idx + 1,
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

  const totalGastado = movimientos.reduce((sum, m) => sum + m.montoUSD, 0);
  const faltaGastar = totalCasa - totalGastado;
  const porcentajeAvance = totalCasa > 0 ? (totalGastado / totalCasa) * 100 : 0;

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
                <li>Convertí tu Excel a Google Sheets</li>
                <li>Conseguí tu API Key desde Google Cloud Console</li>
                <li>Copiá el ID de tu spreadsheet desde la URL</li>
                <li>Pegá ambos valores acá arriba</li>
              </ol>
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

          {/* Error */}
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

          {/* Última sync */}
          {ultimaSync && (
            <p className="text-xs text-gray-500 mb-4">
              Última actualización: {ultimaSync.toLocaleTimeString('es-AR')}
            </p>
          )}

          {/* Total Casa editable */}
          <div className="bg-slate-100 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Total Casa (presupuesto)</span>
              {editandoTotal ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={nuevoTotal}
                    onChange={(e) => setNuevoTotal(e.target.value)}
                    className="w-32 px-2 py-1 text-sm border border-gray-300 rounded"
                    step="1000"
                  />
                  <button onClick={actualizarTotalCasa} className="text-green-600 hover:text-green-700">
                    <Check size={18} />
                  </button>
                  <button onClick={() => { setEditandoTotal(false); setNuevoTotal(totalCasa); }} className="text-red-600 hover:text-red-700">
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-800">
                    USD {totalCasa.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <button onClick={() => setEditandoTotal(true)} className="text-slate-600 hover:text-slate-800">
                    <Edit2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Métricas principales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700 mb-1">
                <DollarSign size={18} />
                <span className="text-sm font-medium">Total Gastado</span>
              </div>
              <p className="text-2xl font-bold text-red-900">
                USD {totalGastado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className={`${faltaGastar >= 0 ? 'bg-blue-50' : 'bg-orange-50'} rounded-lg p-4`}>
              <div className={`flex items-center gap-2 ${faltaGastar >= 0 ? 'text-blue-700' : 'text-orange-700'} mb-1`}>
                <TrendingUp size={18} />
                <span className="text-sm font-medium">Falta Gastar</span>
              </div>
              <p className={`text-2xl font-bold ${faltaGastar >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
                USD {faltaGastar.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 mb-1">
                <TrendingUp size={18} />
                <span className="text-sm font-medium">% Avance</span>
              </div>
              <p className="text-2xl font-bold text-green-900">
                {porcentajeAvance.toFixed(1)}%
              </p>
              <div className="mt-2 bg-green-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-green-600 h-full transition-all duration-500"
                  style={{ width: `${Math.min(porcentajeAvance, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Botón agregar */}
        {!mostrarForm && (
          <button
            onClick={() => setMostrarForm(true)}
            disabled={guardando}
            className="w-full bg-blue-600 text-white rounded-xl p-4 mb-6 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-sm disabled:bg-gray-400"
          >
            <Plus size={24} />
            <span className="font-semibold">Agregar Gasto</span>
          </button>
        )}

        {/* Formulario */}
        {mostrarForm && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Nuevo Gasto</h2>

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
                    {categorias.map(cat => (
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
                  disabled={guardando}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => setMostrarForm(false)}
                  disabled={guardando}
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
              <p className="text-gray-500">No hay gastos registrados todavía</p>
              <p className="text-sm text-gray-400 mt-2">
                {configurado ? 'La sincronización con Google Sheets está activa' : 'Agregá tu primer gasto para comenzar'}
              </p>
            </div>
          ) : (
            movimientos.map(mov => (
              <div
                key={mov.id}
                className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-red-500"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">{mov.fecha}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">{mov.categoria}</span>
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

        {/* Botón config flotante */}
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
