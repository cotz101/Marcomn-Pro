'use client';
import { ThumbsUp, MessageSquare, Share2 } from 'lucide-react';
import { useState } from 'react';
import CreatePost from './CreatePost';

export default function LogbookFeed({ profile }) {
  const [posts, setPosts] = useState([
    {
      id: 1,
      author: 'Captain Jane Doe',
      headline: 'Master Mariner at Global Shipping Co.',
      time: '2h',
      avatar: '/profile_pic.png',
      content: 'Just successfully navigated the Suez Canal. Smooth sailing thanks to the amazing crew onboard! #MaritimeLife #Shipping',
      type: 'standard'
    },
    {
      id: 2,
      author: 'Chief Engineer Bob',
      headline: 'Marine Engineer specializing in sustainable propulsion',
      time: '5h',
      avatar: '/profile_pic.png',
      content: 'Excited to announce our new transition to dual-fuel engines. A big step for reducing emissions in our fleet. 🚢🌱',
      type: 'standard'
    }
  ]);

  const handleNewPost = (postData) => {
    const newPost = {
      id: Date.now(),
      author: profile?.fullName || 'User',
      headline: profile?.headline || 'Headline',
      time: 'Just now',
      avatar: profile?.profilePic || '/profile_pic.png',
      content: postData.content,
      type: postData.type,
      media: postData.media,
      mediaType: postData.mediaType,
      title: postData.title,
      youtubeLink: postData.youtubeLink
    };
    
    setPosts([newPost, ...posts]);
  };

  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    return videoIdMatch ? `https://www.youtube.com/embed/${videoIdMatch[1]}` : null;
  };

  return (
    <div className="feed-container">
      <CreatePost onPostSubmit={handleNewPost} profile={profile} />
      
      {posts.map(post => (
        <div key={post.id} className="card post-card">
          <div className="post-header">
            <img src={post.avatar} alt={post.author} className="post-avatar" />
            <div>
              <div className="post-author">{post.author}</div>
              <div className="post-headline">{post.headline}</div>
              <div className="post-time">{post.time}</div>
            </div>
          </div>
          
          {post.type === 'article' && (
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>{post.title}</h2>
              {post.youtubeLink && getYoutubeEmbedUrl(post.youtubeLink) ? (
                <iframe 
                  width="100%" 
                  height="300" 
                  src={getYoutubeEmbedUrl(post.youtubeLink)} 
                  title="YouTube video" 
                  frameBorder="0" 
                  style={{ borderRadius: '8px', marginBottom: '16px' }}
                  allowFullScreen>
                </iframe>
              ) : post.media && (
                post.mediaType === 'video' ? (
                  <video 
                    src={post.media} 
                    controls 
                    style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px', backgroundColor: 'black' }} 
                  />
                ) : (
                  <img src={post.media} alt="Cover" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }} />
                )
              )}
            </div>
          )}
          
          {(post.type === 'standard' && post.media) && (
            post.mediaType === 'video' ? (
              <video src={post.media} controls style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px', backgroundColor: 'black' }} />
            ) : (
              <img src={post.media} alt="Attached Media" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }} />
            )
          )}

          {post.type === 'article' ? (
            <div className="post-content ql-editor" dangerouslySetInnerHTML={{ __html: post.content }} style={{ padding: 0 }} />
          ) : (
            <div className="post-content">{post.content}</div>
          )}
          
          <div className="post-actions">
            <button className="action-btn"><ThumbsUp size={18} /> Like</button>
            <button className="action-btn"><MessageSquare size={18} /> Comment</button>
            <button className="action-btn"><Share2 size={18} /> Share</button>
          </div>
        </div>
      ))}
    </div>
  );
}
