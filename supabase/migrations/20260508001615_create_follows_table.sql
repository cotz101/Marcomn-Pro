create table public.follows (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(follower_id, following_id)
);

-- RLS
alter table public.follows enable row level security;

create policy "Users can see all follows"
  on public.follows for select
  using ( true );

create policy "Users can follow others"
  on public.follows for insert
  with check ( auth.uid() = follower_id );

create policy "Users can unfollow others"
  on public.follows for delete
  using ( auth.uid() = follower_id );
;
