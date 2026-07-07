create table if not exists community_posts (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references profiles(id) on delete cascade,
  content         text not null check (char_length(content) between 1 and 2000),
  created_at      timestamptz not null default now()
);
create index if not exists community_posts_created_at_idx on community_posts (created_at desc);

create table if not exists community_post_likes (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references community_posts(id) on delete cascade,
  professional_id uuid not null references profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (post_id, professional_id)
);
create index if not exists community_post_likes_post_id_idx on community_post_likes (post_id);

create table if not exists community_post_comments (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references community_posts(id) on delete cascade,
  professional_id uuid not null references profiles(id) on delete cascade,
  content         text not null check (char_length(content) between 1 and 500),
  created_at      timestamptz not null default now()
);
create index if not exists community_post_comments_post_id_idx on community_post_comments (post_id);

alter table community_posts enable row level security;
alter table community_post_likes enable row level security;
alter table community_post_comments enable row level security;

-- leitura: qualquer profissional autenticado
create policy "read_posts" on community_posts for select using (true);
create policy "insert_own_post" on community_posts for insert with check (
  auth.uid() = professional_id
  and not exists (select 1 from profiles p where p.id = auth.uid() and p.comunidade_banned = true)
);
create policy "delete_own_post" on community_posts for delete using (auth.uid() = professional_id);

create policy "read_likes" on community_post_likes for select using (true);
create policy "insert_own_like" on community_post_likes for insert with check (auth.uid() = professional_id);
create policy "delete_own_like" on community_post_likes for delete using (auth.uid() = professional_id);

create policy "read_comments" on community_post_comments for select using (true);
create policy "insert_own_comment" on community_post_comments for insert with check (
  auth.uid() = professional_id
  and not exists (select 1 from profiles p where p.id = auth.uid() and p.comunidade_banned = true)
);
create policy "delete_own_comment" on community_post_comments for delete using (auth.uid() = professional_id);

alter table profiles add column if not exists whatsapp text;
alter table profiles add column if not exists subespecialidades text[];
