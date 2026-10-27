// Dönüm noktaları. Her oyuncu bunlara sırayla uğrar. AI aralarındaki yolu doldurur.
// "flag" gerçekleşince oyuncu bir sonraki dönüm noktasına geçer.
// hint: Gözlemci / Tamirci yeteneği açılınca gösterilen elle yazılmış ipucu.
// talk: Konuşkan yeteneği açılınca gösterilen elle yazılmış cümle. npc varsa güven puanı da artar.

import { AI_ITEMS } from './items';

export type Node = {
  n: number; title: string; location: string; goal: string; flag: string;
  hint: string; talk: string; npc?: string;
  // Bu durak bir bulmaca içerir. Bayrak yalnızca bulmaca çözülünce alınır (src/story/puzzles.ts).
  puzzle?: string;
};

export const NODES: Node[] = [
  { n: 1, title: 'Fener', location: 'yurt', flag: 'selvi_izin', npc: 'Nene Selvi',
    goal: 'Gece yarısı 13. vuruşu duyar. Nene Selvi feneri verir ve "yağı bitmeden dön" der.',
    hint: 'Nene Selvi’nin cebinden fener yağı şişesi kokusu geliyor. Feneri alırsan yola çıkabilirsin.',
    talk: 'Nene Selvi gülümsüyor: “Merak etmen güzel. Fener seni korur, sen de onu koru.”' },
  { n: 2, title: 'Süzülen şapka', location: 'bahce', flag: 'hayalet_gordu', npc: 'Kaptan Marl',
    goal: 'Bahçede havada süzülen bir şapka ve saydam bir el görür. Korkmadan karşılık verir.',
    hint: 'Şapka sana doğru değil, çitin ardındaki mezarlığa doğru eğiliyor. Sanki yolu gösteriyor.',
    talk: 'Şapka bir kez selam verir gibi eğiliyor. Birinin sana iyi niyetle baktığını hissediyorsun.' },
  { n: 3, title: 'Çan Meydanı', location: 'meydan', flag: 'meydana_geldi',
    goal: 'Meydanda başka çocuklarla karşılaşabilir. Selamlaşma ya da hikâye birleştirme önerilir.',
    hint: 'Meydandaki çeşmenin taşında fenerinle aynı işaret oyulu: küçük bir saat. Bu işaret seni yönlendiriyor.',
    talk: 'Bir simitçi fısıldıyor: “Geceleri çan çalmadan önce mezarlıktan gülme sesi gelir. Korkma, o ses sana yol gösterir.”' },
  { n: 4, title: 'Kaptan Marl', location: 'mezarlik', flag: 'marl_tanisti', npc: 'Kaptan Marl', puzzle: 'kabuk',
    goal: 'Marl ile tanışır. BULMACA: Marl haritayı bilmeceyle verir, dört renkli deniz kabuğunu doğru sıraya dizmek gerekir. Oyuncu bulmacayı ekranında çözer; çözünce harita bilmecesini alır.',
    hint: 'Mezar taşlarından birinin üstünde taze bir deniz kabuğu duruyor. Marl’ın oradan seslendiğini fark ediyorsun.',
    talk: 'Marl kahkaha atıyor: “Bu kadar kibar bir çocuk görmeyeli yüz yıl oldu! Haritayı sana bilmeceyle vereceğim.”' },
  { n: 5, title: 'Balıkçı Kulübesi', location: 'kulube', flag: 'pasli_anahtar', npc: 'Madam Pelin Tuzlu',
    goal: 'Madam Tuzlu, birinci harita parçası ve paslı anahtar.',
    hint: 'Kulübenin kapısındaki çapa şeklinde kabartma gevşek. Altında bir şey parlıyor.',
    talk: 'Madam Tuzlu çayını uzatıyor: “Dürüst çocuklara anahtarı vermek benim işim. Önce çayını iç.”' },
  { n: 6, title: 'Kule kapısı', location: 'kule', flag: 'cit_tanisti', npc: 'Çıt',
    goal: 'Çıt ile tanışır. Eksik dişli görevi başlar.',
    hint: 'Kapının kilidi yağlı ve temiz. Biri düzenli olarak bakım yapıyor. Tıkırtılar kapının içinden geliyor.',
    talk: 'Çıt kısa kısa tıkırdıyor: “Dişli yok. Yardım. Sen iyi.” Sana güvenmeye başladığını anlıyorsun.' },
  { n: 7, title: 'Pazar Sokağı', location: 'pazar', flag: 'disli_alindi', npc: 'Kuzgun Teodor',
    goal: 'Kuzgun Teodor ile takas yapar, eksik dişliyi alır.',
    hint: 'Teodor parlak şeylere bayılıyor. Elindeki küçük bir hatıra ona yetebilir.',
    talk: 'Teodor kanat çırpıyor: “Dürüst takas severim. Bana bir hatıra göster, dişliyi beraber bulalım.”' },
  { n: 8, title: 'Eski Kütüphane', location: 'kutuphane', flag: 'gunluk_okundu', puzzle: 'raf',
    goal: 'Ustanın günlüğünü okur, Lina ipucunu bulur. BULMACA: Günlük, üç sayı kilitli bir rafta saklı; kütüphane kedisi yolu gösterir. Oyuncu kilitleri ekranında çözer.',
    hint: 'Raflardan birinin tozu silinmiş. Orada son zamanlarda biri kitap karıştırmış. Günlük en alt rafta olabilir.',
    talk: 'Yaşlı kütüphane kedisi miyavlıyor ve en alt rafa doğru yürüyor. Onu takip etmek iyi bir fikir.' },
  { n: 9, title: 'Gri Hanım', location: 'mezarlik', flag: 'gri_mesaji', npc: 'Gri Hanım',
    goal: 'Gri Hanım yarım kalmış sözünü anlatır, oyuncu Lina’ya iletmeyi öğrenir.',
    hint: 'Gri Hanım’ın solgun eli bir mezar taşının üstünde duruyor. Orada bir isim silinmeye başlamış.',
    talk: 'Gri Hanım yumuşak bir sesle: “Uzun zamandır kimse beni dinlemedi. Sen dinleyeceksin, değil mi?”' },
  { n: 10, title: 'Bay Orvel', location: 'meydan', flag: 'orvel_guveni', npc: 'Bay Orvel',
    goal: 'Orvel çocukları endişeyle arar. Oyuncu ona güvenip yardım isteyebilir. Zamana karşı bulmaca.',
    hint: 'Orvel’in anahtarlığından bir anahtar eksik. Eli sürekli o boşluğa gidiyor. Gerçeği saklamıyor, korkuyor.',
    talk: 'Orvel iç çekiyor: “Biri bana güvenip yardım isterse o kadar rahatlarım ki…” Sesi titriyor ama iyi niyetli.' },
  { n: 11, title: 'Fener Kayalığı', location: 'kayalik', flag: 'parca_2', puzzle: 'gelgit',
    goal: 'Gelgit alçalınca mağarada ikinci harita parçasını bulur. BULMACA: Taş saat kadranının üç çarkı sayı dizileriyle ayarlanır; su çekilince mağara açılır.',
    hint: 'Su çekildikçe kayada yarım bir saat kadranı beliriyor. Parça tam üçte, kadranın göstergesinde.',
    talk: 'Bir martı sana bakıp tam üç kez ötüyor. Üç sayısı önemli olabilir.' },
  { n: 12, title: 'Kolye', location: 'kule', flag: 'kolye_ipucu', npc: 'Çıt',
    goal: 'Çıt kolyenin dişlisinin eşini fark eder. Oyuncu güvendiği biriyle konuşabilir.',
    hint: 'Kolyenin dişlisi, kulenin kapısındaki dişliyle aynı dişe sahip. Eşleşiyorlar.',
    talk: 'Çıt kolyeye bakıp heyecanla tıkırdıyor: “Eş. Aynı. Usta.” Sana bir adım daha yaklaşıyor.' },
  { n: 13, title: 'Mekanizma Odası', location: 'mekanizma', flag: 'mekanizma_acik', puzzle: 'disli',
    goal: 'Dişliyi takar. BULMACA: Dört dişli doğru sıraya dizilince mekanizma çalışır. Çözülünce müzik kutusu melodisini duyar.',
    hint: 'Dişlilerin üstündeki oklar aynı yöne bakmıyor. Küçük dişliden büyüğe doğru sırayla çevir.',
    talk: 'Müzik kutusu kendi kendine üç nota çalıyor ve susuyor. Melodiyi aklında tut.' },
  { n: 14, title: 'Üçüncü parça', location: 'mekanizma', flag: 'gecit_acik',
    goal: 'Üçüncü harita parçasını bulur, gizli geçit açılır.',
    hint: 'Duvardaki saat resminin çerçevesi sıcak. Arkasından hafif bir hava esiyor.',
    talk: 'Çıt arkandan fısıldıyor: “Duvar. Saat. Bas.” Küçük dostun doğru yolda.' },
  { n: 15, title: "Usta'nın Atölyesi", location: 'atolye', flag: 'usta_bulundu', npc: 'Üstat Nikolai Brasswick',
    goal: 'Nikolai Brasswick ile karşılaşır.',
    hint: 'Tezgâhın üstündeki aletler yarım kalmış bir işin ortasında bırakılmış. Usta uzun zamandır burada.',
    talk: 'Brasswick yorgun gülümsüyor: “Beni bulan ilk çocuk sensin. Teşekkür ederim.”' },
  { n: 16, title: "Orvel'in itirafı", location: 'atolye', flag: 'orvel_itiraf', npc: 'Bay Orvel',
    goal: 'Orvel gerçeği anlatır. Oyuncu onu anlayışla karşılar.',
    hint: 'Orvel’in gözleri kızarmış. Sürekli yere bakıyor. Onu yargılamadan dinlemek en iyi yol.',
    talk: 'Orvel derin bir nefes alıyor: “Korktuğum için saklamıştım. Senden bu kadar anlayış beklemiyordum.”' },
  { n: 17, title: 'Lina', location: 'atolye', flag: 'lina_bulundu', npc: 'Lina',
    goal: 'Lina belirir. Kolye eşleşir. Gri Hanım’ın mesajı iletilir.',
    hint: 'Lina’nın boynundaki kolyenin yarım dişlisi, senin bulduğun yarıyla birleşecek gibi.',
    talk: 'Lina utangaç gülüyor: “Sana güveniyorum. Gri Hanım’ın mesajını söylersen çok sevinirim.”' },
  { n: 18, title: 'Büyük seçim', location: 'mekanizma', flag: 'buyuk_secim',
    goal: 'Oyuncu saati durdurur, onarır ya da sırrı kasabayla paylaşır. Üçü de doğru ve olumludur.',
    hint: 'Üç yol da güvenli: durdurmak, onarmak ya da sırrı paylaşmak. Birini seç, hiçbiri yanlış değil.',
    talk: 'Lina elini tutuyor: “Hangisini seçersen seç, yanındayım.”' },
  { n: 19, title: 'Son vuruş', location: 'kule', flag: 'son_vurus',
    goal: 'Seçimin sonucu: son vuruş, hayaletlerle veda ya da ziyaret zamanı.',
    hint: 'Saatin akrebi son vuruşa yaklaşıyor. Hayaletler seni seyrediyor ve gülümsüyor.',
    talk: 'Marl uzaktan el sallıyor: “Güle güle, kıymetli yoldaş!”' },
  { n: 20, title: 'Sabah', location: 'yurt', flag: 'sabah', npc: 'Nene Selvi',
    goal: 'Sabah olur, oyuncu yurda döner. Nene Selvi ve Orvel karşılar.',
    hint: 'Pencereden sızan ilk güneş ışığı sisi eritiyor. Mutfaktan taze ekmek kokusu geliyor.',
    talk: 'Nene Selvi sarılıyor: “Seni bekledim. Gel, kahvaltı hazır.”' },
];

