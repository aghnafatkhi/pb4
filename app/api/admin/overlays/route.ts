import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/adminSession';
import { getServiceSupabase } from '@/lib/serverSupabase';

// Overlay template hanya boleh ditulis lewat panel admin. Route ini memakai
// service-role key di server sehingga anon tidak lagi perlu punya hak tulis
// ke collection 'overlays' di Supabase.

async function guard(): Promise<NextResponse | null> {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Panel admin belum dikonfigurasi.' }, { status: 503 });
  }
  const jar = await cookies();
  if (!(await verifyAdminToken(jar.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Sesi admin tidak valid.' }, { status: 401 });
  }
  return null;
}

function errorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('pb_docs')
      .select('id,data')
      .eq('collection', 'overlays');
    if (error) throw error;
    const overlays = (data ?? []).map((row) => ({
      id: row.id,
      ...(row.data as Record<string, unknown>),
    }));
    return NextResponse.json({ overlays });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const body = (await request.json()) as { id?: string; payload?: Record<string, unknown> };
    const id = typeof body.id === 'string' && body.id ? body.id : crypto.randomUUID();
    if (!body.payload || typeof body.payload !== 'object') {
      return NextResponse.json({ error: 'Payload overlay tidak valid.' }, { status: 400 });
    }
    const supabase = getServiceSupabase();
    const { error } = await supabase.rpc('pb_set', {
      p_coll: 'overlays',
      p_id: id,
      p_data: body.payload,
      p_merge: true,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: 'ID overlay wajib ada.' }, { status: 400 });
    }
    const supabase = getServiceSupabase();
    const { error } = await supabase.rpc('pb_delete', { p_coll: 'overlays', p_id: body.id });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
