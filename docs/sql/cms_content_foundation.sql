-- Stage CMS-2: Database & Content Foundation Migration
-- Establish cms_pages, cms_page_sections, cms_faqs, and cms_content_variables tables.

BEGIN;

-- 1. Create Tables

CREATE TABLE IF NOT EXISTS public.cms_pages (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null,
    title text not null,
    meta_description text,
    is_published boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.cms_page_sections (
    id uuid primary key default gen_random_uuid(),
    page_id uuid not null references public.cms_pages(id) on delete cascade,
    section_key text not null,
    title text not null,
    content text not null,
    sort_order integer default 0,
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(page_id, section_key)
);

CREATE TABLE IF NOT EXISTS public.cms_faqs (
    id uuid primary key default gen_random_uuid(),
    page_id uuid references public.cms_pages(id) on delete cascade,
    question text not null,
    answer text not null,
    sort_order integer default 0,
    is_published boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.cms_content_variables (
    id uuid primary key default gen_random_uuid(),
    variable_key text unique not null,
    value text not null,
    description text,
    is_public boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2. Triggers for updated_at

DROP TRIGGER IF EXISTS update_cms_pages_updated_at ON public.cms_pages;
CREATE TRIGGER update_cms_pages_updated_at
    BEFORE UPDATE ON public.cms_pages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cms_page_sections_updated_at ON public.cms_page_sections;
CREATE TRIGGER update_cms_page_sections_updated_at
    BEFORE UPDATE ON public.cms_page_sections
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cms_faqs_updated_at ON public.cms_faqs;
CREATE TRIGGER update_cms_faqs_updated_at
    BEFORE UPDATE ON public.cms_faqs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cms_content_variables_updated_at ON public.cms_content_variables;
CREATE TRIGGER update_cms_content_variables_updated_at
    BEFORE UPDATE ON public.cms_content_variables
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RLS Configurations

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content_variables ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Pages
DROP POLICY IF EXISTS "Allow public select of published pages" ON public.cms_pages;
CREATE POLICY "Allow public select of published pages" ON public.cms_pages
    FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Allow admins to manage pages" ON public.cms_pages;
CREATE POLICY "Allow admins to manage pages" ON public.cms_pages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND global_role IN ('super_admin', 'admin', 'brand_manager', 'super_user')
        ) OR public.current_user_has_platform_admin_permission('can_manage_content_pages')
    );

-- Sections
DROP POLICY IF EXISTS "Allow public select of active sections" ON public.cms_page_sections;
CREATE POLICY "Allow public select of active sections" ON public.cms_page_sections
    FOR SELECT USING (
        is_active = true 
        AND page_id IN (SELECT id FROM public.cms_pages WHERE is_published = true)
    );

DROP POLICY IF EXISTS "Allow admins to manage sections" ON public.cms_page_sections;
CREATE POLICY "Allow admins to manage sections" ON public.cms_page_sections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND global_role IN ('super_admin', 'admin', 'brand_manager', 'super_user')
        ) OR public.current_user_has_platform_admin_permission('can_manage_content_pages')
    );

-- FAQs
DROP POLICY IF EXISTS "Allow public select of published faqs" ON public.cms_faqs;
CREATE POLICY "Allow public select of published faqs" ON public.cms_faqs
    FOR SELECT USING (
        is_published = true 
        AND (page_id IS NULL OR page_id IN (SELECT id FROM public.cms_pages WHERE is_published = true))
    );

DROP POLICY IF EXISTS "Allow admins to manage faqs" ON public.cms_faqs;
CREATE POLICY "Allow admins to manage faqs" ON public.cms_faqs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND global_role IN ('super_admin', 'admin', 'brand_manager', 'super_user')
        ) OR public.current_user_has_platform_admin_permission('can_manage_faqs')
    );

-- Variables
DROP POLICY IF EXISTS "Allow public select of content variables" ON public.cms_content_variables;
CREATE POLICY "Allow public select of content variables" ON public.cms_content_variables
    FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Allow admins to manage content variables" ON public.cms_content_variables;
CREATE POLICY "Allow admins to manage content variables" ON public.cms_content_variables
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND global_role IN ('super_admin', 'admin', 'brand_manager', 'super_user')
        ) OR public.current_user_has_platform_admin_permission('can_manage_content_pages')
    );

-- 5. Seed Permissions & Link to Roles

INSERT INTO public.platform_admin_permissions (permission_key, permission_name, category, description) VALUES
    ('can_manage_content_pages', 'Manage Content Pages', 'CMS', 'Create, edit, publish/unpublish CMS pages and sections'),
    ('can_manage_faqs', 'Manage FAQs', 'CMS', 'Add, edit, reorder, delete or hide FAQs')
ON CONFLICT (permission_key) DO NOTHING;

DO $$
DECLARE
    v_super_admin uuid;
BEGIN
    SELECT id INTO v_super_admin FROM public.platform_admin_roles WHERE role_key = 'super_admin';
    IF v_super_admin IS NOT NULL THEN
        INSERT INTO public.platform_admin_role_permissions (role_id, permission_id)
        SELECT v_super_admin, id FROM public.platform_admin_permissions
        WHERE permission_key IN ('can_manage_content_pages', 'can_manage_faqs')
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
END $$;

-- 6. Seed Initial Data & Content

-- Content Variables
INSERT INTO public.cms_content_variables (variable_key, value, description, is_public) VALUES
    ('mcredits_per_usd', '1.0', 'MCredit rate per USD (exchange rate)', true),
    ('company_job_posting_fee_percent', '1', 'Platform fee percent charged to companies for job postings', true),
    ('candidate_acceptance_fee_percent', '5', 'Platform fee percent charged to candidates for job offer acceptances', true),
    ('support_email', 'support@marcomn.com', 'Primary support email address for billing and payment queries', true)
