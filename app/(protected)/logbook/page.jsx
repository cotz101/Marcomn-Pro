'use client';

import { useProfile } from '@/app/context/ProfileContext';
import LogbookFeedInner from '@/src/components/logbook/LogbookFeed';
import SidebarLeft from '@/src/components/layout/SidebarLeft';
import SidebarRight from '@/src/components/layout/SidebarRight';

export default function LogbookPage() {
  const { profile } = useProfile();

  return (
    <LogbookFeedInner profile={profile} />
  );
}
