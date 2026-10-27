// Sisli Liman haritası. Hem sunucu (yol kontrolü) hem istemci (çizim) kullanır. Gizli bilgi yok.

export type Pt = { x: number; y: number };

export const MAP_W = 360;
export const MAP_H = 480; // harita görseli (public/harita.jpg) 3:4 oranında: 1086x1448 px

// Konumlar çizilmiş harita görselindeki yerlere göre ayarlıdır (görsel pikseli x 360/1086).
export const MAP_POS: Record<string, Pt> = {
  yurt: { x: 81, y: 356 },
  bahce: { x: 78, y: 282 },
  mezarlik: { x: 50, y: 194 },
  meydan: { x: 194, y: 300 },
  kulube: { x: 262, y: 376 },
  iskele: { x: 295, y: 265 },
  pazar: { x: 189, y: 196 },
  kayalik: { x: 317, y: 99 },
  kutuphane: { x: 76, y: 113 },
  kule: { x: 191, y: 66 },
  mekanizma: { x: 244, y: 71 },
  atolye: { x: 71, y: 46 },
};

// Yollar. Haritadan yalnızca komşu yerlere gidilir.
export const MAP_EDGES: [string, string][] = [
  ['yurt', 'bahce'], ['yurt', 'meydan'], ['bahce', 'mezarlik'], ['meydan', 'mezarlik'],
  ['meydan', 'pazar'], ['meydan', 'kulube'], ['kulube', 'iskele'], ['iskele', 'kayalik'],
  ['pazar', 'iskele'], ['pazar', 'kutuphane'], ['mezarlik', 'kutuphane'], ['kutuphane', 'kule'],
  ['kayalik', 'kule'], ['pazar', 'kule'], ['kule', 'mekanizma'], ['mekanizma', 'atolye'],
];

export const SECRET_EDGES = ['mekanizma|atolye'];

export const neighbors = (loc: string): string[] =>
  MAP_EDGES.flatMap(([a, b]) => (a === loc ? [b] : b === loc ? [a] : []));

// Bir yerin haritada açılacağı ilk dönüm noktası (1. bölüm). 2. bölümde her yer açıktır.
export const UNLOCK_NODE: Record<string, number> = {
  yurt: 1, bahce: 2, meydan: 3, iskele: 3, mezarlik: 4, kulube: 5, kule: 6,
  pazar: 7, kutuphane: 8, kayalik: 11, mekanizma: 13, atolye: 15,
};

export const isUnlocked = (loc: string, chapter: number, node: number) =>
  chapter > 1 || node >= (UNLOCK_NODE[loc] ?? 99);

export const LOCATION_NAMES: Record<string, string> = {
  yurt: 'Sahipsizler Yurdu',
  bahce: 'Yurt Bahçesi',
  mezarlik: 'Unutulmuş Mezarlık',
  meydan: 'Çan Meydanı',
  kulube: 'Balıkçı Kulübesi',
  iskele: 'İskele',
  kutuphane: 'Eski Kütüphane',
  pazar: 'Pazar Sokağı',
  kayalik: 'Fener Kayalığı',
  kule: 'Saat Kulesi',
  mekanizma: 'Mekanizma Odası',
  atolye: "Usta'nın Atölyesi",
};
