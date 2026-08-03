
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, X, Check } from 'lucide-react';

const CatalogUpload = ({ onCatalogLoaded }) => {
    const [fileName, setFileName] = useState(null);
    const [error, setError] = useState(null);
    const [matches, setMatches] = useState(0);
    const [uploading, setUploading] = useState(false);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.confirm("Al subir un nuevo catálogo, ESTO REEMPLAZARÁ EL CATÁLOGO ANTERIOR para todos los usuarios de la base de datos compartida. ¿Está seguro?")) {
            e.target.value = '';
            return;
        }

        setFileName(file.name);
        setError(null);
        setUploading(true);

        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const workbook = XLSX.read(bstr, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                const cnList = new Set();
                let targetColumn = null;

                const headers = Object.keys(data[0] || {});
                targetColumn = headers.find(h => {
                    if (!h) return false;
                    const low = String(h).toLowerCase().trim();
                    return low === 'cn' ||
                        low.includes('codigo') ||
                        low.includes('código') ||
                        low.includes('nregistro') ||
                        low.includes('national');
                });

                if (targetColumn) {
                    data.forEach(row => {
                        const val = row[targetColumn];
                        if (val) {
                            const normalized = String(val).replace(/\D/g, '');
                            if (normalized.length >= 6) {
                                cnList.add(normalized.substring(0, 6)); // Standard CIMA is 6 digits (ignore check digit)
                            }
                        }
                    });
                }

                if (!targetColumn) {
                    setError('No pude encontrar una columna de "CN" o "Código". Por favor revisa la cabecera de tu archivo.');
                    setUploading(false);
                    return;
                }

                if (cnList.size === 0) {
                    setError('Encontré la columna, pero no pude leer códigos válidos. Asegúrate de que sean números.');
                    setUploading(false);
                    return;
                }

                // POST to Serverless API to Atomic Sync
                const response = await fetch('/api/update-catalog', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ catalogCNs: [...cnList] })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    setError(`Error de sincronización con BBDD: ${errData.error || 'Desconocido'}`);
                    setUploading(false);
                    return;
                }

                setMatches(cnList.size);
                onCatalogLoaded(cnList);

            } catch (err) {
                console.error(err);
                setError('Hubo un error al leer el archivo. Asegúrate de que es un Excel (.xlsx) o CSV válido.');
            } finally {
                setUploading(false);
            }
        };

        reader.readAsBinaryString(file);
    };

    const clearFile = () => {
        setFileName(null);
        setMatches(0);
        setError(null);
        document.getElementById('file-upload').value = '';
    };

    return (
        <div className="catalog-upload glass-panel">
            {!fileName ? (
                <div className="upload-area">
                    <input
                        id="file-upload"
                        type="file"
                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv, .xlsx, .xls"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                    />
                    <label htmlFor="file-upload" className="upload-label">
                        <Upload size={20} />
                        <span>Subir Catálogo de Hospital (Excel/CSV)</span>
                    </label>
                    <p className="upload-hint">Sube tu listado para ver qué medicamentos te afectan. (Debe tener una columna como 'CN', 'Código', etc.)</p>
                </div>
            ) : (
                <div className="file-status">
                    <div className="file-info">
                        <FileSpreadsheet size={20} className="text-success" />
                        {uploading ? (
                            <span className="file-name">Subiendo catálogo general a base de datos...</span>
                        ) : (
                            <span className="file-name">{fileName || 'Catálogo hospitalario sincronizado'}</span>
                        )}
                        {matches > 0 && !uploading && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span className="match-badge"><Check size={14} /> {matches} fármacos cargados</span>
                            </div>
                        )}
                    </div>

                    {error ? (
                        <div className="upload-error">{error}</div>
                    ) : uploading ? (
                        <button disabled className="btn-clear"><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div></button>
                    ) : (
                        <button onClick={clearFile} className="btn-clear" title="Quitar archivo">
                            <X size={18} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default CatalogUpload;
