import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isTradable, itemLabel } from '@/story/items';

// Takas: yalnızca aynı mekândaki iki oyuncu, yalnızca küçük hatıra eşyaları.
// Her şey sunucuda doğrulanır. İstemci eşya listesini değiştiremez.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TTL_MS = 10 * 60 * 1000;
const MAX_ITEMS = 8;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return fail('Giriş gerekli', 401);
  const { data: u } = await admin.auth.getUser(token);
  if (!u.user) return fail('Geçersiz oturum', 401);
  const { data: me } = await admin.from('characters').select('id,name,location,items').eq('user_id', u.user.id).single();
  if (!me) return fail('Karakter yok', 404);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();

  // Süresi geçen teklifleri kapat.
  await admin.from('trades').update({ status: 'expired' }).eq('status', 'pending').lt('created_at', cutoff);

  if (action === 'mine') {
    const { data } = await admin
      .from('trades')
      .select('id,from_character,to_character,offer_item,status,created_at')
      .eq('status', 'pending')
      .or(`from_character.eq.${me.id},to_character.eq.${me.id}`);
    const ids = Array.from(new Set((data ?? []).flatMap((t) => [t.from_character, t.to_character]))).filter((i) => i !== me.id);
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: chars } = await admin.from('characters').select('id,name').in('id', ids);
      (chars ?? []).forEach((c) => { names[c.id] = c.name; });
    }
    const incoming = (data ?? []).filter((t) => t.to_character === me.id)
      .map((t) => ({ id: t.id, fromName: names[t.from_character] ?? '?', item: t.offer_item }));
    const outgoing = (data ?? []).filter((t) => t.from_character === me.id)
      .map((t) => ({ id: t.id, toName: names[t.to_character] ?? '?', item: t.offer_item }));
    return NextResponse.json({ incoming, outgoing });
  }

  if (action === 'offer') {
    const toId = String(body.toCharacterId ?? '');
    const item = String(body.item ?? '');
    if (!toId || toId === me.id) return fail('Geçersiz oyuncu');
    if (!isTradable(item) || !me.items.includes(item)) return fail('Bu eşyayı takas edemezsin');
    const { data: other } = await admin.from('characters').select('id,name,location').eq('id', toId).single();
    if (!other || other.location !== me.location) return fail('Bu oyuncu artık burada değil');

    // En fazla 3 bekleyen teklif, dakikada en fazla 5 teklif.
    const { count: pending } = await admin.from('trades').select('id', { count: 'exact', head: true })
      .eq('from_character', me.id).eq('status', 'pending');
    if ((pending ?? 0) >= 3) return fail('Bekleyen çok teklifin var. Biraz bekle.');
    const minuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: recent } = await admin.from('trades').select('id', { count: 'exact', head: true })
      .eq('from_character', me.id).gt('created_at', minuteAgo);
    if ((recent ?? 0) >= 5) return fail('Çok hızlı teklif gönderiyorsun. Biraz bekle.');

    const { data: t, error } = await admin.from('trades')
      .insert({ from_character: me.id, to_character: toId, location: me.location, offer_item: item })
      .select('id').single();
    if (error || !t) return fail('Teklif gönderilemedi', 500);
    return NextResponse.json({ ok: true, tradeId: t.id, toName: other.name });
  }

  if (action === 'accept') {
    const tradeId = String(body.tradeId ?? '');
    const give: string | null = body.give ? String(body.give) : null; // karşılık, boş olursa hediye
    const { data: t } = await admin.from('trades').select('*').eq('id', tradeId).maybeSingle();
    if (!t || t.status !== 'pending' || t.to_character !== me.id) return fail('Teklif artık geçerli değil');
    const { data: from } = await admin.from('characters').select('id,name,location,items').eq('id', t.from_character).single();
    if (!from) return fail('Teklif eden oyuncu bulunamadı');
    if (from.location !== me.location) return fail('Teklif eden oyuncu artık burada değil');
    if (!from.items.includes(t.offer_item)) return fail('Teklif edilen eşya artık yok');
    if (me.items.includes(t.offer_item)) return fail('Bu eşyaya zaten sahipsin');
    if (give) {
      if (!isTradable(give) || !me.items.includes(give)) return fail('Bu eşyayı veremezsin');
      if (from.items.includes(give)) return fail(`${from.name} zaten bu eşyaya sahip`);
    }

    // Çanta kapasitesi: takas sonrası kimse 8'i geçmesin.
    const myNew = me.items.filter((i: string) => i !== give).concat(t.offer_item);
    const fromNew = from.items.filter((i: string) => i !== t.offer_item).concat(give ? [give] : []);
    if (myNew.length > MAX_ITEMS) return fail('Çantan dolu. Önce bir şey kullan ya da ver.');
    if (fromNew.length > MAX_ITEMS) return fail('Karşı tarafın çantası dolu.');

    // Teklifi tek seferde sahiplen: aynı teklif iki kez uygulanamaz.
    const { data: claimed } = await admin.from('trades')
      .update({ status: 'accepted', return_item: give })
      .eq('id', tradeId).eq('status', 'pending').select('id');
    if (!claimed || claimed.length === 0) return fail('Teklif artık geçerli değil');

    const a = await admin.from('characters').update({ items: myNew }).eq('id', me.id);
    const b = await admin.from('characters').update({ items: fromNew }).eq('id', from.id);
    if (a.error || b.error) return fail('Takas tamamlanamadı', 500);
    return NextResponse.json({
      ok: true,
      message: give
        ? `Takas tamam: ${itemLabel(t.offer_item)} karşılığında ${itemLabel(give)} verdin.`
        : `${from.name} sana ${itemLabel(t.offer_item)} hediye etti.`,
    });
  }

  if (action === 'decline' || action === 'cancel') {
    const tradeId = String(body.tradeId ?? '');
    const { data: t } = await admin.from('trades').select('*').eq('id', tradeId).maybeSingle();
    if (!t || t.status !== 'pending') return fail('Teklif artık geçerli değil');
    const mineAsReceiver = action === 'decline' && t.to_character === me.id;
    const mineAsSender = action === 'cancel' && t.from_character === me.id;
    if (!mineAsReceiver && !mineAsSender) return fail('Bu teklife erişimin yok', 403);
    await admin.from('trades').update({ status: action === 'decline' ? 'declined' : 'cancelled' })
      .eq('id', tradeId).eq('status', 'pending');
    return NextResponse.json({ ok: true });
  }

  return fail('Bilinmeyen işlem');
}
