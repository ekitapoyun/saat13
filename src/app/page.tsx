'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase, LOCATION_NAMES, type Character, type Scene, type Skill } from '@/lib/supabase';
import { ITEMS, itemIcon, itemLabel, isTradable } from '@/story/items';
import { MAP_W, MAP_H, MAP_POS, MAP_EDGES, SECRET_EDGES } from '@/story/map';

const SKILLS: { id: Skill; label: string }[] = [
  { id: 'gozlemci', label: 'Gözlemci: her bölümde bir kez saklı ipucunu bulur' },
  { id: 'konuskan', label: 'Konuşkan: içten sohbet açar, güven kazanır, korkusu azalır' },
  { id: 'cevik', label: 'Çevik: her 3. hamlede fener yağı harcamaz' },
  { id: 'tamirci', label: 'Tamirci: mekanizmaları çözer, fener yağı şişesi yapar' },
];

// Serbest yazı yok. Yalnızca hazır mesajlar.
const QUICK: Record<string, string> = {
  selam: '👋 Selam',
  takas: '🤝 Takas yapalım mı?',
  yardim: '❓ Yardım edebilir misin?',
  takip: '🔦 Beni takip et',
};

type Here = { id: string; name: string };
type Quick = { from: string; text: string; at: number };
type Invite = { inviteId: string; fromId: string; fromName: string };
type JView = {
  id: string;
  status: 'open' | 'closed';
  round: number;
  rounds: number;
  scene: { text: string; choices: { id: string; label: string }[] } | null;
  members: string[];
  myVote: string | null;
  waiting: string[];
};

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [character, setCharacter] = useState<Character | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notices, setNotices] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const call = useCallback(async (payload: { choiceId?: string; travel?: string; useItem?: string } = {}) => {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/scene', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Bir şeyler ters gitti');
      setScene(j.scene);
      setCharacter(j.character);
      setNotices(Array.isArray(j.notices) ? j.notices : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bağlantı hatası');
    } finally {
      setBusy(false);
    }
  }, [session]);

  // Giriş yapılınca karakter var mı bak, varsa sahneyi yükle.
  useEffect(() => {
    if (!session) { setCharacter(null); setScene(null); return; }
    supabase.from('characters').select('id').maybeSingle().then(({ data }) => {
      if (data) call();
    });
  }, [session, call]);

  if (!ready) return <main><p className="small">Yükleniyor…</p></main>;
  if (!session) return <Login />;
  if (!character) {
    return (
      <>
        {error && <main><p role="alert">Sahne yüklenemedi: {error}</p></main>}
        <CreateCharacter userId={session.user.id} onDone={() => call()} />
      </>
    );
  }

  return (
    <main>
      <Game
        character={character}
        scene={scene}
        busy={busy}
        error={error}
        notices={notices}
        token={session.access_token}
        onChoose={(id) => call({ choiceId: id })}
        onTravel={(to) => call({ travel: to })}
        onUse={(item) => call({ useItem: item })}
        onRefresh={() => call()}
      />
      <p className="small" style={{ marginTop: 24 }}>
        <button style={{ padding: '4px 10px' }} onClick={() => supabase.auth.signOut()}>Çıkış yap</button>
      </p>
    </main>
  );
}

