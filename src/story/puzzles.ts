// Bulmacaların herkese açık tanımları. Çözümler burada YOK (bkz. puzzles.server.ts).

export type PuzzleDef =
  | { id: string; type: 'jugs'; title: string; intro: string; goal: string; caps: [number, number]; target: number }
  | { id: string; type: 'order'; title: string; intro: string; items: { id: string; label: string; css: string }[]; clues: string[] }
  | { id: string; type: 'numbers'; title: string; intro: string; questions: { seq: number[]; q: string }[] }
  | {
      id: string; type: 'colors'; title: string; intro: string;
      palette: { id: string; label: string; css: string }[];
      targets: { id: string; label: string; css: string }[];
    };

export const PUZZLES: Record<string, PuzzleDef> = {
  yag: {
    id: 'yag',
    type: 'jugs',
    title: '🫙 Yağ ölçüsü',
    intro: 'Madam Tuzlu’nun iki kabı var: 5 litrelik ve 3 litrelik. Kapların üstünde ölçü çizgisi yok. Fenerin yanması için tam 4 litre yağ gerekiyor.',
    goal: 'Büyük (5 litrelik) kapta tam 4 litre yağ olsun.',
    caps: [5, 3],
    target: 4,
  },
  halka: {
    id: 'halka',
    type: 'order',
    title: '🔗 Halka kilidi',
    intro: 'Kayıt kutusunun kilidi dört renkli halkadan oluşuyor. Halkaları soldan sağa doğru sıraya dizmen gerek. İpuçları sana yardım edecek.',
    items: [
      { id: 'kirmizi', label: 'Kırmızı', css: '#c0392b' },
      { id: 'mavi', label: 'Mavi', css: '#2e6fd1' },
      { id: 'yesil', label: 'Yeşil', css: '#2e9e5b' },
      { id: 'sari', label: 'Sarı', css: '#e0b72a' },
    ],
    clues: [
      'Kırmızı halka zincirin iki ucunda da değil.',
      'Mavi halka, yeşil halkanın hemen solunda.',
      'Yeşil halka en sağda değil.',
    ],
  },
  nota: {
    id: 'nota',
    type: 'numbers',
    title: '🎵 Notalı kilit',
    intro: 'Müzik kutusunun kilidi üç sayı dizisini ister. Her dizinin kendine özel bir kuralı var. Sıradaki sayıyı bul.',
    questions: [
      { seq: [1, 2, 4, 7, 11], q: 'Birinci dizi' },
      { seq: [1, 4, 9, 16], q: 'İkinci dizi' },
      { seq: [3, 6, 5, 10, 9, 18], q: 'Üçüncü dizi' },
    ],
  },
  boya: {
    id: 'boya',
    type: 'colors',
    title: '🎨 Çan boyası',
    intro: 'Brasswick’in boya kutusunda yalnızca dört renk var. Çanın dili için dört yeni renk karıştırman gerek. Her renk için iki palet rengi seç.',
    palette: [
      { id: 'kirmizi', label: 'Kırmızı', css: '#c0392b' },
      { id: 'sari', label: 'Sarı', css: '#e0b72a' },
      { id: 'mavi', label: 'Mavi', css: '#2e6fd1' },
      { id: 'beyaz', label: 'Beyaz', css: '#f2efe6' },
    ],
    targets: [
      { id: 'yesil', label: 'Yeşil', css: '#2e9e5b' },
      { id: 'mor', label: 'Mor', css: '#7d3fa6' },
      { id: 'turuncu', label: 'Turuncu', css: '#e07b24' },
      { id: 'pembe', label: 'Pembe', css: '#f0a6b8' },
    ],
  },
  kabuk: {
    id: 'kabuk',
    type: 'order',
    title: '🐚 Marl’ın kabuk bilmecesi',
    intro: 'Kaptan Marl haritayı sana bilmeceyle veriyor: “Dört kabuğu doğru sıraya dizersen harita senin.” Kabukları soldan sağa diz.',
    items: [
      { id: 'mavi', label: 'Mavi kabuk', css: '#3d85c6' },
      { id: 'kum', label: 'Kum kabuğu', css: '#d9c08a' },
      { id: 'inci', label: 'İnci kabuğu', css: '#f2efe6' },
      { id: 'mercan', label: 'Mercan kabuğu', css: '#e07a5f' },
    ],
    clues: [
      'Kum kabuğu, mavi kabuğun hemen sağında.',
      'İnci kabuğu en solda değil.',
      'İnci kabuğu en sağda da değil.',
      'Mercan kabuğu en sağda.',
    ],
  },
  raf: {
    id: 'raf',
    type: 'numbers',
    title: '📚 Günlük rafı',
    intro: 'Kütüphane kedisinin gösterdiği rafta üç küçük kilit var. Her kilit bir sayı dizisinin sıradaki sayısını istiyor. Günlük bu rafta saklı.',
    questions: [
      { seq: [2, 4, 6, 8], q: 'Birinci kilit' },
      { seq: [1, 2, 4, 8], q: 'İkinci kilit' },
      { seq: [100, 90, 80, 70], q: 'Üçüncü kilit' },
    ],
  },
  gelgit: {
    id: 'gelgit',
    type: 'numbers',
    title: '🌊 Gelgit kadranı',
    intro: 'Kayalıktaki taş kadranın üç çarkı var. Her çark bir dizinin sıradaki sayısına ayarlanınca su çekilir ve mağara açılır.',
    questions: [
      { seq: [3, 6, 12, 24], q: 'Birinci çark' },
      { seq: [30, 27, 24, 21], q: 'İkinci çark' },
      { seq: [1, 3, 6, 10], q: 'Üçüncü çark' },
    ],
  },
  disli: {
    id: 'disli',
    type: 'order',
    title: '⚙️ Dişli sırası',
    intro: 'Mekanizma Odası’ndaki dört dişli yanlış sırada duruyor. Doğru sıraya dizilirlerse mekanizma çalışır. Dişlileri soldan sağa diz.',
    items: [
      { id: 'minik', label: 'Minik dişli', css: '#c9a66b' },
      { id: 'kucuk', label: 'Küçük dişli', css: '#b8863b' },
      { id: 'orta', label: 'Orta dişli', css: '#9c6b2a' },
      { id: 'buyuk', label: 'Büyük dişli', css: '#7a4e1d' },
    ],
    clues: [
      'Orta dişli, büyük dişlinin hemen solunda.',
      'Minik dişli, küçük dişliden önce gelir.',
      'Küçük dişli en solda değil.',
      'Küçük dişli en sağda da değil.',
    ],
  },
};
