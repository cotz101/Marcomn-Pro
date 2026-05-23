'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';

export default function GroupPostInput({ onPostCreated }) {
  const { id: groupId } = useParams();
  const { userId, profile, currentIdentity } = useProfile();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const isCompany = currentIdentity?.type === 'company';
  const identityName = isCompany ? currentIdentity.data.name : profile?.fullName;
  const identityImage = isCompany 
    ? (currentIdentity.data.logo_url || '/favicon.svg') 
    : (profile?.profilePic || '/profile_pic.png');

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    console.log('1. Post button clicked!');
    
    if (!content.trim()) {
      console.log('Post failed: Content is empty');
      return;
    }
    if (!userId) {
      console.log('Post failed: No userId found');
      return;
    }
    if (isSubmitting) {
      console.log('Post failed: Submission already in progress');
      return;
    }

    console.log('2. Payload Prep:', { rawGroupId: groupId, userId, content: content.trim() });

    setIsSubmitting(true);
    try {
      let finalGroupId = groupId;

      // Payload Type Safety: If groupId looks like a slug (non-UUID), fetch the actual UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(groupId)) {
        console.log('Detecting slug, fetching UUID for:', groupId);
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('id')
          .eq('slug', groupId)
          .maybeSingle();
        
        if (groupError || !groupData) {
          console.error('Failed to resolve group UUID from slug:', groupError);
          throw new Error('Could not find group ID. Please check the URL.');
        }
        finalGroupId = groupData.id;
        console.log('Resolved UUID:', finalGroupId);
      }

      const postToInsert = {
        group_id: finalGroupId,
        user_id: userId,
        content: content.trim(),
        posted_as_company_id: isCompany ? currentIdentity.id : null
      };

      const { data, error } = await supabase
        .from('group_posts')
        .insert(postToInsert)
        .select(`
          *,
          author:profiles(name, avatar_url, headline)
        `)
        .maybeSingle();

      if (error) {
        // Deep Error Extraction
        console.error('3. DB Error Details:', JSON.stringify(error, null, 2), error?.message, error?.hint, error?.details);
        
        // RLS Warning Log
        if (!error.message) {
          alert('Supabase RLS is likely blocking this insert. Check your Supabase Dashboard policies for the group_posts table.');
        }
        throw error;
      }

      console.log('3. DB Success:', data);

      if (data) {
        // Format for instant UI feedback
        const formattedPost = {
          ...data,
          author: isCompany ? currentIdentity.data.name : data.author?.name || identityName,
          avatar: isCompany ? currentIdentity.data.logo_url : data.author?.avatar_url || identityImage,
          headline: isCompany ? currentIdentity.data.industry : data.author?.headline || 'Member',
          timestamp: 'Just now',
          text: data.content,
          comments: []
        };

        if (onPostCreated) {
          onPostCreated(formattedPost);
        }
        setContent('');
      }
    } catch (err) {
      // Already logged as '3. DB Error' above if it was a Supabase error
      alert('Error creating post: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="px-[22px] py-4">
        <div className="flex gap-4">
          <img 
            src={identityImage} 
            alt={identityName} 
            className="w-10 h-10 object-cover shadow-sm"
            style={{ borderRadius: isCompany ? '8px' : '50%' }}
          />
          <div className="flex-1">
            <textarea
              className="w-full min-h-[80px] p-0 border-none focus:ring-0 text-slate-700 placeholder:text-slate-400 text-sm resize-none bg-transparent"
              placeholder="Start Discussion..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>
        <div className="flex justify-end pt-3 mt-2 border-t border-slate-50">
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
              !content.trim() || isSubmitting
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-950 text-white hover:bg-slate-900 active:scale-95 shadow-sm'
            }`}
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
