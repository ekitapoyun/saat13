// Eşyalar. Anahtar eşyalar (hikâye için gerekli) takas edilemez, küçük hatıralar edilebilir.

export type ItemDef = {
  label: string;
  icon: string;
  tradable: boolean;
  use?: { fear?: number; lantern?: number; text: string };
};

export const ITEMS: Record<string, ItemDef> = {
  pasli_anahtar: { label: 'Paslı anahtar', icon: '🗝️', tradable: false },
  harita_parcasi: { label: 'Harita parçası', icon: '🧭', tradable: false },
  disli: { label: 'Bronz dişli', icon: '⚙️', tradable: false },
  gunluk_notu: { label: 'Ustanın günlük sayfası', icon: '📓', tradable: false },
  mektup: { label: 'Mühürlü mektup', icon: '✉️', tradable: true },
  deniz_cami: { label: 'Deniz camı', icon: '🔹', tradable: true },
  kuzgun_tuyu: { label: 'Kuzgun tüyü', icon: '🪶', tradable: true },
  bronz_dugme: { label: 'Bronz düğme', icon: '🔘', tradable: true },
  kurabiye: {
    label: 'Nene Selvi’nin kurabiyesi', icon: '🍪', tradable: true,
    use: { fear: -1, text: 'Kurabiyeyi yiyorsun. Tarçın ve tereyağı kokusu içini ısıtıyor, korkun azalıyor.' },
  },
  yag_sisesi: {
    label: 'Fener yağı şişesi', icon: '🫙', tradable: true,
    use: { lantern: 3, text: 'Şişedeki yağı fenere boşaltıyorsun. Alev boy atıyor, ışık genişliyor.' },
  },
};

// Yapay zekâ yalnızca bu eşyaları verebilir. Kurabiye ve yağ şişesini yalnızca sunucu verir.
export const AI_ITEMS = ['pasli_anahtar', 'harita_parcasi', 'disli', 'gunluk_notu', 'mektup', 'deniz_cami', 'kuzgun_tuyu', 'bronz_dugme'];

export const itemLabel = (id: string) => ITEMS[id]?.label ?? id;
export const itemIcon = (id: string) => ITEMS[id]?.icon ?? '🎒';
export const isTradable = (id: string) => Boolean(ITEMS[id]?.tradable);
