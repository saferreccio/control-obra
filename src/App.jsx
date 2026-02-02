import React, { useState, useEffect } from 'react';
import { Download, Plus, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ConstruccionTracker() {
  const [movimientos, setMovimientos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState('gasto');
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    categoria: 'materiales',
    montoPesos: '',
    montoUSD: '',
    tipoCambio: '',
    moneda: 'USD',
    notas: ''
  });

  // Cargar datos del localStorage al iniciar
  useEffect(() => {
    const datosGuardados = localStorage.getItem('construccion-movimientos');
    if (datosGuardados) {
      setMovimientos(JSON.parse(datosGuardados));
    }
  }, []);

  // Guardar en localStorage cada vez que cambian los movimientos
  useEffect(() => {
    if (movimientos.length > 0) {
      localStorage.setItem('construccion-movimientos', JSON.stringify(movimientos));
    }
  }, [movimientos]);

  const categorias = {
    gasto: ['Materiales', 'Mano de obra', 'Honorarios', 'Permisos', 'Servicios', 'Otros'],
    entrega: ['Entrega arquitecto', 'Anticipo', 'Pago parcial']
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };

    // Si cambia el monto en pesos o el tipo de cambio, calcular USD automáticamente
    if (name === 'montoPesos' || name === 'tipoCambio') {
      const pesos = parseFloat(name === 'montoPesos' ? value : formData.montoPesos) || 0;
      const tc = parseFloat(name === 'tipoCambio' ? value : formData.tipoCambio) || 0;
      if (pesos > 0 && tc > 0) {
        newFormData.montoUSD = (pesos / tc).toFixed(2);
      }
    }

    setFormData(newFormData);
  };

  const agregarMovimiento = () => {
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

    setMovimientos([...movimientos, nuevoMovimiento].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
    
    // Resetear form
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      categoria: 'materiales',
      montoPesos: '',
      montoUSD: '',
      tipoCambio: '',
      moneda: 'USD',
      notas: ''
    });
    setMostrarForm(false);
  };

  const eliminarMovimiento = (id) => {
    if (confirm('¿Seguro que querés eliminar este movimiento?')) {
      setMovimientos(movimientos.filter(m => m.id !== id));
    }
  };

  const descargarExcel = () => {
    const datosExcel = movimientos.map(m => ({
      Fecha: m.fecha,
      Tipo: m.tipo === 'gasto' ? 'Gasto' : 'Entrega',
      Concepto: m.concepto,
      Categoría: m.categoria,
      'Monto ARS': m.montoPesos || '-',
      'Tipo Cambio': m.tipoCambio || '-',
      'Monto USD': m.montoUSD,
      Notas: m.notas || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    
    const fechaHoy = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `construccion-${fechaHoy}.xlsx`);
  };

  const totales = {
    gastosUSD: movimientos.filter(m => m.tipo === 'gasto').reduce((sum, m) => sum + m.montoUSD, 0),
    entregasUSD: movimientos.filter(m => m.tipo === 'entrega').reduce((sum, m) => sum + m.montoUSD, 0)
  };

  const saldoUSD = totales.entregasUSD - totales.gastosUSD;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Control de Obra</h1>
              <p className="text-slate-600 mt-1">Registro de gastos y entregas</p>
            </div>
            <button
              onClick={descargarExcel}
              disabled={movimientos.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={20} />
              Descargar Excel
            </button>
          </div>

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
            
            {/* Tipo de movimiento */}
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
                      <option key={cat} value={cat.toLowerCase()}>{cat}</option>
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas (opcional)</label>
                <textarea
                  name="notas"
                  value={formData.notas}
                  onChange={handleInputChange}
                  placeholder="Detalles adicionales..."
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

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
              <p className="text-sm text-gray-400 mt-2">Agregá tu primer movimiento para comenzar</p>
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
                    {mov.notas && (
                      <p className="text-sm text-gray-600 mt-1">{mov.notas}</p>
                    )}
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
                    <button
                      onClick={() => eliminarMovimiento(mov.id)}
                      className="text-xs text-red-600 hover:text-red-800 mt-2"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
