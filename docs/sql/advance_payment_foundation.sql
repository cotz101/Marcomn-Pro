-- =====================================================================
-- ADVANCE PAYMENT MODULE FOUNDATION MIGRATION
-- =====================================================================
-- DESCRIPTION: Creates the schema, constraints, indexes, and RLS policies
--              for the offline Advance Payment Module.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. MODIFY public.jobs TABLE
-- ---------------------------------------------------------------------

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS advance_payment_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS advance_payment_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS advance_payment_value NUMERIC(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS advance_payment_max NUMERIC(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS advance_payment_allow_multiple BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS advance_payment_notes TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS advance_payment_availability TEXT DEFAULT 'shortlisted',
ADD COLUMN IF NOT EXISTS advance_payment_expiry_days INTEGER DEFAULT NULL;

-- Drop constraints if they exist to support re-runs
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS chk_advance_payment_type;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS chk_advance_payment_availability;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS chk_advance_payment_expiry_days;

ALTER TABLE public.jobs
ADD CONSTRAINT chk_advance_payment_type 
    CHECK (advance_payment_type IS NULL OR advance_payment_type IN ('fixed', 'percentage')),
ADD CONSTRAINT chk_advance_payment_availability 
    CHECK (advance_payment_availability IN ('shortlisted', 'offered', 'accepted')),
ADD CONSTRAINT chk_advance_payment_expiry_days 
    CHECK (advance_payment_expiry_days IS NULL OR advance_payment_expiry_days > 0),
ADD CONSTRAINT chk_advance_max_salary
    CHECK (advance_payment_max IS NULL OR salary_numeric IS NULL OR advance_payment_max <= salary_numeric);

-- ---------------------------------------------------------------------
-- 2. CREATE public.job_advance_requests TABLE
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_advance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    job_order_id UUID DEFAULT NULL REFERENCES public.job_orders(id) ON DELETE SET NULL,
    applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    requested_amount NUMERIC(10,2) NOT NULL,
    counter_amount NUMERIC(10,2) DEFAULT NULL,
    approved_amount NUMERIC(10,2) DEFAULT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT DEFAULT NULL,
    transfer_date DATE DEFAULT NULL,
    reference_number TEXT DEFAULT NULL,
    company_notes TEXT DEFAULT NULL,
    applicant_notes TEXT DEFAULT NULL,
    dispute_reason TEXT DEFAULT NULL,
    expires_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    negotiated_at TIMESTAMPTZ DEFAULT NULL,
    paid_at TIMESTAMPTZ DEFAULT NULL,
    confirmed_at TIMESTAMPTZ DEFAULT NULL,
    proof_url TEXT DEFAULT NULL,
    
    CONSTRAINT chk_advance_status 
        CHECK (status IN ('pending', 'countered', 'approved', 'transfer_recorded', 'confirmed', 'rejected', 'disputed', 'cancelled', 'expired', 'review_closed')),
    CONSTRAINT chk_advance_payment_method 
        CHECK (payment_method IS NULL OR payment_method IN ('bank_transfer', 'wise', 'paypal', 'gcash', 'paynow', 'cash', 'other')),
    CONSTRAINT chk_requested_amount_positive 
        CHECK (requested_amount > 0)
);

-- ---------------------------------------------------------------------
-- 3. CREATE public.job_advance_audit_logs TABLE
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_advance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.job_advance_requests(id) ON DELETE SET NULL,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. CREATE PERFORMANCE INDEXES
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_advance_req_application ON public.job_advance_requests(application_id);
CREATE INDEX IF NOT EXISTS idx_advance_req_order ON public.job_advance_requests(job_order_id);
CREATE INDEX IF NOT EXISTS idx_advance_req_status ON public.job_advance_requests(status);
CREATE INDEX IF NOT EXISTS idx_advance_audit_req ON public.job_advance_audit_logs(request_id);

-- ---------------------------------------------------------------------
-- 5. ENABLE ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

ALTER TABLE public.job_advance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_advance_audit_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 6. DEFINE RLS POLICIES FOR job_advance_requests
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view involved advance requests" ON public.job_advance_requests;
CREATE POLICY "Users can view involved advance requests" ON public.job_advance_requests
    FOR SELECT TO authenticated
    USING (
        auth.uid() = applicant_id 
        OR job_id IN (
            SELECT j.id FROM public.jobs j 
            WHERE j.poster_id = auth.uid() 
               OR j.company_id IN (
                   SELECT cm.company_id FROM public.company_members cm 
                   WHERE cm.profile_id = auth.uid()
               )
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
              AND p.global_role IN ('super_admin', 'admin', 'brand_manager')
        )
        OR EXISTS (
            SELECT 1 FROM public.platform_admin_user_roles pur 
            WHERE pur.user_id = auth.uid() AND pur.is_active = true
        )
    );

DROP POLICY IF EXISTS "Candidates can insert advance requests" ON public.job_advance_requests;
CREATE POLICY "Candidates can insert advance requests" ON public.job_advance_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = applicant_id
        AND EXISTS (
            SELECT 1 FROM public.applications app
            JOIN public.jobs j ON j.id = app.job_id
            WHERE app.id = application_id
              AND app.applicant_id = auth.uid()
              AND j.advance_payment_enabled = true
        )
    );

