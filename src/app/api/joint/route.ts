import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { BIBLE, RULES } from '@/story/bible';

// Ortak sahne: aynı mekânda iki oyuncu birlikte kısa bir görev oynar.
// Tüm durum sunucuda tutulur ve doğrulanır, istemci yalnızca oy verir.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const ai = new Anthropic();
const MODEL = process.env.SCENE_MODEL || 'claude-sonnet-5-5';
const ROUNDS = 3; // 3 oylama turu, ardından final sahnesi
const INVITE_TTL_MS = 10 * 60 * 1000;

const LOC: Record<string, string> = {
  yurt: 'Sahipsizler Yurdu', bahce: 'Yurt Bahçesi', mezarlik: 'Unutulmuş Mezarlık', meydan: 'Çan Meydanı',
  kulube: 'Balıkçı Kulübesi', iskele: 'İskele', kutuphane: 'Eski Kütüphane', pazar: 'Pazar Sokağı',
  kayalik: 'Fener Kayalığı', kule: 'Saat Kulesi', mekanizma: 'Mekanizma Odası', atolye: "Usta'nın Atölyesi",
};

type JChoice = { id: string; label: string };
type JScene = { text: string; choices: JChoice[] };
type Hist = { text: string; choice?: string };

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function me(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: u } = await admin.auth.getUser(token);
  if (!u.user) return null;
  const { data: ch } = await admin.from('characters').select('id,name,skill,location,fear,lantern,flags').eq('user_id', u.user.id).single();
  return ch ?? null;
}

async function openSessionId(characterId: string): Promise<string | null> {
  const { data: rows } = await admin.from('joint_members').select('session_id').eq('character_id', characterId);
  const ids = (rows ?? []).map((r: any) => r.session_id);
  if (!ids.length) return null;
  const { data: open } = await admin.from('joint_sessions').select('id').in('id', ids).eq('status', 'open').limit(1);
  return open?.[0]?.id ?? null;
}

async function membersOf(sessionId: string) {
  const { data } = await admin.from('joint_members').select('character_id, characters(name,skill)').eq('session_id', sessionId);
  const list = (data ?? []).map((m: any) => ({ id: m.character_id as string, name: m.characters?.name as string, skill: m.characters?.skill as string }));
  return list.sort((a, b) => a.id.localeCompare(b.id)); // sabit sıra: eşitlikte tur sırası buna göre
}

async function view(sessionId: string, myId: string) {
  const { data: s } = await admin.from('joint_sessions').select('*').eq('id', sessionId).single();
  if (!s) return null;
  const members = await membersOf(sessionId);
  if (!members.some((m) => m.id === myId)) return null;
  const { data: votes } = await admin.from('joint_votes').select('character_id,choice_id').eq('session_id', sessionId).eq('round', s.round);
  const voted = new Set((votes ?? []).map((v: any) => v.character_id));
  const myVote = (votes ?? []).find((v: any) => v.character_id === myId)?.choice_id ?? null;
  return {
    id: s.id as string,
    status: s.status as 'open' | 'closed',
    round: s.round as number,
    rounds: ROUNDS,
    location: s.location as string,
    scene: s.scene ? { text: s.scene.text as string, choices: s.scene.choices as JChoice[] } : null,
    members: members.map((m) => m.name),
    myVote: myVote as string | null,
    waiting: members.filter((m) => !voted.has(m.id)).map((m) => m.name),
  };
}

function parseJoint(raw: string, final: boolean): JScene | null {
  try {
    const a = raw.indexOf('{');
    const b = raw.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('JSON bulunamadı');
    const j = JSON.parse(raw.slice(a, b + 1));
    if (typeof j.text !== 'string' || j.text.length < 60 || j.text.length > 2800) return null;
    if (final) return { text: j.text, choices: [] };
    if (!Array.isArray(j.choices) || j.choices.length < 2 || j.choices.length > 3) return null;
    const choices = j.choices.map((c: any, i: number) => ({ id: String(c.id ?? 'abc'[i]).slice(0, 8), label: String(c.label ?? '').slice(0, 140) }));
    if (choices.some((c: JChoice) => !c.label)) return null;
    return { text: j.text, choices };
  } catch (e) {
    console.error('Ortak sahne ayrıştırılamadı:', e instanceof Error ? e.message : e, '|', raw.slice(0, 1200));
    return null;
  }
}

function fallbackJoint(names: string[], final: boolean): JScene {
  if (final) {
    return {
      text: `${names.join(' ve ')} ipucunu birlikte çözüyor. Sis bir an inceliyor, fenerlerin ışığı güçleniyor. Yalnız olmanın değil, yan yana olmanın güç verdiğini ikisi de anlıyor. Sonra herkes kendi yoluna dönüyor, ama bu gecenin sırrı ikisinin cebinde kalıyor.`,
      choices: [],
    };
  }
  return {
    text: `${names.join(' ve ')} bir an duruyor. Sis, ikisinin arasına girmeye çalışır gibi kıvrılıyor ama fenerler yan yana durduğu için yaklaşamıyor. Uzaktan hafif bir tıkırtı geliyor. Birlikte karar vermek gerekiyor.`,
    choices: [
      { id: 'a', label: 'Sesin geldiği yöne birlikte yaklaşın' },
      { id: 'b', label: 'Bir süre durup dinleyin' },
    ],
  };
}

