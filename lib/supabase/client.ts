import { createBrowserClient } from '@supabase/ssr';

// El cliente sin genérico Database evita el problema de tipos `never`
// en queries relacionales. Los tipos de retorno se anotan manualmente
// en cada page/component usando las interfaces de types/database.ts.
//
// Se usan fallbacks durante el pre-renderizado estático en build (cuando
// las vars NEXT_PUBLIC_* aún no están embebidas) para evitar un throw fatal.
// En producción las vars reales son inyectadas por Next.js en el bundle.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createBrowserClient(url, anonKey);
}
