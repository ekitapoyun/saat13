-- 13. Vuruş veritabanı şeması. Supabase > SQL Editor'de çalıştırın.

create extension if not exists pgcrypto;

-- Her kullanıcının tek bir karakteri var. Oyun durumu burada tutulur.
create table characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 16),
  skill text not null check (skill in ('gozlemci','konuskan','cevik','tamirci')),
  location text not null default 'yurt',
  node int not null default 1 check (node between 1 and 21),
  fear int not null default 0 check (fear between 0 and 4),
  lantern int not null default 14 check (lantern between 0 and 14),
  items text[] not null default '{}',
  flags jsonb not null default '{}'::jsonb,
  current jsonb,                       -- oyuncunun şu an gördüğü sahne ve seçenekleri
  created_at timestamptz not null default now()
);

-- Üretilen sahneler önbelleğe alınır: aynı durumdaki oyuncular aynı sahneyi görür.
create table scenes (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  location text not null,
  node int not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);

-- Dünya hafızası: AI'ın icat ettiği NPC'ler ve yerler burada saklanır, tutarlılık için.
create table world_memory (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('npc','place')),
  name text not null unique,
  description text not null,
  voice text,
  created_at timestamptz not null default now()
);

-- Ortak sahneler (birleşen oyuncular)
create table joint_sessions (
  id uuid primary key default gen_random_uuid(),
  location text not null,
  status text not null default 'open' check (status in ('open','closed')),
  round int not null default 1,
  created_at timestamptz not null default now()
);

create table joint_members (
  session_id uuid references joint_sessions(id) on delete cascade,
  character_id uuid references characters(id) on delete cascade,
  primary key (session_id, character_id)
);

create table joint_votes (
  session_id uuid references joint_sessions(id) on delete cascade,
  round int not null,
  character_id uuid references characters(id) on delete cascade,
  choice_id text not null,
  primary key (session_id, round, character_id)
);

-- Diğer oyuncular yalnızca ad ve mekân görür. Envanter ve durum gizli kalır.
create view public_characters as
  select id, name, location from characters;

alter table characters enable row level security;
alter table scenes enable row level security;
alter table world_memory enable row level security;
alter table joint_sessions enable row level security;
alter table joint_members enable row level security;
alter table joint_votes enable row level security;

create policy "kendi karakterini gor" on characters
  for select using (auth.uid() = user_id);
create policy "kendi karakterini olustur" on characters
  for insert with check (auth.uid() = user_id);
-- Güncelleme yalnızca sunucu (service role) tarafından yapılır. İstemci durum değiştiremez.

create policy "sahneleri oku" on scenes for select to authenticated using (true);
create policy "hafizayi oku" on world_memory for select to authenticated using (true);

grant select on public_characters to authenticated;

create policy "ortak oturum uyeleri" on joint_sessions
  for select using (exists (
    select 1 from joint_members m join characters c on c.id = m.character_id
    where m.session_id = joint_sessions.id and c.user_id = auth.uid()));
create policy "uyeler gorur" on joint_members
  for select using (exists (
    select 1 from characters c where c.id = joint_members.character_id and c.user_id = auth.uid()));
create policy "oylarini ver" on joint_votes
  for insert with check (exists (
    select 1 from characters c where c.id = joint_votes.character_id and c.user_id = auth.uid()));
create policy "oylari gor" on joint_votes
  for select using (exists (
    select 1 from joint_members m join characters c on c.id = m.character_id
    where m.session_id = joint_votes.session_id and c.user_id = auth.uid()));
