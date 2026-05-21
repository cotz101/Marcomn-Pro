'use server'
import { createClient } from '@/lib/supabase-server';

export async function sendNotification(targetUserId, message) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notifications')
    .insert([
      {
        recipient_id: targetUserId,
        type: 'message',
        title: 'New Message',
        body: message,
        is_read: false
      }
    ]);
  
  if (error) throw new Error(JSON.stringify(error));
  return { success: true };
}
