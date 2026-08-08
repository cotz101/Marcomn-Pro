'use server'

import { createClient } from '@/lib/supabase-server';

export async function createApplicationMessageNotification(threadId) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'You must be signed in to send an application notification.' };
  }

  // Use the caller's RLS-scoped client to prove they participate in this thread.
  const { data: authorizedThread, error: threadError } = await supabase
    .from('application_threads')
    .select('id, applicant_id, poster_user_id')
    .eq('id', threadId)
    .maybeSingle();

  if (threadError || !authorizedThread) {
    return { success: false, error: threadError?.message || 'Application thread not found.' };
  }

  if (user.id !== authorizedThread.applicant_id && user.id !== authorizedThread.poster_user_id) {
    return { success: false, error: 'You are not a participant in this application thread.' };
  }

  // After authorization, derive every notification field from canonical server-side data.
  const { data: thread, error: detailError } = await supabase
    .from('application_threads')
    .select('id, application_id, applicant_id, poster_user_id, company_id, job:jobs!job_id(title), company:companies!company_id(name, logo_url), applicant:profiles!applicant_id(name, avatar_url), poster:profiles!poster_user_id(name, avatar_url)')
    .eq('id', threadId)
    .single();

  if (detailError || !thread) {
    return { success: false, error: detailError?.message || 'Unable to load application context.' };
  }

  const isSenderApplicant = user.id === thread.applicant_id;
  const recipientId = isSenderApplicant ? thread.poster_user_id : thread.applicant_id;
  const senderDisplayType = !isSenderApplicant && thread.company_id ? 'company' : 'personal';
  const personalSender = isSenderApplicant ? thread.applicant : thread.poster;
  const senderDisplayName = senderDisplayType === 'company' ? thread.company?.name : personalSender?.name;
  const senderAvatarUrl = senderDisplayType === 'company' ? thread.company?.logo_url : personalSender?.avatar_url;

  const { data: settings, error: settingsError } = await supabase
    .from('notification_settings')
    .select('messaging_enabled')
    .eq('user_id', recipientId)
    .maybeSingle();

  if (settingsError) {
    return { success: false, error: settingsError.message };
  }

  if (settings?.messaging_enabled === false) {
    return { success: true, skipped: true };
  }

  const jobTitle = thread.job?.title || 'an application';
  const { error: insertError } = await supabase.from('notifications').insert({
    recipient_id: recipientId,
    sender_id: user.id,
    type: 'application_message',
    title: 'New Application Message',
    body: `${senderDisplayName || 'Someone'} sent you a message about ${jobTitle}.`,
    link: `/messages?application=${thread.application_id}`,
    is_read: false,
    metadata: {
      notification_type: 'application_message',
      application_id: thread.application_id,
      thread_id: thread.id,
      company_id: thread.company_id || null,
      sender_display_type: senderDisplayType,
      sender_display_name: senderDisplayName || null,
      sender_avatar_url: senderAvatarUrl || null
    }
  });

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  return { success: true };
}

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
