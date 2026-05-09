'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useProfile } from '@/app/context/ProfileContext';
import Profile from '@/src/components/profile/Profile';
import ExperienceSection from '@/src/components/profile/ExperienceSection';

export default function PublicProfilePage() {
  const { userId: currentUserId } = useProfile();
  const params = useParams();
  const id = params?.id;

  if (!id) return null;
  const isOwnProfile = currentUserId === id;

  return (
    <>
      <Profile profile={{}} userId={currentUserId} />
      <ExperienceSection userId={id} isOwnProfile={isOwnProfile} />
    </>
  );
}
