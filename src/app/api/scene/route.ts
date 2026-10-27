import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { BIBLE, RULES } from '@/story/bible';
import {
  CHAPTERS, nodesOf, LOCATION_CODES, ALLOWED_ITEMS, FIRST_APPEARS, KNOWN_NPCS, NPC_GIFTS,
  TRUST_MAX, TRUST_GIFT_AT, type Node,
} from '@/story/nodes';
import { ITEMS, isTradable } from '@/story/items';
import { PUZZLES } from '@/story/puzzles';
import { neighbors, isUnlocked, LOCATION_NAMES } from '@/story/map';

// Durum burada, sunucuda tutulur ve doğrulanır. AI yalnızca öneri yapar.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const ai = new Anthropic();
const MODEL = process.env.SCENE_MODEL || 'claude-sonnet-5-5';
const MAX_CHAPTER = Math.max(...Object.keys(CHAPTERS).map(Number));
const MAX_ITEMS = 8;
const MAX_MEMORY = 60;

type StoredChoice = {
  id: string; label: string; to?: string; fear?: number; give?: string; flag?: string;
  npc?: string; trust?: number;
};
type StoredScene = { text: string; choices: StoredChoice[] };
type NewNpc = { name: string; description: string; voice: string };
type Meta = {
  moves?: number; nights?: number; craftNight?: number; skillAt?: string; replays?: number; done?: number[];
  citReturnAt?: number; citNight?: number; puzzleOk?: string;
};

// Çıt: oyuncunun yan karakteri. Fener yağı bulmaya gönderilince 3 hamle sonra +5 yağla döner.
const CIT_MISSION_MOVES = 3;
const CIT_OIL = 5;
const citAvailable = (chapter: number, flags: Record<string, boolean>, trust: Record<string, number>) =>
  chapter >= 2 || Boolean(flags.cit_tanisti) || (trust['Çıt'] ?? 0) >= 1;

const publicScene = (s: StoredScene) => ({
  text: s.text,
  choices: s.choices.map(({ id, label }) => ({ id, label })),
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const fallbackScene = (): StoredScene => ({
  text: 'Sis bir an yoğunlaşıyor, sonra yeniden inceliyor. Fenerin ışığı sıcak ve sakin. Biraz soluklanıp çevreye bakmak iyi bir fikir.',
  choices: [
    { id: 'a', label: 'Çevreye dikkatle bak' },
    { id: 'b', label: 'Yurda doğru yürü', to: 'yurt' },
  ],
});

const REST_CHOICE: StoredChoice = { id: 'rest', label: 'Uyu ve yeni geceye uyan', to: 'yurt' };

// Yedek metin: yalnızca AI başarısız olursa kullanılır.
const nightOverScene: StoredScene = {
  text: 'Fenerin alevi küçülüyor, titriyor ve sönüyor. Karanlık basmadan sokağın ucunda bir ışık beliriyor: Nene Selvi, elinde yedek bir fener ve kalın bir battaniye. “Bu gece yeter,” diyor. “Gelgit seni beklemez ama ben beklerim. Hadi eve.”\n\nYurda dönerken aklında hâlâ cevapsız sorular dönüyor. Battaniyenin altında gözlerin ağırlaşıyor. Bir şeyi unutmuş gibisin ama ne olduğunu çıkaramıyorsun.',
  choices: [REST_CHOICE],
};

// Fener söndüğünde son olayı bağlayan, merak bırakan kısa bir gece sonu sahnesi yazdırır.
async function nightScene(ch: any, chosen?: string): Promise<StoredScene> {
  try {
    const msg = await ai.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: `${BIBLE}\n${RULES}`,
      messages: [{
        role: 'user',
        content: `Oyuncunun fener yağı bitti, fener sönüyor.\nSon sahne: ${String(ch.current?.text ?? '').slice(-900)}\nSon seçim: ${chosen ?? '-'}\nBulunan ipuçları: ${Object.keys(ch.flags).join(', ') || 'yok'}\n\nKısa bir gece sonu sahnesi yaz (80-120 kelime, ikinci tekil şahıs, şimdiki zaman, sade Türkçe). Fenerin alevi küçülüp sönerken son sahnedeki olaya bir iki cümleyle değin, sonra oyuncu güvenle yurda dönsün (Nene Selvi yolda karşılasın ya da kapıda beklesin), battaniyenin altında uykuya dalsın. Çözülmemiş bir gizemle ya da tuhaf bir ayrıntıyla bitir. Seçenek yazma. Yalnızca {"text":"..."} biçiminde tek bir JSON nesnesi döndür. Konuşmalarda “ ” kullan, paragrafları \\n\\n ile ayır.`,
      }],
    });
    const block = msg.content.find((b) => b.type === 'text');
    if (block && block.type === 'text') {
      const s = block.text.indexOf('{');
      const e = block.text.lastIndexOf('}');
      const j = JSON.parse(block.text.slice(s, e + 1));
      if (typeof j.text === 'string' && j.text.length > 60 && j.text.length < 1800) {
        return { text: j.text, choices: [REST_CHOICE] };
      }
    }
  } catch (err) {
    console.error('Gece sonu sahnesi yazılamadı:', err instanceof Error ? err.message : err);
  }
  return nightOverScene;
}