DROP POLICY IF EXISTS "Involved parties can update advance requests" ON public.job_advance_requests;
CREATE POLICY "Involved parties can update advance requests" ON public.job_advance_requests
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = applicant_id
        OR job_id IN (
            SELECT j.id FROM public.jobs j 
            WHERE j.poster_id = auth.uid() 
               OR j.company_id IN (
                   SELECT cm.company_id FROM public.company_members cm 
                   WHERE cm.profile_id = auth.uid()
               )
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
              AND p.global_role IN ('super_admin', 'admin', 'brand_manager')
        )
        OR EXISTS (
            SELECT 1 FROM public.platform_admin_user_roles pur 
            WHERE pur.user_id = auth.uid() AND pur.is_active = true
        )
    )
    WITH CHECK (
        auth.uid() = applicant_id
        OR job_id IN (
            SELECT j.id FROM public.jobs j 
            WHERE j.poster_id = auth.uid() 
               OR j.company_id IN (
                   SELECT cm.company_id FROM public.company_members cm 
                   WHERE cm.profile_id = auth.uid()
               )
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
              AND p.global_role IN ('super_admin', 'admin', 'brand_manager')
        )
        OR EXISTS (
            SELECT 1 FROM public.platform_admin_user_roles pur 
            WHERE pur.user_id = auth.uid() AND pur.is_active = true
        )
    );

-- ---------------------------------------------------------------------
-- 7. DEFINE RLS POLICIES FOR job_advance_audit_logs
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Involved parties and admins can view audit logs" ON public.job_advance_audit_logs;
CREATE POLICY "Involved parties and admins can view audit logs" ON public.job_advance_audit_logs
    FOR SELECT TO authenticated
    USING (
        actor_id = auth.uid()
        OR job_id IN (
            SELECT j.id FROM public.jobs j 
            WHERE j.poster_id = auth.uid() 
               OR j.company_id IN (
                   SELECT cm.company_id FROM public.company_members cm 
                   WHERE cm.profile_id = auth.uid()
               )
        )
        OR EXISTS (
            SELECT 1 FROM public.job_advance_requests r
            WHERE r.id = request_id AND r.applicant_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
              AND p.global_role IN ('super_admin', 'admin', 'brand_manager')
        )
        OR EXISTS (
            SELECT 1 FROM public.platform_admin_user_roles pur 
            WHERE pur.user_id = auth.uid() AND pur.is_active = true
        )
    );

DROP POLICY IF EXISTS "System and actors can insert audit logs" ON public.job_advance_audit_logs;
CREATE POLICY "System and actors can insert audit logs" ON public.job_advance_audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        actor_id = auth.uid()
    );

COMMIT;
