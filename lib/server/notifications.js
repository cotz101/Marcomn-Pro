import { createServiceClient } from '@/lib/supabase-server';

/**
 * Internal server-only helper to create platform/system notifications
 * using the trusted service-role client.
 *
 * NOTE: This file does NOT contain 'use server' and must NEVER be exported
 * as a public Server Action or invoked from client components.
 */
export async function createPlatformNotification({
  userId,
  title,
  message,
  type = 'system',
  linkUrl = null,
  senderId = null,
  metadata = {}
}) {
  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from('notifications')
    .insert([
      {
        recipient_id: userId,
        sender_id: senderId,
        type: type || 'system',
        title: title,
        body: message,
        link: linkUrl || null,
        is_read: false,
        metadata: metadata || {}
      }
    ]);

  if (error) {
    console.error('Internal Platform Notification DB Error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
