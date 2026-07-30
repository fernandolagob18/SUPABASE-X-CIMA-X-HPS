/**
 * Pedidos Mínimos Service — Acceso a datos en Supabase
 */

import { supabase } from '../lib/supabase';

const TABLE = 'pedidos_minimos';

/**
 * Obtiene todos los laboratorios ordenados alfabéticamente
 */
export async function getLaboratorios() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('laboratorio', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Crea o actualiza un laboratorio
 * Si tiene id → actualiza; si no → inserta
 */
export async function saveLaboratorio({ id, laboratorio, minimo_eur, notas }) {
  const payload = {
    laboratorio: laboratorio.trim().toUpperCase(),
    minimo_eur: minimo_eur !== '' && minimo_eur !== null && minimo_eur !== undefined
      ? Number(minimo_eur)
      : null,
    notas: notas?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from(TABLE)
      .insert(payload);
    if (error) throw error;
  }
}

/**
 * Elimina un laboratorio por id
 */
export async function deleteLaboratorio(id) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id);

  if (error) throw error;
}
