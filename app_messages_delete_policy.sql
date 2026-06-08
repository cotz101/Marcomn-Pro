-- Enable DELETE for application messages (if RLS is enabled)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'application_messages' 
        AND rowsecurity = true
    ) THEN
        DROP POLICY IF EXISTS "Participants can delete application_messages" ON public.application_messages;
        CREATE POLICY "Participants can delete application_messages"
            ON public.application_messages
            FOR DELETE
            USING (
                EXISTS (
                    SELECT 1 FROM public.application_threads t
                    WHERE t.id = thread_id
                    AND (t.applicant_id = auth.uid() OR t.poster_user_id = auth.uid())
                )
            );
    END IF;
END $$;
