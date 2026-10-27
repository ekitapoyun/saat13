import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nodesOf } from '@/story/nodes';
import { PUZZLES } from '@/story/puzzles';
import { checkPuzzle, HINTS, SOLVED_TEXT } from '@/story/puzzles.server';

// Bulmaca doğrulama. Çözümler yalnızca sunucuda durur. Doğru çözülünce kayıt "çözüldü" diye
// işaretlenir; hikâyeyi ilerletmek /api/scene tarafında yapılır.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return fail('Giriş gerekli', 401);
  const { data: u } = await admin.auth.getUser(token);
  if (!u.user) return fail('Geçersiz oturum', 401);
  const { data: ch } = await admin.from('characters').select('*').eq('user_id', u.user.id).single();
  if (!ch) return fail('Karakter yok', 404);

  const chapter: number = ch.chapter ?? 1;
  const cur = nodesOf(chapter)[ch.node - 1];
  if (!cur?.puzzle || !PUZZLES[cur.puzzle]) return fail('Bu durakta bulmaca yok');
  if (!ch.current || ch.current.night || ch.current.finished) return fail('Şimdi bulmaca çözemezsin');
  if (ch.location !== cur.location) return fail('Bulmacayı çözmek için durağın yerinde olmalısın');
  if ((ch.current.steps ?? 1) < 2) return fail('Önce hikâyeyi biraz yaşa');
  if (ch.flags?.[cur.flag]) return fail('Bu bulmacayı zaten çözdün');

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? 'get');
  const key = `${chapter}:${cur.n}`;
  const meta: any = { ...(ch.meta ?? {}) };
  const tries: Record<string, number> = { ...(meta.puzzleTries ?? {}) };

  if (action === 'get') {
    return NextResponse.json({ puzzle: PUZZLES[cur.puzzle], tries: tries[key] ?? 0, solved: meta.puzzleOk === key });
  }

  if (action === 'solve') {
    if (meta.puzzleOk === key) return NextResponse.json({ ok: true, message: SOLVED_TEXT[cur.puzzle] ?? 'Çözüldü!' });
    const res = checkPuzzle(cur.puzzle, body.answer);
    if (res.ok) {
      meta.puzzleOk = key;
      delete tries[key];
      meta.puzzleTries = tries;
      await admin.from('characters').update({ meta }).eq('id', ch.id);
      return NextResponse.json({ ok: true, message: SOLVED_TEXT[cur.puzzle] ?? 'Çözüldü!' });
    }
    // Yanlış cevap ceza değildir: bir sonraki ipucu açılır.
    tries[key] = (tries[key] ?? 0) + 1;
    meta.puzzleTries = tries;
    await admin.from('characters').update({ meta }).eq('id', ch.id);
    const hints = HINTS[cur.puzzle] ?? [];
    return NextResponse.json({
      ok: false,
      detail: res.detail,
      hint: hints.length ? hints[Math.min(tries[key] - 1, hints.length - 1)] : undefined,
      tries: tries[key],
    });
  }

  return fail('Bilinmeyen işlem');
}
