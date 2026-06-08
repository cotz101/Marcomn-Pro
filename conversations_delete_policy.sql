-- Enable DELETE for direct conversations (if RLS is enabled)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'conversations' 
        AND rowsecurity = true
    ) THEN
        DROP POLICY IF EXISTS "Participants can delete conversations" ON public.conversations;
        CREATE POLICY "Participants can delete conversations"
            ON public.conversations
            FOR DELETE
            USING (auth.uid() = participant_one OR auth.uid() = participant_two);
    END IF;
END $$;
