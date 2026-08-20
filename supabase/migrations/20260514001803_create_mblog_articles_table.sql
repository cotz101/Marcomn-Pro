CREATE TABLE public.mblog_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content_html TEXT NOT NULL,
    media_url TEXT,
    pdf_url TEXT,
    youtube_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mblog_articles ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Everyone can read articles
CREATE POLICY "Everyone can read articles" ON public.mblog_articles
    FOR SELECT USING (true);

-- INSERT policy: Any authenticated user can create an article
CREATE POLICY "Authenticated users can create articles" ON public.mblog_articles
    FOR INSERT WITH CHECK (auth.uid() = author_id);

-- UPDATE/DELETE policy: Only the author can modify or remove their own article
CREATE POLICY "Authors can update their own articles" ON public.mblog_articles
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own articles" ON public.mblog_articles
    FOR DELETE USING (auth.uid() = author_id);
;
