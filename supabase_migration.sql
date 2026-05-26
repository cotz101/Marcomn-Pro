-- =====================================================================
-- PHASE 2: DATA LAYER NORMALIZATION MIGRATION SCRIPT (REVISED)
-- =====================================================================
-- DESCRIPTION: Creates the scalable threaded chat schema (group_threads, 
--              group_thread_messages, message_attachments, thread_participants)
--              with RLS, indexing, soft-deletes, and updated_at triggers.
--              NO database-level dual-write synchronization triggers are 
--              defined. All write logic is handled explicitly at the 
--              application layer for superior maintainability and debugging.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CLEANUP / PREPARATION
-- ---------------------------------------------------------------------
-- (Safe to run multiple times; only drops if exists)
DROP TRIGGER IF EXISTS tr_sync_posts_to_threads ON group_posts;
DROP TRIGGER IF EXISTS tr_sync_comments_to_messages ON group_comments;
DROP FUNCTION IF EXISTS sync_post_to_thread();
DROP FUNCTION IF EXISTS sync_comment_to_message();
DROP FUNCTION IF EXISTS is_group_member(UUID, UUID);
DROP FUNCTION IF EXISTS is_group_admin(UUID, UUID);

-- ---------------------------------------------------------------------
-- 2. CREATE NORMALIZED TABLES
-- ---------------------------------------------------------------------

-- Table A: group_threads (Topic threads are the primary entities)
CREATE TABLE IF NOT EXISTS group_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_archived BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Table B: group_thread_messages (Must always associate with a valid existing thread)
CREATE TABLE IF NOT EXISTS group_thread_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES group_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Table C: message_attachments
CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES group_thread_messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table D: thread_participants
CREATE TABLE IF NOT EXISTS thread_participants (
    thread_id UUID NOT NULL REFERENCES group_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (thread_id, user_id)
);

-- ---------------------------------------------------------------------
-- 3. CREATE PERFORMANCE-TUNED INDEXES
-- ---------------------------------------------------------------------
-- Fast retrieval of threads in a group, ranked by most recent message:
CREATE INDEX IF NOT EXISTS idx_group_threads_group_id_last_msg 
ON group_threads(group_id, last_message_at DESC) 
WHERE is_deleted = false AND is_archived = false;

-- Fast chronological feed loading within an active chat thread:
CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id_created 
ON group_thread_messages(thread_id, created_at ASC) 
WHERE is_deleted = false;

-- Fast participant index:
CREATE INDEX IF NOT EXISTS idx_thread_participants_user_id 
ON thread_participants(user_id);

-- Fast attachment mapping index:
CREATE INDEX IF NOT EXISTS idx_message_attachments_msg_id 
ON message_attachments(message_id);

-- ---------------------------------------------------------------------
-- 4. TIMESTAMPS & AUTOMATED TRIGGER LOGIC
-- ---------------------------------------------------------------------

-- Helper to keep updated_at columns synced
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS tr_group_threads_updated_at ON group_threads;
CREATE TRIGGER tr_group_threads_updated_at
    BEFORE UPDATE ON group_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_group_thread_messages_updated_at ON group_thread_messages;
CREATE TRIGGER tr_group_thread_messages_updated_at
    BEFORE UPDATE ON group_thread_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Bumps last_message_at ranking on the parent thread when a new message is inserted
CREATE OR REPLACE FUNCTION bump_thread_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE group_threads
    SET last_message_at = NEW.created_at
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_bump_thread_last_message_at ON group_thread_messages;
CREATE TRIGGER tr_bump_thread_last_message_at
    AFTER INSERT ON group_thread_messages
    FOR EACH ROW EXECUTE FUNCTION bump_thread_last_message_at();

-- ---------------------------------------------------------------------
-- 5. EXPLICIT ROLE-BASED ACCESS & RLS POLICIES
-- ---------------------------------------------------------------------

