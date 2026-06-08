-- messaging_permissions.sql
-- Stage M0B: Direct Messaging Database Security Trigger

-- 1. Conversation Creation Permission Trigger
-- Enforces that conversations can only be created by participants who have an accepted friendship.
-- Also ensures the creator is actually one of the participants.

CREATE OR REPLACE FUNCTION check_conversation_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Require the inserting user to be one of the participants
  -- This inherently blocks company IDs since auth.uid() is the personal profile ID
  IF auth.uid() != NEW.participant_one AND auth.uid() != NEW.participant_two THEN
    RAISE EXCEPTION 'You can only create conversations for yourself.';
  END IF;

  -- Ensure an accepted friendship exists between the two participants
  IF NOT EXISTS (
    SELECT 1 FROM friendships
    WHERE (
      (requester_id = NEW.participant_one AND recipient_id = NEW.participant_two)
      OR 
      (requester_id = NEW.participant_two AND recipient_id = NEW.participant_one)
    )
    AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Direct messaging requires an accepted friendship.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_conversation_permissions ON conversations;

CREATE TRIGGER tr_check_conversation_permissions
BEFORE INSERT ON conversations
FOR EACH ROW
EXECUTE FUNCTION check_conversation_permissions();


-- 2. Message Insertion Permission Trigger
-- Enforces that messages can only be sent into existing conversations where the user is a participant
-- and the friendship is still active (accepted).

CREATE OR REPLACE FUNCTION check_message_permissions()
RETURNS TRIGGER AS $$
DECLARE
  v_participant_one UUID;
  v_participant_two UUID;
BEGIN
  -- Require the inserting user to be the sender
  IF auth.uid() != NEW.sender_id THEN
    RAISE EXCEPTION 'You can only send messages as yourself.';
  END IF;

  -- Fetch conversation participants
  SELECT participant_one, participant_two 
  INTO v_participant_one, v_participant_two 
  FROM conversations 
  WHERE id = NEW.conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found.';
  END IF;

  -- Ensure the sender is actually a participant in the conversation
  IF NEW.sender_id != v_participant_one AND NEW.sender_id != v_participant_two THEN
    RAISE EXCEPTION 'You are not a participant in this conversation.';
  END IF;

  -- Ensure the friendship is STILL accepted (in case it was removed after conversation was created)
  IF NOT EXISTS (
    SELECT 1 FROM friendships
    WHERE (
      (requester_id = v_participant_one AND recipient_id = v_participant_two)
      OR 
      (requester_id = v_participant_two AND recipient_id = v_participant_one)
    )
    AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Active friendship is required to send messages.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_message_permissions ON messages;

CREATE TRIGGER tr_check_message_permissions
BEFORE INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION check_message_permissions();

-- Note: These triggers intentionally do NOT apply to group_threads, group_thread_messages,
-- or any future application messaging structures. They are strictly for direct conversations.
