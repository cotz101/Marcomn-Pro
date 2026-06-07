import AuditLogViewer from '@/app/components/admin/AuditLogViewer';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Platform Audit Logs - MarComn',
  description: 'View administrative audit logs',
};

export default function AdminAuditLogsPage() {
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 w-full">
      <Link
        href="/admin"
        className="flex w-fit items-center gap-2 text-gray-500 hover:text-[#002b4e] transition-colors mb-6 text-sm font-bold cursor-pointer"
      >
        <ArrowLeft size={16} />
        <span>Back to Admin Dashboard</span>
      </Link>
      <AuditLogViewer />
    </div>
  );
}
