'use client';

import { useProfile } from '@/app/context/ProfileContext';

export default function CreatePost() {
  const { profile, setShowCreatePost } = useProfile();

  return (
    <div 
      className="bg-white rounded-xl border border-gray-100 px-2 sm:px-4 py-5 mb-6 shadow-sm flex flex-col gap-3 w-full max-w-3xl mx-auto"
      style={{ paddingTop: '20px', paddingBottom: '20px' }}
    >
      {/* Avatar + Rounded Trigger Button */}
      <div className="flex items-center gap-3 w-full">
        {profile?.profilePic ? (
          <img
            src={profile.profilePic}
            alt={profile.name || 'User'}
            className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-xs flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shadow-inner flex-shrink-0">
            <span className="text-sm font-extrabold text-blue-900">
              {profile?.name?.charAt(0)?.toUpperCase() || 'M'}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setShowCreatePost(true);
          }}
          className="bg-gray-50 hover:bg-gray-100/80 border border-gray-200 font-sans font-medium text-sm text-gray-500 rounded-full transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-100 active:scale-[0.99] select-none flex items-center justify-center w-full text-center px-4 py-3"
        >
          Start a post as {profile?.name || 'member'}...
        </button>
      </div>
    </div>
  );
}
