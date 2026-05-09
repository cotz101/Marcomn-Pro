'use client';

import { useState, useEffect } from 'react';
import { X, ThumbsUp, Heart, Lightbulb, Zap, Smile } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function ReactionsModal({ isOpen, onClose, postId, currentUserId }) {
  const [likes, setLikes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const supabase = createClient();

  useEffect(() => {
    if (isOpen && postId) {
      fetchLikes();
    }
  }, [isOpen, postId]);

  const fetchLikes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('likes')
        .select(`
          id,
          user:profiles (
            id,
            name,
            avatar_url,
            headline
          )
        `)
        .eq('post_id', postId);

      if (error) throw error;
      setLikes(data || []);
    } catch (err) {
      console.error('Error fetching likes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay-glass" onClick={onClose}>
      <div className="modal-content-standard" style={{ maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header-navy" style={{ padding: '12px 20px' }}>
          <h3 className="modal-title-white" style={{ fontSize: '16px' }}>Reactions</h3>
          <button className="modal-close-btn-white" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body-standard" style={{ padding: '0 20px 20px' }}>
          <div className="reactions-tabs">
            <button 
              className={`reaction-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All <span className="reaction-tab-count">{likes.length}</span>
            </button>
            <button 
              className={`reaction-tab ${activeTab === 'likes' ? 'active' : ''}`}
              onClick={() => setActiveTab('likes')}
            >
              <ThumbsUp size={14} className="text-blue-500" />
              <span className="reaction-tab-count">{likes.length}</span>
            </button>
          </div>

          <div className="reactions-list">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="reaction-item">
                  <div className="reaction-user-info">
                    <div className="skeleton reaction-avatar" />
                    <div className="reaction-details">
                      <div className="skeleton skeleton-title" style={{ height: '14px', width: '120px' }} />
                      <div className="skeleton skeleton-text" style={{ height: '10px', width: '180px' }} />
                    </div>
                  </div>
                </div>
              ))
            ) : likes.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#666' }}>
                No reactions yet.
              </div>
            ) : (
              likes.map((like) => (
                <div key={like.id} className="reaction-item">
                  <div className="reaction-user-info">
                    {like.user?.avatar_url ? (
                      <img 
                        src={like.user?.avatar_url} 
                        alt={like.user?.name} 
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                        <User size={20} className="text-slate-400" />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900 leading-tight">
                        {like.user?.name}
                        {like.user?.id === currentUserId && <span className="user-tag">• You</span>}
                      </span>
                      <div className="reaction-headline">{like.user?.headline || 'Maritime Professional'}</div>
                    </div>
                  </div>
                  {like.user?.id !== currentUserId && (
                    <button className="btn-connect">Connect</button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