ON CONFLICT (variable_key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, is_public = EXCLUDED.is_public;

-- Pages, Sections & FAQs
DO $$
DECLARE
    v_credits_page_id uuid;
    v_payments_page_id uuid;
BEGIN
    -- Insert or get pages
    INSERT INTO public.cms_pages (slug, title, meta_description, is_published)
    VALUES 
        ('credits', 'MCredits Guide & Pricing', 'Learn about MCredits, preset pricing packages, how top-ups work, and what they are used for on MarComn.', true),
        ('legal/payments', 'Payment & Billing Policies', 'Review MarComn legal policies regarding payments, refunds, and billing disputes.', true)
    ON CONFLICT (slug) DO UPDATE SET 
        title = EXCLUDED.title,
        meta_description = EXCLUDED.meta_description,
        is_published = EXCLUDED.is_published;

    -- Retrieve IDs
    SELECT id INTO v_credits_page_id FROM public.cms_pages WHERE slug = 'credits';
    SELECT id INTO v_payments_page_id FROM public.cms_pages WHERE slug = 'legal/payments';

    -- Seed page sections for /credits
    INSERT INTO public.cms_page_sections (page_id, section_key, title, content, sort_order, is_active)
    VALUES
        (v_credits_page_id, 'what-is-mcredit', 'What is MCredit?', 'MCredits (MC) are the digital utility tokens used to power transactions on the MarComn platform. They allow seamless payment for services, postings, and agreements.', 10, true),
        (v_credits_page_id, 'exchange-rate', 'Current Exchange Rate', 'The current official exchange rate is 1 MCredit = {{mcredits_per_usd}} USD. This rate is set globally and managed by the platform administration.', 20, true),
        (v_credits_page_id, 'available-packages', 'Available Packages', 'We offer several preset packages to fit your top-up needs. You can choose from the options below or enter a custom amount.', 30, true),
        (v_credits_page_id, 'how-topups-work', 'How Top-Ups Work', 'You can top up your wallet securely online using a credit or debit card through Stripe. Once the Stripe payment succeeds, your MCredit balance is credited automatically in real-time.', 40, true),
        (v_credits_page_id, 'usage', 'What MCredits Can Be Used For', 'Companies use MCredits to pay for job postings (currently {{company_job_posting_fee_percent}}% of budget). Candidates use MCredits to accept job offers (currently {{candidate_acceptance_fee_percent}}% fee). MCredits are non-transferable between accounts and never expire.', 50, true)
    ON CONFLICT (page_id, section_key) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        sort_order = EXCLUDED.sort_order,
        is_active = EXCLUDED.is_active;

    -- Seed page sections for /legal/payments
    INSERT INTO public.cms_page_sections (page_id, section_key, title, content, sort_order, is_active)
    VALUES
        (v_payments_page_id, 'terms', 'MCredit Terms of Use', 'By purchasing and using MCredits, you agree to these payment terms. MCredits represent a non-refundable, non-transferable digital credit balance solely redeemable for services within the MarComn platform. MarComn reserves the right to modify platform fees, including job posting fees (currently {{company_job_posting_fee_percent}}%) and job acceptance fees (currently {{candidate_acceptance_fee_percent}}%), at any time.', 10, true),
        (v_payments_page_id, 'refunds', 'Refund Policy', 'All MCredit purchases are generally final and non-refundable. Refunds are strictly limited to the following exceptions: 1. Duplicate billing/payment transactions. 2. Verified technical errors during checkout. 3. Incorrect crediting to your wallet. 4. Unauthorized charges under active security investigation. All refund requests must be submitted within 30 days of purchase.', 20, true),
        (v_payments_page_id, 'disputes', 'Payment Disputes', 'If you believe there is an error in your transaction history or card statement, please contact us immediately before filing a chargeback. Filing an unwarranted chargeback may lead to temporary suspension of your account during the dispute review process.', 30, true),
        (v_payments_page_id, 'support', 'Billing Support Contact', 'For all billing inquiries, refund requests, or payment issues, please reach out to MarComn Support at {{support_email}}.', 40, true)
    ON CONFLICT (page_id, section_key) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        sort_order = EXCLUDED.sort_order,
        is_active = EXCLUDED.is_active;

    -- Seed FAQs for /credits
    DELETE FROM public.cms_faqs WHERE page_id = v_credits_page_id;
    INSERT INTO public.cms_faqs (page_id, question, answer, sort_order, is_published)
    VALUES
        (v_credits_page_id, 'Do my MCredits expire?', 'No, MCredits never expire. Once credited to your wallet, they remain active until spent.', 10, true),
        (v_credits_page_id, 'Can I transfer MCredits to another user?', 'No. MCredits are tied to the account or company wallet that purchased them and are strictly non-transferable.', 20, true),
        (v_credits_page_id, 'Are there any hidden fees?', 'No. MarComn does not charge any hidden maintenance or transaction fees. You only pay the standard configured fees for job postings or offer acceptances.', 30, true);

    -- Seed FAQs for /legal/payments
    DELETE FROM public.cms_faqs WHERE page_id = v_payments_page_id;
    INSERT INTO public.cms_faqs (page_id, question, answer, sort_order, is_published)
    VALUES
        (v_payments_page_id, 'How do I request a refund?', 'If your purchase falls under one of the allowed refund exceptions (such as duplicate payment or technical error), contact support at {{support_email}} with your checkout transaction ID or receipt number.', 10, true),
        (v_payments_page_id, 'What happens during a chargeback?', 'If a card chargeback is initiated, the associated account may be temporarily locked while we investigate the transaction with our payment processor. We recommend contacting support first to resolve issues amicably.', 20, true);

END $$;

COMMIT;
