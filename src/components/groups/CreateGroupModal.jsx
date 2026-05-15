'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import BaseModal from '../layout/BaseModal';

export default function CreateGroupModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('public');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();
  const { userId } = useProfile();
  const currentUser = { id: userId };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a group name');
      return;
    }

    if (!currentUser.id) {
      alert('Please sign in to create a group');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Insert the new group into the groups table
      // Trigger in DB now handles adding creator as admin
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          name,
          description,
          type,
          owner_id: currentUser.id
        })
        .select()
        .single();

      if (groupError) {
        alert('Error creating group: ' + groupError.message);
        setIsLoading(false);
        return;
      }

      // Step 5: On full success, close the modal, refresh, and redirect
      router.refresh();
      if (onSuccess) onSuccess();
      router.push('/groups/' + newGroup.id);
    } catch (err) {
      alert('An unexpected error occurred: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Create New Maritime Group"
      maxWidth="500px"
    >
      <form onSubmit={handleSubmit} className="space-y-6 pt-4">
        <div>
          <label className="block text-sm font-bold text-[#0e2a4d] mb-1">Group Name</label>
          <input 
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g. LNG Tanker Crew"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-[#0e2a4d] mb-1">Description</label>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
            placeholder="What is this community for?"
          />
        </div>

        <div className="mb-8">
          <label className="block text-sm font-bold text-[#0e2a4d] mb-1">Privacy Setting</label>
          <select 
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="public">Public - Anyone can join</option>
            <option value="private">Private - Request to join</option>
          </select>
          <p className="mt-1 text-[10px] text-gray-500 font-medium">Public groups are visible to everyone, while private groups require approval to join.</p>
        </div>

        <div className="flex gap-3 pt-6 border-t border-gray-100">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-bold text-gray-600 hover:bg-gray-50 transition-all text-sm"
          >
            Cancel
          </button>
          <button 
            type="submit"
            disabled={isLoading}
            className={`flex-1 py-3 bg-[#002b4e] text-white rounded-lg font-bold hover:bg-[#001f38] transition-all text-sm ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'Creating...' : 'Create Community'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
