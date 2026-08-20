-- Update profiles table
alter table public.profiles 
add column if not exists headline text,
add column if not exists location text,
add column if not exists about text,
add column if not exists cover_photo_url text;

-- Create posts table
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text,
  content text not null,
  media_url text,
  media_type text default 'image',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on posts
alter table public.posts enable row level security;

-- Policies for posts
create policy "Users can insert their own posts."
  on public.posts for insert
  with check ( auth.uid() = user_id );

create policy "Anyone can view posts."
  on public.posts for select
  using ( true );

-- Enable Realtime for posts
alter publication supabase_realtime add table posts;
;
