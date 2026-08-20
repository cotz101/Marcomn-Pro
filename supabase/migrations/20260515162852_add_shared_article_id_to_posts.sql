ALTER TABLE public.posts ADD COLUMN shared_article_id UUID REFERENCES public.mblog_articles(id) ON DELETE SET NULL;;
