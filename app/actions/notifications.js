'use server'

import { createClient } from '@/lib/supabase-server'; 

export async function sendNotification(targetUserId, senderUserId, message, conversationId) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('notifications')
    .insert([
      {
        recipient_id: targetUserId,                    // Target receiver column (uuid)
        sender_id: senderUserId,                       // Message author column (uuid)
        type: 'message',                               // text column
        title: 'New Message',                          // text column
        body: message,                                 // text column
        link: `/messages?chat=${conversationId}`,       // text column dynamic link
        is_read: false                                 // boolean indicator initialization
      }
    ]);
  
  if (error) {
    console.error('Server Action DB Error:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}