import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import AppShell from '@/app/components/AppShell';

export default async function ProtectedLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/');

  return (
    <AppShell userEmail={user.email} userId={user.id}>
      {children}
    </AppShell>
  );
}