-- Security-definer function to validate if a user is a group admin/owner
CREATE OR REPLACE FUNCTION is_group_admin(check_user_id UUID, check_group_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM groups 
        WHERE id = check_group_id 
          AND owner_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql;

-- Security-definer function to validate general group membership
CREATE OR REPLACE FUNCTION is_group_member(check_user_id UUID, check_group_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM group_members 
        WHERE group_id = check_group_id 
          AND user_id = check_user_id 
          AND status = 'member'
    ) OR EXISTS (
        SELECT 1 
        FROM groups 
        WHERE id = check_group_id 
          AND owner_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE group_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_participants ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- A. RLS Policies for: group_threads
-- ---------------------------------------------------------------------
-- View: Members can view active threads
CREATE POLICY "Members can view threads" ON group_threads
    FOR SELECT TO authenticated
    USING (is_group_member(auth.uid(), group_id) AND NOT is_deleted);

-- Create: Members can create threads
CREATE POLICY "Members can create threads" ON group_threads
    FOR INSERT TO authenticated
    WITH CHECK (is_group_member(auth.uid(), group_id) AND auth.uid() = created_by);

-- Modify: Thread owners (created_by) or group admins can update/soft-delete
CREATE POLICY "Thread owners or group admins can modify threads" ON group_threads
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = created_by 
        OR is_group_admin(auth.uid(), group_id)
    );

-- ---------------------------------------------------------------------
-- B. RLS Policies for: group_thread_messages
-- ---------------------------------------------------------------------
-- View: Members can read messages in their group threads
CREATE POLICY "Members can read messages" ON group_thread_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM group_threads 
            WHERE id = thread_id AND is_group_member(auth.uid(), group_id)
        )
        AND NOT is_deleted
    );

-- Create: Members can post messages in their group threads
CREATE POLICY "Members can write messages" ON group_thread_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_threads 
            WHERE id = thread_id AND is_group_member(auth.uid(), group_id)
        )
        AND auth.uid() = user_id
    );

-- Modify: Sender (user_id) can edit/delete own message, group admin can delete/moderate
CREATE POLICY "Senders or group admins can modify messages" ON group_thread_messages
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM group_threads gt
            WHERE gt.id = thread_id AND is_group_admin(auth.uid(), gt.group_id)
        )
    );

-- ---------------------------------------------------------------------
-- C. RLS Policies for: message_attachments
-- ---------------------------------------------------------------------
CREATE POLICY "Users can view attachments if they can view messages" ON message_attachments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM group_thread_messages 
            WHERE id = message_id
        )
    );

CREATE POLICY "Users can insert attachments for their own messages" ON message_attachments
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_thread_messages 
            WHERE id = message_id AND user_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------
-- D. RLS Policies for: thread_participants
-- ---------------------------------------------------------------------
CREATE POLICY "Users can manage their own participant records" ON thread_participants
    FOR ALL TO authenticated
    USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 6. ENABLE SUPABASE REALTIME REPLICATION
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table group_thread_messages;

-- ---------------------------------------------------------------------
-- 7. SEED DATA MIGRATION (ONE-TIME INITIAL POPULATION)
-- ---------------------------------------------------------------------
-- Seed threads from legacy posts
INSERT INTO group_threads (id, group_id, created_by, title, created_at, updated_at, last_message_at)
SELECT id, group_id, user_id, content, created_at, created_at, created_at
FROM group_posts
ON CONFLICT (id) DO NOTHING;

-- Seed messages from legacy comments
INSERT INTO group_thread_messages (id, thread_id, user_id, content, created_at, updated_at)
SELECT id, post_id, user_id, content, created_at, created_at
FROM group_comments
ON CONFLICT (id) DO NOTHING;

-- Seed attachments for legacy files if stored as arrays
INSERT INTO message_attachments (message_id, file_url, file_type, file_name)
SELECT 
    c.id as message_id, 
    unnest(p.file_urls) as file_url, 
    'file' as file_type, 
    'Legacy Attachment' as file_name
FROM group_comments c
JOIN group_posts p ON c.post_id = p.id
WHERE p.file_urls IS NOT NULL AND array_length(p.file_urls, 1) > 0
ON CONFLICT DO NOTHING;

-- Seed participants for existing thread creators
INSERT INTO thread_participants (thread_id, user_id, joined_at)
SELECT id, created_by, created_at
FROM group_threads
ON CONFLICT DO NOTHING;
