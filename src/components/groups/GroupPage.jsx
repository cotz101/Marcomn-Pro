'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function GroupPage() {
  const { id: groupId } = useParams();
  const supabase = createClient();

  // 1. State Initialization
  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState('');
  const [groupName, setGroupName] = useState('Loading...');
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // 2. Initial Data Fetch
    const initData = async () => {
      // Get User ID
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      // Fetch Group Name
      const { data: gData } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .maybeSingle();
      if (gData) setGroupName(gData.name);

      // Fetch Posts
      const { data: pData } = await supabase
        .from('group_posts')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      if (pData) setPosts(pData);
    };

    if (groupId) initData();
  }, [groupId, supabase]);

  // 3. Direct Hardwired Submit Logic
  const handlePost = async () => {
    if (!postText.trim() || !userId || !groupId) return;

    const { data, error } = await supabase
      .from('group_posts')
      .insert([{
        group_id: groupId,
        user_id: userId,
        content: postText
      }])
      .select()
      .maybeSingle();

    if (error) {
      alert('Database Error: ' + error.message);
    } else if (data) {
      // Refresh local state immediately
      setPosts(prev => [data, ...prev]);
      setPostText('');
    }
  };

  // 4. Native UI Shell
  return (
    <div className="min-h-screen bg-slate-50 px-[22px] py-8">
      <div className="max-w-xl mx-auto">
        {/* Top Header */}
        <h1 className="text-2xl font-bold text-slate-900 mb-8">
          {groupName}
        </h1>

        {/* Composer */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-8 shadow-sm">
          <textarea
            className="w-full border-none focus:ring-0 text-sm bg-transparent resize-none min-h-[100px]"
            placeholder="Write to the group..."
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
          />
          <div className="flex justify-end pt-2">
            <button
              onClick={handlePost}
              className="bg-blue-950 text-white px-6 py-2 rounded-full text-xs font-bold hover:bg-slate-900 transition-all"
            >
              Post
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <p className="text-slate-400 italic text-sm text-center">No posts yet.</p>
          ) : (
            posts.map(post => (
              <div key={post.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </p>
                <div className="mt-3 pt-3 border-t border-slate-50">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {new Date(post.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
