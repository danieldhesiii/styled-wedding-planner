import { createClient } from "@supabase/supabase-js";

// Browser Supabase client. The publishable (anon) key is safe to expose; row-level
// security on the database enforces that a planner only ever sees their own rows.
// Session is persisted in the browser so the planner stays logged in.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