async function jointScene(players: { name: string; skill: string }[], location: string, round: number, history: Hist[], final: boolean): Promise<JScene> {
  const names = players.map((p) => p.name);
  const state = {
    oyuncular: players.map((p) => ({ ad: p.name, yetenek: p.skill })),
    mekan: LOC[location] ?? location,
    tur: round,
    toplam_tur: ROUNDS,
    son_tur_mu: final,
    gecmis: history.slice(-3).map((h) => ({ sahne: h.text.slice(-500), secilen: h.choice ?? null })),
  };
  const finalNote = final
    ? 'Bu SON sahnedir: görev birlikte çözülüyor, sıcak ve olumlu bir sonla bitiyor, ikisi de katkı yaptığı için övülüyor. Seçenek YAZMA. Yalnızca {"text":"..."} döndür.'
    : 'Sahneyi açık kalan bir soru ya da küçük bir ürperti ile bitir. 2 ya da 3 seçenek ver; her seçenek farklı bir yeteneğe ya da karaktere rol versin. Biçim: {"text":"...","choices":[{"id":"a","label":"..."}]}.';
  try {
    const msg = await ai.messages.create({
      model: MODEL,
      max_tokens: 1800,
      system: `${BIBLE}\n${RULES}`,
      messages: [{
        role: 'user',
        content: `İki oyuncu karakteri bu mekânda birleşti ve küçük bir ORTAK GÖREV oynuyor.\n${JSON.stringify(state)}\n\nOrtak görevin bir sonraki sahnesini yaz. Görev, bu mekâna özgü kısa bir gizem ya da bilmece olsun ve her turda bir adım ilerlesin. Ana sırrı açma, yeni büyük karakter ya da yeni dönüm noktası icat etme, ana hikâyenin ilerleme işaretlerine dokunma. Bu sahnede üçüncü şahıs kullan ve karakterleri adlarıyla an (${names.join(', ')}); "sen" deme. Her iki karakteri de eşit önemde göster. 110-160 kelime, sade ve akıcı Türkçe, en fazla bir benzetme. Konuşmalarda “ ” kullan, paragrafları \\n\\n ile ayır. ${finalNote} Yalnızca tek bir JSON nesnesi döndür.`,
      }],
    });
    const block = msg.content.find((b) => b.type === 'text');
    const parsed = block && block.type === 'text' ? parseJoint(block.text, final) : null;
    if (parsed) return parsed;
  } catch (e) {
    console.error('Ortak sahne yazılamadı:', e instanceof Error ? e.message : e);
  }
  return fallbackJoint(names, final);
}

async function giveRewards(memberIds: string[]) {
  for (const id of memberIds) {
    const { data: c } = await admin.from('characters').select('fear,lantern,flags').eq('id', id).single();
    if (!c) continue;
    await admin.from('characters').update({
      fear: Math.max(0, c.fear - 1),
      lantern: Math.min(14, c.lantern + 2),
      flags: { ...c.flags, ortak_macera: true },
    }).eq('id', id);
  }
}

// Tüm üyeler oy verdiyse turu çözer: oy birliği ya da tur sırasındaki oyuncunun seçimi.
async function resolveIfReady(sessionId: string) {
  const { data: s } = await admin.from('joint_sessions').select('*').eq('id', sessionId).single();
  if (!s || s.status !== 'open' || !s.scene) return;
  const members = await membersOf(sessionId);
  const { data: votes } = await admin.from('joint_votes').select('character_id,choice_id').eq('session_id', sessionId).eq('round', s.round);
  if (!votes || votes.length < members.length) return;

  const tally = new Map<string, number>();
  votes.forEach((v: any) => tally.set(v.choice_id, (tally.get(v.choice_id) ?? 0) + 1));
  const top = [...tally.entries()].sort((x, y) => y[1] - x[1]);
  let chosenId = top[0][0];
  if (top.length > 1 && top[0][1] === top[1][1]) {
    const decider = members[(s.round - 1) % members.length];
    chosenId = votes.find((v: any) => v.character_id === decider.id)?.choice_id ?? chosenId;
  }
  const chosen = (s.scene.choices as JChoice[]).find((c) => c.id === chosenId);
  const history: Hist[] = [...(s.history ?? []), { text: s.scene.text, choice: chosen?.label }];
  const final = s.round >= ROUNDS;

  // Çözümü yalnızca bir istek üstlenir: tur numarası koşullu güncellenir.
  const { data: claimed } = await admin
    .from('joint_sessions')
    .update({ round: final ? s.round : s.round + 1, status: final ? 'closed' : 'open', scene: null, history, updated_at: new Date().toISOString() })
    .eq('id', sessionId).eq('round', s.round).eq('status', 'open')
    .select('id');
  if (!claimed?.length) return;

  const scene = await jointScene(members, s.location, final ? s.round + 1 : s.round + 1, history, final);
  await admin.from('joint_sessions').update({ scene, updated_at: new Date().toISOString() }).eq('id', sessionId);
  if (final) await giveRewards(members.map((m) => m.id));
}

