// Bulmaca çözümleri ve ipuçları. YALNIZCA sunucu kodu bu dosyayı içe aktarır.
// Yanlış cevap ceza değildir: oyuncu ipucu alır ve tekrar dener.

export type CheckResult = { ok: boolean; detail?: string };

const JUG_MOVES = ['fillA', 'fillB', 'emptyA', 'emptyB', 'pourAB', 'pourBA'];

function checkJugs(answer: any): CheckResult {
  const moves: unknown = answer?.moves;
  if (!Array.isArray(moves) || moves.length === 0 || moves.length > 60) return { ok: false, detail: 'Önce birkaç hamle yap.' };
  let a = 0, b = 0;
  const capA = 5, capB = 3;
  for (const m of moves) {
    if (typeof m !== 'string' || !JUG_MOVES.includes(m)) return { ok: false, detail: 'Geçersiz hamle.' };
    if (m === 'fillA') a = capA;
    else if (m === 'fillB') b = capB;
    else if (m === 'emptyA') a = 0;
    else if (m === 'emptyB') b = 0;
    else if (m === 'pourAB') { const t = Math.min(a, capB - b); a -= t; b += t; }
    else if (m === 'pourBA') { const t = Math.min(b, capA - a); b -= t; a += t; }
  }
  return a === 4 ? { ok: true } : { ok: false, detail: `Büyük kapta ${a} litre, küçük kapta ${b} litre var.` };
}

function checkOrder(answer: any): CheckResult {
  const want = ['mavi', 'yesil', 'kirmizi', 'sari'];
  const got: unknown = answer?.order;
  if (!Array.isArray(got) || got.length !== 4) return { ok: false, detail: 'Dört halkayı da yerleştir.' };
  const right = want.filter((w, i) => got[i] === w).length;
  return right === 4 ? { ok: true } : { ok: false, detail: `${right}/4 halka doğru yerde.` };
}

function checkNumbers(answer: any): CheckResult {
  const want = [16, 25, 17];
  const got: unknown = answer?.values;
  if (!Array.isArray(got) || got.length !== 3) return { ok: false, detail: 'Üç diziyi de doldur.' };
  const right = want.filter((w, i) => Number(got[i]) === w).length;
  return right === 3 ? { ok: true } : { ok: false, detail: `${right}/3 dizi doğru.` };
}

function checkColors(answer: any): CheckResult {
  const want: Record<string, string[]> = {
    yesil: ['mavi', 'sari'],
    mor: ['kirmizi', 'mavi'],
    turuncu: ['kirmizi', 'sari'],
    pembe: ['beyaz', 'kirmizi'],
  };
  const mix: any = answer?.mix;
  if (!mix || typeof mix !== 'object') return { ok: false, detail: 'Renkleri seç.' };
  let right = 0;
  for (const [t, pair] of Object.entries(want)) {
    const g: unknown = mix[t];
    if (Array.isArray(g) && g.length === 2 && g[0] !== g[1] && [...g].sort().join() === [...pair].sort().join()) right++;
  }
  return right === 4 ? { ok: true } : { ok: false, detail: `${right}/4 renk doğru.` };
}

export function checkPuzzle(id: string, answer: unknown): CheckResult {
  switch (id) {
    case 'yag': return checkJugs(answer);
    case 'halka': return checkOrder(answer);
    case 'nota': return checkNumbers(answer);
    case 'boya': return checkColors(answer);
    default: return { ok: false, detail: 'Bilinmeyen bulmaca.' };
  }
}

// Her yanlış denemede bir sonraki ipucu açılır.
export const HINTS: Record<string, string[]> = {
  yag: [
    'Önce büyük kabı tamamen doldurmayı dene.',
    'Büyük kaptaki yağı küçük kaba boşalt. Büyük kapta ne kaldı?',
    'Küçük kabı boşalt, sonra büyük kaptakini yeniden küçük kaba aktar. Büyük kapta kaç litre var?',
    'Şimdi büyük kabı tekrar doldur ve küçük kaptaki boşluk dolana kadar aktar.',
  ],
  halka: [
    'Önce “mavi, yeşilin hemen solunda” ipucunu kullan: mavi ve yeşil yan yana, sırayla.',
    'Yeşil en sağda olamaz. Mavi–yeşil ikilisi nerede durabilir?',
    'Kırmızı iki uçta da olamaz, yani ortadaki iki yerden birinde olmalı.',
    'Mavi–yeşil ikilisini en sola koy, geri kalan iki halkayı düşün.',
  ],
  nota: [
    'Birinci dizide sayılar arasındaki farkı yaz: 1, 2, 3, 4… Fark nasıl değişiyor?',
    'İkinci dizideki sayılar bir sayının kendisiyle çarpımı: 1×1, 2×2, 3×3…',
    'Üçüncü dizide iki kural sırayla tekrarlanıyor: önce ikiyle çarp, sonra bir çıkar.',
    'Birinci dizide son fark 4 idi, sıradaki fark 5. Sonuç 11 + 5.',
  ],
  boya: [
    'Üç ana renk: kırmızı, sarı, mavi. İkisini karıştırınca yeni renkler çıkar.',
    'Sarı + mavi çimen rengini verir. Kırmızı + mavi ise menekşe rengini.',
    'Turuncu, ateşin renkleri: kırmızı ile sarı karışır.',
    'Pembe için bir ana renk ve bir açıcı renk lazım. Beyaz hangi renkle pembe yapar?',
  ],
};

export const SOLVED_TEXT: Record<string, string> = {
  yag: 'Tam 4 litre! Madam Tuzlu ellerini çırpıyor: “Hesap bu kadar güzel olur.”',
  halka: 'Halkalar yerine oturuyor ve kilit tık diye açılıyor.',
  nota: 'Üç dizi de doğru! Müzik kutusunun kilidi nazikçe açılıyor.',
  boya: 'Dört renk de hazır! Brasswick sevinçle fırçasını sallıyor.',
};
