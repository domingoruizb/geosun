import { createBrowserClient } from '@supabase/ssr';

// El cliente sin genérico Database evita el problema de tipos `never`
// en queries relacionales. Los tipos de retorno se anotan manualmente
// en cada page/component usando las interfaces de types/database.ts
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
