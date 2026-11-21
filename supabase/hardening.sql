-- Fotoyuk: penguatan database.
-- Jalankan di Supabase -> SQL Editor (project yang dipakai NEXT_PUBLIC_SUPABASE_URL).
-- Semua blok di bawah idempotent (aman diulang). Jalankan satu blok per satu
-- kali agar kalau ada yang gagal, blok lain tidak ikut batal.
--
-- LATAR: public.pb_docs memakai policy `using (true)` untuk select/insert/
-- update/delete, dan pb_set/pb_patch/pb_delete adalah security definer yang
-- di-grant ke anon. Artinya siapa pun yang memegang anon key (kunci ini selalu
-- ada di bundle situs) bisa membaca dan menghapus seluruh isi tabel, termasuk
-- room_photos (foto mode berdua) dan users.
--
-- CATATAN: blok A dan B aman dijalankan sekarang. Blok C belum boleh dijalankan
-- sebelum panel admin memakai Supabase Auth, karena aplikasi saat ini menulis
-- template lewat anon key.


-- =====================================================================
-- BLOK A - bersihkan sesi lama supaya foto tidak menumpuk (aman)
-- =====================================================================
create extension if not exists pg_cron;

select cron.unschedule('pb_bersihkan_sesi_lama')
 where exists (select 1 from cron.job where jobname = 'pb_bersihkan_sesi_lama');

select cron.schedule(
  'pb_bersihkan_sesi_lama',
  '17 * * * *',
  $job$
    delete from public.pb_docs
     where collection in ('rooms', 'room_photos')
       and updated_at < now() - interval '24 hours';
  $job$
);


-- =====================================================================
-- BLOK B - batasi ukuran satu dokumen (aman, mencegah tabel dibanjiri)
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
-- BLOK C - kunci tulis template ke akun admin (BUTUH SUPABASE AUTH)
-- Jalankan hanya setelah admin masuk lewat Supabase Auth dan email di bawah
-- cocok dengan akun admin. Tanpa itu, simpan/hapus template di /admin akan
-- ditolak dan panel admin kehilangan fungsi simpannya.
-- =====================================================================
-- create policy pb_overlays_write on public.pb_docs
--   for all
--   using  (collection = 'overlays' and auth.jwt() ->> 'email' = 'aghna1011@gmail.com')
--   with check (collection = 'overlays' and auth.jwt() ->> 'email' = 'aghna1011@gmail.com');

-- Setelah blok C aktif, hapus juga policy tulis bebas:
-- drop policy if exists pb_docs_insert on public.pb_docs;
-- drop policy if exists pb_docs_update on public.pb_docs;
-- drop policy if exists pb_docs_delete on public.pb_docs;
