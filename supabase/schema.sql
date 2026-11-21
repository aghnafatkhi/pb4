-- Fotoyuk: penyimpanan dokumen di Supabase.
-- Jalankan di SQL Editor Supabase (project yang dipakai NEXT_PUBLIC_SUPABASE_URL).

create table if not exists public.pb_docs (
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

alter table public.pb_docs enable row level security;

drop policy if exists pb_docs_select on public.pb_docs;
drop policy if exists pb_docs_insert on public.pb_docs;
drop policy if exists pb_docs_update on public.pb_docs;
drop policy if exists pb_docs_delete on public.pb_docs;

create policy pb_docs_select on public.pb_docs for select using (true);
create policy pb_docs_insert on public.pb_docs for insert with check (true);
create policy pb_docs_update on public.pb_docs for update using (true) with check (true);
create policy pb_docs_delete on public.pb_docs for delete using (true);

create or replace function public.pb_set(p_coll text, p_id text, p_data jsonb, p_merge boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.pb_docs (collection, id, data)
  values (p_coll, p_id, coalesce(p_data, '{}'::jsonb))
  on conflict (collection, id) do update
    set data = case when p_merge then public.pb_docs.data || excluded.data else excluded.data end,
        updated_at = now();
end $$;

create or replace function public.pb_patch(p_coll text, p_id text, p_patch jsonb default '{}'::jsonb, p_append jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  k text;
  v jsonb;
  path text[];
begin
  for k, v in select key, value from jsonb_each(coalesce(p_patch, '{}'::jsonb)) loop
    path := string_to_array(k, '.');
    update public.pb_docs
       set data = jsonb_set(coalesce(data, '{}'::jsonb), path, v, true), updated_at = now()
     where collection = p_coll and id = p_id;
  end loop;
  for k, v in select key, value from jsonb_each(coalesce(p_append, '{}'::jsonb)) loop
    path := string_to_array(k, '.');
    update public.pb_docs
       set data = jsonb_set(coalesce(data, '{}'::jsonb), path, coalesce(data #> path, '[]'::jsonb) || jsonb_build_array(v), true), updated_at = now()
     where collection = p_coll and id = p_id;
  end loop;
end $$;

create or replace function public.pb_delete(p_coll text, p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.pb_docs where collection = p_coll and id = p_id;
end $$;

revoke all on function public.pb_set(text, text, jsonb, boolean) from public;
revoke all on function public.pb_patch(text, text, jsonb, jsonb) from public;
revoke all on function public.pb_delete(text, text) from public;

grant execute on function public.pb_set(text, text, jsonb, boolean) to anon, authenticated;
grant execute on function public.pb_patch(text, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.pb_delete(text, text) to anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  begin
    alter publication supabase_realtime add table public.pb_docs;
  exception when duplicate_object then null;
  end;
end $$;