// Bölüm sonu: elle yazılmış şablon. Dostlar listesi güven puanından gelir. Seçenekler bölümün devamını açar.
function finishedScene(name: string, chapter: number, trust: Record<string, number>): StoredScene {
  const friends = Object.entries(trust).filter(([, v]) => v >= TRUST_GIFT_AT).map(([k]) => k);
  const friendLine = friends.length
    ? `\n\nBu yolculukta dost edindiklerin: ${friends.join(', ')}. Seni hiç unutmayacaklar.`
    : '\n\nBu yolculukta birçok kişiyle tanıştın. Bir dahaki sefere onlara biraz daha yakınlaşabilirsin.';
  if (chapter < MAX_CHAPTER) {
    return {
      text: `Sabah ışığı Sisli Liman’ın çatılarına dökülüyor. ${name}, 13. vuruşun sırrını çözdün, hayaletlere ve dostlarına yardım ettin. Sis incelmiş, kasaba ilk kez rahat nefes alıyor.${friendLine}\n\nTam kahvaltıya otururken kapı çalınıyor. Orvel’in yüzünde tuhaf bir ifade var: “Meydandaki çan bu sabah hiç çalmadı,” diyor. “Hem de hiç.”`,
      choices: [
        { id: 'next', label: `${chapter + 1}. Bölüm: ${CHAPTERS[chapter + 1].title}` },
        { id: 'replay', label: 'Bu bölümü yeni bir geceyle yeniden oyna' },
      ],
    };
  }
  return {
    text: `Çan sabahı müjdeliyor. Kasaba meydanda toplanmış, herkes gülüyor. ${name}, bu bölümde de Sisli Liman’a yardım ettin. Fener sönmedi, sis geri çekildi.${friendLine}\n\nBir sonraki bölüm için Sis Kâhyası uzaktan sana el sallıyor gibi. Yakında yeni bir hikâyede buluşacaksınız.`,
    choices: [
      { id: 'replay', label: 'Bu bölümü yeni bir geceyle yeniden oyna' },
      { id: 'restart', label: '1. bölümden yeniden başla' },
    ],
  };
}

// Seçim günlüğü: oyuncunun her eylemi kaydedilir (yönetici panelinde görünür).
// Tablo yoksa ya da yazılamazsa oyun etkilenmez.
async function logChoice(
  ch: any, kind: string, id: string, label: string, fear: number, lantern: number
) {
  try {
    const { error } = await admin.from('choice_log').insert({
      character_id: ch.id,
      chapter: ch.chapter ?? 1,
      node: ch.node,
      location: ch.location,
      kind,
      choice_id: id.slice(0, 20),
      choice_label: label.slice(0, 200),
      scene_excerpt: String(ch.current?.baseText ?? ch.current?.text ?? '').slice(0, 600),
      fear_after: fear,
      lantern_after: lantern,
    });
    if (error) console.error('Seçim kaydedilemedi:', error.message);
  } catch (e) {
    console.error('Seçim kaydedilemedi:', e instanceof Error ? e.message : e);
  }
}

function flagHash(flags: Record<string, unknown>) {
  return createHash('sha1').update(JSON.stringify(Object.keys(flags).sort())).digest('hex').slice(0, 10);
}

const NPC_NAME = /^[\p{L}][\p{L} .'’-]{1,28}$/u;

function cleanNpc(raw: any): NewNpc | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name ?? '').trim();
  const description = String(raw.description ?? '').trim().slice(0, 220);
  const voice = String(raw.voice ?? '').trim().slice(0, 120);
  if (!NPC_NAME.test(name) || description.length < 10) return null;
  if (KNOWN_NPCS.some((k) => k.toLowerCase() === name.toLowerCase())) return null;
  return { name, description, voice };
}

function parseScene(raw: string, allowedNpcs: Set<string>): { scene: StoredScene; npc: NewNpc | null } | null {
  try {
    // Modelin JSON'un öncesine ya da sonrasına eklediği metni at: ilk { ile son } arası.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('JSON bulunamadı');
    const j = JSON.parse(raw.slice(start, end + 1));
    if (typeof j.text !== 'string' || j.text.length < 40 || j.text.length > 2500) return null;
    if (!Array.isArray(j.choices) || j.choices.length < 2 || j.choices.length > 4) return null;
    const npc = cleanNpc(j.npc);
    if (npc) allowedNpcs.add(npc.name);
    const choices: StoredChoice[] = j.choices.map((c: any, i: number): StoredChoice => ({
      id: String(c.id ?? 'abcd'[i]).slice(0, 8),
      label: String(c.label ?? '').slice(0, 120),
      to: LOCATION_CODES.includes(c.to) ? c.to : undefined,
      fear: [-1, 0, 1].includes(c.fear) ? c.fear : 0,
      give: ALLOWED_ITEMS.includes(c.give) ? c.give : undefined,
      flag: typeof c.flag === 'string' && /^[a-z_0-9]{3,30}$/.test(c.flag) ? c.flag : undefined,
      npc: typeof c.npc === 'string' && allowedNpcs.has(c.npc) ? c.npc : undefined,
      trust: [-1, 0, 1].includes(c.trust) ? c.trust : 0,
    }));
    // Seçenek kimliği özel kimliklerle çakışmasın.
    if (choices.some((c) => !c.label || ['rest', 'skill', 'goal', 'puzzle', 'puzzle_done', 'next', 'replay', 'restart', 'travel'].includes(c.id))) return null;
    return { scene: { text: j.text, choices }, npc };
  } catch (e) {
    console.error('Sahne ayrıştırılamadı:', e instanceof Error ? e.message : e, '| ham çıktı:', raw.slice(0, 1500));
    return null;
  }
}

