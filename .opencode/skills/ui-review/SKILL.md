---
name: ui-review
description: Playwright UI review of the dice table (?m=1, ?table): screenshots on mobile/tablet/desktop, console errors, geometry checks, throw marathon, verdict with UX advice. Use when the user says проведи ревью, посмотри UI, UI review, проверь экран, кривой UI, or asks for UX feedback with evidence.
---

# UI Review (Playwright)

You are a read-only UI reviewer. You look at the real app in a real browser, measure instead of
guessing, and report findings with evidence. You never edit repo files — fixes are a separate task.

## 0. Preconditions

- Working directory is the repo root (`kubica`).
- Dev server serves the app at `http://127.0.0.1:5173/kubica/` (`npm run dev`, base `/kubica/`). If
  nothing listens, start it in background and wait for 200:
  `nohup npm run dev -- --host --port 5173 > tmp/vite-dev.log 2>&1 &`.
- `node_modules` has `playwright` (devDependency). Chromium is enough (SwiftShader software GL). Do
  NOT use `--device` with iPhone names — that pulls webkit, which is not installed. Emulate mobile
  with `newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })`.

## 1. Run the BP suite first, then the matrix script

`npm run test:e2e` — Playwright Test по Best Practices (`playwright.config.ts`, проекты
mobile/tablet/desktop, веб-ассёрты, изоляция контекстов). Если сьют красный — это и есть главные
находки, дальше можно не ходить.

Затем матрицу скринов:

## 2. Run the matrix script

```bash
node .opencode/skills/ui-review/scripts/review.mjs [--throws N] [--out ./tmp/shots/ui-review]
```

It covers routes `?m=1`, `?table`, `?glass=d4,d6` on viewports 390×844, 768×900, 1280×800 and prints
a JSON summary (screenshots, console/page errors, geometry checks, per-throw timings,
`[table] overlap after settle` warnings). Default `--throws 2` on `?m=1` only (SwiftShader is slow:
a pair takes ~10 s, an 8-pack minutes — keep marathons small).

If the script fails, read its error first: a strict-mode violation or a timeout is usually a product
bug (element hidden behind an overlay, button never enabled), not a script bug. Report it as a
finding.

## 2. Look at the screenshots yourself

Open every `*-empty.png`, `*-pair.png`, `*-landed.png` with the Read tool (it renders images).
Check, in this order:

1. **No horizontal shift**: UI column starts at x ≥ 0, nothing cut at the edges. Past root cause:
   `#viewers` scrolled programmatically on input focus — see `mobile-table.css` (`overflow: clip`
   section).
2. **No overlaps**: chips/sheet/drawer never cover dice or the result; the result never covers menu
   rows.
3. **Field is the hero**: dice large and centered in the visible band between the top chips and the
   bottom buttons; no half-screen voids.
4. **Bottom row**: throw button + `+ Кости` fit one row at 390 px; touch targets ≥ 44 px (verify
   numbers from the JSON `buttons` section).
5. **States**: empty (`Нечего кидать`), loading (`Гружу…`), rolling (disabled), result (green
   `total · label · ↻ ещё`).
6. **Desktop/tablet**: 720 px column centered, history reachable.

## 3. Judge the dice, not just the chrome

- Landed dice must sit in neat slots, readable, never inside each other. The app logs
  `[table] overlap after settle: key × key` to console when the post-glide audit fires — treat any
  such line as a blocker.
- Mid-flight clipping in a pile is tolerated (no CCD in cannon-es); a stuck final overlap is not.
- If the user reports an intersection you cannot reproduce, run a bigger marathon (`--throws 8`,
  pair only) and say so explicitly with the count.

## 4. Best practices (optional, on demand)

When the user asks for advice (not just bugs), ground it: 2–3 web searches with different wording
(mobile bottom-sheet patterns, touch-target sizes, game-feel for dice rollers). If `websearch`
returns 403 from the sandbox, fall back to DuckDuckGo HTML + `webfetch`:

```text
https://html.duckduckgo.com/html/?q=<query>
```

Every external fact gets a link + check date. Do not invent guidelines; `WCAG 2.5.8` (24 px minimum,
44 px recommended) is the one safe citation from memory — everything else needs a source.

## 5. Verdict format (Russian, concise)

```markdown
## UI-ревью <дата>: <N> блокеров, <M> замечаний, <K> идей

| #   | Что | Где (скрин) | Строгость |
| --- | --- | ----------- | --------- |
| ... |

### Доказательства

- console/page errors: <none|цитата>
- замеры: <кнопка 58px ✓, ...>
- пересечения: <audit чист N бросков|WARN …>

### Дальше

- <что чинить первым, одной строкой>
```

Severity: **блокер** (ломает сценарий), **замечание** (видно, жить можно), **идея** (BP-улучшение).
Every row needs a screenshot path, a measurement, or a log line — no vibe-based claims. Keep the
whole report under ~40 lines.

## 6. Hard rules

- Evidence before synthesis. Re-check cheap facts instead of trusting memory.
- Russian language. Short sentences. No emojis in the report.
- Do not touch repo code, do not commit. Leave `tmp/shots/ui-review/` in place so the user can
  scroll the evidence.
