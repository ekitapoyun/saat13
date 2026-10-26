import { createClient } from '@supabase/supabase-js';

// Tarayıcı istemcisi: yalnızca anon anahtar. Durum değişikliği yapamaz (RLS).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Skill = 'gozlemci' | 'konuskan' | 'cevik' | 'tamirci';

export type Choice = { id: string; label: string };
export type Scene = { text: string; choices: Choice[] };

export type Character = {
  id: string;
  name: string;
  skill: Skill;
  location: string;
  node: number;
  fear: number;
  lantern: number;
  items: string[];
};

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
