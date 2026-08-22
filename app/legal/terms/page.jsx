import LegalCMSPage from '@/app/components/LegalCMSPage';
import { getCMSPageData } from '@/lib/cmsPublicPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Terms of Use | Marcomn', description: 'The terms governing access to and use of Marcomn.' };

export default async function TermsLegalPage() {
  return <LegalCMSPage data={await getCMSPageData('legal/terms')} />;
}
