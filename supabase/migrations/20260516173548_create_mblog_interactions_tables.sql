-- Create mblog_article_likes table
CREATE TABLE IF NOT EXISTS public.mblog_article_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES public.mblog_articles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(article_id, user_id)
);

-- Create mblog_article_comments table
CREATE TABLE IF NOT EXISTS public.mblog_article_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES public.mblog_articles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mblog_article_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mblog_article_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Likes
CREATE POLICY "Anyone can view mblog article likes" ON public.mblog_article_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can toggle their own likes" ON public.mblog_article_likes FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for Comments
CREATE POLICY "Anyone can view mblog article comments" ON public.mblog_article_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage their own comments" ON public.mblog_article_comments FOR ALL USING (auth.uid() = user_id);
;
