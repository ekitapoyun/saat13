'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase, LOCATION_NAMES, type Character, type Scene, type Skill } from '@/lib/supabase';
import { ITEMS, itemIcon, itemLabel, isTradable } from '@/story/items';
import { MAP_W, MAP_H, MAP_POS, MAP_EDGES, SECRET_EDGES } from '@/story/map';
import type { PuzzleDef } from '@/story/puzzles';

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

  const call = useCallback(async (payload: { choiceId?: string; travel?: string; useItem?: string; cit?: string } = {}) => {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/scene', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      });
      // Sunucu zaman aşımına uğrarsa JSON yerine düz metin dönebilir; anlaşılır bir mesaj göster.
      const raw = await res.text();
      let j: any;
      try { j = JSON.parse(raw); } catch { throw new Error('Hikâye şimdi yazılamadı, sunucu geç yanıt verdi. Birkaç saniye sonra aynı seçeneğe tekrar dokun.'); }
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
        onCit={() => call({ cit: 'send' })}
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
// Çıt'ın simgesi: hurda metalden yapılmış küçük dost. Kubbe başlı, paslı sarı varil gövdeli, ince bacaklı.
function CitIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Çıt" style={{ verticalAlign: '-4px' }}>
      {/* kulaklar: eski kapak ve saat kadranı */}
      <circle cx="5.2" cy="8.6" r="3" fill="#9aa3ab" stroke="#4a4f55" strokeWidth="1" />
      <circle cx="5.2" cy="8.6" r="1.1" fill="#4a4f55" />
      <circle cx="26.8" cy="8.6" r="3" fill="#b9c1c7" stroke="#4a4f55" strokeWidth="1" />
      <circle cx="26.8" cy="8.6" r="1.1" fill="#4a4f55" />
      {/* kubbe baş */}
      <path d="M8.5 12 Q8.5 2.2 16 2.2 Q23.5 2.2 23.5 12 Z" fill="#c4ccd2" stroke="#4a4f55" strokeWidth="1.3" />
      <path d="M11 8 Q11.8 4.6 15 4.2" fill="none" stroke="#f2f5f7" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="13" cy="9" r="1.4" fill="#2b1b0e" />
      <circle cx="19" cy="9" r="1.4" fill="#2b1b0e" />
      <rect x="8" y="11.6" width="16" height="2" rx=".8" fill="#6f747a" />
      {/* varil gövde */}
      <rect x="7.5" y="13.5" width="17" height="10" rx="1.6" fill="#d9a521" stroke="#6b3f17" strokeWidth="1.3" />
      <path d="M7.8 17 H24.2 M7.8 20.2 H24.2" stroke="#8f5a1c" strokeWidth=".9" />
      <path d="M9 21.5 q2 -3 4 -1 t3 -2 l1.2 2.8 z" fill="#a8461a" opacity=".6" />
      <circle cx="21" cy="15.5" r="1.1" fill="#a8461a" opacity=".85" />
      <circle cx="11" cy="15.8" r=".8" fill="#a8461a" opacity=".85" />
      {/* kollar */}
      <path d="M7.5 16 Q4 18 4.6 22" fill="none" stroke="#5b4a3a" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M24.5 16 Q28 18 27.4 22" fill="none" stroke="#5b4a3a" strokeWidth="1.3" strokeLinecap="round" />
      {/* ince bacaklar, çan ayaklar */}
      <path d="M12 23.5 L11 28.5 M20 23.5 L21 28.5" stroke="#5b4a3a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.6 30.5 Q9 27.8 11 27.8 Q13 27.8 13.4 30.5 Z" fill="#9aa3ab" stroke="#4a4f55" strokeWidth="1" />
      <path d="M18.6 30.5 Q19 27.8 21 27.8 Q23 27.8 23.4 30.5 Z" fill="#9aa3ab" stroke="#4a4f55" strokeWidth="1" />
    </svg>
  );
}

