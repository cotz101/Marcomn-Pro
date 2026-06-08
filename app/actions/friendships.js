'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { logPlatformAdminAction } from '@/lib/adminAuditLogger';

/**
 * Creates a Supabase client for Server Actions.
 * Assuming standard Next.js app router structure with cookie handling.
 * If @/lib/supabase/server isn't standard, we'll need to adapt it, 
 * but looking at existing codebase, usually we have a way to create a client.
 * Actually, let's use the pattern from other actions.
 */

export async function sendFriendRequest(recipientId) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');
  if (user.id === recipientId) throw new Error('Cannot friend yourself');

  // Validate both are personal profiles (not companies)
  // Since we only check profiles, company accounts are not in `profiles` directly 
  // wait, companies are in `companies` table, users are in `profiles`. 
  // recipientId MUST be a profile.
  const { data: recipientProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', recipientId)
    .single();

  if (profileErr || !recipientProfile) {
    throw new Error('Recipient must be a personal profile.');
  }

  // Check for existing active relationship (pending or accepted)
  const { data: existing, error: existingErr } = await supabase
    .from('friendships')
    .select('id, status')
    .or(`and(requester_id.eq.${user.id},recipient_id.eq.${recipientId}),and(requester_id.eq.${recipientId},recipient_id.eq.${user.id})`)
    .in('status', ['pending', 'accepted'])
    .maybeSingle();

  if (existing) {
    throw new Error(`An active friendship or request already exists (${existing.status}).`);
  }

  // Insert the pending request
  const { data: friendship, error: insertErr } = await supabase
    .from('friendships')
    .insert({
      requester_id: user.id,
      recipient_id: recipientId,
      status: 'pending'
    })
    .select('id')
    .single();

  if (insertErr) throw new Error('Failed to send friend request: ' + insertErr.message);

  // Send Notification
  try {
    await supabase.from('notifications').insert({
      recipient_id: recipientId,
      sender_id: user.id,
      type: 'friend_request',
      title: 'New Friend Request',
      body: 'Sent you a friend request.',
      link: '/network/connections', // Go to requests tab ideally
      is_read: false
    });
  } catch (err) {
    console.error('Notification error:', err);
  }

  // Log audit to platform_admin_audit_logs
  try {
    await logPlatformAdminAction({
      actorUserId: user.id,
      actionKey: 'friend.request_sent',
      targetType: 'user',
      targetId: recipientId,
      details: { recipient_id: recipientId, friendship_id: friendship.id }
    });
  } catch(e) { console.error('Audit log error', e); }

  revalidatePath('/network/connections');
  return { success: true, friendshipId: friendship.id };
}

export async function acceptFriendRequest(requestId) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify the request exists and is directed to the current user
  const { data: req, error: reqErr } = await supabase
    .from('friendships')
    .select('id, requester_id, recipient_id, status')
    .eq('id', requestId)
    .single();

  if (reqErr || !req) throw new Error('Friend request not found');
  if (req.recipient_id !== user.id) throw new Error('You are not the recipient of this request');
  if (req.status !== 'pending') throw new Error('Request is not pending');

  const { error: updateErr } = await supabase
    .from('friendships')
    .update({ 
      status: 'accepted',
      accepted_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (updateErr) throw new Error('Failed to accept request: ' + updateErr.message);

  // Send Notification to requester
  try {
    await supabase.from('notifications').insert({
      recipient_id: req.requester_id,
      sender_id: user.id,
      type: 'friend_accept',
      title: 'Friend Request Accepted',
      body: 'Accepted your friend request.',
      link: '/network/connections', 
      is_read: false
    });
  } catch (err) {
    console.error('Notification error:', err);
  }

  try {
    await logPlatformAdminAction({
      actorUserId: user.id,
      actionKey: 'friend.request_accepted',
      targetType: 'user',
      targetId: req.requester_id,
      details: { requester_id: req.requester_id, friendship_id: requestId }
    });
  } catch(e) {}

  revalidatePath('/network/connections');
  return { success: true };
}

export async function rejectFriendRequest(requestId) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: req, error: reqErr } = await supabase
    .from('friendships')
    .select('id, recipient_id, requester_id, status')
    .eq('id', requestId)
    .single();

  if (reqErr || !req) throw new Error('Friend request not found');
  if (req.recipient_id !== user.id) throw new Error('You are not the recipient');
  if (req.status !== 'pending') throw new Error('Request is not pending');

  const { error: updateErr } = await supabase
    .from('friendships')
    .update({ status: 'rejected' })
    .eq('id', requestId);

  if (updateErr) throw new Error('Failed to reject request: ' + updateErr.message);

  try {
    await logPlatformAdminAction({
      actorUserId: user.id,
      actionKey: 'friend.request_rejected',
      targetType: 'user',
      targetId: req.requester_id,
      details: { requester_id: req.requester_id, friendship_id: requestId }
    });
  } catch(e) {}

  revalidatePath('/network/connections');
  return { success: true };
}

