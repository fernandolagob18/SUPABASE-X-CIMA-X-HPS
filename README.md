# 🏥 HPS Suite — Herramientas de Farmacia Hospitalaria (Versión Web HTML Autónoma)

Suite web de herramientas de gestión y consulta clínica para servicios de **Farmacia Hospitalaria**, reestructurada como una **aplicación web estática en un único archivo HTML autocontenido**, sin dependencias de Node.js, Vercel, Supabase ni GitHub.

---

## 🚀 Uso Rápido (Cero Instalación)

1. Abre el archivo **[`index.html`](./index.html)** (o **[`hps-suite.html`](./hps-suite.html)**) haciendo **doble clic** directamente desde el Explorador de Windows.
2. Se abrirá en tu navegador habitual (Microsoft Edge, Google Chrome, Firefox, etc.) al instante (`file:///...`).
3. **No requiere internet ni conexión a ningún servidor**: funciona 100% desconectado y offline.
4. Puedes copiar el archivo `index.html` a cualquier carpeta compartida, intranet o memoria USB.

---

## ✨ Módulos Incluidos

### 1. ☣️ Guía NIOSH 2024
* **Buscador en tiempo real**: Localización inmediata de medicamentos peligrosos por nombre o principio activo.
* **Clasificación NIOSH**:
  * **Tabla 1**: Antineoplásicos / MSHI (Información Especial de Manejo) / Citotóxicos.
  * **Tabla 2**: Fármacos con riesgo reproductivo / toxicidad específica.
* **Guía SNG Integrada**: Indicaciones y precauciones para la administración por Sonda Nasogástrica y nutrición enteral, con protocolos de dispersión y fármacos incompatibles.
* **Bibliografía oficial**: Referencias de NIOSH 2024, AEMPS y SEFH accesibles en modal.

### 2. 📦 Pedidos Mínimos
* **Gestión de umbrales sin IVA**: Consulta, alta, modificación y eliminación de importes mínimos por laboratorio proveedor.
* **Categorización visual por colores**:
  * ⚪ **Sin mínimo**: Proveedor sin importe mínimo de pedido.
  * 🟡 **≤ 75 €**: Nivel amarillo.
  * 🟠 **≤ 150 €**: Nivel naranja.
  * 🔴 **> 150 €**: Nivel rojo.
* **Almacenamiento Local Seguro**: Todos los datos se guardan en el navegador (`localStorage`), sin viajar por la red.
* **Copias de Seguridad**:
  * 📥 **Exportar a Excel**: Descarga la base de datos en formato `.xlsx`.
  * 📥 **Backup JSON**: Descarga copia completa de seguridad.
  * 📤 **Importar**: Permite cargar o fusionar datos desde archivos Excel o JSON de otros equipos.

### 3. 📊 Análisis Económico
* **Motor SheetJS embebido**: Procesa hojas de cálculo directamente en la memoria del navegador.
* **Consumos por Servicio**:
  * Analiza consumos con columnas: `Cantidad principal`, `Alm. destino` y `Últ. precio`.
  * Calcula el gasto neto total sin IVA y el porcentaje imputable a cada servicio/unidad.
* **Compras por Proveedor**:
  * Filtra automáticamente compras de almacén `FARMACIA` a partir de `Almacén`, `Total c/IVA` y `Proveedor`.
  * Desglose porcentual y ranking por proveedor.
* **Utilidades**: Botón para copiar resumen al portapapeles y exportar el informe final a Excel (`.xlsx`).

---

## 🛠️ Tecnologías y Características Técnicas

* **Formato**: 1 archivo HTML autocontenido (HTML5 + CSS3 nativo + JavaScript ES6).
* **Motor Excel**: SheetJS (`xlsx.full.min.js`) inyectado en línea (624 KB).
* **Iconografía**: Gráficos vectoriales SVG en línea puros (cero peticiones externas).
* **Modo Oscuro / Claro**: Selector integrado en la cabecera con guardado automático de preferencia.
* **Compatibilidad**: Compatible con redes hospitalarias cerradas con restricciones de proxy/firewall.
