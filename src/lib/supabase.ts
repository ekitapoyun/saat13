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
  chapter: number;
  chapterTitle: string;
  friends: { name: string; value: number }[];
  cit: { available: boolean; away: boolean; movesLeft: number; rested: boolean; canSend: boolean; trust: number };
  map: {
    unlocked: string[];
    travel: string[];
    target: string | null;
    pieces: { have: number; total: number; label: string };
  };
};

export { LOCATION_NAMES } from '@/story/map';
