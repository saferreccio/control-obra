import React, { useState, useEffect, useMemo } from 'react';
import { Download, Plus, DollarSign, TrendingUp, RefreshCw, Cloud, AlertCircle, Edit2, Trash2, BarChart3, List } from 'lucide-react';
import * as XLSX from 'xlsx';
import { CATEGORIAS, BUDGET_POR_CATEGORIA, BUDGET_POR_SUBCATEGORIA, SUBCATEGORIA_A_CATEGORIA, TOTAL_PRESUPUESTO } from './budgetData';

const GOOGLE_SHEETS_CONFIG = {
  apiKey: '',
  spreadsheetId: '',
  range: 'Libro Diario!A5:G',
  scriptUrl: 'https://script.google.com/macros/s/AKfycbwTIsNhePh6ME6VzKSThQ2MwHO4X2WSJ7FH_4NTZo2b8r1SjLBSUmE95KGO6-0JbLK_2w/exec'
};

function formatUSD(n) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function parseCategoria(rawCat) {
  // New format: "Category > Subcategory"
  if (rawCat && rawCat.includes(' > ')) {
    const [cat, sub] = rawCat.split(' > ');
    return { categoria: cat.trim(), subcategoria: sub.trim() };
  }
  // Legacy: try reverse lookup from subcategory name
  if (SUBCATEGORIA_A_CATEGORIA[rawCat]) {
    return { categoria: SUBCATEGORIA_A_CATEGORIA[rawCat], subcategoria: rawCat };
  }
  // Try matching as a category name directly
  if (CATEGORIAS[rawCat]) {
    return { categoria: rawCat, subcategoria: '' };
  }
  return { categoria: 'Otros', subcategoria: rawCat || 'Otros' };
}

