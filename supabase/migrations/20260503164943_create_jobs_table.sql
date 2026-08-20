CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  salary_range TEXT,
  employment_type TEXT DEFAULT 'Full-time',
  status TEXT DEFAULT 'Open',
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  poster_id UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for Jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Anyone can view open jobs
CREATE POLICY "Public can view open jobs" ON public.jobs
  FOR SELECT USING (status = 'Open');

-- Authenticated users can post jobs
CREATE POLICY "Authenticated users can post jobs" ON public.jobs
  FOR INSERT WITH CHECK (auth.uid() = poster_id);

-- Only the poster can update their jobs
CREATE POLICY "Posters can update their jobs" ON public.jobs
  FOR UPDATE USING (auth.uid() = poster_id);

-- Only the poster can delete their jobs
CREATE POLICY "Posters can delete their jobs" ON public.jobs
  FOR DELETE USING (auth.uid() = poster_id);
;
