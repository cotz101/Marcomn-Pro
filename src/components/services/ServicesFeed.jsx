'use client';
import JobBoard from '../jobs/JobBoard';

export default function ServicesFeed() {
  return (
    <div className="flex flex-col gap-2">
      <JobBoard />
    </div>
  );
}