export default function ConstruccionTracker() {
  const [movimientos, setMovimientos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [configurado, setConfigurado] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState(null);
  const [error, setError] = useState(null);
  const [editandoMovimiento, setEditandoMovimiento] = useState(null);
  const [vistaActiva, setVistaActiva] = useState('gastos'); // 'gastos' | 'presupuesto'
  const [categoriaExpandida, setCategoriaExpandida] = useState(null);

  const [config, setConfig] = useState({
    apiKey: localStorage.getItem('sheets-api-key') || '',
    spreadsheetId: localStorage.getItem('sheets-spreadsheet-id') || ''
  });

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    categoria: 'Otros',
    subcategoria: 'Otros',
    montoPesos: '',
    montoUSD: '',
    tipoCambio: '',
    moneda: 'USD'
  });

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
          .filter(row => row[0] && row[4])
          .map(row => {
            const montoPesos = row[5] ? parseFloat(row[5].toString().replace(/,/g, '')) : 0;
            const montoUSD = row[4] ? parseFloat(row[4].toString().replace(/,/g, '')) : 0;
            const tipoCambio = row[6] ? parseFloat(row[6].toString().replace(/,/g, '')) : null;

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

            const rawCat = row[3] || 'Otros';
            const { categoria, subcategoria } = parseCategoria(rawCat);

            return {
              id: parseInt(row[0]) || Date.now(),
              fecha,
              concepto: row[2] || 'Sin concepto',
              categoriaRaw: rawCat,
              categoria,
              subcategoria,
              montoUSD,
              montoPesos,
              tipoCambio,
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
    try {
      const ultimoId = movimientos.length > 0
        ? Math.max(...movimientos.map(m => m.id))
        : 0;
      const proximoId = ultimoId + 1;
      const [year, month, day] = nuevoMovimiento.fecha.split('-');
      const fechaFormateada = `${day}/${month}/${year}`;

      const categoriaParaSheet = `${nuevoMovimiento.categoria} > ${nuevoMovimiento.subcategoria}`;

      const datosParaEnviar = {
        id: proximoId,
        fecha: fechaFormateada,
        concepto: nuevoMovimiento.concepto,
        categoria: categoriaParaSheet,
        montoUSD: nuevoMovimiento.montoUSD,
        montoPesos: nuevoMovimiento.moneda === 'ARS' ? nuevoMovimiento.montoPesos : '',
        tipoCambio: nuevoMovimiento.tipoCambio || ''
      };

      await fetch(GOOGLE_SHEETS_CONFIG.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(datosParaEnviar)
      });

      setTimeout(() => cargarDesdeGoogleSheets(), 2000);
    } catch (err) {
      console.error('Error al guardar:', err);
      setTimeout(() => cargarDesdeGoogleSheets(), 2000);
    }
  };

  const eliminarMovimiento = async (id) => {
    if (!confirm('¿Seguro que querés eliminar este gasto?')) return;

    try {
      await fetch(GOOGLE_SHEETS_CONFIG.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'delete', id })
      });
      setTimeout(() => cargarDesdeGoogleSheets(), 2000);
    } catch (err) {
      console.error('Error al eliminar:', err);
      alert('Error al eliminar el gasto');
    }
  };

  const editarMovimiento = (mov) => {
    setEditandoMovimiento(mov.id);
    setFormData({
      fecha: mov.fecha,
      concepto: mov.concepto,
      categoria: mov.categoria,
      subcategoria: mov.subcategoria,
      montoPesos: mov.montoPesos || '',
      montoUSD: mov.montoUSD,
      tipoCambio: mov.tipoCambio || '',
      moneda: mov.moneda
    });
  };

  const guardarEdicion = async () => {
    try {
      const [year, month, day] = formData.fecha.split('-');
      const fechaFormateada = `${day}/${month}/${year}`;
      const categoriaParaSheet = `${formData.categoria} > ${formData.subcategoria}`;

      const datosParaEnviar = {
        action: 'edit',
        id: editandoMovimiento,
        fecha: fechaFormateada,
        concepto: formData.concepto,
        categoria: categoriaParaSheet,
        montoUSD: formData.montoUSD,
        montoPesos: formData.moneda === 'ARS' ? formData.montoPesos : '',
        tipoCambio: formData.tipoCambio || ''
      };

      await fetch(GOOGLE_SHEETS_CONFIG.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(datosParaEnviar)
      });

      setEditandoMovimiento(null);
      resetForm();
      setTimeout(() => cargarDesdeGoogleSheets(), 2000);
    } catch (err) {
      console.error('Error al editar:', err);
      alert('Error al editar el gasto');
    }
  };

  const cancelarEdicion = () => {
    setEditandoMovimiento(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      categoria: 'Otros',
      subcategoria: 'Otros',
      montoPesos: '',
      montoUSD: '',
      tipoCambio: '',
      moneda: 'USD'
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };

    if (name === 'categoria') {
      newFormData.subcategoria = CATEGORIAS[value]?.[0] || '';
    }

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

    if (editandoMovimiento) {
      await guardarEdicion();
    } else {
      const nuevoMovimiento = {
        id: Date.now(),
        fecha: formData.fecha,
        concepto: formData.concepto,
        categoria: formData.categoria,
        subcategoria: formData.subcategoria,
        montoPesos: formData.moneda === 'ARS' ? parseFloat(formData.montoPesos) : 0,
        montoUSD: formData.moneda === 'USD' ? parseFloat(formData.montoUSD) : parseFloat(formData.montoUSD) || 0,
        tipoCambio: formData.moneda === 'ARS' ? parseFloat(formData.tipoCambio) : null,
        moneda: formData.moneda
      };

      if (configurado) {
        await guardarEnGoogleSheets(nuevoMovimiento);
      } else {
        setMovimientos(prev => [...prev, nuevoMovimiento].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
      }

      resetForm();
    }

    setMostrarForm(false);
  };

  const descargarExcel = () => {
    const datosExcel = movimientos.map((m, idx) => ({
      ID: idx + 1,
      Fecha: m.fecha,
      Concepto: m.concepto,
      Categoria: m.categoria,
      Subcategoria: m.subcategoria,
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

  // Budget tracking computations
  const totalGastado = movimientos.reduce((sum, m) => sum + m.montoUSD, 0);
  const faltaGastar = TOTAL_PRESUPUESTO - totalGastado;
  const porcentajeAvance = (totalGastado / TOTAL_PRESUPUESTO) * 100;

  const gastosPorCategoria = useMemo(() => {
    const result = {};
    // Initialize all budget categories
    for (const cat of Object.keys(BUDGET_POR_CATEGORIA)) {
      result[cat] = { gastado: 0, presupuesto: BUDGET_POR_CATEGORIA[cat], movimientos: [] };
    }
    result['Otros'] = { gastado: 0, presupuesto: 0, movimientos: [] };

    for (const mov of movimientos) {
      const cat = mov.categoria;
      if (!result[cat]) {
        result[cat] = { gastado: 0, presupuesto: 0, movimientos: [] };
      }
      result[cat].gastado += mov.montoUSD;
      result[cat].movimientos.push(mov);
    }
    return result;
  }, [movimientos]);

  // Config screen
  if (mostrarConfig || !configurado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Configuracion de Google Sheets</h1>
          <p className="text-slate-600 mb-6">Conecta tu Google Sheet para sincronizar automaticamente</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Google Sheets API Key</label>
              <input
                type="text"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Spreadsheet ID</label>
              <input
                type="text"
                value={config.spreadsheetId}
                onChange={(e) => setConfig({ ...config, spreadsheetId: e.target.value })}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lo encontras en la URL: docs.google.com/spreadsheets/d/<strong>ESTE-ES-EL-ID</strong>/edit
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
              <h3 className="font-semibold text-blue-900 mb-2">Instrucciones rapidas:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Converti tu Excel a Google Sheets</li>
                <li>Consegui tu API Key desde Google Cloud Console</li>
                <li>Copia el ID de tu spreadsheet desde la URL</li>
                <li>Pega ambos valores aca arriba</li>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-2 sm:p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Control de Obra</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm sm:text-base text-slate-600">Alcanfores</p>
                {configurado && (
                  <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    <Cloud size={12} />
                    Sync
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {configurado && (
                <button
                  onClick={cargarDesdeGoogleSheets}
                  disabled={sincronizando}
                  className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                >
                  <RefreshCw size={18} className={sincronizando ? 'animate-spin' : ''} />
                  {sincronizando ? 'Sync...' : 'Actualizar'}
                </button>
              )}
              <button
                onClick={descargarExcel}
                disabled={movimientos.length === 0}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Download size={18} />
                Excel
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-800 font-medium">Error de sincronizacion</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
                <button onClick={() => setMostrarConfig(true)} className="text-xs text-red-700 underline mt-2">
                  Revisar configuracion
                </button>
              </div>
            </div>
          )}

          {ultimaSync && (
            <p className="text-xs text-gray-500 mb-4">
              Ultima actualizacion: {ultimaSync.toLocaleTimeString('es-AR')}
            </p>
          )}

          {/* Overall metrics */}
          <div className="bg-slate-50 rounded-lg p-3 sm:p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Presupuesto Total</span>
              <span className="text-lg font-bold text-slate-800">USD {formatUSD(TOTAL_PRESUPUESTO)}</span>
            </div>
            <div className="bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-500 rounded-full ${porcentajeAvance > 100 ? 'bg-red-500' : porcentajeAvance > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(porcentajeAvance, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{porcentajeAvance.toFixed(1)}% ejecutado</span>
              <span>USD {formatUSD(totalGastado)} de {formatUSD(TOTAL_PRESUPUESTO)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-red-50 rounded-lg p-2 sm:p-4">
              <div className="flex items-center gap-1 text-red-700 mb-1">
                <DollarSign size={14} className="hidden sm:block" />
                <span className="text-xs sm:text-sm font-medium">Gastado</span>
              </div>
              <p className="text-sm sm:text-2xl font-bold text-red-900">
                <span className="hidden sm:inline">USD </span>{formatUSD(totalGastado)}
              </p>
            </div>

            <div className={`${faltaGastar >= 0 ? 'bg-blue-50' : 'bg-orange-50'} rounded-lg p-2 sm:p-4`}>
              <div className={`flex items-center gap-1 ${faltaGastar >= 0 ? 'text-blue-700' : 'text-orange-700'} mb-1`}>
                <TrendingUp size={14} className="hidden sm:block" />
                <span className="text-xs sm:text-sm font-medium">{faltaGastar >= 0 ? 'Disponible' : 'Excedido'}</span>
              </div>
              <p className={`text-sm sm:text-2xl font-bold ${faltaGastar >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
                <span className="hidden sm:inline">USD </span>{formatUSD(Math.abs(faltaGastar))}
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-2 sm:p-4">
              <div className="flex items-center gap-1 text-green-700 mb-1">
                <TrendingUp size={14} className="hidden sm:block" />
                <span className="text-xs sm:text-sm font-medium">Avance</span>
              </div>
              <p className="text-sm sm:text-2xl font-bold text-green-900">
                {porcentajeAvance.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setVistaActiva('gastos')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors ${
              vistaActiva === 'gastos'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <List size={18} />
            Gastos
          </button>
          <button
            onClick={() => setVistaActiva('presupuesto')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors ${
              vistaActiva === 'presupuesto'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BarChart3 size={18} />
            Presupuesto
          </button>
        </div>

        {/* =================== GASTOS VIEW =================== */}
        {vistaActiva === 'gastos' && (
          <>
            {/* Add button */}
            {!mostrarForm && !editandoMovimiento && (
              <button
                onClick={() => setMostrarForm(true)}
                className="w-full bg-blue-600 text-white rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus size={24} />
                <span className="font-semibold">Agregar Gasto</span>
              </button>
            )}

            {/* Form */}
            {(mostrarForm || editandoMovimiento) && (
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4">
                  {editandoMovimiento ? 'Editar Gasto' : 'Nuevo Gasto'}
                </h2>

                <div className="space-y-4">
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                    <select
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {Object.keys(CATEGORIAS).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subcategoria</label>
                    <select
                      name="subcategoria"
                      value={formData.subcategoria}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {(CATEGORIAS[formData.categoria] || []).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                    {formData.categoria !== 'Otros' && BUDGET_POR_CATEGORIA[formData.categoria] > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        Presupuesto categoria: USD {formatUSD(BUDGET_POR_CATEGORIA[formData.categoria])}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Concepto</label>
                    <input
                      type="text"
                      name="concepto"
                      value={formData.concepto}
                      onChange={handleInputChange}
                      placeholder="Detalle del gasto..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFormData({ ...formData, moneda: 'USD', montoPesos: '', tipoCambio: '' })}
                        className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                          formData.moneda === 'USD' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        USD
                      </button>
                      <button
                        onClick={() => setFormData({ ...formData, moneda: 'ARS', montoUSD: '' })}
                        className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                          formData.moneda === 'ARS' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">TC</label>
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
                      {editandoMovimiento ? 'Guardar Cambios' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => {
                        if (editandoMovimiento) cancelarEdicion();
                        else setMostrarForm(false);
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 rounded-lg py-3 font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Movement list */}
            <div className="space-y-2 sm:space-y-3">
              {movimientos.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center">
                  <p className="text-gray-500">No hay gastos registrados todavia</p>
                  <p className="text-sm text-gray-400 mt-2">
                    {configurado ? 'La sincronizacion con Google Sheets esta activa' : 'Agrega tu primer gasto para comenzar'}
                  </p>
                </div>
              ) : (
                movimientos.map(mov => (
                  <div key={mov.id} className="bg-white rounded-xl shadow-sm p-3 sm:p-4 border-l-4 border-red-500">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs text-gray-500">{mov.fecha}</span>
                          <span className="text-xs text-gray-400">|</span>
                          <span className="text-xs font-medium text-blue-600">{mov.categoria}</span>
                          {mov.subcategoria && mov.subcategoria !== mov.categoria && (
                            <>
                              <span className="text-xs text-gray-400">&gt;</span>
                              <span className="text-xs text-gray-500">{mov.subcategoria}</span>
                            </>
                          )}
                        </div>
                        <h3 className="font-semibold text-slate-800">{mov.concepto}</h3>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-base sm:text-xl font-bold text-slate-800">
                          USD {mov.montoUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        {mov.montoPesos > 0 && (
                          <p className="text-xs text-gray-500">
                            ARS {mov.montoPesos.toLocaleString('es-AR')} @ {mov.tipoCambio}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2 justify-end">
                          <button
                            onClick={() => editarMovimiento(mov)}
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                          >
                            <Edit2 size={14} /> Editar
                          </button>
                          <button
                            onClick={() => eliminarMovimiento(mov.id)}
                            className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                          >
                            <Trash2 size={14} /> Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* =================== PRESUPUESTO VIEW =================== */}
        {vistaActiva === 'presupuesto' && (
          <div className="space-y-3">
            {Object.entries(gastosPorCategoria)
              .filter(([, data]) => data.presupuesto > 0 || data.gastado > 0)
              .sort((a, b) => b[1].presupuesto - a[1].presupuesto)
              .map(([cat, data]) => {
                const pct = data.presupuesto > 0 ? (data.gastado / data.presupuesto) * 100 : (data.gastado > 0 ? 100 : 0);
                const desviacion = data.gastado - data.presupuesto;
                const isExpanded = categoriaExpandida === cat;

                let barColor = 'bg-green-500';
                let textColor = 'text-green-700';
                let bgColor = 'bg-green-50';
                if (pct > 100) {
                  barColor = 'bg-red-500';
                  textColor = 'text-red-700';
                  bgColor = 'bg-red-50';
                } else if (pct > 80) {
                  barColor = 'bg-yellow-500';
                  textColor = 'text-yellow-700';
                  bgColor = 'bg-yellow-50';
                }

                return (
                  <div key={cat} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => setCategoriaExpandida(isExpanded ? null : cat)}
                      className="w-full p-3 sm:p-4 text-left"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-slate-800 text-sm sm:text-base">{cat}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bgColor} ${textColor}`}>
                            {pct.toFixed(0)}%
                          </span>
                          <span className="text-xs text-gray-400">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="bg-gray-200 rounded-full h-2 overflow-hidden mb-2">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${barColor}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>

                      {/* Amounts row */}
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">
                          Gastado: <span className="font-semibold text-slate-700">USD {formatUSD(data.gastado)}</span>
                        </span>
                        <span className="text-slate-500">
                          Presup: <span className="font-semibold text-slate-700">USD {formatUSD(data.presupuesto)}</span>
                        </span>
                      </div>

                      {/* Deviation */}
                      {data.gastado > 0 && (
                        <div className="mt-1 text-xs">
                          {desviacion > 0 ? (
                            <span className="text-red-600 font-medium">Excedido: +USD {formatUSD(desviacion)}</span>
                          ) : desviacion < 0 ? (
                            <span className="text-green-600 font-medium">Disponible: USD {formatUSD(Math.abs(desviacion))}</span>
                          ) : (
                            <span className="text-yellow-600 font-medium">Justo en presupuesto</span>
                          )}
                        </div>
                      )}
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-3 sm:px-4 pb-3 sm:pb-4">
                        {data.movimientos.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-medium text-slate-500 uppercase">Gastos registrados</p>
                            {data.movimientos.map(mov => (
                              <div key={mov.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-1">
                                <div>
                                  <span className="text-xs text-gray-400 mr-2">{mov.fecha}</span>
                                  <span className="text-slate-700">{mov.concepto}</span>
                                  {mov.subcategoria && (
                                    <span className="text-xs text-gray-400 ml-2">({mov.subcategoria})</span>
                                  )}
                                </div>
                                <span className="font-semibold text-slate-800 whitespace-nowrap ml-2">
                                  USD {mov.montoUSD.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 mt-3">Sin gastos registrados en esta categoria</p>
                        )}

                        {/* Subcategories budget breakdown */}
                        {CATEGORIAS[cat] && CATEGORIAS[cat].length > 1 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-slate-500 uppercase mb-2">Desglose presupuesto</p>
                            <div className="space-y-1">
                              {CATEGORIAS[cat].map(sub => {
                                const subBudget = BUDGET_POR_SUBCATEGORIA[sub] || 0;
                                const subGastado = data.movimientos
                                  .filter(m => m.subcategoria === sub)
                                  .reduce((s, m) => s + m.montoUSD, 0);

                                return (
                                  <div key={sub} className="flex justify-between text-xs text-slate-600">
                                    <span className="flex-1">{sub}</span>
                                    <span className="text-slate-400 mx-2">USD {formatUSD(subBudget)}</span>
                                    {subGastado > 0 && (
                                      <span className="font-medium text-slate-700">/ USD {formatUSD(subGastado)} gastado</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* Config floating button */}
        <button
          onClick={() => setMostrarConfig(true)}
          className="fixed bottom-6 right-6 bg-gray-800 text-white p-4 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
          title="Configuracion"
        >
          <Cloud size={24} />
        </button>
      </div>
    </div>
  );
}
