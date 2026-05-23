'use client';

import { Anchor } from 'lucide-react';
import LogbookFeed from '@/src/components/logbook/LogbookFeed';

export default function LogbookPage() {
  return (
    <div className="logbook-shell w-full max-w-full min-h-screen">
      {/* Feed Content */}
      <div className="feed-wrapper">
        <LogbookFeed />
      </div>
    </div>
  );
}