export async function POST(req: NextRequest) {
  const player = await me(req);
  if (!player) return fail('Giriş gerekli', 401);
  const body = await req.json().catch(() => ({}));
  const action: string = body.action;

  // Mevcut açık oturumu bul (sayfa yenilenince ya da ilk açılışta).
  if (action === 'mine') {
    const sid = await openSessionId(player.id);
    return NextResponse.json({ session: sid ? await view(sid, player.id) : null });
  }

  if (action === 'state') {
    const v = typeof body.sessionId === 'string' ? await view(body.sessionId, player.id) : null;
    return v ? NextResponse.json({ session: v }) : fail('Oturum bulunamadı', 404);
  }

  if (action === 'invite') {
    const toId = String(body.toCharacterId ?? '');
    if (!toId || toId === player.id) return fail('Geçersiz oyuncu');
    const { data: other } = await admin.from('characters').select('id,location').eq('id', toId).single();
    if (!other || other.location !== player.location) return fail('Oyuncu artık burada değil');
    if ((await openSessionId(player.id)) || (await openSessionId(toId))) return fail('Biri zaten ortak bir sahnede');
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin.from('joint_invites').select('id', { count: 'exact', head: true }).eq('from_character', player.id).gte('created_at', since);
    if ((count ?? 0) >= 3) return fail('Çok fazla davet gönderdin, biraz bekle');
    const { data: inv } = await admin.from('joint_invites').insert({ from_character: player.id, to_character: toId, location: player.location }).select('id').single();
    return NextResponse.json({ inviteId: inv?.id });
  }

  if (action === 'accept') {
    const { data: inv } = await admin.from('joint_invites').select('*').eq('id', String(body.inviteId ?? '')).single();
    if (!inv || inv.to_character !== player.id || inv.status !== 'pending') return fail('Davet geçersiz');
    if (Date.now() - new Date(inv.created_at).getTime() > INVITE_TTL_MS) return fail('Davetin süresi doldu');
    const { data: inviter } = await admin.from('characters').select('id,name,skill,location').eq('id', inv.from_character).single();
    if (!inviter || inviter.location !== player.location) return fail('Arkadaşın artık burada değil');
    if ((await openSessionId(player.id)) || (await openSessionId(inviter.id))) return fail('Biri zaten ortak bir sahnede');

    const { data: claimed } = await admin.from('joint_invites').update({ status: 'accepted' }).eq('id', inv.id).eq('status', 'pending').select('id');
    if (!claimed?.length) return fail('Davet geçersiz');

    const { data: s } = await admin.from('joint_sessions').insert({ location: player.location, round: 1 }).select('id').single();
    if (!s) return fail('Ortak sahne açılamadı', 500);
    await admin.from('joint_members').insert([{ session_id: s.id, character_id: inviter.id }, { session_id: s.id, character_id: player.id }]);
    const scene = await jointScene(
      [{ name: inviter.name, skill: inviter.skill }, { name: player.name, skill: player.skill }],
      player.location, 1, [], false
    );
    await admin.from('joint_sessions').update({ scene, updated_at: new Date().toISOString() }).eq('id', s.id);
    return NextResponse.json({ session: await view(s.id, player.id), sessionId: s.id });
  }

  if (action === 'vote') {
    const sid = String(body.sessionId ?? '');
    const v = await view(sid, player.id);
    if (!v || v.status !== 'open' || !v.scene) return fail('Şu an oy verilemez');
    if (!v.scene.choices.some((c) => c.id === body.choiceId)) return fail('Geçersiz seçim');
    await admin.from('joint_votes').upsert(
      { session_id: sid, round: v.round, character_id: player.id, choice_id: String(body.choiceId) },
      { onConflict: 'session_id,round,character_id' }
    );
    await resolveIfReady(sid);
    return NextResponse.json({ session: await view(sid, player.id) });
  }

  if (action === 'leave') {
    const sid = String(body.sessionId ?? '');
    const v = await view(sid, player.id);
    if (!v) return fail('Oturum bulunamadı', 404);
    await admin.from('joint_sessions').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', sid);
    return NextResponse.json({ ok: true });
  }

  return fail('Bilinmeyen işlem');
}