async function saveNpc(npc: NewNpc, characterId: string, chapter: number) {
  const { count } = await admin.from('world_memory').select('id', { count: 'exact', head: true });
  if ((count ?? 0) >= MAX_MEMORY) return;
  const { error } = await admin.from('world_memory').upsert(
    { kind: 'npc', name: npc.name, description: npc.description, voice: npc.voice, introduced_by: characterId, chapter },
    { onConflict: 'name', ignoreDuplicates: true }
  );
  if (error) console.error('NPC kaydedilemedi:', error.message);
}

async function generate(
  ch: any, location: string, node: Node, steps: number, chosen: string | undefined, isNew: boolean
): Promise<{ scene: StoredScene; ok: boolean; npc: NewNpc | null }> {
  const chapter: number = ch.chapter ?? 1;
  const chapterNodes = nodesOf(chapter);
  const { data: memory } = await admin
    .from('world_memory').select('name,description,voice').order('created_at', { ascending: false }).limit(40);
  const allowed = new Set<string>([...KNOWN_NPCS, ...(memory ?? []).map((m: any) => m.name)]);
  const state = {
    bolum: { no: chapter, baslik: CHAPTERS[chapter]?.title, ozet: CHAPTERS[chapter]?.intro || undefined, yeni_bolum_basladi: isNew },
    oyuncu: { ad: ch.name, yetenek: ch.skill, korku: ch.fear, fener: ch.lantern, esyalar: ch.items, bayraklar: Object.keys(ch.flags) },
    guven_puanlari: ch.trust ?? {},
    tamamlanan_duraklar: chapterNodes.slice(0, Math.max(0, node.n - 1)).map((n, i, all) =>
      i >= all.length - 3 ? { no: n.n, baslik: n.title, ne_oldu: n.goal } : { no: n.n, baslik: n.title }),
    atlanan_durak: ch.skipped ? { baslik: ch.skipped.title, hedef: ch.skipped.goal } : null,
    mekan: location,
    izinli_mekanlar: LOCATION_CODES,
    hedef_donum_noktasi: { no: node.n, baslik: node.title, mekan: node.location, hedef: node.goal, bitis_bayragi: node.puzzle ? null : node.flag, bulmaca: node.puzzle ? (PUZZLES[node.puzzle]?.title ?? 'bulmaca') : null },
    bu_donum_noktasinda_kacinci_sahne: steps,
    yeni_gece_basladi: Boolean(ch.current?.night),
    korkudan_yurda_dondu: Boolean(ch.scared),
    son_sahne: ch.current?.text?.slice(-1200) ?? null,
    oyuncunun_son_secimi: chosen ?? null,
    henuz_sahneye_girmeyecek_karakterler: chapter > 1 ? [] : Object.entries(FIRST_APPEARS)
      .filter(([, first]) => first > node.n)
      .map(([name]) => name),
    bilinen_npcler: memory ?? [],
    guvenilir_dostlar_tanidigi_karakterler: KNOWN_NPCS,
  };
  const msg = await ai.messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: `${BIBLE}\n${RULES}`,
    messages: [{
      role: 'user',
      content: `Oyuncunun durumu:\n${JSON.stringify(state)}\n\nBir sonraki sahneyi yaz. Eğer "yeni_bolum_basladi" doğruysa yeni bir bölümün ilk sahnesidir: "bolum.ozet" bilgisini oyuncuya anlatma, yalnızca o havayı taşıyan sıcak, merak uyandıran bir açılış yaz. Eğer "yeni_gece_basladi" doğruysa oyuncu uyuyup yeni geceye uyandı: sahneyi kısa bir uyanışla aç (Nene Selvi feneri yağla dolduruyor, sıcak bir ayrıntı), sonra daha önce bulunan ipuçlarını hatırlayarak hikâyeyi kaldığı yerden sürdür. Eğer "korkudan_yurda_dondu" doğruysa oyuncu çok ürkerek yurda koştu: sahneyi Nene Selvi'nin onu sakinleştirmesiyle aç (sıcak bir içecek, battaniye), sonra hikâyeyi kaldığı yerden sürdür. "tamamlanan_duraklar" listesindeki olaylar çoktan yaşandı: onları yeniden yaşatma ve baştan anlatma, yalnızca gerekirse geçmişte kalmış bir ayrıntı olarak an. Eğer "atlanan_durak" doluysa o durağın olayı ekranda anlatılmadan çözülmüş sayılır: sahneyi o olayın nasıl çözüldüğünü bir ya da iki cümleyle özetleyerek aç, sonra yeni durağın hikâyesine geç. Aksi durumda önce oyuncunun son seçimine DOĞRUDAN karşılık ver: seçtiği eylem sahnede gerçekleşsin, sorduğu soru cevaplansın, konuştuğu kişi cevap versin. "henuz_sahneye_girmeyecek_karakterler" listesindeki karakterleri sahneye sokma, yalnızca belirsiz bir iz (uzaktan ses, gölge) göstermen yeterli. "guven_puanlari" yüksek olan karakterler oyuncuya daha sıcak ve yardımsever davransın, hiç puanı olmayanlar mesafeli ama kibar olsun. "bilinen_npcler" listesindeki karakterleri tutarlı kullan. Anlatım ikinci tekil şahıs ve şimdiki zaman olsun (“kapıyı itiyorsun”, “Nene Selvi sana bakıyor”). Kısa, sade, doğal ve akıcı Türkçe kullan. Sahnede en fazla bir benzetme olsun. Hikâyeyi her sahnede gözle görülür biçimde ilerlet: yeni bir bilgi, yeni bir kişi ya da yeni bir yer olsun. Oyuncu bu dönüm noktasında ${steps}. sahnede. Eğer "hedef_donum_noktasi.bulmaca" doluysa bu durak bir bulmaca durağıdır: bulmacayı sahnede ÇÖZDÜRME ve cevabını söyleme; oyuncuyu bulmacanın nesnesine (kap, kilit, boya kutusu) götür ve merak uyandır, bayrak verme. Oyuncu bulmacayı kendi ekranında çözecek. Çıt oyuncunun yan karakteri ve yol arkadaşıdır (yalnızca 2. bölümde ya da onu tanıdıysa), ara sıra kısa cümlelerle sahnede yer alabilir. Bitiş bayrağı yalnızca oyuncu hedef dönüm noktasının mekânındaysa ve o durakta en az 2. sahnedeyse geçerlidir. Oyuncu "hedef_donum_noktasi.mekan" dışında bir yerdeyse seçeneklerden birini ("to" ile) hedef mekâna götüren bir yol yap. 3. sahneden itibaren, oyuncu hedef mekândayken, bitiş bayrağını seçeneklerden en az birine MUTLAKA ver ve hikâyeyi hedefe ulaştır.\nGerilim ve gizem ekle: sahneyi açık kalan bir soru ya da küçük bir ürperti (tuhaf ses, kıpırdayan gölge, kaybolan eşya) ile bitir. Seçenekler gerçek ikilem olsun (biri merak, biri temkin; her birinin bedeli ve getirisi olsun, hiçbiri bariz olmasın). Ürpertici bir şeye yaklaşan ya da dokunan seçeneğe "fear": 1 ver, rahatlatan seçeneğe (dost bir yüz, ışık, espri) -1. Seçeneklerin en az birine "fear": 1 ver. Dehşet, kan ve gerçek tehlike olmasın, ürperti hep güvenli ve biraz komik kalsın.\nBir karakterle konuşmayı, ona yardım etmeyi ya da dürüst davranmayı içeren seçeneğe "npc" (karakterin adı) ve "trust": 1 ekle; kaba ya da yalancı davranış için -1.\nYalnızca tek bir JSON nesnesi döndür, öncesine ve sonrasına hiçbir şey yazma. Metin içindeki konuşmalarda düz çift tırnak yerine “ ” kullan. Paragraflar arasına \\n\\n koy. "fear" değeri -1, 0 ya da 1 sayısı olmalı.`,
    }],
  });
  const block = msg.content.find((b) => b.type === 'text');
  const parsed = block && block.type === 'text' ? parseScene(block.text, allowed) : null;
  if (!parsed) return { scene: fallbackScene(), ok: false, npc: null };
  return { scene: parsed.scene, ok: true, npc: parsed.npc };
}

