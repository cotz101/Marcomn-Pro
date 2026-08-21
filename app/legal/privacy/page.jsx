import LegalCMSPage from '@/app/components/LegalCMSPage';
import { getCMSPageData } from '@/lib/cmsPublicPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Privacy Policy | MarComn', description: 'How MarComn collects, uses, shares, stores, and protects personal data.' };

export default async function PrivacyLegalPage() {
  return <LegalCMSPage data={await getCMSPageData('legal/privacy')} />;
}
