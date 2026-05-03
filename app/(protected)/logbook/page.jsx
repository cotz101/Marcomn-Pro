'use client';

import { useProfile } from '@/app/context/ProfileContext';
import LogbookFeedInner from '@/src/components/logbook/LogbookFeed';

export default function LogbookPage() {
  const { profile } = useProfile();

  return <LogbookFeedInner profile={profile} />;
}
