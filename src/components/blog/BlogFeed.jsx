'use client';
import { Newspaper, Clock, User, Share2 } from 'lucide-react';

export default function BlogFeed() {
  const posts = [
    {
      id: 1,
      title: "The Future of Sustainable Shipping",
      excerpt: "Exploring new fuel technologies and environmental regulations shaping the maritime industry in 2026.",
      author: "Capt. Sarah Jenkins",
      date: "May 12, 2026",
      readTime: "5 min read",
      image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&q=80&w=400"
    },
    {
      id: 2,
      title: "Digital Transformation in Port Logistics",
      excerpt: "How AI and blockchain are optimizing container throughput and reducing waiting times at major hubs.",
      author: "Dr. Mark Chen",
      date: "May 10, 2026",
      readTime: "8 min read",
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=400"
    }
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="card p-6 mb-2">
        <h2 className="text-xl font-bold text-[#004173] mb-2">MBlog</h2>
        <p className="text-sm text-[#42474f]">Expert insights, industry news, and maritime thought leadership.</p>
      </div>

      <div className="flex flex-col gap-5">
        {posts.map((post) => (
          <article key={post.id} className="card overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-48 h-32 md:h-auto flex-shrink-0">
                <img 
                  src={post.image} 
                  alt={post.title} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-5 flex-1">
                <div className="flex items-center gap-3 text-[10px] text-[#666] mb-2">
                  <span className="flex items-center gap-1"><User size={12} /> {post.author}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime}</span>
                  <span className="ml-auto">{post.date}</span>
                </div>
                <h3 className="font-bold text-lg text-[#1b1c1c] mb-2">{post.title}</h3>
                <p className="text-sm text-[#42474f] mb-4">{post.excerpt}</p>
                <div className="flex items-center justify-between">
                  <button className="text-[#004173] text-sm font-bold hover:underline">Read Full Article</button>
                  <button className="text-[#666] hover:text-[#004173]"><Share2 size={18} /></button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
