create table public.likes (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(post_id, user_id)
);

-- RLS policies
alter table public.likes enable row level security;

create policy "Likes are viewable by everyone" 
  on public.likes for select 
  using (true);

create policy "Users can insert their own likes" 
  on public.likes for insert 
  with check (auth.uid() = user_id);

create policy "Users can delete their own likes" 
  on public.likes for delete 
  using (auth.uid() = user_id);
;
