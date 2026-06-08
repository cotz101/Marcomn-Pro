-- MarComn Stage M1B: Application Messaging Schema (Revised)
-- This script creates a secure, isolated messaging path for job applications.
-- It explicitly bypasses friend-only Direct Messaging to allow companies and applicants to communicate.

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS public.application_threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    
    -- poster_user_id maps to the profile of the user who posted the job
    poster_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Optional reference to the actual company record (if any)
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    
    -- applicant_id maps to the profile of the applicant
    applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(application_id) -- Only one thread per application
);

CREATE TABLE IF NOT EXISTS public.application_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES public.application_threads(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.application_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for application_threads
-- Thread participants (poster or applicant) can read the thread
DROP POLICY IF EXISTS "Participants can read application_threads" ON public.application_threads;
CREATE POLICY "Participants can read application_threads"
    ON public.application_threads
    FOR SELECT
    USING (auth.uid() = applicant_id OR auth.uid() = poster_user_id);

-- Thread participants can insert the thread
DROP POLICY IF EXISTS "Participants can insert application_threads" ON public.application_threads;
CREATE POLICY "Participants can insert application_threads"
    ON public.application_threads
    FOR INSERT
    WITH CHECK (auth.uid() = applicant_id OR auth.uid() = poster_user_id);

-- Thread participants can delete the thread
DROP POLICY IF EXISTS "Participants can delete application_threads" ON public.application_threads;
CREATE POLICY "Participants can delete application_threads"
    ON public.application_threads
    FOR DELETE
    USING (auth.uid() = applicant_id OR auth.uid() = poster_user_id);

-- 4. RLS Policies for application_messages
-- Thread participants can read messages
DROP POLICY IF EXISTS "Participants can read application_messages" ON public.application_messages;
CREATE POLICY "Participants can read application_messages"
    ON public.application_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.application_threads t
            WHERE t.id = thread_id
            AND (t.applicant_id = auth.uid() OR t.poster_user_id = auth.uid())
        )
    );

-- Sender can insert their own messages
DROP POLICY IF EXISTS "Sender can insert application_messages" ON public.application_messages;
CREATE POLICY "Sender can insert application_messages"
    ON public.application_messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.application_threads t
            WHERE t.id = thread_id
            AND (t.applicant_id = auth.uid() OR t.poster_user_id = auth.uid())
        )
    );

-- 5. Trigger: Block Messages for Invalid Application Statuses
CREATE OR REPLACE FUNCTION public.check_application_messaging_status()
RETURNS TRIGGER AS $$
DECLARE
    app_status text;
    normalized_status text;
BEGIN
    -- Fetch the application status securely based on the thread
    SELECT a.status INTO app_status
    FROM public.applications a
    JOIN public.application_threads t ON a.id = t.application_id
    WHERE t.id = NEW.thread_id;

    -- Normalize status to lowercase, replace spaces with underscores for safe comparison
    normalized_status := LOWER(REPLACE(app_status, ' ', '_'));

    IF normalized_status NOT IN ('shortlisted', 'accepted', 'active_engagement') THEN
        RAISE EXCEPTION 'Messaging is only allowed for Shortlisted, Accepted, or Active Engagement applications. Current status: %', app_status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_application_messaging_status ON public.application_messages;
CREATE TRIGGER enforce_application_messaging_status
    BEFORE INSERT ON public.application_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.check_application_messaging_status();

-- 6. Trigger: Update last_message_at on the thread
CREATE OR REPLACE FUNCTION public.update_app_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.application_threads
    SET last_message_at = NEW.created_at,
        updated_at = NEW.created_at
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_app_thread_timestamp ON public.application_messages;
CREATE TRIGGER update_app_thread_timestamp
    AFTER INSERT ON public.application_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_app_thread_last_message();

-- Enable realtime subscriptions (Idempotent approach via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'application_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.application_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'application_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.application_threads;
  END IF;
END $$;
