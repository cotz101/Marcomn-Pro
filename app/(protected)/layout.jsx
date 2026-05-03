import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import AppShell from '@/app/components/AppShell';
import { ProfileProvider } from '@/app/context/ProfileContext';

export default async function ProtectedLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/');

  return (
    <ProfileProvider userId={user.id} userEmail={user.email}>
      <AppShell userEmail={user.email} userId={user.id}>
        {children}
      </AppShell>
    </ProfileProvider>
  );
}
