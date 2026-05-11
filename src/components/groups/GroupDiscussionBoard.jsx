'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import DiscussionPost from './DiscussionPost';

export default function GroupDiscussionBoard({ groupId }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvedUuid, setResolvedUuid] = useState(null);
  const { userId, profile, currentIdentity } = useProfile();
  const supabase = createClient();

  useEffect(() => {
    const resolveAndFetch = async () => {
      if (!groupId) return;
      setLoading(true);
      
      try {
        let uuid = groupId;
        // Smart UUID Bypass: Check if groupId is already a valid UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        
        if (!uuidRegex.test(groupId)) {
          console.log('Detecting slug, fetching UUID for:', groupId);
          // Safe Lookup Fallback: Using maybeSingle to prevent crashes
          const { data, error } = await supabase
            .from('groups')
            .select('id')
            .eq('slug', groupId)
            .maybeSingle();
          
          if (error) {
            console.error('Safe Lookup Error:', error);
            throw error;
          }
          
          if (!data) {
            console.warn('No group found for slug:', groupId);
            throw new Error('Group not found');
          }
          uuid = data.id;
          console.log('Resolved UUID from slug:', uuid);
        } else {
          console.log('groupId is already a UUID, skipping lookup.');
        }
        
        setResolvedUuid(uuid);

        // Fetch posts
        const { data: postsData, error: postsError } = await supabase
          .from('group_posts')
          .select('*')
          .eq('group_id', uuid)
          .order('created_at', { ascending: false });

        if (postsError) throw postsError;

        // Batch fetch profiles
        const uids = [...new Set(postsData.map(p => p.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, headline')
          .in('id', uids);

        const profileMap = (profilesData || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});

        const merged = postsData.map(post => {
          const p = profileMap[post.user_id];
          return {
            ...post,
            author: p?.name || 'Anonymous User',
            avatar: p?.avatar_url,
            headline: p?.headline || 'Member',
            timestamp: new Date(post.created_at).toLocaleDateString(),
            text: post.content,
            comments: []
          };
        });

        setPosts(merged);
      } catch (err) {
        console.error('Board Error:', err);
      } finally {
        setLoading(false);
      }
    };

    resolveAndFetch();
  }, [groupId]);

  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
  };

  return (
    <div className="space-y-6">
      <GroupPostComposer 
        resolvedUuid={resolvedUuid} 
        onPostCreated={handlePostCreated} 
      />

      <div className="space-y-4 pb-20">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 italic text-sm">
            No discussions yet. Start the conversation!
          </div>
        ) : (
          posts.map(post => (
            <DiscussionPost key={post.id} post={post} groupId={resolvedUuid} />
          ))
        )}
      </div>
    </div>
  );
}

function GroupPostComposer({ resolvedUuid, onPostCreated }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { userId, currentIdentity, profile } = useProfile();
  const supabase = createClient();

  const isCompany = currentIdentity?.type === 'company';
  const identityName = isCompany ? currentIdentity.data.name : profile?.fullName;
  const identityImage = isCompany 
    ? (currentIdentity.data.logo_url || '/favicon.svg') 
    : (profile?.profilePic || '/profile_pic.png');

  const handlePost = async () => {
    if (!text.trim() || !userId || submitting || !resolvedUuid) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('group_posts')
        .insert({
          group_id: resolvedUuid,
          user_id: userId,
          content: text.trim(),
          posted_as_company_id: isCompany ? currentIdentity.id : null
        })
        .select(`
          *,
          author:profiles(name, avatar_url, headline)
        `)
        .single();

      if (error) {
        alert(error.message);
        throw error;
      }

      if (data) {
        const formatted = {
          ...data,
          author: isCompany ? currentIdentity.data.name : data.author?.name || identityName,
          avatar: isCompany ? currentIdentity.data.logo_url : data.author?.avatar_url || identityImage,
          headline: isCompany ? currentIdentity.data.industry : data.author?.headline || 'Member',
          timestamp: 'Just now',
          text: data.content,
          comments: []
        };
        onPostCreated(formatted);
        setText('');
      }
    } catch (err) {
      console.error('Composer Error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex gap-4">
        <img 
          src={identityImage} 
          alt="User" 
          className="w-10 h-10 object-cover" 
          style={{ borderRadius: isCompany ? '8px' : '50%' }}
        />
        <div className="flex-1">
          <textarea
            className="w-full min-h-[100px] border-none focus:ring-0 text-sm placeholder:text-slate-400 bg-transparent resize-none"
            placeholder="Start a discussion..."
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <div className="flex justify-end pt-3 border-t border-slate-50">
            <button
              onClick={handlePost}
              disabled={!text.trim() || submitting}
              className="bg-blue-950 text-white px-5 py-1.5 rounded-full text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-900 transition-all active:scale-95"
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
