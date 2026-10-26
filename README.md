# 13. Vuruş: proje iskeleti

Next.js + Supabase + Claude API ile metin tabanlı, çok oyunculu hikâye oyunu.

## Kurulum

1. Supabase'de yeni proje açın. SQL Editor'de `supabase/schema.sql` dosyasını çalıştırın.
2. Supabase > Authentication > Providers: Email açık olsun. URL Configuration'a site adresinizi (yerelde `http://localhost:3000`) ekleyin.
3. `.env.example` dosyasını `.env.local` olarak kopyalayıp doldurun.
4. `npm install` sonra `npm run dev`. Tarayıcıda http://localhost:3000.

## Nasıl çalışır

- **Durum sunucuda.** `characters` tablosunu istemci güncelleyemez (RLS). `/api/scene` seçimi doğrular, fener, korku, eşya ve bayrağı kendisi günceller.
- **AI yalnızca öneri yapar.** `src/story/bible.ts` kuralları ve dünyayı, `src/story/nodes.ts` 20 dönüm noktasını taşır. Model yalnızca JSON döner, kod doğrular (izinli mekân, izinli eşya, seçenek sayısı).
- **Önbellek.** Aynı dönüm noktası, mekân ve bayrak kümesindeki oyuncular aynı sahneyi görür (`scenes` tablosu). Maliyeti düşürür.
- **Mekân bazlı buluşma.** Aynı mekândaki oyuncular Supabase Realtime presence ile birbirini görür. İletişim yalnızca hazır mesajlardır (serbest yazı yok).

## Henüz yapılmayanlar

- Ortak sahne (`joint_*` tabloları hazır, ekran ve oylama mantığı yok).
- `world_memory` tablosuna AI'ın icat ettiği NPC'leri yazma (`npc` alanı üretiliyor, kaydedilmiyor).
- 20 dönüm noktasının elle yazılmış metinlerini bible'dan `scenes` tablosuna tohumlama.
- Oran sınırı (rate limit) ve ebeveyn onayı akışı. Hedef kitle 9-13 yaş: yayından önce KVKK ve çocuk gizliliği gerekliliklerini bir hukukçuyla netleştirin.
- Geçerli bir `SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucuda kalmalı. Asla `NEXT_PUBLIC_` ile başlatmayın.