// 2. bölüm: Çanın Dili (20 durak). Tüm yerler açık, tüm karakterler sahneye girebilir.
// Çıt artık oyuncunun yan karakteri. 4 durakta gerçek bulmaca var (puzzle alanı).
export const NODES2: Node[] = [
  { n: 1, title: 'Sessiz sabah', location: 'yurt', flag: 'c2_sessizlik', npc: 'Nene Selvi',
    goal: 'Sabah çan çalmaz. Nene Selvi bunu tuhaf bulur. Çıt kapıya gelir ve artık oyuncuyla birlikte yürüyeceğini söyler: "Çıt yardım. Çıt yağ bulur." Meydana bakmaya karar verilir.',
    hint: 'Pencereden meydandaki saatin ibresi duruyor. Kapının önünde küçük metal ayak izleri var: Çıt gelmiş.',
    talk: 'Nene Selvi kaşlarını çatıyor: “Çan çalmadı. Bu hiç olmaz. Çıt’ı da yanına al, işine yarar.”' },
  { n: 2, title: 'Eksik dil', location: 'meydan', flag: 'c2_dil_kayip', npc: 'Bay Orvel',
    goal: 'Çan Meydanı’nda çanın dili yok. Orvel endişeli ve bu sefer suçlu değil. Zincirin ucunda bir not: dilin üç parçaya ayrıldığı yazıyor.',
    hint: 'Çanın içi boş, yalnızca ince bir zincir sallanıyor. Zincirin ucunda küçük bir not var.',
    talk: 'Orvel mırıldanıyor: “Bu sefer ben yapmadım, yemin ederim. Yardım eder misin?”' },
  { n: 3, title: 'Kuzgunların gördüğü', location: 'pazar', flag: 'c2_kuzgun', npc: 'Kuzgun Teodor',
    goal: 'Teodor ve kuzgunlar, parlayan bir şeyin iskeleye düştüğünü görmüş. Küçük bir hatıra takasıyla bilgi alınır.',
    hint: 'Teodor’un kuzgunları iskele yönüne bakıp ötüyor. İlk iz orada.',
    talk: 'Teodor kıkırdıyor: “Parlayan bir şey gördük. İskelede, tahtanın altında!”' },
  { n: 4, title: 'Durmuş saat', location: 'kule', flag: 'c2_saat', npc: 'Çıt',
    goal: 'Saat Kulesi’nde Çıt, durmuş saati gösterir. Çanın dili olmadığı için son vuruş yapılamıyor. Dilin üç parçası: bakır, gümüş, bronz. Çıt fener yağı bulma görevini anlatır.',
    hint: 'Saatin kadranında üç küçük yuva var: bakır, gümüş ve bronz renginde. Parçalar buraya oturacak.',
    talk: 'Çıt göğsündeki kapağı tıkırdatıyor: “Çıt yağ bulur. Sen söyle. Çıt gider, gelir.”' },
  { n: 5, title: 'Islak izler', location: 'iskele', flag: 'c2_iz',
    goal: 'İskelede tahtaların altında ıslak, parlak izler var. Bir balıkçı, bakır parçanın Fener Kayalığı’nda bir ışıkla görüneceğini söyler. Ama fenerin yanması için Madam Tuzlu’nun yağı gerekir.',
    hint: 'İzler iskele ucundan kulübeye doğru gidiyor. Kulübenin penceresinde ışık yanıyor.',
    talk: 'Yaşlı bir balıkçı ağını onarırken göz kırpıyor: “Fener yanmadan kayalık sır vermez. Madam Tuzlu’ya sor.”' },
  { n: 6, title: 'Yağ ölçüsü', location: 'kulube', flag: 'c2_yag_olcu', npc: 'Madam Pelin Tuzlu', puzzle: 'yag',
    goal: 'BULMACA 1: Madam Tuzlu’nun 5 litrelik ve 3 litrelik iki kabı var. Fenerin yanması için tam 4 litre yağ gerekiyor. Oyuncu kapları doldurup boşaltarak 4 litreyi ölçer.',
    hint: 'Önce büyük kabı doldur, sonra küçüğüne boşalt. Geriye kalan yağ işine yarayacak.',
    talk: 'Madam Tuzlu çayını uzatıyor: “Acele etme. Ölçü işi sabır ister, çocuğum.”' },
  { n: 7, title: 'Bakır parça', location: 'kayalik', flag: 'c2_bakir',
    goal: 'Fener yanınca Fener Kayalığı’nda mağarada bakır parça parlar. Gelgit zamanı hafif bir baskı yaratır, ürpertici ama güvenli.',
    hint: 'Fenerin ışığı mağaranın duvarında bir noktada birikiyor. Parça oranın altında.',
    talk: 'Bir martı sana eşlik ediyor ve ışığın düştüğü kayanın üstüne konuyor.' },
  { n: 8, title: 'Gri Hanım’ın isteği', location: 'mezarlik', flag: 'c2_gri', npc: 'Gri Hanım',
    goal: 'Gri Hanım, bronz parçanın yerini bildiğini söyler. Karşılığında küçük bir iyilik ister: Lina’ya bir selam götürmek. Oyuncu söz verir.',
    hint: 'Gri Hanım’ın gösterdiği mezar taşının üzerinde bir saat işareti oyulu. Bu işaret sonra işine yarayacak.',
    talk: 'Gri Hanım gülümsüyor: “Dostluk gösterene hep yardım ederim.”' },
  { n: 9, title: 'Marl’ın şapkası', location: 'bahce', flag: 'c2_marl', npc: 'Kaptan Marl',
    goal: 'Yurt Bahçesi’nde Kaptan Marl’ın şapkası havada süzülür. Marl, gümüş parçanın kütüphanedeki eski bir kayıt kutusunda saklı olduğunu ima eder.',
    hint: 'Şapka kütüphane yönüne doğru eğiliyor. Marl’ın şakacı sesi rüzgârla geliyor.',
    talk: 'Marl kahkaha atıyor: “Kütüphane! Kitaplar yalan söylemez ama kutular inatçıdır.”' },
  { n: 10, title: 'Halka kilidi', location: 'kutuphane', flag: 'c2_halka', npc: 'Lina', puzzle: 'halka',
    goal: 'BULMACA 2: Eski kayıt kutusunun kilidi dört renkli halkadan oluşuyor (kırmızı, mavi, yeşil, sarı). Lina üç ipucuyla halkaların doğru sırasını bulmaya yardım eder.',
    hint: 'İpuçlarını tek tek düşün. Önce “hemen solunda” olan ikiliyi yan yana yerleştir.',
    talk: 'Lina defteri açıyor: “Birlikte düşünelim. Önce kesin olanı bulalım.”' },
  { n: 11, title: 'Çan kayıtları', location: 'kutuphane', flag: 'c2_kayit', npc: 'Lina',
    goal: 'Kutunun içinde çan kayıtları ve gümüş parçanın nerede olduğunu gösteren bir harita çıkar. Gümüş parça, Fener Kayalığı’nın başka bir mağarasında.',
    hint: 'Haritada küçük bir martı çizilmiş. Fener Kayalığı’nın arka tarafını gösteriyor.',
    talk: 'Lina fısıldıyor: “Bunu babamla yıllar önce okumuştum. Şimdi sana güveniyorum.”' },
  { n: 12, title: 'Teodor’un takası', location: 'pazar', flag: 'c2_takas', npc: 'Kuzgun Teodor',
    goal: 'Gümüş parçaya inmek için sağlam bir ip lazım. Teodor ipi verir ama karşılığında bir hatıra eşyası ister. Dürüst takas yapılır.',
    hint: 'Teodor’un tezgâhında bir ip makarası var. Elindeki küçük bir hatıra ona yeter.',
    talk: 'Teodor kanat çırpıyor: “Dürüst takas severim. İp bende, hatıra sende.”' },
  { n: 13, title: 'Gümüş parça', location: 'kayalik', flag: 'c2_gumus',
    goal: 'Fener Kayalığı’nın arka mağarasında gümüş parça bulunur. Gelgit yükselirken ip yardımıyla güvenle inilir.',
    hint: 'Mağaranın duvarında ipi bağlayabileceğin bir halka var. Sağlam görünüyor.',
    talk: 'Çıt ipin ucunu tutuyor: “Çıt tutar. Sen in. Güven.”' },
  { n: 14, title: 'Notalı kilit', location: 'mekanizma', flag: 'c2_nota', npc: 'Çıt', puzzle: 'nota',
    goal: 'BULMACA 3: Mekanizma Odası’nda müzik kutusunun kilidi üç sayı dizisiyle açılır. Her dizinin bir kuralı var. Oyuncu sıradaki sayıyı bulur.',
    hint: 'Sayılar arasındaki farklara bak. Bazen fark artar, bazen iki kural sırayla tekrarlanır.',
    talk: 'Çıt notaları dinliyor: “Tik. Tik. Kural var. Bul.”' },
  { n: 15, title: 'Gizli bölme', location: 'mekanizma', flag: 'c2_bolme',
    goal: 'Müzik kutusunun içinden gizli bir bölme açılır. İçinde Usta’nın eski bir notu ve bronz parçanın mezarlıkta bir mezar taşının altında olduğunu gösteren bir çizim var.',
    hint: 'Notun köşesindeki saat işareti, Gri Hanım’ın gösterdiği mezar taşındakiyle aynı.',
    talk: 'Müzik kutusu son bir kez çalıyor. Mekanizma odası yumuşak bir ışıkla doluyor.' },
  { n: 16, title: 'Bronz parça', location: 'mezarlik', flag: 'c2_bronz', npc: 'Gri Hanım',
    goal: 'Mezarlıkta saat işaretli taşın altında bronz parça bulunur. Gri Hanım’ın selamı Lina’ya iletilecek diye söz verilir. Küçük bir ürperti, rahatlatıcı bir sonla.',
    hint: 'Taşın altındaki toprak yumuşak. Kazmak yerine eliyle nazikçe kaldırabilirsin.',
    talk: 'Gri Hanım usulca: “Teşekkür ederim. Sözünü tutacağını biliyordum.”' },
  { n: 17, title: 'Çan boyası', location: 'atolye', flag: 'c2_boya', npc: 'Üstat Nikolai Brasswick', puzzle: 'boya',
    goal: 'BULMACA 4: Brasswick çanın dilini boyamadan önce dört renk karışımı hazırlar: yeşil, mor, turuncu ve pembe. Oyuncu palet renklerinden hangi ikisini karıştıracağını bulur.',
    hint: 'Üç ana renk var: kırmızı, sarı, mavi. Beyaz rengi açar. İkişer ikişer karıştır.',
    talk: 'Brasswick fırçasını uzatıyor: “Renkler dosttur, doğru ikiliyi bulursan seni hiç yalnız bırakmazlar.”' },
  { n: 18, title: 'Çanın dili birleşiyor', location: 'atolye', flag: 'c2_dil', npc: 'Üstat Nikolai Brasswick',
    goal: 'Brasswick üç parçayı (bakır, gümüş, bronz) örse koyar. Oyuncu ve dostları çekiçle birlikte vurur. Çanın dili hazırdır.',
    hint: 'Üç parça sırayla: bakır, gümüş, bronz. Örsteki yuvalar bu sırayla dizilmiş.',
    talk: 'Brasswick eldivenlerini çıkarıyor: “Birlikte yapalım. Sen de çekiçle bir vuruş yap.”' },
  { n: 19, title: 'Kasaba toplanıyor', location: 'meydan', flag: 'c2_toplanma', npc: 'Bay Orvel',
    goal: 'Çanın dili meydana taşınır. Orvel kasabalıyı toplar. Herkes çanı birlikte asmaya hazırlanır. Gri Hanım’ın selamı Lina’ya iletilir.',
    hint: 'Meydandaki çeşmenin taşındaki küçük saat işareti şimdi parlıyor. Doğru yerdesin.',
    talk: 'Orvel gururla gülümsüyor: “Bu kasaba bugün senin sayende uyanıyor.”' },
  { n: 20, title: 'Sabah çanı', location: 'kule', flag: 'c2_son', npc: 'Lina',
    goal: 'Çanın dili takılır, çan sabahı müjdeler. Kasaba toplanır, herkes birlikte kutlar. Çıt kutlamada dans eder.',
    hint: 'Çan ipine herkes birlikte asılıyor. Birlikte çekersen çan çalar.',
    talk: 'Lina el sıkıyor: “Hep birlikte!”' },
];