function Login() {
  const [mode, setMode] = useState<'giris' | 'kayit'>('giris');
  const [email, setEmail] = useState('');
  // Varsayılan şifre hazır gelir. İstenirse değiştirilebilir.
  const [password, setPassword] = useState('11111111');
  const [err, setErr] = useState('');
  const [working, setWorking] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  function switchMode(m: 'giris' | 'kayit') { setMode(m); setErr(''); }

  async function submit() {
    setErr('');
    setWorking(true);
    const mail = email.trim().toLowerCase();
    if (mode === 'giris') {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
      if (error) {
        const m = (error.message || '').toLowerCase();
        if (m.includes('invalid login credentials')) setErr('E-posta ya da şifre yanlış. Hesabın yoksa “Kayıt ol” sekmesine geç.');
        else if (error.status === 429 || m.includes('rate limit')) setErr('Kısa sürede çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.');
        else if (m.includes('not confirmed')) setErr('Bu hesap henüz doğrulanmamış. Yöneticiye haber ver.');
        else setErr('Giriş yapılamadı: ' + error.message);
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email: mail, password });
      if (error) {
        const m = (error.message || '').toLowerCase();
        if (m.includes('already')) setErr('Bu e-posta zaten kayıtlı. “Giriş yap” sekmesine geç.');
        else if (error.status === 429 || m.includes('rate limit')) setErr('Kısa sürede çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.');
        else if (m.includes('password')) setErr('Şifre en az 6 karakter olmalı.');
        else setErr('Kayıt olunamadı: ' + error.message);
      } else if (!data.session) {
        // E-posta zaten kayıtlıysa ya da doğrulama açıksa oturum açılmaz.
        setErr('Bu e-posta zaten kayıtlı olabilir. “Giriş yap” sekmesini dene.');
      }
    }
    setWorking(false);
  }

  const tab = (m: 'giris' | 'kayit') => ({
    onClick: () => switchMode(m),
    'aria-pressed': mode === m,
    style: mode === m ? { borderColor: 'var(--brass)', flex: 1 } : { flex: 1 },
  });

  return (
    <main>
      <div className="panel">
        <h1>13. Vuruş</h1>
        <p>Sisli Liman’da her gece saat on üç kez çalar.</p>
        <div className="row" style={{ marginTop: 4 }}>
          <button {...tab('giris')}>Giriş yap</button>
          <button {...tab('kayit')}>Kayıt ol</button>
        </div>
        <p className="small" style={{ marginTop: 12 }}>
          {mode === 'giris' ? 'Daha önce kayıt olduysan e-posta ve şifreni gir.' : 'İlk kez mi geliyorsun? E-posta ve bir şifre seç. Şifreyi unutma!'}
        </p>
        <label htmlFor="email">E-posta</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="pw">Şifre</label>
        <input id="pw" type="password" autoComplete={mode === 'giris' ? 'current-password' : 'new-password'}
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="choices">
          <button onClick={submit} disabled={working || !email.includes('@') || password.length < 6}>
            {working ? 'Bekle…' : mode === 'giris' ? 'Giriş yap' : 'Kayıt ol ve başla'}
          </button>
        </div>
        {err && <p role="alert">{err}</p>}
        <p className="small">Çocuklar için: e-posta adresi ebeveynin adresi olmalı.</p>
        <div className="row"><button onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}>❓ Oyun nasıl oynanır?</button></div>
        {showHelp && <HelpPanel />}
      </div>
    </main>
  );
}

