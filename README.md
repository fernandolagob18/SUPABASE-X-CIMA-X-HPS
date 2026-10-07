# 🏥 HPS Suite — Herramientas de Farmacia Hospitalaria

Suite web de herramientas de gestión y consulta para servicios de Farmacia Hospitalaria.

## ✨ Módulos Incluidos

- ☣️ **Guía NIOSH 2024** — Buscador y clasificador de medicamentos peligrosos para el personal sanitario y farmacia hospitalaria según los grupos NIOSH (antineoplásicos, no antineoplásicos, riesgo reproductivo) con alertas MSHI (Información Especial de Manejo).
- 📦 **Pedidos Mínimos** — Gestión de importes mínimos de pedido por laboratorio proveedor con umbrales sin IVA, notas de compra y categorización por alertas de importe.
- 📊 **Análisis Económico** — Procesador de consumos por servicio y facturas/compras por proveedor a partir de hojas de cálculo (CSV, XLS, XLSX) con cálculo automático del importe neto y desglose porcentual.

## 🛠️ Tecnologías

| Componente | Tecnología |
|---|---|
| Frontend | React 19 + Vite |
| Estilos | CSS nativo con variables + Soporte Dark Mode |
| Iconos | Lucide React |
| Procesamiento de Hojas de Cálculo | SheetJS (xlsx) |
| Backend & Autenticación | Supabase (Auth + PostgreSQL) |
| Servidor & Middleware | Vercel Edge Functions + jose (JWT verification) |

---

## 🚀 Instalación y Desarrollo Local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Compilar para producción
npm run build
```
