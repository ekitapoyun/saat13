// Sisli Liman haritası. Hem sunucu (yol kontrolü) hem istemci (çizim) kullanır. Gizli bilgi yok.

export type Pt = { x: number; y: number };

export const MAP_W = 360;
export const MAP_H = 440;

export const MAP_POS: Record<string, Pt> = {
  yurt: { x: 62, y: 390 },
  bahce: { x: 62, y: 305 },
  mezarlik: { x: 62, y: 215 },
  meydan: { x: 190, y: 350 },
  kulube: { x: 305, y: 395 },
  iskele: { x: 305, y: 305 },
  pazar: { x: 190, y: 262 },
  kayalik: { x: 305, y: 205 },
  kutuphane: { x: 128, y: 160 },
  kule: { x: 230, y: 112 },
  mekanizma: { x: 300, y: 48 },
  atolye: { x: 90, y: 48 },
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
