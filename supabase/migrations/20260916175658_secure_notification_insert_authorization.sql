-- ==============================================================================
-- Migration: 20260916175658_secure_notification_insert_authorization.sql
-- Description: SEC-T01 — Restrict notifications INSERT to authenticated own-sender social types
--
-- Security objectives:
--   1. Drop permissive WITH CHECK (true) policies:
--      - "Allow cross-user message notifications"
--      - "Enable insert access for notifications"
--   2. Drop redundant / open INSERT policy:
--      - "Users can insert notifications"
--   3. Create one precise, restrictive policy for authenticated social notifications:
--      - "authenticated_insert_social_notifications"
--      - Enforces:
--          auth.uid() = sender_id
--          sender_id IS NOT NULL
--          type IN ('message', 'connection', 'friend_request', 'friend_accept', 'group_like', 'group_mention', 'mention')
--   4. Preserve existing SELECT and UPDATE policies on public.notifications intact.
-- ==============================================================================

-- 1. Drop the unsafe and redundant INSERT policies
DROP POLICY IF EXISTS "Allow cross-user message notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable insert access for notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "authenticated_insert_social_notifications" ON public.notifications;

-- 2. Create the precise, hardened authenticated social-notification INSERT policy
CREATE POLICY "authenticated_insert_social_notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND sender_id IS NOT NULL
    AND type IN (
      'message',
      'connection',
      'friend_request',
      'friend_accept',
      'group_like',
      'group_mention',
      'mention',
      'application_message'
    )
  );