const HELP: { q: string; a: string[] }[] = [
  { q: '🎮 Oyun nasıl oynanır?', a: [
    'Hikâyeyi okursun, altındaki seçeneklerden birine dokunursun. Hikâye seçtiğin şeye göre devam eder.',
    'Hikâyede ilerledikçe yeni yerler, yeni kişiler ve yeni ipuçları bulursun. Amacın Sisli Liman’ın sırrını çözmek.',
    'Yanlış seçim diye bir şey yok. Bazen bir kişi sana ipucu verir, sen tekrar denersin.',
    'Hikâye duraklardan oluşur. Her durağın kendi yeri vardır: ★ işaretli yere gidip orada birkaç sahne yaşaman gerekir. Durakları atlayamazsın, sırayla ilerlersin.',
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
  { q: '🤖 Çıt kim, ne yapar?', a: [
    'Çıt küçük, bronz bir mekanik dosttur. 2. bölümde (ya da kuleye uğradıktan sonra) seninle birlikte yürür.',
    'Fener yağı 9’un altına düşünce Çıt’ı “yağ bulmaya gönder”. 3 hamle sonra yaklaşık 5 yağla döner, böylece yağ bitmeden eve dönmek zorunda kalmazsın.',
    'Çıt her gece yalnızca bir görev yapar. Yağ bitmeden önce göndermezsen, sabah bir yağ şişesiyle döner.',
    'Çıt’a yardım edersen sana güvenir. Güven puanı arttıkça sana hediyeler getirir.',
  ] },
  { q: '🧩 Bulmacalar nasıl çözülür?', a: [
    'Bazı duraklarda “🧩 Bulmacayı çöz” düğmesi çıkar. Bulmacayı çözmeden o durağı geçemezsin.',
    'Yanlış cevap ceza değildir. Her yanlış denemede bir ipucu açılır, istediğin kadar deneyebilirsin.',
    'Bulmaca türleri: kap ölçme, mantık sırası, sayı dizisi ve renk karışımı.',
    'Takıldığında yeteneğini (Gözlemci, Tamirci) ve ipuçlarını kullan.',
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

// Kayıt yuvaları ve baştan başlama. Oyun her adımda kendiliğinden kaydeder; yuvalar "bu ana dönebileyim" içindir.
function SavePanel({ token, onChanged }: { token: string; onChanged: () => void }) {
  const [slots, setSlots] = useState<{ slot: number; label: string | null; at: string | null }[]>([]);
  const [armed, setArmed] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newSkill, setNewSkill] = useState<Skill>('gozlemci');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const post = useCallback(async (body: object) => {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Bir şeyler ters gitti');
    return j;
  }, [token]);

  const reload = useCallback(() => {
    post({ action: 'list' }).then((j) => setSlots(j.slots)).catch(() => {});
  }, [post]);
  useEffect(() => { reload(); }, [reload]);

  const run = async (key: string, body: object, changes: boolean) => {
    // İki dokunuşlu onay: yanlışlıkla silmeyi önler.
    if (armed !== key) { setArmed(key); setMsg(''); return; }
    setArmed('');
    setBusy(true);
    try {
      const j = await post(body);
      setMsg(j.message ?? 'Tamam');
      reload();
      if (changes) onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  };

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

  return (
    <div className="panel" style={{ marginBottom: 16, padding: '12px 16px' }}>
      <b>💾 Kayıt</b>
      <p className="small" style={{ margin: '4px 0 8px' }}>
        Oyun her adımda kendiliğinden kaydedilir; kapatıp tekrar açınca kaldığın yerden devam edersin.
        Zor bir yere gelmeden önce aşağıdan ayrıca kayıt alabilir, sonra o ana dönebilirsin.
      </p>
      {slots.map((s) => (
        <div key={s.slot} style={{ marginBottom: 10 }}>
          <div className="small"><b>Yuva {s.slot}:</b> {s.label ? `${s.label} (${fmt(s.at)})` : 'boş'}</div>
          <div className="row">
            <button disabled={busy} onClick={() => run(`save${s.slot}`, { action: 'save', slot: s.slot }, false)}>
              {armed === `save${s.slot}` ? (s.label ? 'Üzerine yazılsın mı? Evet' : 'Kaydet, emin misin?') : '💾 Buraya kaydet'}
            </button>
            {s.label && (
              <button disabled={busy} onClick={() => run(`load${s.slot}`, { action: 'load', slot: s.slot }, true)}>
                {armed === `load${s.slot}` ? 'Şimdiki oyun gidecek. Evet, yükle' : '📂 Yükle'}
              </button>
            )}
          </div>
        </div>
      ))}
      <hr style={{ opacity: 0.2 }} />
      <div className="small">Baştan başlarsan ilerlemen, eşyaların ve güven puanların sıfırlanır. Adın ve yeteneğin kalır. Kayıt yuvaların silinmez.</div>
      <div className="row">
        <button disabled={busy} onClick={() => run('reset', { action: 'reset' }, true)}>
          {armed === 'reset' ? 'Emin misin? Evet, baştan başla' : '🔄 Baştan başla'}
        </button>
        {armed && <button disabled={busy} onClick={() => setArmed('')}>Vazgeç</button>}
      </div>
      <hr style={{ opacity: 0.2 }} />
      <div className="small"><b>Yeni karakterle başla:</b> yeni bir takma ad ve yetenek seç, hikâye baştan başlasın. Kayıt yuvaların kalır.</div>
      <label htmlFor="newname" className="small">Yeni takma ad (gerçek adını yazma)</label>
      <input id="newname" value={newName} maxLength={16} onChange={(e) => setNewName(e.target.value)} />
      <label htmlFor="newskill" className="small">Yeni yetenek</label>
      <select id="newskill" value={newSkill} onChange={(e) => setNewSkill(e.target.value as Skill)}>
        {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <div className="row">
        <button disabled={busy || newName.trim().length < 2}
          onClick={() => run('newchar', { action: 'reset', name: newName.trim(), skill: newSkill }, true)}>
          {armed === 'newchar' ? 'Emin misin? Evet, yeni karakterle başla' : '🧒 Yeni karakterle başla'}
        </button>
      </div>
      {msg && <p className="small" role="status" style={{ margin: '8px 0 0' }}>{msg}</p>}
    </div>
  );
}

function HelpPanel() {
  return (
    <div className="here" style={{ marginTop: 14 }}>
      {HELP.map((h) => (
        <details key={h.q} style={{ marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', padding: '6px 0' }}><b>{h.q.startsWith('🤖') ? <><CitIcon /> {h.q.slice(2).trim()}</> : h.q}</b></summary>
          {h.a.map((line, i) => <p key={i} className="small" style={{ margin: '4px 0 4px 14px' }}>{line}</p>)}
        </details>
      ))}
    </div>
  );
}

// ---------- Bulmaca ekranı ----------
async function puzzleApi(token: string, payload: object) {
  const res = await fetch('/api/puzzle', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || 'Bir şeyler ters gitti');
  return j;
}

const swatch = (css: string, size = 22): CSSProperties => ({
  display: 'inline-block', width: size, height: size, borderRadius: 999, background: css,
  border: '2px solid var(--line)', verticalAlign: 'middle', marginRight: 6,
});

function PuzzlePanel({ token, onClose, onSolved }: { token: string; onClose: () => void; onSolved: () => void }) {
  const [def, setDef] = useState<PuzzleDef | null>(null);
  const [err, setErr] = useState('');
  const [feedback, setFeedback] = useState<{ detail?: string; hint?: string } | null>(null);
  const [solved, setSolved] = useState('');
  const [working, setWorking] = useState(false);

  // Bulmaca durumları
  const [jug, setJug] = useState({ a: 0, b: 0 });
  const [moves, setMoves] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [nums, setNums] = useState<string[]>(['', '', '']);
  const [mix, setMix] = useState<Record<string, string[]>>({});

  useEffect(() => {
    puzzleApi(token, { action: 'get' })
      .then((j) => { setDef(j.puzzle); if (j.solved) setSolved('Bu bulmacayı çözdün!'); })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Bulmaca yüklenemedi'));
  }, [token]);

  function doMove(m: string) {
    if (!def || def.type !== 'jugs') return;
    const [capA, capB] = def.caps;
    let { a, b } = jug;
    if (m === 'fillA') a = capA;
    else if (m === 'fillB') b = capB;
    else if (m === 'emptyA') a = 0;
    else if (m === 'emptyB') b = 0;
    else if (m === 'pourAB') { const t = Math.min(a, capB - b); a -= t; b += t; }
    else if (m === 'pourBA') { const t = Math.min(b, capA - a); b -= t; a += t; }
    setJug({ a, b });
    setMoves((x) => [...x, m]);
    setFeedback(null);
  }

  async function submit() {
    if (!def) return;
    setWorking(true);
    setErr('');
    let answer: unknown = null;
    if (def.type === 'jugs') answer = { moves };
    else if (def.type === 'order') answer = { order };
    else if (def.type === 'numbers') answer = { values: nums.map((n) => Number(n)) };
    else if (def.type === 'colors') answer = { mix };
    try {
      const j = await puzzleApi(token, { action: 'solve', answer });
      if (j.ok) setSolved(j.message ?? 'Çözdün!');
      else setFeedback({ detail: j.detail, hint: j.hint });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setWorking(false);
    }
  }

  const canSubmit =
    !def ? false :
    def.type === 'jugs' ? moves.length > 0 :
    def.type === 'order' ? order.length === def.items.length :
    def.type === 'numbers' ? nums.every((n) => n.trim() !== '') :
    def.targets.every((t) => (mix[t.id] ?? []).length === 2);

  return (
    <div className="here" style={{ marginTop: 18 }}>
      {!def && !err && <p className="small">Bulmaca yükleniyor…</p>}
      {err && <p role="alert">{err}</p>}
      {def && (
        <>
          <h2 style={{ fontSize: '1.2rem' }}>{def.title}</h2>
          <p style={{ margin: '8px 0' }}>{def.intro}</p>

          {def.type === 'jugs' && (
            <>
              <p className="small"><b>Amaç:</b> {def.goal}</p>
              <div className="row" style={{ alignItems: 'flex-end' }}>
                {[{ n: 'Büyük kap', cap: def.caps[0], v: jug.a }, { n: 'Küçük kap', cap: def.caps[1], v: jug.b }].map((k) => (
                  <div key={k.n} style={{ minWidth: 110 }}>
                    <div className="small">{k.n} ({k.cap} L)</div>
                    <div style={{ height: 14 * k.cap, width: 60, border: '2px solid var(--line)', borderRadius: 6, position: 'relative', background: 'var(--bg)' }}>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(k.v / k.cap) * 100}%`, background: 'var(--brass)', borderRadius: 4 }} />
                    </div>
                    <div><b>{k.v} L</b></div>
                  </div>
                ))}
              </div>
              <div className="row">
                <button onClick={() => doMove('fillA')}>Büyüğü doldur</button>
                <button onClick={() => doMove('fillB')}>Küçüğü doldur</button>
                <button onClick={() => doMove('emptyA')}>Büyüğü boşalt</button>
                <button onClick={() => doMove('emptyB')}>Küçüğü boşalt</button>
                <button onClick={() => doMove('pourAB')}>Büyükten küçüğe aktar</button>
                <button onClick={() => doMove('pourBA')}>Küçükten büyüğe aktar</button>
                <button onClick={() => { setJug({ a: 0, b: 0 }); setMoves([]); setFeedback(null); }}>↺ Baştan başla</button>
              </div>
              <p className="small">Hamle sayısı: {moves.length}</p>
            </>
          )}

          {def.type === 'order' && (
            <>
              <ul className="small" style={{ paddingLeft: 18 }}>{def.clues.map((c) => <li key={c}>{c}</li>)}</ul>
              <p className="small">Birine dokun, soldan sağa sıraya girsin. Yerleştirdiğine tekrar dokunursan geri alınır.</p>
              <div className="row">
                {def.items.map((it) => (
                  <button key={it.id} disabled={order.includes(it.id)} onClick={() => { setOrder((o) => [...o, it.id]); setFeedback(null); }}>
                    <span style={swatch(it.css)} />{it.label}
                  </button>
                ))}
              </div>
              <div className="row" style={{ minHeight: 48, alignItems: 'center' }}>
                <span className="small">Sıra:</span>
                {order.length === 0 && <span className="small">(boş)</span>}
                {order.map((id, i) => {
                  const it = def.items.find((x) => x.id === id)!;
                  return (
                    <button key={id} onClick={() => { setOrder((o) => o.filter((x) => x !== id)); setFeedback(null); }}>
                      {i + 1}. <span style={swatch(it.css, 18)} />{it.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {def.type === 'numbers' && (
            <>
              {def.questions.map((q, i) => (
                <div key={i} style={{ margin: '10px 0' }}>
                  <div className="small">{q.q}</div>
                  <div style={{ fontSize: '1.1rem' }}>{q.seq.join(', ')}, <b>?</b></div>
                  <input
                    type="number" inputMode="numeric" aria-label={`${q.q} sıradaki sayı`}
                    value={nums[i]} style={{ maxWidth: 140 }}
                    onChange={(e) => { const v = [...nums]; v[i] = e.target.value; setNums(v); setFeedback(null); }}
                  />
                </div>
              ))}
            </>
          )}

          {def.type === 'colors' && (
            <>
              <p className="small">Her renk için paletten iki renk seç.</p>
              {def.targets.map((t) => {
                const chosen = mix[t.id] ?? [];
                return (
                  <div key={t.id} style={{ margin: '10px 0' }}>
                    <div><span style={swatch(t.css, 26)} /><b>{t.label}</b> <span className="small">= {chosen.map((c) => def.palette.find((p) => p.id === c)?.label).join(' + ') || '…'}</span></div>
                    <div className="row">
                      {def.palette.map((p) => {
                        const on = chosen.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            aria-pressed={on}
                            style={on ? { borderColor: 'var(--brass)', borderWidth: 2 } : undefined}
                            onClick={() => {
                              setFeedback(null);
                              setMix((m) => {
                                const cur = m[t.id] ?? [];
                                if (cur.includes(p.id)) return { ...m, [t.id]: cur.filter((x) => x !== p.id) };
                                if (cur.length >= 2) return { ...m, [t.id]: [cur[1], p.id] };
                                return { ...m, [t.id]: [...cur, p.id] };
                              });
                            }}
                          >
                            <span style={swatch(p.css, 16)} />{p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {solved ? (
            <>
              <p><b>✨ {solved}</b></p>
              <div className="choices"><button onClick={onSolved}>Devam et</button></div>
            </>
          ) : (
            <>
              <div className="row">
                <button disabled={working || !canSubmit} onClick={submit}>{working ? 'Kontrol ediliyor…' : 'Cevabı gönder'}</button>
                <button onClick={onClose}>Sonra devam ederim</button>
              </div>
              {feedback && (
                <div className="small" role="status" style={{ marginTop: 10 }}>
                  <div>Henüz değil, ama çok yakınsın. {feedback.detail}</div>
                  {feedback.hint && <div>💡 İpucu: {feedback.hint}</div>}
                </div>
              )}
            </>
          )}
        </>
      )}
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
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width="100%" style={{ maxWidth: 560, display: 'block', margin: '0 auto', borderRadius: 10 }} role="group" aria-label="Sisli Liman haritası">
        <defs>
          <clipPath id="mapclip"><rect x="0" y="0" width={MAP_W} height={MAP_H} rx="10" /></clipPath>
          <radialGradient id="fog">
            <stop offset="0%" stopColor="#eef1ee" stopOpacity="0.96" />
            <stop offset="55%" stopColor="#eef1ee" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#eef1ee" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={MAP_W} height={MAP_H} rx="10" style={{ fill: 'var(--bg)' }} />
        <image href="/harita.jpg" x="0" y="0" width={MAP_W} height={MAP_H} preserveAspectRatio="xMidYMid slice" clipPath="url(#mapclip)" />

        {/* Yollar: yalnızca açılmış yerler arasında silik kesik çizgi */}
        {MAP_EDGES.map(([a, b]) => {
          if (!(unlocked.has(a) && unlocked.has(b))) return null;
          const secret = SECRET_EDGES.includes(`${a}|${b}`);
          return (
            <g key={`${a}-${b}`}>
              <line x1={MAP_POS[a].x} y1={MAP_POS[a].y} x2={MAP_POS[b].x} y2={MAP_POS[b].y}
                stroke="#0b1d21" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" />
              <line x1={MAP_POS[a].x} y1={MAP_POS[a].y} x2={MAP_POS[b].x} y2={MAP_POS[b].y}
                stroke="#f3ecd8" strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round"
                strokeDasharray={secret ? '1 6' : '2 6'} />
            </g>
          );
        })}

        {/* Henüz açılmamış yerler sisle örtülür */}
        {Object.entries(MAP_POS).map(([loc, p]) =>
          unlocked.has(loc) ? null : <circle key={`fog-${loc}`} cx={p.x} cy={p.y} r="46" fill="url(#fog)" pointerEvents="none" />
        )}

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
              <circle cx={p.x} cy={p.y} r="22" fill="transparent" />
              {(go || isTarget) && (
                <circle cx={p.x} cy={p.y} r="16" fill="none" stroke="#f0c75e" strokeOpacity="0.55" strokeWidth="3" />
              )}
              <circle cx={p.x} cy={p.y} r="11"
                fill={isHere ? '#c9a24b' : open ? 'rgba(16,38,43,0.88)' : 'rgba(238,241,238,0.85)'}
                stroke={sel === loc ? '#ffffff' : go ? '#f0c75e' : isHere ? '#10262b' : '#f3ecd8'}
                strokeWidth={go || sel === loc ? 3 : 2}
                strokeDasharray={open ? undefined : '3 3'} />
              <text x={p.x} y={p.y + 4.5} textAnchor="middle" fontSize="12" fontWeight="700"
                fill={isHere ? '#10262b' : open ? '#f3ecd8' : '#3a4a4d'}>
                {isHere ? '●' : open ? (go ? '→' : '·') : '?'}
              </text>
              {isTarget && (
                <text x={p.x + 11} y={p.y - 10} fontSize="17" fill="#f0c75e" stroke="#10262b" strokeWidth="2.5" paintOrder="stroke">★</text>
              )}
              {open && (
                <text x={p.x} y={p.y + 26} textAnchor="middle" fontSize="10.5" fontWeight="700"
                  fill="#f6f0dd" stroke="#0b1d21" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke">
                  {LOCATION_NAMES[loc]}
                </text>
              )}
              {open && (counts[loc] ?? 0) > 0 && (
                <text x={p.x - 24} y={p.y - 11} fontSize="11" fontWeight="700"
                  fill="#f0c75e" stroke="#0b1d21" strokeWidth="3" paintOrder="stroke">👥{counts[loc]}</text>
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
  onChoose: (id: string) => void; onTravel: (to: string) => void; onUse: (item: string) => void; onCit: () => void; onRefresh: () => void;
}) {
  const { character, scene, busy, error, notices, token, onChoose, onTravel, onUse, onCit, onRefresh } = props;
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [showSave, setShowSave] = useState(false);
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
        <button onClick={() => setShowSave((v) => !v)} aria-expanded={showSave}>
          💾 Kayıt
        </button>
      </div>
      {showSave && <SavePanel token={token} onChanged={() => { setShowSave(false); onRefresh(); }} />}
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
        {character.cit.available && (
          <div className="here" style={{ marginTop: 10 }}>
            <b><CitIcon size={22} /> Çıt</b> <span className="small">
              {character.cit.away
                ? `yağ arıyor, ${character.cit.movesLeft} hamle sonra dönecek`
                : character.cit.rested
                  ? 'bu gece bir görev yaptı, dinleniyor'
                  : 'yanında'}
            </span>
            <div className="small">Fener yağı azalınca Çıt’ı yağ bulmaya gönderebilirsin. Böylece yağ bitmeden dönmek zorunda kalmazsın.</div>
            <div className="row">
              <button disabled={busy || !character.cit.canSend} onClick={onCit}><CitIcon size={18} /> Çıt’ı yağ bulmaya gönder</button>
            </div>
            {!character.cit.canSend && !character.cit.away && !character.cit.rested && (
              <div className="small">{character.lantern > 9 ? 'Fener yağı 9’un altına düşünce gönderebilirsin.' : ''}</div>
            )}
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
                onClick={() => (c.id === 'puzzle' ? setPuzzleOpen(true) : onChoose(c.id))}
                style={c.id === 'skill' ? { borderStyle: 'dashed', borderColor: 'var(--brass)' } : c.id === 'puzzle' ? { borderColor: 'var(--brass)', borderWidth: 2 } : undefined}
              >
                {c.label}
              </button>
            ))}
          </div>
          {puzzleOpen && (
            <PuzzlePanel
              token={token}
              onClose={() => setPuzzleOpen(false)}
              onSolved={() => { setPuzzleOpen(false); onChoose('puzzle_done'); }}
            />
          )}
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
