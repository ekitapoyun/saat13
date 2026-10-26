// 20 dönüm noktası. Her oyuncu bunlara sırayla uğrar. AI aralarındaki yolu doldurur.
// "flag" gerçekleşince oyuncu bir sonraki dönüm noktasına geçer.

export type Node = { n: number; title: string; location: string; goal: string; flag: string };

export const NODES: Node[] = [
  { n: 1, title: 'Fener', location: 'yurt', goal: 'Gece yarısı 13. vuruşu duyar. Nene Selvi feneri verir ve "yağı bitmeden dön" der.', flag: 'selvi_izin' },
  { n: 2, title: 'Süzülen şapka', location: 'bahce', goal: 'Bahçede havada süzülen bir şapka ve saydam bir el görür. Korkmadan karşılık verir.', flag: 'hayalet_gordu' },
  { n: 3, title: 'Çan Meydanı', location: 'meydan', goal: 'Meydanda başka çocuklarla karşılaşabilir. Selamlaşma ya da hikâye birleştirme önerilir.', flag: 'meydana_geldi' },
  { n: 4, title: 'Kaptan Marl', location: 'mezarlik', goal: 'Marl ile tanışır, harita bilmecesini alır.', flag: 'marl_tanisti' },
  { n: 5, title: 'Balıkçı Kulübesi', location: 'kulube', goal: 'Madam Tuzlu, birinci harita parçası ve paslı anahtar.', flag: 'pasli_anahtar' },
  { n: 6, title: 'Kule kapısı', location: 'kule', goal: 'Çıt ile tanışır. Eksik dişli görevi başlar.', flag: 'cit_tanisti' },
  { n: 7, title: 'Pazar Sokağı', location: 'pazar', goal: 'Kuzgun Teodor ile takas yapar, eksik dişliyi alır.', flag: 'disli_alindi' },
  { n: 8, title: 'Eski Kütüphane', location: 'kutuphane', goal: 'Ustanın günlüğünü okur, Lina ipucunu bulur.', flag: 'gunluk_okundu' },
  { n: 9, title: 'Gri Hanım', location: 'mezarlik', goal: 'Gri Hanım yarım kalmış sözünü anlatır, oyuncu Lina’ya iletmeyi öğrenir.', flag: 'gri_mesaji' },
  { n: 10, title: 'Bay Orvel', location: 'meydan', goal: 'Orvel çocukları endişeyle arar. Oyuncu ona güvenip yardım isteyebilir. Zamana karşı bulmaca.', flag: 'orvel_guveni' },
  { n: 11, title: 'Fener Kayalığı', location: 'kayalik', goal: 'Gelgit alçalınca mağarada ikinci harita parçasını bulur (bilmece: saat).', flag: 'parca_2' },
  { n: 12, title: 'Kolye', location: 'kule', goal: 'Çıt kolyenin dişlisinin eşini fark eder. Oyuncu güvendiği biriyle konuşabilir.', flag: 'kolye_ipucu' },
  { n: 13, title: 'Mekanizma Odası', location: 'mekanizma', goal: 'Dişliyi takar, mekanizma bulmacasını çözer, müzik kutusu melodisini duyar.', flag: 'mekanizma_acik' },
  { n: 14, title: 'Üçüncü parça', location: 'mekanizma', goal: 'Üçüncü harita parçasını bulur, gizli geçit açılır.', flag: 'gecit_acik' },
  { n: 15, title: "Usta'nın Atölyesi", location: 'atolye', goal: 'Nikolai Brasswick ile karşılaşır.', flag: 'usta_bulundu' },
  { n: 16, title: "Orvel'in itirafı", location: 'atolye', goal: 'Orvel gerçeği anlatır. Oyuncu onu anlayışla karşılar.', flag: 'orvel_itiraf' },
  { n: 17, title: 'Lina', location: 'atolye', goal: 'Lina belirir. Kolye eşleşir. Gri Hanım’ın mesajı iletilir.', flag: 'lina_bulundu' },
  { n: 18, title: 'Büyük seçim', location: 'mekanizma', goal: 'Oyuncu saati durdurur, onarır ya da sırrı kasabayla paylaşır. Üçü de doğru ve olumludur.', flag: 'buyuk_secim' },
  { n: 19, title: 'Son vuruş', location: 'kule', goal: 'Seçimin sonucu: son vuruş, hayaletlerle veda ya da ziyaret zamanı.', flag: 'son_vurus' },
  { n: 20, title: 'Sabah', location: 'yurt', goal: 'Sabah olur, oyuncu yurda döner. Nene Selvi ve Orvel karşılar.', flag: 'sabah' },
];

// Karakterlerin sahnede ilk yer alabileceği dönüm noktası. Öncesinde sahneye girmezler,
// en fazla belirsiz bir iz (ses, gölge, uzaktan bir şekil) görülebilir.
export const FIRST_APPEARS: Record<string, number> = {
  'Kaptan Marl': 2,
  'Madam Pelin Tuzlu': 5,
  'Çıt': 6,
  'Kuzgun Teodor': 7,
  'Gri Hanım': 9,
  'Üstat Nikolai Brasswick': 15,
  'Lina': 17,
};

export const LOCATION_CODES = [
  'yurt', 'bahce', 'mezarlik', 'meydan', 'kulube', 'iskele',
  'kutuphane', 'pazar', 'kayalik', 'kule', 'mekanizma', 'atolye',
];

// AI yalnızca bu eşyaları verebilir.
export const ALLOWED_ITEMS = ['pasli_anahtar', 'harita_parcasi', 'disli', 'gunluk_notu', 'mektup'];
