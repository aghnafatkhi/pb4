-- Fotoyuk: penguatan database (v2).
-- Jalankan di Supabase -> SQL Editor pada project yang dipakai
-- NEXT_PUBLIC_SUPABASE_URL, satu blok sekali jalan (semua blok idempotent).
--
-- LATAR: tabel pb_docs semula terbuka penuh untuk anon (policy using(true)
-- untuk semua operasi, plus pb_set/pb_patch/pb_delete security-definer yang
-- di-grant ke anon). Siapa pun yang memegang anon key bisa membaca, menimpa,
-- dan menghapus seluruh isi — termasuk room_photos (foto berdua) dan semua
-- template overlay panel admin.
--
-- Perubahan v2 dibanding draft lama:
--   * Tulisan overlays dikunci total untuk anon: kini panel admin menyimpan
--     template lewat /api/admin/overlays (service-role, server-side) —
--     butuh env SUPABASE_SERVICE_ROLE_KEY di Vercel (deploy sudah ada).
--   * pb_delete hanya untuk service-role (app tidak pernah memakainya).
--   * pb_set/pb_patch hanya menerima koleksi yang dipakai app.
--   * Write langsung ke tabel ditutup; tulis hanya via RPC yang dicek.
--   * Purge otomatis sesi lama (sekalian menepati janji halaman Privasi).


-- =====================================================================
-- BLOK 1 — purge otomatis sesi lama (aman, langsung jalan)
-- =====================================================================
create extension if not exists pg_cron;

select cron.unschedule('pb_bersihkan_sesi_lama')
 where exists (select 1 from cron.job where jobname = 'pb_bersihkan_sesi_lama');

-- rooms & room_photos: hapus > 6 jam (sesi TTL 15 menit di klien, beri grace).
-- invites: hapus > 24 jam.
select cron.schedule(
  'pb_bersihkan_sesi_lama',
  '17 * * * *',
  $job$
    delete from public.pb_docs
     where (collection in ('rooms', 'room_photos') and updated_at < now() - interval '6 hours')
        or (collection = 'invites' and updated_at < now() - interval '24 hours');
  $job$
);


-- =====================================================================
-- BLOK 2 — batasi ukuran dokumen + index purge (aman)
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pb_docs_data_size'
  ) then
    alter table public.pb_docs
      add constraint pb_docs_data_size
      check (octet_length(data::text) <= 8 * 1024 * 1024);
  end if;
end $$;

create index if not exists pb_docs_collection_updated_idx
  on public.pb_docs (collection, updated_at desc);


-- =====================================================================
-- BLOK 3 — tutup tulis langsung ke tabel (aman: app menulis via RPC)
-- =====================================================================
drop policy if exists pb_docs_insert on public.pb_docs;
drop policy if exists pb_docs_update on public.pb_docs;
drop policy if exists pb_docs_delete on public.pb_docs;

-- SELECT tetap terbuka: klien membaca room/foto/template via PostgREST.
drop policy if exists pb_docs_select on public.pb_docs;
create policy pb_docs_select on public.pb_docs
  for select to anon, authenticated using (true);


-- =====================================================================
-- BLOK 4 — perkuat RPC (inti hardening)
--   * anon hanya boleh menulis koleksi app: rooms, room_photos, invites, users
--   * overlays: hanya service-role (API route panel admin)
--   * delete: hanya service-role
-- =====================================================================
create or replace function public.pb_set(p_coll text, p_id text, p_data jsonb, p_merge boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller text := coalesce(nullif(auth.jwt() ->> 'role', ''), 'anon');
begin
  if caller <> 'service_role' then
    if p_coll = 'overlays' then
      raise exception 'Tulis overlay hanya lewat panel admin.';
    end if;
    if p_coll not in ('rooms', 'room_photos', 'invites', 'users') then
      raise exception 'Koleksi % tidak diizinkan.', p_coll;
    end if;
    if octet_length(coalesce(p_data, '{}'::jsonb)::text) > 8 * 1024 * 1024 then
      raise exception 'Dokumen terlalu besar (maks 8 MB).';
    end if;
  end if;

  insert into public.pb_docs (collection, id, data)
  values (p_coll, p_id, coalesce(p_data, '{}'::jsonb))
  on conflict (collection, id) do update
    set data = case when p_merge then public.pb_docs.data || excluded.data else excluded.data end,
        updated_at = now();
end $$;

create or replace function public.pb_patch(p_coll text, p_id text, p_patch jsonb default '{}'::jsonb, p_append jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller text := coalesce(nullif(auth.jwt() ->> 'role', ''), 'anon');
  k text;
  v jsonb;
  path text[];
begin
  if caller <> 'service_role' then
    if p_coll = 'overlays' then
      raise exception 'Tulis overlay hanya lewat panel admin.';
    end if;
    if p_coll not in ('rooms', 'room_photos', 'invites', 'users') then
      raise exception 'Koleksi % tidak diizinkan.', p_coll;
    end if;
  end if;

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
declare
  caller text := coalesce(nullif(auth.jwt() ->> 'role', ''), 'anon');
begin
  if caller <> 'service_role' then
    raise exception 'Hapus dokumen hanya lewat panel admin.';
  end if;
  delete from public.pb_docs where collection = p_coll and id = p_id;
end $$;

revoke all on function public.pb_set(text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.pb_patch(text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.pb_delete(text, text) from public, anon, authenticated;

grant execute on function public.pb_set(text, text, jsonb, boolean) to anon, authenticated, service_role;
grant execute on function public.pb_patch(text, text, jsonb, jsonb) to anon, authenticated, service_role;
grant execute on function public.pb_delete(text, text) to service_role;


-- =====================================================================
-- BLOK 5 — verifikasi cepat (opsional, lihat hasilnya di output)
--   Harusnya: baris pertama error (ditolak), baris kedua "ok".
-- =====================================================================
-- select public.pb_set('overlays', 'tes-anon', '{"x":1}'::jsonb, false);  -- harus GAGAL
-- select public.pb_set('rooms', 'tes-anon', '{"x":1}'::jsonb, false);     -- harus OK
-- lalu bersihkan: select public.pb_docs where ...
