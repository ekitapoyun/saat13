import type { ReactNode } from 'react';

export const metadata = { title: '13. Vuruş', description: 'Sisli Liman’da bir hikâye macerası' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root{--bg:#10262b;--panel:#17343a;--ink:#e9e4d4;--mute:#9db1ac;--brass:#c9a24b;--line:#2c5058;--btn:#1e4048}
          *{box-sizing:border-box}
          body{margin:0;background:var(--bg);color:var(--ink);font-family:Lora,Georgia,serif;line-height:1.7}
          h1,h2{font-family:Fraunces,Georgia,serif;margin:0}
          main{max-width:760px;margin:0 auto;padding:20px 16px 48px}
          .panel{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:22px}
          .scene p{margin:0 0 .9em;font-size:1.06rem;max-width:62ch}
          button{font:inherit;text-align:left;background:var(--btn);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:12px 14px;cursor:pointer}
          button:hover{border-color:var(--brass)}
          button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--brass);outline-offset:2px}
          button:disabled{opacity:.5;cursor:wait}
          input,select{font:inherit;width:100%;padding:10px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:6px}
          .choices{display:grid;gap:10px;margin-top:18px}
          .bar{height:6px;background:var(--line);border-radius:3px;overflow:hidden}
          .bar i{display:block;height:100%}
          .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;font-size:.88rem;color:var(--mute)}
          .here{margin-top:18px;padding:12px 14px;border-left:3px solid var(--brass);background:var(--bg);font-size:.95rem}
          .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
          .row button{padding:6px 10px;font-size:.88rem}
          label{display:block;margin:12px 0 4px;color:var(--mute);font-size:.9rem}
          .small{color:var(--mute);font-size:.85rem}
          @media (prefers-reduced-motion:reduce){*{transition:none!important}}
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
