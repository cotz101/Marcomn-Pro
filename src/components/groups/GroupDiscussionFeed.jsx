'use client';

import { useState, useRef } from 'react';
import { ImagePlus, FileText, X, Send } from 'lucide-react';
import DiscussionPost from './DiscussionPost';

const MOCK_POSTS = [
  {
    id: 1,
    author: 'Capt. James Whitmore',
    role: 'Master Mariner · 22 yrs',
    timestamp: '3 hours ago',
    content: 'Just completed SIRE 2.0 inspection on our VLCC. The new digital format is a significant improvement. The system allows inspectors to flag items in real-time. Has anyone else been through it yet? Happy to share notes on what they focused on.',
    likes: 24,
    media: null,
    comments: [
      { id: 1, author: 'Engr. Priya Sharma', role: 'Chief Engineer', timestamp: '2h ago', text: 'Yes, went through it last month. The focus on cyber security and SEEMP Part III was very noticeable. Great to hear the digital format is working well.' },
      { id: 2, author: 'Ana González', role: 'HSEQ Manager', timestamp: '1h ago', text: 'Would love to see those notes! We have an inspection scheduled for next quarter and trying to prepare our crew.' },
    ],
  },
  {
    id: 2,
    author: 'TechMaritime Editor',
    role: 'Industry Publisher',
    timestamp: '1 day ago',
    content: 'The IMO\'s CII (Carbon Intensity Indicator) ratings are already reshaping chartering decisions. Vessels rated D or E for three consecutive years face a corrective action plan requirement. Here\'s our full breakdown of the fleet impact:',
    likes: 87,
    media: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1494412651409-8963ce7935a7?w=800&q=80',
      alt: 'Container ship at sea',
    },
    comments: [],
  },
  {
    id: 3,
    author: 'Safety First Network',
    role: 'Maritime Safety Group',
    timestamp: '2 days ago',
    content: 'We\'ve published our latest incident analysis report for Q1 2026. Key findings include an increase in near-miss events in confined spaces and a welcome decline in machinery room incidents. Download the full PDF below.',
    likes: 43,
    media: {
      type: 'pdf',
      filename: 'Q1-2026-Safety-Incident-Analysis.pdf',
      size: '2.4 MB',
    },
    comments: [
      { id: 3, author: 'Pedro Alvarez', role: 'Safety Officer', timestamp: '1d ago', text: 'Excellent report. The confined space section aligns with the trend we are seeing across our fleet. Sharing this with our HSEQ team.' },
    ],
  },
];

export default function GroupDiscussionFeed({ groupId }) {
  const [posts, setPosts] = useState(MOCK_POSTS);
  const [showComposer, setShowComposer] = useState(false);
  const [draft, setDraft] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const mediaInputRef = useRef(null);
  const documentInputRef = useRef(null);

  const handleMediaSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    setSelectedMedia({
      file,
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
      type: isImage ? 'image' : 'video',
      preview: isImage ? URL.createObjectURL(file) : null,
    });
    e.target.value = '';
  };

  const handleDocumentSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedDocument({
      file,
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
    });
    e.target.value = '';
  };

  const clearAttachments = () => {
    setSelectedMedia(null);
    setSelectedDocument(null);
  };

  const handlePost = () => {
    if (!draft.trim() && !selectedMedia && !selectedDocument) return;
    const newPost = {
      id: Date.now(),
      author: 'You',
      role: 'Maritime Professional',
      timestamp: 'Just now',
      content: draft.trim(),
      likes: 0,
      media: selectedMedia
        ? { type: selectedMedia.type, url: selectedMedia.preview || '', alt: selectedMedia.name }
        : selectedDocument
          ? { type: 'pdf', filename: selectedDocument.name, size: selectedDocument.size }
          : null,
      comments: [],
    };
    setPosts(prev => [newPost, ...prev]);
    setDraft('');
    clearAttachments();
    setShowComposer(false);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Hidden File Inputs */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleMediaSelect}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        className="hidden"
        onChange={handleDocumentSelect}
      />

      {/* Composer Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        {!showComposer ? (
          <button
            onClick={() => setShowComposer(true)}
            className="w-full flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-[#002b4e] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              Y
            </div>
            <div className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm text-gray-400 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-text">
              Start a discussion...
            </div>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="What's on your mind? Share a maritime insight, question, or update..."
              rows={4}
              className="w-full text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none leading-relaxed"
            />

            {/* Attachment Previews */}
            {selectedMedia && (
              <div className="flex items-center gap-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                {selectedMedia.preview ? (
                  <img src={selectedMedia.preview} alt="Preview" className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <ImagePlus size={20} className="text-blue-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-800 truncate">{selectedMedia.name}</p>
                  <p className="text-xs text-blue-500">{selectedMedia.size}</p>
                </div>
                <button onClick={() => setSelectedMedia(null)} className="p-1 hover:bg-blue-100 rounded-full transition-colors flex-shrink-0">
                  <X size={16} className="text-blue-500" />
                </button>
              </div>
            )}

            {selectedDocument && (
              <div className="flex items-center gap-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="w-10 h-10 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800 truncate">{selectedDocument.name}</p>
                  <p className="text-xs text-amber-600">{selectedDocument.size}</p>
                </div>
                <button onClick={() => setSelectedDocument(null)} className="p-1 hover:bg-amber-100 rounded-full transition-colors flex-shrink-0">
                  <X size={16} className="text-amber-500" />
                </button>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2 text-gray-400 items-center">
                <button
                  title="Add media"
                  onClick={() => mediaInputRef.current?.click()}
                  className="hover:text-blue-500 transition-colors p-2 rounded-md hover:bg-blue-50"
                >
                  <ImagePlus size={20} />
                </button>
                <button
                  title="Attach document"
                  onClick={() => documentInputRef.current?.click()}
                  className="hover:text-amber-600 transition-colors p-2 rounded-md hover:bg-amber-50"
                >
                  <FileText size={20} />
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => { setShowComposer(false); setDraft(''); clearAttachments(); }}
                  className="px-5 py-2 text-sm font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-h-[40px]"
                >
                  <span>{"\u00A0"}Cancel{"\u00A0"}</span>
                </button>
                <button
                  onClick={handlePost}
                  disabled={!draft.trim() && !selectedMedia && !selectedDocument}
                  className="px-6 py-2 text-sm font-bold bg-[#002b4e] text-white rounded-lg hover:bg-[#001f38] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px] min-h-[40px]"
                >
                  <Send size={14} />
                  <span>{"\u00A0"}Post{"\u00A0"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Posts Feed */}
      {posts.map(post => (
        <DiscussionPost key={post.id} post={post} />
      ))}
    </div>
  );
}
