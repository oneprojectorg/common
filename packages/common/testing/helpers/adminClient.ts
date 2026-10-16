import { createClient } from '@supabase/supabase-js';

export const createTestAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

export type TestAdminClient = ReturnType<typeof createTestAdminClient>;
