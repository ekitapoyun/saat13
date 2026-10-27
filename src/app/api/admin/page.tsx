'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, LOCATION_NAMES } from '@/lib/supabase';
import { itemIcon, itemLabel } from '@/story/items';

type Player = {
  id: string; name: string; email: string; skill: string; chapter: number; chapterTitle: string;
  node: number; total: number; title: string; progress: number; finished: boolean; completed: number[];
  replays: number; nights: number; moves: number; location: string; fear: number; lantern: number;
  items: string[]; flags: string[]; trust: Record<string, number>; lastScene: string;
  createdAt: string; lastActive: string; activeToday: boolean;
};
type Memory = { id: string; name: string; description: string; voice: string | null; created_at: string };
type Data = {
  stats: { players: number; activeToday: number; finishedChapter1: number; avgProgress: number; inChapter2: number };
  players: Player[];
  memory: Memory[];
};

const SKILL: Record<string, string> = { gozlemci: 'Gözlemci', konuskan: 'Konuşkan', cevik: 'Çevik', tamirci: 'Tamirci' };
const fmt = (d: string) => (d ? new Date(d).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-');

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'overview' }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Bir şeyler ters gitti');
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function deleteNpc(id: string) {
    if (!session) return;
    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'deleteNpc', id }),
    });
    load();
  }

  if (!ready) return <main><p className="small">Yükleniyor…</p></main>;
  if (!session) {
    return (
      <main>
        <div className="panel">
          <h1>Yönetici paneli</h1>
          <p>Önce yönetici hesabınla <a href="/" style={{ color: 'var(--brass)' }}>ana sayfadan</a> giriş yap, sonra bu sayfaya dön.</p>
        </div>
      </main>
    );
  }

  const list = (data?.players ?? []).filter((p) => {
    const t = q.trim().toLowerCase();
    return !t || p.name.toLowerCase().includes(t) || p.email.toLowerCase().includes(t);
  });

  return (
    <main style={{ maxWidth: 1000 }}>
      <h1>Yönetici paneli</h1>
      <p className="small">
        <a href="/" style={{ color: 'var(--brass)' }}>← Oyuna dön</a>{' '}
        <button style={{ padding: '4px 10px', marginLeft: 8 }} onClick={load} disabled={loading}>{loading ? 'Yenileniyor…' : 'Yenile'}</button>
      </p>
      {err && <p role="alert">{err}</p>}

      {data && (
        <>
          <div className="meta" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="panel" style={{ padding: 12 }}>Oyuncu<div style={{ fontSize: '1.6rem', color: 'var(--ink)' }}>{data.stats.players}</div></div>
            <div className="panel" style={{ padding: 12 }}>Son 24 saatte aktif<div style={{ fontSize: '1.6rem', color: 'var(--ink)' }}>{data.stats.activeToday}</div></div>
            <div className="panel" style={{ padding: 12 }}>1. bölümü bitiren<div style={{ fontSize: '1.6rem', color: 'var(--ink)' }}>{data.stats.finishedChapter1}</div></div>
            <div className="panel" style={{ padding: 12 }}>Ortalama ilerleme<div style={{ fontSize: '1.6rem', color: 'var(--ink)' }}>%{data.stats.avgProgress}</div></div>
          </div>

          <label htmlFor="q">Ara (takma ad ya da e-posta)</label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} />

          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.88rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--mute)' }}>
                  <th style={{ padding: 8 }}>Oyuncu</th>
                  <th style={{ padding: 8 }}>Bölüm / durak</th>
                  <th style={{ padding: 8, minWidth: 120 }}>İlerleme</th>
                  <th style={{ padding: 8 }}>Korku</th>
                  <th style={{ padding: 8 }}>Yağ</th>
                  <th style={{ padding: 8 }}>Son etkinlik</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <Fragment key={p.id}>
                    <tr onClick={() => setOpen(open === p.id ? null : p.id)}
                      style={{ borderTop: '1px solid var(--line)', cursor: 'pointer' }}>
                      <td style={{ padding: 8 }}>
                        <b>{p.name}</b> {p.activeToday && <span title="Son 24 saatte aktif">🟢</span>}
                        <div className="small">{p.email} · {SKILL[p.skill] ?? p.skill}</div>
                      </td>
                      <td style={{ padding: 8 }}>
                        {p.chapter}. bölüm: {p.chapterTitle}
                        <div className="small">{p.finished ? 'Bölümü bitirdi' : `${p.node}/${p.total} · ${p.title}`}</div>
                      </td>
                      <td style={{ padding: 8 }}>
                        <div className="bar"><i style={{ width: `${p.finished ? 100 : p.progress}%`, background: 'var(--brass)' }} /></div>
                        <div className="small">%{p.finished ? 100 : p.progress}</div>
                      </td>
                      <td style={{ padding: 8 }}>{p.fear}/4</td>
                      <td style={{ padding: 8 }}>{p.lantern}/14</td>
                      <td style={{ padding: 8 }}>{fmt(p.lastActive)}</td>
                    </tr>
                    {open === p.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: '0 8px 14px' }}>
                          <div className="here">
                            <div className="small">
                              Mekân: {LOCATION_NAMES[p.location] ?? p.location} · Kayıt: {fmt(p.createdAt)} · Hamle: {p.moves} · Gece: {p.nights} · Yeniden oynama: {p.replays}
                              {p.completed.length > 0 && ` · Biten bölümler: ${p.completed.join(', ')}`}
                            </div>
                            <div className="small" style={{ marginTop: 6 }}>
                              <b>Çanta:</b> {p.items.length ? p.items.map((i) => `${itemIcon(i)} ${itemLabel(i)}`).join(', ') : 'boş'}
                            </div>
                            <div className="small" style={{ marginTop: 6 }}>
                              <b>Dostlar:</b> {Object.keys(p.trust).length ? Object.entries(p.trust).map(([n, v]) => `${n} ${v}/5`).join(' · ') : 'henüz yok'}
                            </div>
                            <div className="small" style={{ marginTop: 6 }}>
                              <b>Bulunan ipuçları:</b> {p.flags.length ? p.flags.join(', ') : 'henüz yok'}
                            </div>
                            <div style={{ marginTop: 10 }}>
                              <b className="small">Son gördüğü sahne</b>
                              {p.lastScene ? p.lastScene.split('\n\n').map((t, i) => <p key={i} className="small" style={{ margin: '4px 0' }}>{t}</p>) : <p className="small">-</p>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <p className="small">Eşleşen oyuncu yok.</p>}
          </div>

          <h2 style={{ marginTop: 32 }}>Dünya hafızası</h2>
          <p className="small">Yapay zekânın tanıttığı karakterler. Uygun olmayan birini silebilirsin.</p>
          {data.memory.length === 0 && <p className="small">Henüz kayıt yok.</p>}
          {data.memory.map((m) => (
            <div key={m.id} className="here">
              <b>{m.name}</b> <span className="small">· {fmt(m.created_at)}</span>
              <div className="small">{m.description}{m.voice ? ` (Ses: ${m.voice})` : ''}</div>
              <div className="row"><button onClick={() => deleteNpc(m.id)}>Sil</button></div>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