// Yetenek seçeneği: yalnızca düğüm mekânında, düğüm başına bir kez (yağ şişesi yapmak gece başına bir kez).
type SkillKind = 'hint' | 'talk' | 'craft';
function skillOption(
  ch: { skill: string; items: string[]; meta: Meta; chapter: number }, node: Node | undefined, location: string
): { kind: SkillKind; label: string } | null {
  if (!node) return null;
  const done = ch.meta.skillAt === `${ch.chapter}:${node.n}`;
  const atNode = location === node.location;
  if (ch.skill === 'gozlemci' && atNode && !done) return { kind: 'hint', label: '🔍 Etrafı dikkatle incele (Gözlemci)' };
  if (ch.skill === 'konuskan' && atNode && !done) {
    return { kind: 'talk', label: node.npc ? `🗣️ ${node.npc} ile içten bir sohbet aç (Konuşkan)` : '🗣️ Çevredekilerle sohbet et (Konuşkan)' };
  }
  if (ch.skill === 'tamirci') {
    if (atNode && !done && ['kule', 'mekanizma', 'atolye'].includes(location)) return { kind: 'hint', label: '🔧 Mekanizmayı kurcala (Tamirci)' };
    if (!ch.items.includes('yag_sisesi') && ch.items.length < MAX_ITEMS && ch.meta.craftNight !== (ch.meta.nights ?? 0)) {
      return { kind: 'craft', label: '🔧 Eldeki parçalardan fener yağı şişesi yap (Tamirci)' };
    }
  }
  return null;
}