// Yardım menüsü: kısa, çocuklara göre yazılmış açıklamalar. Sunucudaki gerçek kurallarla aynı tutulmalı.
const HELP: { q: string; a: string[] }[] = [
  { q: '🎮 Oyun nasıl oynanır?', a: [
    'Hikâyeyi okursun, altındaki seçeneklerden birine dokunursun. Hikâye seçtiğin şeye göre devam eder.',
    'Hikâyede ilerledikçe yeni yerler, yeni kişiler ve yeni ipuçları bulursun. Amacın Sisli Liman’ın sırrını çözmek.',
    'Yanlış seçim diye bir şey yok. Bazen bir kişi sana ipucu verir, sen tekrar denersin.',
  ] },
  { q: '🏮 Fener yağı neden azalır?', a: [
    'Fener yağı 14 ile başlar. Her seçim ya da haritadan yürüyüş 1 yağ harcar.',
    'Yağ 4’e ve 2’ye inince fenerin alevi küçülür ve biraz ürkersin (korku artar).',
    'Yağ bitince fener söner. Nene Selvi seni yurda götürür, uyursun ve yeni bir geceye uyanırsın. Yağın tekrar 14 olur ve çantana bir kurabiye gelir.',
    'Yağı artırmanın yolları: Fener yağı şişesini kullan (+3 yağ), Tamirci yeteneğiyle bir şişe yap ya da korkup yurda koşunca +4 yağ kazan.',
    'Çevik yeteneği olanlar her 3. hamlede yağ harcamaz.',
  ] },
  { q: '😨 Korku nedir, nasıl azalır?', a: [
    'Korku 0 ile 4 arasında bir ölçek. Ürpertici şeylere yaklaşınca artar. Hikâye hep güvenlidir, hiçbir şey sana zarar vermez.',
    'Korkuyu artıranlar: ürpertici bir şeye yaklaşmak ya da dokunmak, Unutulmuş Mezarlık, Fener Kayalığı, Mekanizma Odası ve Usta’nın Atölyesi’ne girmek, fener yağının azalması.',
    'Korkuyu azaltanlar: dost bir yüzle konuşmak, ışık ve espri içeren seçenekler, Nene Selvi’nin kurabiyesini yemek (−1), Konuşkan yeteneğiyle sohbet etmek (−1) ve ortak sahneyi bitirmek (−1).',
    'Korku 4 olursa ceza yok: yurda dönersin, Nene Selvi seni sakinleştirir, korkun sıfırlanır ve 4 yağ kazanırsın.',
  ] },
  { q: '👥 Diğer oyuncuları nasıl görürüm?', a: [
    'Aynı yerde olan oyuncuları sahnenin altında görürsün: “Ali burada.” Birini görmek için aynı yerde olmanız gerekir.',
    '“👥 Çevrimiçi” düğmesi şu an oyunda olan herkesi ve hangi yerde olduklarını gösterir. Haritada da kaç kişi olduğunu görürsün.',
    'Yalnızca takma ad görünür. Gerçek ad, e-posta ya da başka bilgi görünmez. Serbest yazı yoktur, sadece hazır mesajlar: 👋 Selam, 🤝 Takas yapalım mı?, ❓ Yardım edebilir misin?, 🔦 Beni takip et.',
    'Aynı yerdeki biriyle 🧩 “hikâyeni birleştir” diyerek birlikte kısa bir maceraya çıkabilirsin. İkiniz de oy verirsiniz.',
  ] },
  { q: '🗺️ Harita nasıl çalışır?', a: [
    '“Haritayı aç” de. Bulunduğun yer dolu, gidebileceğin yerler → ile işaretli. Dokun, “Buraya yürü” de.',
    '★ hikâyenin seni beklediği yer. ? işaretli yerler henüz sisin içinde, hikâyede ilerledikçe açılır.',
    'Haritadan sadece komşu yerlere gidebilirsin. Yürümek 1 fener yağı harcar.',
  ] },
  { q: '✨ Yetenekler ne işe yarar?', a: [
    '🔍 Gözlemci: hikâye durağında bir kez saklı bir ipucu bulur.',
    '🗣️ Konuşkan: karşısındakiyle içten sohbet eder. Korkun azalır ve o kişi sana daha çok güvenir.',
    '⚡ Çevik: her 3. hamlede fener yağı harcamaz.',
    '🔧 Tamirci: mekanizmaları kurcalayıp ipucu bulur. Başka yerde malzemelerden fener yağı şişesi yapar (gece başına bir).',
    'Yetenek seçeneği, sahnenin altında kesik çizgili düğme olarak çıkar.',
  ] },
  { q: '🎒 Eşyalar ve takas', a: [
    'Çantanda en fazla 8 eşya taşıyabilirsin. 🍪 Kurabiye ve 🫙 yağ şişesi gibi eşyalara “Kullan” diyerek kullanırsın.',
    'Anahtar, dişli, harita parçası ve günlük gibi hikâye eşyaları takas edilemez, onları hep sen saklarsın.',
    'Küçük hatıraları (deniz camı, kuzgun tüyü, bronz düğme, mektup, kurabiye, yağ şişesi) aynı yerdeki oyuncuyla takas edebilirsin. “🤝 takas” de, eşyayı seç. Karşı taraf kabul ederse takas olur, 10 dakika içinde cevap vermezse teklif silinir.',
  ] },
  { q: '💛 Dostların ve güven puanı', a: [
    'Karakterlere nazik, dürüst ve yardımsever davranırsan sana güvenirler. Güven puanı 0 ile 5 arasındadır.',
    'Güveni 3 olan bir karakter sana küçük bir hediye verir ve sana daha açık davranır. Dostların listesi çantanın altında durur.',
    'Hikâyeyi yeniden oynasan bile dostların seni hatırlar.',
  ] },
  { q: '📖 Bölümler ve hikâyenin sonu', a: [
    'Hikâye bölümlere ayrılır. Bir bölüm bitince “2. Bölüm” ya da “yeniden oyna” seçeneği çıkar.',
    'Yeniden oynarken hikâye eşyaların gider, ama hatıralarını ve dostlarını korursun.',
  ] },
  { q: '🛡️ Güvenlik', a: [
    'Takma ad kullan, gerçek adını, okulunu ya da adresini yazma. Zaten oyun senden bunları istemez.',
    'Oyunda bir şey seni rahatsız ederse ya da korkutursa ekranı kapat ve güvendiğin bir büyüğüne söyle.',
  ] },
];

