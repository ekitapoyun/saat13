import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { BIBLE, RULES } from '@/story/bible';
import { NODES, LOCATION_CODES, ALLOWED_ITEMS } from '@/story/nodes';

// Durum burada, sunucuda tutulur ve doğrulanır. AI yalnızca öneri yapar.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const ai = new Anthropic();
const MODEL = process.env.SCENE_MODEL || 'claude-sonnet-5-5';

type StoredChoice = { id: string; label: string; to?: string; fear?: number; give?: string; flag?: string };
type StoredScene = { text: string; choices: StoredChoice[] };

const publicScene = (s: StoredScene) => ({
  text: s.text,
  choices: s.choices.map(({ id, label }) => ({ id, label })),
});

const fallbackScene = (location: string): StoredScene => ({
  text: 'Sis bir an yoğunlaşıyor, sonra yeniden inceliyor. Fenerin ışığı sıcak ve sakin. Biraz soluklanıp çevreye bakmak iyi bir fikir.',
  choices: [
    { id: 'a', label: 'Çevreye dikkatle bak' },
    { id: 'b', label: 'Yurda doğru yürü', to: 'yurt' },
  ],
});

const nightOverScene: StoredScene = {
  text: 'Fenerin alevi küçülüp küçülüp sönüyor. Tam karanlık basmadan, kapının önünde Nene Selvi beliriyor, elinde başka bir fener ve sıcak bir battaniye. "Yeter bu gece, hadi eve." Yurdun sıcaklığı sana tüm yorgunluğu unutturuyor. Bulduğun ipuçları cebinde. Yarın yeni bir gece.',
  choices: [{ id: 'rest', label: 'Dinlen ve yeni bir gece başlat', to: 'yurt' }],
};

const finishedScene: StoredScene = {
  text: 'Bu bölümün sonuna geldin. Sis inceldi, kasaba ilk kez nefes alıyor. Yeni bir macera için yakında yine buluşacağız.',
  choices: [],
};

function flagHash(flags: Record<string, unknown>) {
  return createHash('sha1').update(JSON.stringify(Object.keys(flags).sort())).digest('hex').slice(0, 10);
}

function parseScene(raw: string): StoredScene | null {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const j = JSON.parse(cleaned);
    if (typeof j.text !== 'string' || j.text.length < 40 || j.text.length > 2500) return null;
    if (!Array.isArray(j.choices) || j.choices.length < 2 || j.choices.length > 4) return null;
    const choices: StoredChoice[] = j.choices.map((c: any, i: number): StoredChoice => ({
      id: String(c.id ?? 'abcd'[i]).slice(0, 8),
      label: String(c.label ?? '').slice(0, 120),
      to: LOCATION_CODES.includes(c.to) ? c.to : undefined,
      fear: [-1, 0, 1].includes(c.fear) ? c.fear : 0,
      give: ALLOWED_ITEMS.includes(c.give) ? c.give : undefined,
      flag: typeof c.flag === 'string' && /^[a-z_0-9]{3,30}$/.test(c.flag) ? c.flag : undefined,
    }));
    if (choices.some((c) => !c.label)) return null;
    return { text: j.text, choices };
  } catch {
    return null;
  }
}

async function generate(ch: any, location: string, node: (typeof NODES)[number]): Promise<StoredScene> {
  const { data: memory } = await admin.from('world_memory').select('name,description,voice').limit(40);
  const state = {
    oyuncu: { ad: ch.name, yetenek: ch.skill, korku: ch.fear, fener: ch.lantern, esyalar: ch.items, bayraklar: Object.keys(ch.flags) },
    mekan: location,
    izinli_mekanlar: LOCATION_CODES,
    hedef_donum_noktasi: { no: node.n, baslik: node.title, mekan: node.location, hedef: node.goal, bitis_bayragi: node.flag },
    son_sahne: ch.current?.text?.slice(0, 600) ?? null,
    bilinen_npcler: memory ?? [],
  };
  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: `${BIBLE}\n${RULES}`,
    messages: [{
      role: 'user',
      content: `Oyuncunun durumu:\n${JSON.stringify(state)}\n\nBir sonraki sahneyi yaz. Oyuncuyu hedef dönüm noktasına yaklaştır ama acele ettirme.`,
    }],
  });
  const block = msg.content.find((b) => b.type === 'text');
  const scene = block && block.type === 'text' ? parseScene(block.text) : null;
  return scene ?? fallbackScene(location);
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });
  const { data: u } = await admin.auth.getUser(token);
  if (!u.user) return NextResponse.json({ error: 'Geçersiz oturum' }, { status: 401 });

  const { data: ch } = await admin.from('characters').select('*').eq('user_id', u.user.id).single();
  if (!ch) return NextResponse.json({ error: 'Karakter yok' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const choiceId: string | undefined = typeof body.choiceId === 'string' ? body.choiceId : undefined;

  let { location, node, fear, lantern } = ch as { location: string; node: number; fear: number; lantern: number };
  const items: string[] = [...ch.items];
  const flags: Record<string, boolean> = { ...ch.flags };

  // Sayfa yenilenirse aynı sahneyi tekrar göster, yeni seçim yoksa AI'ı çağırma.
  if (!choiceId && ch.current) {
    return NextResponse.json({ scene: publicScene(ch.current), character: toPublic(ch) });
  }

  if (choiceId) {
    const picked: StoredChoice | undefined = ch.current?.choices?.find((c: StoredChoice) => c.id === choiceId);
    if (!picked) return NextResponse.json({ error: 'Geçersiz seçim' }, { status: 400 });

    lantern = Math.max(0, lantern - 1);
    fear = Math.min(4, Math.max(0, fear + (picked.fear ?? 0)));
    if (picked.give && !items.includes(picked.give) && items.length < 8) items.push(picked.give);
    if (picked.flag) flags[picked.flag] = true;
    if (picked.to) location = picked.to;
    const cur = NODES[node - 1];
    if (cur && flags[cur.flag]) node += 1;

    // Korku sınırı: ceza yok, yumuşak dönüş.
    if (fear >= 4) { location = 'yurt'; fear = 0; lantern = Math.min(14, lantern + 4); }
  }

  let scene: StoredScene;
  if (node > NODES.length) {
    scene = finishedScene;
  } else if (lantern <= 0) {
    scene = nightOverScene;
    location = 'yurt';
    lantern = 14;
  } else {
    const target = NODES[node - 1];
    const cacheKey = `${target.n}|${location}|${flagHash(flags)}`;
    const { data: cached } = await admin.from('scenes').select('body').eq('cache_key', cacheKey).maybeSingle();
    if (cached) {
      scene = cached.body as StoredScene;
    } else {
      scene = await generate({ ...ch, location, fear, lantern, items, flags }, location, target);
      await admin.from('scenes').upsert({ cache_key: cacheKey, location, node: target.n, body: scene }, { onConflict: 'cache_key' });
    }
  }

  const { data: updated } = await admin
    .from('characters')
    .update({ location, node, fear, lantern, items, flags, current: scene })
    .eq('id', ch.id)
    .select()
    .single();

  return NextResponse.json({ scene: publicScene(scene), character: toPublic(updated ?? ch) });
}

function toPublic(c: any) {
  return { id: c.id, name: c.name, skill: c.skill, location: c.location, node: c.node, fear: c.fear, lantern: c.lantern, items: c.items };
}
