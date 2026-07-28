-- =============================================
-- CIMA Watch — Supabase Database Setup
-- =============================================
-- Run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================

-- Table: subscriptions
-- Stores email recipients and catalog CNs for each hospital
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    emails TEXT[] NOT NULL DEFAULT '{}',
    catalog_cns TEXT[] NOT NULL DEFAULT '{}',
    hospital_name TEXT DEFAULT 'Hospital',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: snapshots
-- Stores daily shortage snapshots for comparison
CREATE TABLE IF NOT EXISTS snapshots (
    id SERIAL PRIMARY KEY,
    subscription_id INT REFERENCES subscriptions(id) ON DELETE CASCADE,
    shortage_cns TEXT[] NOT NULL DEFAULT '{}',
    shortage_data JSONB DEFAULT '{}',
    snapshot_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster snapshot lookups
CREATE INDEX IF NOT EXISTS idx_snapshots_sub_date 
    ON snapshots(subscription_id, snapshot_date DESC);

-- Enable Row Level Security (required by Supabase)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- =============================================

--- POLÍTICAS PARA: subscriptions ---

-- Permitir que solo el personal logueado vea y gestione los emails/catálogos
CREATE POLICY "Gestion total para personal logueado"
    ON public.subscriptions
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

--- POLÍTICAS PARA: snapshots ---

-- Permitir que el personal logueado consulte el historial de desabastecimientos
CREATE POLICY "Consulta historial para personal logueado"
    ON public.snapshots
    FOR SELECT
    TO authenticated
    USING (true);
