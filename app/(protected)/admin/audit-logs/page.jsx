import AuditLogViewer from '@/app/components/admin/AuditLogViewer';

export const metadata = {
  title: 'Platform Audit Logs - MarComn',
  description: 'View administrative audit logs',
};

export default function AdminAuditLogsPage() {
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 w-full">
      <AuditLogViewer />
    </div>
  );
}