// Güven puanı: 0-5. 3'e ilk ulaşınca karakter hediye verir.
function addTrust(trust: Record<string, number>, items: string[], name: string, delta: number, notices: string[]) {
  const before = trust[name] ?? 0;
  const after = clamp(before + delta, 0, TRUST_MAX);
  trust[name] = after;
  if (after > before) notices.push(`💛 ${name} sana biraz daha güveniyor (${after}/${TRUST_MAX}).`);
  if (before < TRUST_GIFT_AT && after >= TRUST_GIFT_AT) {
    const gift = NPC_GIFTS[name];
    if (gift && !items.includes(gift.item) && items.length < MAX_ITEMS) {
      items.push(gift.item);
      notices.push(`🎁 ${gift.text}`);
    } else {
      notices.push(`🤝 ${name} artık seni dostu sayıyor.`);
    }
  }
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
  const travelTo: string | undefined = typeof body.travel === 'string' ? body.travel : undefined;
  const useItem: string | undefined = typeof body.useItem === 'string' ? body.useItem : undefined;
  const citAction: string | undefined = typeof body.cit === 'string' ? body.cit : undefined;

  let { location, node, fear, lantern } = ch as { location: string; node: number; fear: number; lantern: number };
  let chapter: number = ch.chapter ?? 1;
  const items: string[] = [...ch.items];
  let flags: Record<string, boolean> = { ...ch.flags };
  const trust: Record<string, number> = { ...(ch.trust ?? {}) };
  const meta: Meta = { ...(ch.meta ?? {}) };
  const notices: string[] = [];
  let nodes = nodesOf(chapter);

  const respond = (row: any, scene: StoredScene, extra?: object) =>
    NextResponse.json({ scene: publicScene(scene), character: toPublic(row), notices, ...extra });

  // 1) Eşya kullan (yağ şişesi, kurabiye). Sahne değişmez, AI çağrılmaz.
  if (useItem) {
    const def = ITEMS[useItem];
    if (!def?.use || !items.includes(useItem) || !ch.current) {
      return NextResponse.json({ error: 'Bu eşya şimdi kullanılamaz' }, { status: 400 });
    }
    items.splice(items.indexOf(useItem), 1);
    fear = clamp(fear + (def.use.fear ?? 0), 0, 4);
    lantern = clamp(lantern + (def.use.lantern ?? 0), 0, 14);
    notices.push(def.use.text);
    const { data: upd } = await admin.from('characters').update({ fear, lantern, items }).eq('id', ch.id).select().single();
    await logChoice(ch, 'use', useItem, `Kullandı: ${def.label}`, fear, lantern);
    return respond(upd ?? ch, ch.current);
  }

  // 1b) Çıt'ı fener yağı bulmaya gönder. Sahne değişmez, AI çağrılmaz.
  if (citAction === 'send') {
    const nightsNow = meta.nights ?? 0;
    if (!ch.current || ch.current.night || ch.current.finished) {
      return NextResponse.json({ error: 'Çıt şimdi yola çıkamaz' }, { status: 400 });
    }
    if (!citAvailable(chapter, flags, trust)) return NextResponse.json({ error: 'Çıt henüz seninle değil' }, { status: 400 });
    if (meta.citReturnAt) return NextResponse.json({ error: 'Çıt zaten yolda' }, { status: 400 });
    if (meta.citNight === nightsNow) return NextResponse.json({ error: 'Çıt bu gece zaten bir görev yaptı, dinlenmesi lazım' }, { status: 400 });
    if (lantern > 9 || lantern < 1) return NextResponse.json({ error: 'Fener yağın hâlâ dolu ya da bitmiş. Çıt’ı yağ azalınca gönder' }, { status: 400 });
    meta.citReturnAt = (meta.moves ?? 0) + CIT_MISSION_MOVES;
    meta.citNight = nightsNow;
    notices.push(`🤖 Çıt tıkırdayarak yağ aramaya çıktı. ${CIT_MISSION_MOVES} hamle sonra dönecek.`);
    const { data: upd } = await admin.from('characters').update({ meta }).eq('id', ch.id).select().single();
    await logChoice(ch, 'cit', 'send', 'Çıt’ı yağ bulmaya gönderdi', fear, lantern);
    return respond(upd ?? ch, ch.current);
  }

  // 2) Sayfa yenilenirse aynı sahneyi tekrar göster, yeni seçim yoksa AI'ı çağırma.
  if (!choiceId && !travelTo && ch.current) {
    // Eski sürümde bitirmiş oyuncular: bölüm sonu seçeneklerini şimdi ekle.
    if (node > nodes.length && !ch.current.finished) {
      const fin = finishedScene(ch.name, chapter, trust);
      const current = { ...fin, baseText: fin.text, steps: 1, nodeAt: node, night: false, finished: true };
      const { data: upd } = await admin.from('characters').update({ current }).eq('id', ch.id).select().single();
      return respond(upd ?? ch, fin);
    }
    return respond(ch, ch.current);
  }

  let picked: StoredChoice | undefined;
  if (travelTo) {
    // 3) Haritadan yolculuk: yalnızca komşu ve açılmış yerlere.
    if (!ch.current || ch.current.night || ch.current.finished) {
      return NextResponse.json({ error: 'Şimdi yolculuğa çıkamazsın' }, { status: 400 });
    }
    if (!LOCATION_CODES.includes(travelTo) || travelTo === location) {
      return NextResponse.json({ error: 'Geçersiz yer' }, { status: 400 });
    }
    if (!neighbors(location).includes(travelTo)) {
      return NextResponse.json({ error: 'Oraya doğrudan bir yol yok' }, { status: 400 });
    }
    if (!isUnlocked(travelTo, chapter, node)) {
      return NextResponse.json({ error: 'Burası henüz sisin içinde, haritada açılmadı' }, { status: 400 });
    }
    picked = { id: 'travel', label: `${LOCATION_NAMES[travelTo]} yönüne yürümeye karar verdim`, to: travelTo };
  } else if (choiceId === 'puzzle') {
    // Bulmaca ekranı istemcide açılır, sahne değişmez.
    if (!ch.current) return NextResponse.json({ error: 'Sahne yok' }, { status: 400 });
    return respond(ch, ch.current);
  } else if (choiceId === 'puzzle_done') {
    const c0 = nodes[node - 1];
    if (!c0?.puzzle || meta.puzzleOk !== `${chapter}:${node}` || !ch.current) {
      return NextResponse.json({ error: 'Bulmaca henüz çözülmedi' }, { status: 400 });
    }
    picked = { id: 'puzzle_done', label: `Bulmacayı çözdüm: ${PUZZLES[c0.puzzle]?.title ?? 'bulmaca'}`, fear: -1 };
  } else if (choiceId) {
    picked = ch.current?.choices?.find((c: StoredChoice) => c.id === choiceId);
    if (!picked) return NextResponse.json({ error: 'Geçersiz seçim' }, { status: 400 });
  }

  let chosenLabel: string | undefined = picked?.label;
  let scared = false;
  let isNew = false;
  let skipped: Node | null = null;
  let logEntry: { kind: string; id: string; label: string } | null = null;

  if (picked && ['next', 'replay', 'restart'].includes(picked.id)) {
    // 4) Bölüm sonu seçenekleri: sonraki bölüm ya da yeniden oynama.
    if (!ch.current?.finished) return NextResponse.json({ error: 'Bölüm henüz bitmedi' }, { status: 400 });
    logEntry = { kind: 'chapter', id: picked.id, label: picked.label };
    if (picked.id === 'next') {
      if (chapter >= MAX_CHAPTER) return NextResponse.json({ error: 'Sonraki bölüm yakında' }, { status: 400 });
      chapter += 1;
    } else if (picked.id === 'restart') {
      chapter = 1;
    }
    if (picked.id !== 'next') meta.replays = (meta.replays ?? 0) + 1;
    nodes = nodesOf(chapter);
    node = 1; flags = {}; location = 'yurt'; fear = 0; lantern = 14;
    // Hikâye eşyaları gider, hatıra eşyaları ve güven puanları kalır.
    for (let i = items.length - 1; i >= 0; i--) if (!isTradable(items[i])) items.splice(i, 1);
    meta.skillAt = '';
    meta.citReturnAt = 0;
    meta.puzzleOk = '';
    isNew = true;
    chosenLabel = undefined;
    picked = undefined;
  } else if (picked && picked.id === 'skill') {
    // 5) Yetenek eylemi: elle yazılmış, anında, AI çağrılmaz.
    const cur = nodes[node - 1];
    const opt = skillOption({ skill: ch.skill, items, meta, chapter }, cur, location);
    if (!opt || !ch.current) return NextResponse.json({ error: 'Yetenek şimdi kullanılamaz' }, { status: 400 });
    let extra = '';
    if (opt.kind === 'hint') {
      extra = `${ch.skill === 'tamirci' ? '🔧' : '🔍'} ${cur.hint}`;
      meta.skillAt = `${chapter}:${cur.n}`;
    } else if (opt.kind === 'talk') {
      extra = `🗣️ ${cur.talk}`;
      fear = clamp(fear - 1, 0, 4);
      if (cur.npc) addTrust(trust, items, cur.npc, 1, notices);
      meta.skillAt = `${chapter}:${cur.n}`;
    } else {
      items.push('yag_sisesi');
      meta.craftNight = meta.nights ?? 0;
      extra = '🔧 Cebindeki bakır tel, boş bir şişe ve biraz yağla küçük bir fener yağı şişesi yapıyorsun. Elin işe yatkın.';
      notices.push('🫙 Çantana bir fener yağı şişesi eklendi.');
    }
    const base = String(ch.current.baseText ?? ch.current.text);
    const text = `${base}\n\n${extra}`;
    const next = skillOption({ skill: ch.skill, items, meta, chapter }, cur, location);
    const choices = (ch.current.choices as StoredChoice[]).filter((c) => c.id !== 'skill');
    if (next) choices.push({ id: 'skill', label: next.label });
    const current = { ...ch.current, text, choices, baseText: base };
    const { data: upd } = await admin.from('characters')
      .update({ fear, items, trust, meta, current }).eq('id', ch.id).select().single();
    await logChoice(ch, 'skill', opt.kind, opt.label, fear, lantern);
    return respond(upd ?? ch, current);
  } else if (picked) {
    // 6) Normal seçim ya da haritadan yolculuk.
    meta.moves = (meta.moves ?? 0) + 1;
    // Çevik: her 3. hamlede fener yağı harcanmaz.
    const free = ch.skill === 'cevik' && meta.moves % 3 === 0;
    if (picked.id !== 'rest' && picked.id !== 'puzzle_done') {
      if (free) notices.push('⚡ Çevik: Bu hamle fener yağı harcamadı.');
      else lantern = Math.max(0, lantern - 1);
    }
    // Çıt görevden döndü mü?
    if (meta.citReturnAt && meta.moves >= meta.citReturnAt) {
      lantern = Math.min(14, lantern + CIT_OIL);
      meta.citReturnAt = 0;
      notices.push(`🤖 Çıt döndü ve bir kutu fener yağı buldu! (+${CIT_OIL} yağ)`);
      addTrust(trust, items, 'Çıt', 1, notices);
    }
    fear = clamp(fear + (picked.fear ?? 0), 0, 4);
    if (picked.give && !items.includes(picked.give) && items.length < MAX_ITEMS) {
      items.push(picked.give);
      notices.push(`🎒 Çantana eklendi: ${ITEMS[picked.give]?.label ?? picked.give}`);
    }
    const cur = nodes[node - 1];
    // Yalnızca şu anki dönüm noktasının bayrağı kabul edilir. Modelin icat ettiği ya da
    // ileriki bir noktanın bayrağı hikâyeyi atlatamaz.
    // Bayrak yalnızca durağın kendi mekânında ve en az 2. sahneden itibaren kabul edilir:
    // hiçbir durak, oraya uğramadan ya da tek sahnede geçilemez.
    const atStop = Boolean(cur) && ch.location === cur.location && (ch.current?.steps ?? 1) >= 2;
    const isPuzzle = Boolean(cur?.puzzle);
    if (picked.flag && picked.flag === cur?.flag && atStop && !isPuzzle) flags[picked.flag] = true;
    // Bulmaca duraklarında bayrak yalnızca bulmaca çözülünce alınır.
    if (picked.id === 'puzzle_done' && cur && isPuzzle && atStop && meta.puzzleOk === `${chapter}:${cur.n}`) {
      flags[cur.flag] = true;
      meta.puzzleOk = '';
    }
    // Sunucunun eklediği "görevi tamamla" seçeneği (AI bayrağı vermezse takılmamak için).
    if (picked.id === 'goal' && cur && atStop && !isPuzzle) { flags[cur.flag] = true; skipped = cur; }
    logEntry = {
      kind: travelTo ? 'travel' : picked.id === 'rest' ? 'rest' : picked.id === 'goal' ? 'goal' : picked.id === 'puzzle_done' ? 'puzzle' : 'choice',
      id: picked.id,
      label: picked.label,
    };
    // Güven puanı: bilinen karakter (sahneye girmiş olmalı) ya da dünya hafızasındaki karakter.
    if (picked.npc && picked.trust) {
      let ok = false;
      if (KNOWN_NPCS.includes(picked.npc)) {
        ok = chapter > 1 || (FIRST_APPEARS[picked.npc] ?? 1) <= node;
      } else {
        const { data: m } = await admin.from('world_memory').select('id').eq('name', picked.npc).maybeSingle();
        ok = Boolean(m);
      }
      if (ok) addTrust(trust, items, picked.npc, picked.trust, notices);
    }
    // Korku kuralları kodda: tekinsiz mekâna girmek ve fener yağının azalması korkuyu artırır.
    const spooky = ['mezarlik', 'kayalik', 'mekanizma', 'atolye'];
    if (picked.to && picked.to !== location && spooky.includes(picked.to)) fear = Math.min(4, fear + 1);
    if (lantern === 4 || lantern === 2) fear = Math.min(4, fear + 1);
    if (picked.to) location = picked.to;
    if (cur && flags[cur.flag]) node += 1;

    // Korku sınırı: ceza yok, yumuşak dönüş.
    if (fear >= 4) { location = 'yurt'; fear = 0; lantern = Math.min(14, lantern + 4); scared = true; }
  }

  // Oyuncunun bu dönüm noktasında kaçıncı sahnede olduğu (AI'ı ilerlemeye zorlamak için).
  const prevSteps: number = ch.current?.steps ?? 0;
  const prevNode: number | undefined = ch.current?.nodeAt;
  const steps = picked && prevNode === node && !isNew ? prevSteps + 1 : 1;

  let scene: StoredScene;
  let isNight = false;
  let finished = false;
  let newNpc: NewNpc | null = null;
  const sceneCh = { ...ch, chapter, location, fear, lantern, items, flags, trust, scared, skipped, current: isNew ? null : ch.current };

  if (node > nodes.length) {
    finished = true;
    scene = finishedScene(ch.name, chapter, trust);
    meta.done = Array.from(new Set([...(meta.done ?? []), chapter]));
  } else if (lantern <= 0) {
    scene = await nightScene(ch, chosenLabel);
    isNight = true;
    location = 'yurt';
    lantern = 14;
    meta.nights = (meta.nights ?? 0) + 1;
    // Yolda olan Çıt sabah bir yağ şişesiyle döner.
    if (meta.citReturnAt) {
      meta.citReturnAt = 0;
      if (!items.includes('yag_sisesi') && items.length < MAX_ITEMS) {
        items.push('yag_sisesi');
        notices.push('🤖 Çıt sabah döndü ve yanında bir fener yağı şişesi getirdi.');
      }
    }
    // Nene Selvi yastığın yanına bir kurabiye bırakır.
    if (!items.includes('kurabiye') && items.length < MAX_ITEMS) {
      items.push('kurabiye');
      notices.push('🍪 Nene Selvi yastığının yanına bir kurabiye bırakmış.');
    }
  } else {
    const target = nodes[node - 1];
    // Anahtara önceki sahne ve seçilen seçenek de girer: aynı sahnede aynı seçimi yapan
    // oyuncular aynı sonraki sahneyi görür, farklı seçim farklı sahne üretir.
    const prevText = isNew ? null : (ch.current?.baseText ?? ch.current?.text);
    const prevHash = prevText ? createHash('sha1').update(String(prevText)).digest('hex').slice(0, 10) : 'start';
    const action = travelTo ? `travel:${travelTo}` : isNew ? 'start' : (choiceId ?? 'start');
    const cacheKey = `c${chapter}|${target.n}|${location}|${flagHash(flags)}|${prevHash}|${action}|${scared ? 's' : ''}${skipped ? 'k' : ''}|r${meta.replays ?? 0}`;
    const { data: cached } = await admin.from('scenes').select('body').eq('cache_key', cacheKey).maybeSingle();
    if (cached) {
      scene = cached.body as StoredScene;
    } else {
      const made = await generate(sceneCh, location, target, steps, chosenLabel, isNew);
      scene = made.scene;
      newNpc = made.npc;
      // Yedek sahne asla önbelleğe alınmaz: sonraki istek yeniden denesin.
      if (made.ok) {
        await admin.from('scenes').upsert({ cache_key: cacheKey, location, node: target.n, body: scene }, { onConflict: 'cache_key' });
        if (newNpc) await saveNpc(newNpc, ch.id, chapter);
      }
    }
  }

  // Yetenek seçeneği sunucuda eklenir (önbelleğe girmez).
  const storedChoices = [...scene.choices];
  if (!isNight && !finished) {
    const opt = skillOption({ skill: ch.skill, items, meta, chapter }, nodes[node - 1], location);
    if (opt) storedChoices.push({ id: 'skill', label: opt.label });
  }
  // Takılma önlemi: durağın mekânında 6 sahne geçtiyse görevi tamamlama seçeneği çıkar.
  const stop = nodes[node - 1];
  if (!isNight && !finished && stop && !flags[stop.flag] && location === stop.location) {
    if (stop.puzzle && steps >= 2) {
      storedChoices.push({ id: 'puzzle', label: `🧩 Bulmacayı çöz: ${PUZZLES[stop.puzzle]?.title ?? 'Bulmaca'}` });
    } else if (!stop.puzzle && steps >= 6) {
      storedChoices.push({ id: 'goal', label: `✔️ Bu durağın işini tamamla (${stop.title})`, flag: stop.flag });
    }
  }
  const shown: StoredScene = { text: scene.text, choices: storedChoices };

  const { data: updated } = await admin
    .from('characters')
    .update({
      location, node, fear, lantern, items, flags, chapter, trust, meta,
      current: { ...shown, baseText: scene.text, steps, nodeAt: node, night: isNight, finished },
    })
    .eq('id', ch.id)
    .select()
    .single();

  if (logEntry) await logChoice(ch, logEntry.kind, logEntry.id, logEntry.label, fear, lantern);
  return respond(updated ?? ch, shown);
}

