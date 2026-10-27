import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nodesOf, CHAPTERS } from '@/story/nodes';
import { LOCATION_NAMES } from '@/story/map';

// Kayıt yuvaları ve baştan başlama. Oyun her adımda zaten kendiliğinden kaydeder;
// buradaki kayıtlar "bu ana geri dönebileyim" içindir. Her şey sunucuda yapılır.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const SLOTS = [1, 2, 3];

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return fail('Giriş gerekli', 401);
  const { data: u } = await admin.auth.getUser(token);
  if (!u.user) return fail('Geçersiz oturum', 401);
  const { data: ch } = await admin.from('characters').select('*').eq('user_id', u.user.id).single();
  if (!ch) return fail('Karakter yok', 404);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const slot = Number(body.slot);

  if (action === 'list') {
    const { data } = await admin.from('saves').select('slot,label,created_at').eq('character_id', ch.id);
    return NextResponse.json({
      slots: SLOTS.map((s) => {
        const r = (data ?? []).find((x) => x.slot === s);
        return { slot: s, label: r?.label ?? null, at: r?.created_at ?? null };
      }),
    });
  }

  if (action === 'save') {
    if (!SLOTS.includes(slot)) return fail('Geçersiz kayıt yeri');
    if (!ch.current) return fail('Kaydedilecek bir sahne yok');
    const chapter: number = ch.chapter ?? 1;
    const total = nodesOf(chapter).length;
    const stop = Math.min(ch.node, total);
    const label = `Bölüm ${chapter} · Durak ${stop}/${total} · ${LOCATION_NAMES[ch.location] ?? ch.location} · fener ${ch.lantern}`;
    const data = {
      location: ch.location, node: ch.node, fear: ch.fear, lantern: ch.lantern, items: ch.items,
      flags: ch.flags, chapter, trust: ch.trust ?? {}, meta: ch.meta ?? {}, current: ch.current,
    };
    const { error } = await admin.from('saves').upsert(
      { character_id: ch.id, slot, label, data, created_at: new Date().toISOString() },
      { onConflict: 'character_id,slot' }
    );
    if (error) return fail('Kayıt alınamadı', 500);
    return NextResponse.json({ ok: true, message: `Kaydedildi: ${label}` });
  }

  if (action === 'load') {
    if (!SLOTS.includes(slot)) return fail('Geçersiz kayıt yeri');
    const { data: s } = await admin.from('saves').select('data,label').eq('character_id', ch.id).eq('slot', slot).maybeSingle();
    if (!s) return fail('Bu yuva boş');
    const d = s.data as any;
    if (!CHAPTERS[d.chapter]) return fail('Bu kayıt okunamadı');
    const { error } = await admin.from('characters').update({
      location: d.location, node: d.node, fear: d.fear, lantern: d.lantern, items: d.items,
      flags: d.flags, chapter: d.chapter, trust: d.trust, meta: d.meta, current: d.current,
    }).eq('id', ch.id);
    if (error) return fail('Kayıt yüklenemedi', 500);
    return NextResponse.json({ ok: true, message: `Yüklendi: ${s.label}` });
  }

  if (action === 'reset') {
    // Ad ve yetenek kalır. İlerleme, eşyalar ve güven puanları sıfırlanır. Kayıt yuvaları korunur.
    // İstenirse yeni takma ad ve yetenekle (yeni karakter) başlanır.
    const meta = { replays: ((ch.meta ?? {}).replays ?? 0) + 1 };
    const who: { name?: string; skill?: string } = {};
    if (body.name !== undefined || body.skill !== undefined) {
      const name = String(body.name ?? '').trim();
      const skill = String(body.skill ?? '');
      if (name.length < 2 || name.length > 16) return fail('Takma ad 2 ile 16 harf arasında olmalı');
      if (!['gozlemci', 'konuskan', 'cevik', 'tamirci'].includes(skill)) return fail('Geçersiz yetenek');
      who.name = name;
      who.skill = skill;
    }
    const { error } = await admin.from('characters').update({
      ...who,
      location: 'yurt', node: 1, fear: 0, lantern: 14, items: [], flags: {},
      chapter: 1, trust: {}, meta, current: null,
    }).eq('id', ch.id);
    if (error) return fail('Baştan başlanamadı', 500);
    return NextResponse.json({ ok: true, message: who.name ? `Yeni karakter: ${who.name}. Yeni bir oyun başladı.` : 'Yeni bir oyun başladı.' });
  }

  return fail('Bilinmeyen işlem');
}
