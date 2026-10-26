'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase, LOCATION_NAMES, type Character, type Scene, type Skill } from '@/lib/supabase';

const SKILLS: { id: Skill; label: string }[] = [
  { id: 'gozlemci', label: 'Gözlemci: saklı ipuçlarını fark eder' },
  { id: 'konuskan', label: 'Konuşkan: hayaletlerle ek diyalog açar' },
  { id: 'cevik', label: 'Çevik: zamana karşı ekstra hamle' },
  { id: 'tamirci', label: 'Tamirci: mekanizmalarla ek seçenek' },
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const call = useCallback(async (choiceId?: string) => {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/scene', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ choiceId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Bir şeyler ters gitti');
      setScene(j.scene);
      setCharacter(j.character);
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
        token={session.access_token}
        onChoose={call}
        onRefresh={() => call()}
      />
      <p className="small" style={{ marginTop: 24 }}>
        <button style={{ padding: '4px 10px' }} onClick={() => supabase.auth.signOut()}>Çıkış yap</button>
      </p>
    </main>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  async function send() {
    setErr('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setErr('E-posta gönderilemedi. Adresi kontrol edip tekrar dene.');
    else setSent(true);
  }

  return (
    <main>
      <div className="panel">
        <h1>13. Vuruş</h1>
        <p>Sisli Liman’da her gece saat on üç kez çalar. Hikâyeye başlamak için e-posta adresini gir.</p>
        <p className="small">Çocuklar için: giriş bağlantısı ebeveynin e-posta adresine gönderilmelidir.</p>
        {sent ? (
          <p>Giriş bağlantısı e-postana gönderildi. Bağlantıya tıklayınca buraya döneceksin.</p>
        ) : (
          <>
            <label htmlFor="email">E-posta</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="choices">
              <button onClick={send} disabled={!email.includes('@')}>Giriş bağlantısı gönder</button>
            </div>
            {err && <p role="alert">{err}</p>}
          </>
        )}
      </div>
    </main>
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

function Game(props: {
  character: Character; scene: Scene | null; busy: boolean; error: string; token: string;
  onChoose: (id: string) => void; onRefresh: () => void;
}) {
  const { character, scene, busy, error, token, onChoose, onRefresh } = props;
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
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ name: character.name });
    });
    channel.current = ch;
    return () => { supabase.removeChannel(ch); channel.current = null; setHere([]); };
  }, [character.location, character.id, character.name]);

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
        <div>{character.items.length ? `Çanta: ${character.items.join(', ')}` : 'Çanta boş'}</div>
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
              <button key={c.id} disabled={busy} onClick={() => onChoose(c.id)}>{c.label}</button>
            ))}
          </div>
          {busy && <p className="small">Hikâye yazılıyor…</p>}
          {error && <p role="alert">{error}</p>}

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
