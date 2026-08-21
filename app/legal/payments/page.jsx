import LegalCMSPage from '@/app/components/LegalCMSPage';
import { getCMSPageData } from '@/lib/cmsPublicPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'MCredits, Payments & Refund Policy | MarComn', description: 'How MCredits, online top-ups, platform fees, offline advances, and refunds work on MarComn.' };

export default async function PaymentsLegalPage() {
  return <LegalCMSPage data={await getCMSPageData('legal/payments')} />;
}
