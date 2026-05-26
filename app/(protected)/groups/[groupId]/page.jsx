'use client';

import { use } from 'react';
import GroupPageClient from '@/src/components/groups/GroupPage';

export default function GroupPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const groupId = params?.groupId;
  
  return <GroupPageClient groupId={groupId} />;
}
