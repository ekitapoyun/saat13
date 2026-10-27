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
};
