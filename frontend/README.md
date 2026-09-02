# statvista Frontend

React + TypeScript app for statvista, built with [Vite](https://vite.dev/). `/` redirects to MLB games.

## Stack

- React 19 · TypeScript · Vite
- Tokens in `src/app/tokens.css` (Luxury Adventure Comedy) + semantic CSS in `ui.css`
- Tailwind CSS v4 for layout only, themed to those tokens
- React Router

## Visual language

| Pattern | Usage |
|---------|--------|
| Palette | `--c1` espresso ground, `--c2` surfaces, `--c3` parchment type, `--c4` gold accent, `--c5` terracotta (max 2/screen) |
| Type | Fraunces 600 headings, Public Sans 400/500 UI; scale 12/14/16/20/26/34/46/62 |
| Radius | 4px everywhere (pills/avatars fully round) |
| Borders | 1px `--c3` at 10% alpha; one shadow `0 1px 2px rgba(0,0,0,.08)` |
| Icons | Hand-authored 24×24 stroke SVGs in `shared/ui/Icons.tsx` |

## Setup

```bash
cd frontend
npm install
```

## Development

From the `frontend/` directory:

```bash
npm run dev
```

Open http://localhost:5173/ — it redirects to MLB games.

## API base URL

The live WNBA scoreboard calls `/api/wnba/scoreboard/today`. In dev, Vite proxies
`/api` to `http://127.0.0.1:8000`, so no configuration is needed.

Static hosts (GitHub Pages and friends) have no proxy, so those builds must set
`VITE_API_BASE_URL` to the deployed API origin:

```bash
VITE_API_BASE_URL=https://api.example.com npm run build
```

Leaving it unset keeps the relative path, which only resolves when the API is
served from the same origin as the app.

## Tests

```bash
npm test
```

Vitest + Testing Library cover routing and LIVE NOW empty/filled states.

## Production build

```bash
npm run build
npm run preview
```

Build output goes to `frontend/dist/` (gitignored; regenerate as needed).

## Project structure

```
frontend/src/
  app/                 # entry, router, chrome layout, global CSS
  features/
    basketball/        # WNBA (+ future NBA) game, league UI, hooks
    mlb/               # MLB game UI + hooks
    home/              # app chrome (sidebar, league switcher)
  pages/               # thin route composers
  shared/
    ui/                # cross-feature chrome (GameSection, avatars, footer)
    lib/               # api client + cross-league slate helpers
  assets/
```

Coding standards for this app follow repo `claude.md` (typing, small focused modules, input guards, tests with changes).
