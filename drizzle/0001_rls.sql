-- Tie every row to a Supabase auth user and turn on Row Level Security.
-- The app connects as the postgres role (bypasses RLS) and always filters by user_id itself;
-- these policies are the safety net for anything that reaches the Data API with the publishable key.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['exercises','folders','lists','sessions','sets','imports','api_tokens']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE', t, t || '_user_fk');
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)', t || '_owner', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- Tables without their own user_id inherit ownership from their parent row.
ALTER TABLE public.list_exercises ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY list_exercises_owner ON public.list_exercises FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.user_id = (select auth.uid())));
--> statement-breakpoint
ALTER TABLE public.multisets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY multisets_owner ON public.multisets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = (select auth.uid())));
--> statement-breakpoint

-- api_tokens hold hashes only, but never expose them through the Data API at all.
DROP POLICY api_tokens_owner ON public.api_tokens;
