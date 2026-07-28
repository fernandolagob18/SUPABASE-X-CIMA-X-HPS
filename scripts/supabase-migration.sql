-- Migración a Supabase (Tablas y RLS)

-- 1. Tabla: catalogo_hospital
CREATE TABLE IF NOT EXISTS public.catalogo_hospital (
    cn VARCHAR PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.catalogo_hospital ENABLE ROW LEVEL SECURITY;

-- Políticas para catalogo_hospital
-- Permite lectura pública (anon/authenticated)
CREATE POLICY "Lectura pública de catalogo"
    ON public.catalogo_hospital
    FOR SELECT
    TO authenticated
    USING (true);

-- Insert/Delete/Update restringido a service_role
-- (no se define política pública, por defecto deniega a anon/authenticated)
-- Nota: Service Role hace bypass de RLS por defecto.

-- 2. Tabla: seguimiento_medicamentos
CREATE TABLE IF NOT EXISTS public.seguimiento_medicamentos (
    cn VARCHAR PRIMARY KEY REFERENCES public.catalogo_hospital(cn) ON DELETE CASCADE,
    estado_gestion BOOLEAN DEFAULT false,
    notas_seguimiento TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.seguimiento_medicamentos ENABLE ROW LEVEL SECURITY;

-- Políticas para seguimiento_medicamentos
-- Permite lectura, inserción y modificación a cualquier usuario de la aplicación
CREATE POLICY "Lectura y escritura pública de seguimiento"
    ON public.seguimiento_medicamentos
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Revocar permisos de DELETE explícitamente (o simplemente no crear política DELETE public)
-- En Supabase "FOR ALL" incluye delete. Para restringir delete, creamos las otras 3 por separado.
DROP POLICY IF EXISTS "Lectura y escritura pública de seguimiento" ON public.seguimiento_medicamentos;

CREATE POLICY "Lectura pública de seguimiento" ON public.seguimiento_medicamentos FOR SELECT USING (true);
CREATE POLICY "Inserción pública de seguimiento" ON public.seguimiento_medicamentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización pública de seguimiento" ON public.seguimiento_medicamentos FOR UPDATE USING (true) WITH CHECK (true);
-- Sin política de DELETE, por tanto está prohibido para el cliente web (anon).

-- 3. Tabla: desabastecimientos_activos
CREATE TABLE IF NOT EXISTS public.desabastecimientos_activos (
    cn VARCHAR PRIMARY KEY,
    nombre TEXT,
    observaciones TEXT,
    fecha_inicio BIGINT,
    fecha_fin BIGINT,
    criticidad VARCHAR,
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.desabastecimientos_activos ENABLE ROW LEVEL SECURITY;

-- Políticas para desabastecimientos_activos
-- Lectura pública para el frontend
CREATE POLICY "Lectura pública de desabastecimientos"
    ON public.desabastecimientos_activos
    FOR SELECT
    TO authenticated
    USING (true);

-- El script Node.js usa service_role y podrá hacer INSERT/UPDATE/DELETE.