// İstemciye giden herkese açık durum. Harita bilgisi (açık yerler, komşular, hedef) sunucudan gelir.
function toPublic(c: any) {
  const chapter: number = c.chapter ?? 1;
  const nodes = nodesOf(chapter);
  const target = nodes[c.node - 1];
  const locked = Boolean(c.current?.night || c.current?.finished);
  const flags = c.flags ?? {};
  const pieceFlags = chapter === 1 ? ['pasli_anahtar', 'parca_2', 'gecit_acik'] : ['c2_bakir', 'c2_gumus', 'c2_bronz'];
  const trust: Record<string, number> = c.trust ?? {};
  return {
    id: c.id, name: c.name, skill: c.skill, location: c.location, node: c.node,
    fear: c.fear, lantern: c.lantern, items: c.items,
    chapter, chapterTitle: CHAPTERS[chapter]?.title ?? '',
    cit: (() => {
      const m = c.meta ?? {};
      const nightsNow = m.nights ?? 0;
      const avail = citAvailable(chapter, flags, trust);
      const away = Boolean(m.citReturnAt);
      return {
        available: avail,
        away,
        movesLeft: away ? Math.max(0, (m.citReturnAt ?? 0) - (m.moves ?? 0)) : 0,
        rested: !away && m.citNight === nightsNow,
        canSend: avail && !away && m.citNight !== nightsNow && c.lantern <= 9 && c.lantern >= 1 && !locked,
        trust: trust['Çıt'] ?? 0,
      };
    })(),
    friends: Object.entries(trust).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })),
    map: {
      unlocked: LOCATION_CODES.filter((l) => isUnlocked(l, chapter, c.node)),
      travel: locked ? [] : neighbors(c.location).filter((l) => isUnlocked(l, chapter, c.node)),
      target: target?.location ?? null,
      pieces: { have: pieceFlags.filter((f) => flags[f]).length, total: pieceFlags.length, label: chapter === 1 ? 'Harita parçaları' : 'Çan dili parçaları' },
    },
  };
}
