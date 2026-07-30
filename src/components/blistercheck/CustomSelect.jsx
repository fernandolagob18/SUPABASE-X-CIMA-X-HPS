import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export default function CustomSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Normaliza texto eliminando tildes/diacríticos para búsqueda insensible a acentos
  const norm = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filteredOptions = options.filter(opt =>
    norm(opt).includes(norm(search))
  );

  return (
    <div className={`bc-custom-select-wrapper ${className}`} ref={wrapperRef}>
      <div 
        className="bc-custom-select-trigger" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="bc-custom-select-value">
          {value || placeholder}
        </span>
        {value && (
          <button 
            type="button" 
            className="bc-custom-select-clear"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown size={16} className="bc-custom-select-icon" />
      </div>

      {isOpen && (
        <div className="bc-custom-select-dropdown">
          <div className="bc-custom-select-search-box">
            <Search size={14} className="bc-custom-select-search-icon" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bc-custom-select-search-input"
              autoFocus
            />
          </div>
          <div className="bc-custom-select-options">
            <div
              className={`bc-custom-select-option ${value === '' ? 'selected' : ''}`}
              onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
            >
              Todas
            </div>
            {filteredOptions.map(opt => (
              <div
                key={opt}
                className={`bc-custom-select-option ${value === opt ? 'selected' : ''}`}
                onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
              >
                {opt}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div className="bc-custom-select-no-results">No hay coincidencias</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
