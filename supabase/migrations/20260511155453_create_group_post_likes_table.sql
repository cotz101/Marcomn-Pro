-- Create group_post_likes table
CREATE TABLE IF NOT EXISTS public.group_post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE public.group_post_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Likes are viewable by everyone" 
ON public.group_post_likes FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own likes" 
ON public.group_post_likes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" 
ON public.group_post_likes FOR DELETE 
USING (auth.uid() = user_id);
;