function HelpPanel() {
  return (
    <div className="here" style={{ marginTop: 14 }}>
      {HELP.map((h) => (
        <details key={h.q} style={{ marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', padding: '6px 0' }}><b>{h.q}</b></summary>
          {h.a.map((line, i) => <p key={i} className="small" style={{ margin: '4px 0 4px 14px' }}>{line}</p>)}
        </details>
      ))}
    </div>
  );
}

function CreateCharacter({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [skill, setSkill] = useState<Skill>('gozlemci');
  const [err, setErr] = useState('');
  const [working, setWorking] = useState(false);

  async function create() {
    setErr('');
    setWorking(true);
    // Takma ad kullanılır, gerçek ad değil.
    const { error } = await supabase.from('characters').insert({ user_id: userId, name: name.trim(), skill });
    if (error) {
      setErr('Karakter oluşturulamadı: ' + error.message);
      setWorking(false);
    } else {
      onDone(); // sahne yazılırken düğme kilitli kalır
    }
  }

  return (
    <main>
      <div className="panel">
        <h2>Karakterini oluştur</h2>
        <label htmlFor="name">Takma ad (gerçek adını yazma)</label>
        <input id="name" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="skill">Yeteneğin</label>
        <select id="skill" value={skill} onChange={(e) => setSkill(e.target.value as Skill)}>
          {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <div className="choices">
          <button onClick={create} disabled={working || name.trim().length < 2}>
            {working ? 'Hikâye yazılıyor…' : 'Yolculuğa başla'}
          </button>
        </div>
        {err && <p role="alert">{err}</p>}
      </div>
    </main>
  );
}

async function jointApi(token: string, payload: object) {
  const res = await fetch('/api/joint', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || 'Bir şeyler ters gitti');
  return j;
}

async function tradeApi(token: string, payload: object) {
  const res = await fetch('/api/trade', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || 'Bir şeyler ters gitti');
  return j;
}

type TradeIn = { id: string; fromName: string; item: string };
type TradeOut = { id: string; toName: string; item: string };

// Çizili harita: komşu yerlere dokunup yürüyebilirsin. Sisteki yerler henüz açılmadı.
function MapView({ character, busy, counts, onTravel }: { character: Character; busy: boolean; counts: Record<string, number>; onTravel: (to: string) => void }) {
  const m = character.map;
  const [sel, setSel] = useState<string | null>(null);
  const unlocked = new Set(m.unlocked);
  const canGo = new Set(m.travel);
  const here = character.location;

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width="100%" style={{ maxWidth: 440, display: 'block', margin: '0 auto' }} role="group" aria-label="Sisli Liman haritası">
        <rect x="0" y="0" width={MAP_W} height={MAP_H} rx="10" style={{ fill: 'var(--bg)' }} />
        {MAP_EDGES.map(([a, b]) => {
          const ok = unlocked.has(a) && unlocked.has(b);
          const secret = SECRET_EDGES.includes(`${a}|${b}`);
          return (
            <line key={`${a}-${b}`} x1={MAP_POS[a].x} y1={MAP_POS[a].y} x2={MAP_POS[b].x} y2={MAP_POS[b].y}
              style={{ stroke: ok ? 'var(--mute)' : 'var(--line)' }} strokeWidth={ok ? 2.5 : 1.5}
              strokeDasharray={secret || !ok ? '4 5' : undefined} />
          );
        })}
        {Object.entries(MAP_POS).map(([loc, p]) => {
          const open = unlocked.has(loc);
          const isHere = loc === here;
          const go = canGo.has(loc);
          const isTarget = open && m.target === loc;
          return (
            <g key={loc} role="button" tabIndex={0} aria-label={open ? LOCATION_NAMES[loc] : 'Henüz açılmamış yer'}
              onClick={() => setSel(loc)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSel(loc); }}
              style={{ cursor: 'pointer', outline: 'none' }}>
              <circle cx={p.x} cy={p.y} r="28" fill="transparent" />
              <circle cx={p.x} cy={p.y} r="20"
                style={{ fill: isHere ? 'var(--brass)' : open ? 'var(--panel)' : 'var(--bg)', stroke: go ? 'var(--brass)' : 'var(--line)' }}
                strokeWidth={go || sel === loc ? 3.5 : 2} strokeDasharray={open ? undefined : '3 3'} />
              <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="15" style={{ fill: isHere ? 'var(--bg)' : 'var(--ink)' }}>
                {isHere ? '●' : open ? (go ? '→' : '·') : '?'}
              </text>
              {isTarget && <text x={p.x + 17} y={p.y - 14} fontSize="18" style={{ fill: 'var(--brass)' }}>★</text>}
              {open && (
                <text x={p.x} y={p.y + 36} textAnchor="middle" fontSize="11" style={{ fill: 'var(--ink)' }}>
                  {LOCATION_NAMES[loc]}
                </text>
              )}
              {open && (counts[loc] ?? 0) > 0 && (
                <text x={p.x - 30} y={p.y - 14} fontSize="12" style={{ fill: 'var(--brass)' }}>👥{counts[loc]}</text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="small" style={{ margin: '8px 0 0' }}>
        ● buradasın · → gidebileceğin yer · ★ hikâyenin seni beklediği yer · 👥 oyuncular · ? sis içinde. {m.pieces.label}: {m.pieces.have}/{m.pieces.total}
      </p>
      {sel && (
        <div className="here">
          {unlocked.has(sel) ? <b>{LOCATION_NAMES[sel]}</b> : <b>Sisin içindeki bir yer</b>}
          {sel === here && <div className="small">Şu an buradasın.</div>}
          {sel !== here && canGo.has(sel) && (
            <div className="row">
              <button disabled={busy} onClick={() => { const to = sel; setSel(null); onTravel(to); }}>
                Buraya yürü (fener yağı −1)
              </button>
            </div>
          )}
          {sel !== here && !canGo.has(sel) && unlocked.has(sel) && (
            <div className="small">Buraya doğrudan yol yok. Önce haritada → ile işaretli bir yere git.</div>
          )}
          {!unlocked.has(sel) && <div className="small">Hikâyede ilerledikçe bu yer haritada belirecek.</div>}
        </div>
      )}
    </div>
  );
}

function Game(props: {
  character: Character; scene: Scene | null; busy: boolean; error: string; notices: string[]; token: string;
  onChoose: (id: string) => void; onTravel: (to: string) => void; onUse: (item: string) => void; onRefresh: () => void;
}) {
  const { character, scene, busy, error, notices, token, onChoose, onTravel, onUse, onRefresh } = props;
  const [showMap, setShowMap] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [online, setOnline] = useState<{ id: string; name: string; location: string }[]>([]);
  const onlineCh = useRef<RealtimeChannel | null>(null);
  const locRef = useRef(character.location);
  const [incoming, setIncoming] = useState<TradeIn[]>([]);
  const [outgoing, setOutgoing] = useState<TradeOut[]>([]);
  const [tradeWith, setTradeWith] = useState<Here | null>(null);
  const [tradeMsg, setTradeMsg] = useState('');
  const [here, setHere] = useState<Here[]>([]);
  const [messages, setMessages] = useState<Quick[]>([]);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [notice, setNotice] = useState('');
  const [jointId, setJointId] = useState<string | null>(null);
  const channel = useRef<RealtimeChannel | null>(null);

  // Sayfa yenilense bile açık ortak sahne varsa ona geri dön.
  useEffect(() => {
    jointApi(token, { action: 'mine' }).then((j) => { if (j.session) setJointId(j.session.id); }).catch(() => {});
  }, [token]);

  // Takas teklifleri: açılışta, her 5 saniyede ve bildirim gelince yenilenir.
  const refreshTrades = useCallback(async () => {
    try {
      const j = await tradeApi(token, { action: 'mine' });
      setIncoming(j.incoming ?? []);
      setOutgoing(j.outgoing ?? []);
    } catch { /* sessizce geç */ }
  }, [token]);
  useEffect(() => {
    refreshTrades();
    const t = setInterval(refreshTrades, 5000);
    return () => clearInterval(t);
  }, [refreshTrades]);

  // Aynı mekândaki oyuncuları görmek için mekân başına bir presence kanalı.
  useEffect(() => {
    const ch = supabase.channel(`loc:${character.location}`, { config: { presence: { key: character.id } } });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ name: string }>();
      const list = Object.entries(state)
        .filter(([id]) => id !== character.id)
        .map(([id, metas]) => ({ id, name: metas[0]?.name ?? '?' }));
      setHere(list);
    });
    ch.on('broadcast', { event: 'quick' }, ({ payload }) => {
      if (payload.from === character.name) return;
      setMessages((m) => [...m.slice(-4), { from: payload.from, text: QUICK[payload.preset] ?? '', at: Date.now() }]);
    });
    ch.on('broadcast', { event: 'invite' }, ({ payload }) => {
      if (payload.to === character.id) {
        setInvite({ inviteId: payload.inviteId, fromId: payload.fromId, fromName: payload.fromName });
      }
    });
    ch.on('broadcast', { event: 'joint_started' }, ({ payload }) => {
      if (payload.to === character.id) { setNotice(''); setJointId(payload.sessionId); }
    });
    ch.on('broadcast', { event: 'trade' }, ({ payload }) => {
      if (payload.to === character.id) refreshTrades();
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ name: character.name });
    });
    channel.current = ch;
    return () => { supabase.removeChannel(ch); channel.current = null; setHere([]); };
  }, [character.location, character.id, character.name, refreshTrades]);

  // Takas teklifi gönder: yalnızca hatıra eşyaları ve aynı mekândaki oyuncuya.
  async function offerTrade(item: string) {
    if (!tradeWith) return;
    setTradeMsg('');
    try {
      await tradeApi(token, { action: 'offer', toCharacterId: tradeWith.id, item });
      channel.current?.send({ type: 'broadcast', event: 'trade', payload: { to: tradeWith.id } });
      setTradeMsg(`${tradeWith.name} adlı oyuncuya ${itemLabel(item)} teklif ettin. Kabul edince takas olacak.`);
      setTradeWith(null);
      refreshTrades();
    } catch (e) {
      setTradeMsg(e instanceof Error ? e.message : 'Teklif gönderilemedi');
    }
  }

  async function answerTrade(t: TradeIn, action: 'accept' | 'decline', give?: string) {
    setTradeMsg('');
    try {
      const j = await tradeApi(token, { action, tradeId: t.id, give: give ?? null });
      if (action === 'accept') setTradeMsg(j.message ?? 'Takas tamam.');
      await refreshTrades();
      if (action === 'accept') onRefresh();
    } catch (e) {
      setTradeMsg(e instanceof Error ? e.message : 'İşlem başarısız');
      refreshTrades();
    }
  }

  async function cancelTrade(t: TradeOut) {
    try { await tradeApi(token, { action: 'cancel', tradeId: t.id }); } catch { /* sessizce geç */ }
    refreshTrades();
  }

  const myTradables = character.items.filter(isTradable);

  // Çevrimiçi oyuncular: tüm oyun için tek bir presence kanalı. Yalnızca takma ad ve mekân paylaşılır.
  useEffect(() => {
    const ch = supabase.channel('online', { config: { presence: { key: character.id } } });
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState<{ name: string; location: string }>();
      setOnline(
        Object.entries(st)
          .filter(([id]) => id !== character.id)
          .map(([id, metas]) => ({ id, name: metas[0]?.name ?? '?', location: metas[0]?.location ?? '' }))
      );
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ name: character.name, location: locRef.current });
    });
    onlineCh.current = ch;
    return () => { supabase.removeChannel(ch); onlineCh.current = null; setOnline([]); };
  }, [character.id, character.name]);

  // Mekân değişince konumu kanalda güncelle.
  useEffect(() => {
    locRef.current = character.location;
    const ch = onlineCh.current;
    if (ch && (ch as unknown as { state?: string }).state === 'joined') {
      ch.track({ name: character.name, location: character.location });
    }
  }, [character.location, character.name]);

  const counts: Record<string, number> = {};
  online.forEach((o) => { counts[o.location] = (counts[o.location] ?? 0) + 1; });

  function send(preset: string) {
    channel.current?.send({ type: 'broadcast', event: 'quick', payload: { from: character.name, preset } });
    setMessages((m) => [...m.slice(-4), { from: 'Sen', text: QUICK[preset], at: Date.now() }]);
  }

  async function inviteTo(h: Here) {
    setNotice('');
    try {
      const j = await jointApi(token, { action: 'invite', toCharacterId: h.id });
      channel.current?.send({
        type: 'broadcast', event: 'invite',
        payload: { to: h.id, fromId: character.id, fromName: character.name, inviteId: j.inviteId },
      });
      setNotice(`${h.name} adlı oyuncuya davet gönderildi. Kabul edince ortak sahne açılacak.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Davet gönderilemedi');
    }
  }

  async function acceptInvite() {
    if (!invite) return;
    try {
      const j = await jointApi(token, { action: 'accept', inviteId: invite.inviteId });
      channel.current?.send({ type: 'broadcast', event: 'joint_started', payload: { to: invite.fromId, sessionId: j.sessionId } });
      setInvite(null);
      setJointId(j.sessionId);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Davet kabul edilemedi');
      setInvite(null);
    }
  }

  return (
    <>
      <div className="meta">
        <div>
          Fener yağı
          <div className="bar"><i style={{ width: `${(character.lantern / 14) * 100}%`, background: 'var(--brass)' }} /></div>
        </div>
        <div>
          Korku
          <div className="bar"><i style={{ width: `${(character.fear / 4) * 100}%`, background: '#c46a4f' }} /></div>
        </div>
        <div>{LOCATION_NAMES[character.location] ?? character.location}</div>
        <div>Bölüm {character.chapter}: {character.chapterTitle}</div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <button onClick={() => setShowMap((v) => !v)} aria-expanded={showMap}>
          🗺️ {showMap ? 'Haritayı kapat' : 'Haritayı aç'}
        </button>
        <button onClick={() => setShowOnline((v) => !v)} aria-expanded={showOnline}>
          👥 Çevrimiçi ({online.length + 1})
        </button>
        <button onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}>
          ❓ Yardım
        </button>
      </div>
      {showOnline && (
        <div className="panel" style={{ marginBottom: 16, padding: '12px 16px' }}>
          <b>Şu an oyunda</b>
          <div className="small">Sen: {character.name} · {LOCATION_NAMES[character.location]}</div>
          {online.length === 0 ? (
            <p className="small" style={{ margin: '6px 0 0' }}>Şimdilik başka oyuncu yok. Biraz sonra tekrar bak.</p>
          ) : (
            online.map((o) => (
              <div key={o.id} className="small">
                {o.name} · {LOCATION_NAMES[o.location] ?? 'Sisli Liman'}
                {o.location === character.location && ' · seninle aynı yerde 👋'}
              </div>
            ))
          )}
          <p className="small" style={{ margin: '8px 0 0' }}>Birini görmek ve onunla konuşmak için aynı yerde olmanız gerekir. Haritada hangi yerde kaç kişi olduğu 👥 ile görünür.</p>
        </div>
      )}
      {showHelp && (
        <div className="panel" style={{ marginBottom: 16, padding: '12px 16px' }}>
          <b>Yardım</b>
          <HelpPanel />
        </div>
      )}
      {showMap && !jointId && (
        <MapView character={character} busy={busy} counts={counts} onTravel={(to) => { setShowMap(false); onTravel(to); }} />
      )}

      <div className="panel" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <b>Çanta</b>
        {character.items.length === 0 ? (
          <span className="small"> boş</span>
        ) : (
          <div className="row">
            {character.items.map((i) => (
              <span key={i} className="chip">
                {itemIcon(i)} {itemLabel(i)}
                {ITEMS[i]?.use && (
                  <button disabled={busy} style={{ marginLeft: 8, padding: '2px 8px' }} onClick={() => onUse(i)}>Kullan</button>
                )}
              </span>
            ))}
          </div>
        )}
        {character.friends.length > 0 && (
          <div className="small" style={{ marginTop: 10 }}>
            <b>Dostların:</b>{' '}
            {character.friends.map((f) => `${f.name} ${'💛'.repeat(f.value)}${'·'.repeat(5 - f.value)}`).join(' · ')}
          </div>
        )}
      </div>

      {jointId ? (
        <JointView
          token={token}
          sessionId={jointId}
          onExit={() => { setJointId(null); onRefresh(); }}
        />
      ) : (
        <div className="panel scene" aria-live="polite">
          {scene ? scene.text.split('\n\n').map((p, i) => <p key={i}>{p}</p>) : <p>Sahne yükleniyor…</p>}
          <div className="choices">
            {scene?.choices.map((c) => (
              <button
                key={c.id}
                disabled={busy}
                onClick={() => onChoose(c.id)}
                style={c.id === 'skill' ? { borderStyle: 'dashed', borderColor: 'var(--brass)' } : undefined}
              >
                {c.label}
              </button>
            ))}
          </div>
          {busy && <p className="small">Hikâye yazılıyor…</p>}
          {error && <p role="alert">{error}</p>}
          {notices.length > 0 && (
            <div className="small" role="status" style={{ marginTop: 12 }}>
              {notices.map((n, i) => <div key={i}>{n}</div>)}
            </div>
          )}

          {incoming.map((t) => (
            <div className="here" key={t.id}>
              <b>{t.fromName}</b> sana {itemIcon(t.item)} {itemLabel(t.item)} vermek istiyor.
              {character.items.includes(t.item) ? (
                <div className="small">Bu eşyaya zaten sahipsin.</div>
              ) : (
                <div className="row">
                  <button onClick={() => answerTrade(t, 'accept')}>Hediye olarak kabul et</button>
                  {myTradables.map((i) => (
                    <button key={i} onClick={() => answerTrade(t, 'accept', i)}>🤝 Karşılığında {itemIcon(i)} {itemLabel(i)} ver</button>
                  ))}
                </div>
              )}
              <div className="row"><button onClick={() => answerTrade(t, 'decline')}>Hayır, teşekkürler</button></div>
            </div>
          ))}
          {outgoing.map((t) => (
            <div className="here" key={t.id}>
              {t.toName} adlı oyuncuya {itemIcon(t.item)} {itemLabel(t.item)} teklif ettin. Cevap bekleniyor.
              <div className="row"><button onClick={() => cancelTrade(t)}>Teklifi geri al</button></div>
            </div>
          ))}
          {tradeMsg && <p className="small" role="status">{tradeMsg}</p>}

          {invite && (
            <div className="here">
              <b>{invite.fromName}</b> seninle hikâyeni birleştirmek istiyor.
              <div className="row">
                <button onClick={acceptInvite}>Kabul et</button>
                <button onClick={() => setInvite(null)}>Şimdi değil</button>
              </div>
            </div>
          )}

          {here.length > 0 && (
            <div className="here">
              <b>{here.map((h) => h.name).join(', ')}</b> da burada.
              <div className="row">
                {Object.entries(QUICK).map(([k, v]) => <button key={k} onClick={() => send(k)}>{v}</button>)}
              </div>
              <div className="row">
                {here.map((h) => (
                  <button key={h.id} onClick={() => inviteTo(h)}>🧩 {h.name} ile hikâyeni birleştir</button>
                ))}
              </div>
              {myTradables.length > 0 && (
                <div className="row">
                  {here.map((h) => (
                    <button key={h.id} onClick={() => setTradeWith(h)}>🤝 {h.name} ile takas</button>
                  ))}
                </div>
              )}
              {tradeWith && (
                <div className="row">
                  <span className="small" style={{ width: '100%' }}>{tradeWith.name} için hangi eşyayı teklif edersin?</span>
                  {myTradables.map((i) => (
                    <button key={i} onClick={() => offerTrade(i)}>{itemIcon(i)} {itemLabel(i)}</button>
                  ))}
                  <button onClick={() => setTradeWith(null)}>Vazgeç</button>
                </div>
              )}
            </div>
          )}
          {notice && <p className="small" role="status">{notice}</p>}
          {messages.length > 0 && (
            <div className="small" style={{ marginTop: 10 }}>
              {messages.map((m) => <div key={m.at}>{m.from}: {m.text}</div>)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Ortak sahne: iki oyuncu aynı sahneyi görür, birlikte oy verir.
function JointView({ token, sessionId, onExit }: { token: string; sessionId: string; onExit: () => void }) {
  const [view, setView] = useState<JView | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const j = await jointApi(token, { action: 'state', sessionId });
        if (alive) { setView(j.session); setErr(''); }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : 'Bağlantı hatası');
      }
    }
    tick();
    const t = setInterval(tick, 3000); // arkadaşının oyunu ve yeni sahne için
    return () => { alive = false; clearInterval(t); };
  }, [token, sessionId]);

  async function vote(choiceId: string) {
    setBusy(true);
    try {
      const j = await jointApi(token, { action: 'vote', sessionId, choiceId });
      setView(j.session);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Oy verilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    try { await jointApi(token, { action: 'leave', sessionId }); } catch { /* sessizce çık */ }
    onExit();
  }

  const finished = view?.status === 'closed';

  return (
    <div className="panel scene" aria-live="polite">
      <p className="small">
        Ortak sahne{view ? `: ${view.members.join(' ve ')}` : ''}
        {view && !finished ? ` · Tur ${view.round}/${view.rounds}` : ''}
      </p>

      {!view || !view.scene ? (
        <p>Hikâye yazılıyor…</p>
      ) : (
        view.scene.text.split('\n\n').map((p, i) => <p key={i}>{p}</p>)
      )}

      {view?.scene && !finished && (
        <div className="choices">
          {view.scene.choices.map((c) => (
            <button
              key={c.id}
              disabled={busy || view.myVote !== null}
              onClick={() => vote(c.id)}
              style={view.myVote === c.id ? { borderColor: 'var(--brass)' } : undefined}
            >
              {view.myVote === c.id ? '✓ ' : ''}{c.label}
            </button>
          ))}
        </div>
      )}

      {view?.scene && !finished && view.myVote !== null && (
        <p className="small">
          Seçimin alındı. {view.waiting.length ? `Bekleniyor: ${view.waiting.join(', ')}` : 'Hikâye yazılıyor…'}
        </p>
      )}
      {view?.scene && !finished && view.myVote === null && view.waiting.length > 1 && (
        <p className="small">İkiniz de seçim yapınca hikâye devam eder. Oylar eşit olursa sırayla biriniz karar verir.</p>
      )}

      {finished && view?.scene && (
        <>
          <p className="small">
            {view.scene.choices.length === 0
              ? 'Ortak görev tamamlandı. İkiniz de biraz soluklandınız: fener yağı doldu, korku azaldı.'
              : 'Ortak sahne sona erdi: biriniz ayrıldı. Kendi hikâyene dönebilirsin.'}
          </p>
          <div className="choices"><button onClick={onExit}>Kendi hikâyene dön</button></div>
        </>
      )}

      {err && <p role="alert">{err}</p>}
      {!finished && (
        <p className="small" style={{ marginTop: 14 }}>
          <button style={{ padding: '4px 10px' }} onClick={leave}>Ortak sahneden ayrıl</button>
        </p>
      )}
    </div>
  );
}
