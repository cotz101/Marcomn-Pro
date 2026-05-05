'use client';

import { useProfile } from '@/app/context/ProfileContext';
import Profile from '@/src/components/profile/Profile';
import ExperienceSection from '@/src/components/profile/ExperienceSection';

export default function ProfilePage() {
  const { profile, setProfile, userId } = useProfile();

  return (
    <>

      <Profile profile={profile} setProfile={setProfile} userId={userId} />
      <ExperienceSection userId={userId} />
    </>
  );
}
