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

export async function createPlatformNotification({ userId, title, message, type, linkUrl, senderId = null, metadata = null }) {
  const supabase = await createClient();
  
  const { error } = await supabase
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
    console.error('Server Action DB Error:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

export async function checkAndNotifyVacancyReopened(jobId) {
  const supabase = await createClient();
  const { data: jobData, error: jobErr } = await supabase
    .from('jobs')
    .select('number_of_positions, poster_id, title')
    .eq('id', jobId)
    .maybeSingle();

  if (jobErr || !jobData) return;

  const number_of_positions = jobData.number_of_positions || 1;

  const { count: newFilledCount, error: countErr } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .in('status', ['Accepted', 'Completed']);

  if (countErr) return;

  if (newFilledCount === number_of_positions - 1) {
    try {
      await createPlatformNotification({
        userId: jobData.poster_id,
        title: 'Vacancy Reopened',
        message: `One position has become available again for your job "${jobData.title}". Applications are now open.`,
        type: 'job.reopened',
        linkUrl: `/jobs/my-postings`
      });
    } catch (notifErr) {
      console.error('Failed to send vacancy reopened notification:', notifErr);
    }
  }
}