import React, { useState, useCallback } from 'react';
import { read, utils } from 'xlsx';
import { Calculator, UploadCloud, RefreshCw, AlertCircle, Building2, Euro, ArrowLeft } from 'lucide-react';

function AnalisisEconomicoApp({ onVolver }) {
  const [data, setData] = useState(null);
  const [totalGeneral, setTotalGeneral] = useState(0);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Helper para parsear números que pueden venir como strings con comas
  const parseNumber = (val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleanStr = val.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
      const parsed = parseFloat(cleanStr);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const procesarArchivo = async (file) => {
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convertir a JSON
      const jsonData = utils.sheet_to_json(worksheet, { defval: null });
      
      if (jsonData.length === 0) {
        throw new Error('El archivo está vacío o no se pudo leer correctamente.');
      }

      // Validar cabeceras clave
      const sampleRow = jsonData[0];
      const requiredColumns = ['Cantidad principal', 'Alm. destino', 'Últ. precio'];
      
      const missingColumns = requiredColumns.filter(col => !(col in sampleRow));
      if (missingColumns.length > 0) {
        throw new Error(`El archivo CSV no contiene las columnas necesarias. Faltan: ${missingColumns.join(', ')}`);
      }

      const consumoPorServicio = {};
      let granTotal = 0;

      jsonData.forEach(row => {
        const destino = row['Alm. destino'];
        if (!destino) return; // Ignorar filas sin destino (podrían ser totales o filas vacías)

        const cantidad = parseNumber(row['Cantidad principal']);
        const precio = parseNumber(row['Últ. precio']);
        
        const costeFila = cantidad * precio;

        if (!consumoPorServicio[destino]) {
          consumoPorServicio[destino] = 0;
        }
        
        consumoPorServicio[destino] += costeFila;
        granTotal += costeFila;
      });

      // Convertir el objeto a un array ordenado por gasto (de mayor a menor)
      const resultadosArray = Object.keys(consumoPorServicio)
        .map(servicio => ({
          servicio,
          gasto: consumoPorServicio[servicio],
          porcentaje: granTotal > 0 ? (consumoPorServicio[servicio] / granTotal) * 100 : 0
        }))
        .sort((a, b) => b.gasto - a.gasto); // Orden descendente

      setData(resultadosArray);
      setTotalGeneral(granTotal);
      
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al procesar el archivo. Asegúrate de que es un CSV válido.');
      setData(null);
      setTotalGeneral(0);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      procesarArchivo(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      procesarArchivo(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const formatEuro = (value) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  };

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Botón de volver */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.5rem' }}>
        <button
          onClick={onVolver}
          className="bc-back-btn"
          title="Volver al menú principal"
        >
          <ArrowLeft size={18} style={{ marginRight: '0.4rem' }} />
          Volver al menú de inicio
        </button>
      </div>

      <div className="ae-container">
        {/* Cabecera */}
        <div className="ae-header glass-panel">
          <div className="ae-header-icon">
            <Calculator size={28} />
          </div>
          <div>
            <h2>Análisis Económico de Consumos</h2>
            <p>Sube un archivo de consumos para calcular el gasto por servicio o unidad destino (Base Imponible sin IVA).</p>
          </div>
        </div>

        {error && (
          <div className="ae-error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {!data ? (
          /* Zona de Carga */
          <label 
            className={`ae-upload-zone ${isDragging ? 'drag-active' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input 
              type="file" 
              accept=".csv,.xlsx,.xls" 
              onChange={handleFileUpload} 
              style={{ display: 'none' }} 
            />
            <UploadCloud size={48} className="ae-upload-icon" />
            <p className="ae-upload-text">Haz clic aquí o arrastra tu archivo de consumos</p>
            <p className="ae-upload-subtext">Soporta CSV, XLS, XLSX</p>
          </label>
        ) : (
          /* Resultados */
          <>
            <div className="ae-summary-row">
              <div className="ae-summary-card glass-panel">
                <div className="ae-summary-icon-wrap" style={{ color: '#0ea5e9', background: 'rgba(14, 165, 233, 0.1)' }}>
                  <Building2 size={24} />
                </div>
                <div className="ae-summary-info">
                  <span className="ae-summary-value">{data.length}</span>
                  <span className="ae-summary-label">Servicios Distintos</span>
                </div>
              </div>
              <div className="ae-summary-card glass-panel">
                <div className="ae-summary-icon-wrap" style={{ color: '#10b981', background: 'rgba(16, 185, 137, 0.1)' }}>
                  <Euro size={24} />
                </div>
                <div className="ae-summary-info">
                  <span className="ae-summary-value">{formatEuro(totalGeneral)}</span>
                  <span className="ae-summary-label">Gasto Total (Sin IVA)</span>
                </div>
              </div>
            </div>

            <div className="ae-table-container glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-card-border)' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>Desglose por Servicio</h3>
                <button className="ae-btn-reset" onClick={() => { setData(null); setTotalGeneral(0); }}>
                  <RefreshCw size={16} />
                  Analizar otro archivo
                </button>
              </div>
              <table className="ae-table">
                <thead>
                  <tr>
                    <th className="ae-table-rank">#</th>
                    <th>Servicio / Alm. destino</th>
                    <th className="ae-table-amount">Gasto (€)</th>
                    <th className="ae-table-percentage">% Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, index) => (
                    <tr key={item.servicio}>
                      <td className="ae-table-rank">{index + 1}</td>
                      <td className="ae-table-service">{item.servicio}</td>
                      <td className="ae-table-amount">{formatEuro(item.gasto)}</td>
                      <td className="ae-table-percentage">{item.porcentaje.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AnalisisEconomicoApp;