export const CHAPTERS: Record<number, { title: string; nodes: Node[]; intro: string }> = {
  1: { title: '13. Vuruş', nodes: NODES, intro: '' },
  2: {
    title: 'Çanın Dili',
    nodes: NODES2,
    intro: 'Birinci bölümde 13. vuruşun sırrı çözüldü: Usta Nikolai Brasswick ile Lina birbirine kavuştu, hayaletler huzur buldu, sis inceldi. Şimdi yeni bir bulmaca var: Çan Meydanı’ndaki çanın dili kayboldu ve üç parçaya (bakır, gümüş, bronz) ayrıldı. Kuzgunlar, kütüphane kayıtları ve eski dostlar yardım eder. Çıt, küçük mekanik dost, artık oyuncuyla birlikte yürür ve yağ bulmaya gidebilir. Dört durakta gerçek bulmaca vardır (yağ ölçüsü, halka kilidi, notalı kilit, çan boyası): bulmacaları sahnede çözdürme, oyuncu kendi bulmaca ekranında çözer. Sis Kâhyası yine uzaktan izler ama zarar vermez.',
  },
};

export const nodesOf = (chapter: number): Node[] => CHAPTERS[chapter]?.nodes ?? NODES;

// Karakterlerin sahnede ilk yer alabileceği dönüm noktası (yalnızca 1. bölüm). Öncesinde sahneye
// girmezler, en fazla belirsiz bir iz (ses, gölge, uzaktan bir şekil) görülebilir.
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
export const ALLOWED_ITEMS = AI_ITEMS;

