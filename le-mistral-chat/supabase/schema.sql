-- Supabase schema for persisting chats
-- Run this entire script inside the Supabase SQL editor (connected to your project)
-- before using the chat sync features.

-- Ensure pgcrypto is available for gen_random_uuid (enabled by default on Supabase)
create extension if not exists "pgcrypto";

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model_used text,
  created_at timestamptz not null default now()
);

create index if not exists chat_sessions_user_idx on public.chat_sessions (user_id, updated_at desc);
create index if not exists chat_messages_session_idx on public.chat_messages (session_id, created_at asc);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

create table if not exists public.system_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists system_prompts_user_idx on public.system_prompts (user_id, updated_at desc);

alter table public.system_prompts enable row level security;

-- Allow users to see only their sessions
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_sessions'
      and policyname = 'Users select their sessions'
  ) then
    create policy "Users select their sessions"
      on public.chat_sessions
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- Allow insert/update/delete only if the row belongs to the user
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_sessions'
      and policyname = 'Users manage their sessions'
  ) then
    create policy "Users manage their sessions"
      on public.chat_sessions
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Messages: users can read any message that belongs to one of their sessions
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'Users select their messages'
  ) then
    create policy "Users select their messages"
      on public.chat_messages
      for select
      using (
        exists (
          select 1
          from public.chat_sessions s
          where s.id = chat_messages.session_id
            and s.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Messages insert/update restricted to owners of the parent session
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'Users manage their messages'
  ) then
    create policy "Users manage their messages"
      on public.chat_messages
      for all
      using (
        exists (
          select 1
          from public.chat_sessions s
          where s.id = chat_messages.session_id
            and s.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.chat_sessions s
          where s.id = chat_messages.session_id
            and s.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- System prompts RLS policies
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'system_prompts'
      and policyname = 'Users select their prompts'
  ) then
    create policy "Users select their prompts"
      on public.system_prompts
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'system_prompts'
      and policyname = 'Users manage their prompts'
  ) then
    create policy "Users manage their prompts"
      on public.system_prompts
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

comment on table public.chat_sessions is 'Stores chat threads per user for the Mistral chat app.';
comment on table public.chat_messages is 'Stores chat messages tied to a session for the Mistral chat app.';
comment on table public.system_prompts is 'User-defined system prompts for customising assistant behaviour.';

-- ---------------------------------------------------------------------------
-- Storage setup for profile pictures (bucket + RLS policies)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'profile-pictures') then
    perform storage.create_bucket('profile-pictures', public => true);
  end if;
end $$;

-- Allow authenticated users to upload objects inside their own folder
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users upload their avatars'
  ) then
    create policy "Users upload their avatars"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'profile-pictures'
        and auth.uid()::text = split_part(name, '/', 1)
      );
  end if;
end $$;

-- Allow authenticated users to remove their own files
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users delete their avatars'
  ) then
    create policy "Users delete their avatars"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'profile-pictures'
        and auth.uid()::text = split_part(name, '/', 1)
      );
  end if;
end $$;
