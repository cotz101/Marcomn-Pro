-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  website text,
  industry text,
  location text,
  bio text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Create company_members table
CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('Owner', 'Admin', 'Member')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(company_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Companies Policies
-- Everyone can view companies
CREATE POLICY "Public companies are viewable by everyone" 
  ON public.companies FOR SELECT 
  USING (true);

-- Owners/Admins can update company info
CREATE POLICY "Owners and Admins can update company info" 
  ON public.companies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = companies.id
      AND profile_id = auth.uid()
      AND role IN ('Owner', 'Admin')
    )
  );

-- Only authenticated users can create companies
CREATE POLICY "Authenticated users can create companies" 
  ON public.companies FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Company Members Policies
-- Everyone can see who is in a company
CREATE POLICY "Company members are viewable by everyone" 
  ON public.company_members FOR SELECT 
  USING (true);

-- Users can join/be added (simplified for now, usually requires admin)
CREATE POLICY "Users can create their own membership on creation"
  ON public.company_members FOR INSERT
  WITH CHECK (profile_id = auth.uid());
;
