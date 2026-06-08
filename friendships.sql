-- M0 Friend System Foundation
-- Migration Script: friendships.sql

-- 1. Create the friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'removed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add constraints
-- Prevent self-friending (idempotent: drop first if exists)
ALTER TABLE public.friendships 
DROP CONSTRAINT IF EXISTS check_no_self_friending;

ALTER TABLE public.friendships 
ADD CONSTRAINT check_no_self_friending 
CHECK (requester_id <> recipient_id);

-- Prevent duplicate ACTIVE friendship relationships
-- This allows history of rejected/cancelled/removed requests while enforcing only one pending/accepted state.
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_friendship 
ON public.friendships (
    LEAST(requester_id, recipient_id),
    GREATEST(requester_id, recipient_id)
)
WHERE status IN ('pending', 'accepted');

-- 3. Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies (idempotent: drop first if exists)
DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friendships;
CREATE POLICY "Users can view their own friendships"
    ON public.friendships FOR SELECT
    USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can create friend requests" ON public.friendships;
CREATE POLICY "Users can create friend requests"
    ON public.friendships FOR INSERT
    WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Users can update their own friendships" ON public.friendships;
CREATE POLICY "Users can update their own friendships"
    ON public.friendships FOR UPDATE
    USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Explicitly deny DELETE to preserve history
-- (No delete policy created means it defaults to denied under RLS)

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_friendships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_friendships_updated_at ON public.friendships;
CREATE TRIGGER tr_friendships_updated_at
    BEFORE UPDATE ON public.friendships
    FOR EACH ROW
    EXECUTE FUNCTION update_friendships_updated_at();