export async function cancelFriendRequest(requestId) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: req, error: reqErr } = await supabase
    .from('friendships')
    .select('id, requester_id, recipient_id, status')
    .eq('id', requestId)
    .single();

  if (reqErr || !req) throw new Error('Friend request not found');
  if (req.requester_id !== user.id) throw new Error('You are not the requester');
  if (req.status !== 'pending') throw new Error('Request is not pending');

  const { error: updateErr } = await supabase
    .from('friendships')
    .update({ status: 'cancelled' })
    .eq('id', requestId);

  if (updateErr) throw new Error('Failed to cancel request: ' + updateErr.message);

  try {
    await logPlatformAdminAction({
      actorUserId: user.id,
      actionKey: 'friend.request_cancelled',
      targetType: 'user',
      targetId: req.recipient_id,
      details: { recipient_id: req.recipient_id, friendship_id: requestId }
    });
  } catch(e) {}

  revalidatePath('/network/connections');
  return { success: true };
}

export async function removeFriend(friendshipId) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: req, error: reqErr } = await supabase
    .from('friendships')
    .select('id, requester_id, recipient_id, status')
    .eq('id', friendshipId)
    .single();

  if (reqErr || !req) throw new Error('Friendship not found');
  if (req.requester_id !== user.id && req.recipient_id !== user.id) throw new Error('Unauthorized');
  if (req.status !== 'accepted') throw new Error('Friendship is not accepted');

  const { error: updateErr } = await supabase
    .from('friendships')
    .update({ status: 'removed' })
    .eq('id', friendshipId);

  if (updateErr) throw new Error('Failed to remove friend: ' + updateErr.message);

  try {
    const otherUserId = req.requester_id === user.id ? req.recipient_id : req.requester_id;
    await logPlatformAdminAction({
      actorUserId: user.id,
      actionKey: 'friend.removed',
      targetType: 'user',
      targetId: otherUserId,
      details: { other_user_id: otherUserId, friendship_id: friendshipId }
    });
  } catch(e) {}

  revalidatePath('/network/connections');
  return { success: true };
}

export async function getFriendsList() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch accepted friendships
  const { data: friendships, error } = await supabase
    .from('friendships')
    .select(`
      id,
      created_at,
      accepted_at,
      requester:requester_id (id, name, avatar_url, currentRole, location),
      recipient:recipient_id (id, name, avatar_url, currentRole, location)
    `)
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false });

  if (error || !friendships) return [];

  // Flatten the response so we get an array of 'friend' objects alongside the friendship ID
  return friendships.map(f => {
    const isRequester = f.requester.id === user.id;
    const friendProfile = isRequester ? f.recipient : f.requester;
    return {
      friendshipId: f.id,
      acceptedAt: f.accepted_at,
      profile: friendProfile
    };
  });
}

export async function getFriendRequests() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { incoming: [], outgoing: [] };

  const { data: requests, error } = await supabase
    .from('friendships')
    .select(`
      id,
      created_at,
      requester_id,
      recipient_id,
      status,
      requester:requester_id (id, name, avatar_url, currentRole, location),
      recipient:recipient_id (id, name, avatar_url, currentRole, location)
    `)
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !requests) return { incoming: [], outgoing: [] };

  const incoming = [];
  const outgoing = [];

  requests.forEach(req => {
    if (req.recipient_id === user.id) {
      incoming.push({
        requestId: req.id,
        createdAt: req.created_at,
        profile: req.requester
      });
    } else if (req.requester_id === user.id) {
      outgoing.push({
        requestId: req.id,
        createdAt: req.created_at,
        profile: req.recipient
      });
    }
  });

  return { incoming, outgoing };
}

// Add a helper to check status between two users (useful for Profile / ProfessionalCard)
export async function getFriendshipStatus(targetUserId) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id === targetUserId) return null;

  const { data, error } = await supabase
    .from('friendships')
    .select('id, status, requester_id, recipient_id')
    .or(`and(requester_id.eq.${user.id},recipient_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},recipient_id.eq.${user.id})`)
    .in('status', ['pending', 'accepted'])
    .maybeSingle();

  if (error || !data) return null;
  
  return {
    friendshipId: data.id,
    status: data.status,
    isRequester: data.requester_id === user.id
  };
}
