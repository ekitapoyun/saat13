import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nodesOf, CHAPTERS } from '@/story/nodes';

// Yönetici paneli API'si. Yalnızca ADMIN_EMAILS listesindeki hesaplar erişebilir.
// Liste boşsa kimse erişemez. Hizmet anahtarı yalnızca burada, sunucuda kullanılır.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const admins = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function emailMap(): Promise<Record<string, { email: string; lastSignIn: string | null }>> {
  const out: Record<string, { email: string; lastSignIn: string | null }> = {};
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    data.users.forEach((u) => { out[u.id] = { email: u.email ?? '', lastSignIn: u.last_sign_in_at ?? null }; });
    if (data.users.length < 1000) break;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return fail('Giriş gerekli', 401);
  const { data: u } = await admin.auth.getUser(token);
  const mail = u.user?.email?.toLowerCase();
  if (!mail) return fail('Geçersiz oturum', 401);
  if (admins.length === 0 || !admins.includes(mail)) return fail('Bu sayfaya erişim yetkin yok', 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? 'overview');

  if (action === 'deleteNpc') {
    const id = String(body.id ?? '');
    if (!id) return fail('Geçersiz kayıt');
    const { error } = await admin.from('world_memory').delete().eq('id', id);
    if (error) return fail('Silinemedi', 500);
    return NextResponse.json({ ok: true });
  }

  const [{ data: chars, error }, { data: memory }, emails] = await Promise.all([
    admin.from('characters').select('*').limit(500),
    admin.from('world_memory').select('id,name,description,voice,created_at,introduced_by').order('created_at', { ascending: false }).limit(100),
    emailMap(),
  ]);
  if (error) return fail('Veriler okunamadı: ' + error.message, 500);

  const now = Date.now();
  const players = (chars ?? []).map((c: any) => {
    const chapter: number = c.chapter ?? 1;
    const nodes = nodesOf(chapter);
    const total = nodes.length;
    const finished = c.node > total;
    const info = emails[c.user_id];
    const last = c.updated_at ?? info?.lastSignIn ?? c.created_at;
    return {
      id: c.id,
      name: c.name,
      email: info?.email ?? '',
      skill: c.skill,
      chapter,
      chapterTitle: CHAPTERS[chapter]?.title ?? '',
      node: c.node,
      total,
      title: finished ? 'Bölüm sonu' : nodes[c.node - 1]?.title ?? '',
      progress: Math.round((Math.min(c.node - 1, total) / total) * 100),
      finished,
      completed: c.meta?.done ?? [],
      replays: c.meta?.replays ?? 0,
      nights: c.meta?.nights ?? 0,
      moves: c.meta?.moves ?? 0,
      location: c.location,
      fear: c.fear,
      lantern: c.lantern,
      items: c.items ?? [],
      flags: Object.keys(c.flags ?? {}),
      trust: c.trust ?? {},
      lastScene: String(c.current?.baseText ?? c.current?.text ?? '').slice(0, 800),
      createdAt: c.created_at,
      lastActive: last,
      activeToday: last ? now - new Date(last).getTime() < 24 * 3600 * 1000 : false,
    };
  }).sort((a: any, b: any) => String(b.lastActive).localeCompare(String(a.lastActive)));

  const stats = {
    players: players.length,
    activeToday: players.filter((p: any) => p.activeToday).length,
    finishedChapter1: players.filter((p: any) => p.completed.includes(1) || (p.chapter > 1)).length,
    avgProgress: players.length ? Math.round(players.reduce((s: number, p: any) => s + p.progress, 0) / players.length) : 0,
    inChapter2: players.filter((p: any) => p.chapter >= 2).length,
  };

  return NextResponse.json({ stats, players, memory: memory ?? [] });
}