// Güven puanı takip edilen bilinen karakterler. Puan 0-5, güven 3'e ulaşınca hediye verir.
export const KNOWN_NPCS = [
  'Nene Selvi', 'Bay Orvel', 'Kaptan Marl', 'Madam Pelin Tuzlu', 'Çıt',
  'Kuzgun Teodor', 'Gri Hanım', 'Üstat Nikolai Brasswick', 'Lina',
];

export const NPC_GIFTS: Record<string, { item: string; text: string }> = {
  'Nene Selvi': { item: 'kurabiye', text: 'Nene Selvi sana taze bir kurabiye uzatıyor.' },
  'Kaptan Marl': { item: 'deniz_cami', text: 'Kaptan Marl sana mavi bir deniz camı veriyor: “Şans getirir.”' },
  'Madam Pelin Tuzlu': { item: 'yag_sisesi', text: 'Madam Tuzlu sana küçük bir fener yağı şişesi veriyor.' },
  'Kuzgun Teodor': { item: 'kuzgun_tuyu', text: 'Teodor sana parlak bir kuzgun tüyü bırakıyor.' },
  'Çıt': { item: 'bronz_dugme', text: 'Çıt sana küçük bir bronz düğme uzatıyor.' },
  'Bay Orvel': { item: 'mektup', text: 'Orvel sana mühürlü küçük bir mektup veriyor.' },
};

export const TRUST_MAX = 5;
export const TRUST_GIFT_AT = 3;
