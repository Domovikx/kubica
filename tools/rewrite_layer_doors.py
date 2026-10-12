# -*- coding: utf-8 -*-
"""Перевод импортов через дверь слоя FSD: '@/layer/slice/...' -> '@/layer'.

Только кавычкованные строковые литералы в .ts/.tsx под src/.
Слои с плоскими слайсами (entities, features, widgets, pages, testUtils)
перечислены явно; shared — по сегментам, api НЕ в двери слоя (msw — только
динамический import из main.tsx).

Запуск: python tools/rewrite_layer_doors.py
"""
import re
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / "src"

LAYER_SLICES = {
    "entities": ["diceNotation", "dieModel", "rollHistory"],
    "features": ["music", "repoStars", "sound", "tableRoll", "tableSetup",
                 "tableUi", "throwPower", "uiScale"],
    "widgets": ["mobileTable"],
    "pages": ["HomePage"],
    "testUtils": ["testPump"],
}
SHARED_SEGS = ["dice", "three", "ui", "arena"]  # api — мимо двери слоя

patterns = []
for layer, names in LAYER_SLICES.items():
    for n in names:
        # \b — не зацепить '@/shared/diceX' за '@/shared/dice'
        patterns.append((re.compile(r"(['\"])@/%s/%s\b" % (layer, n)),
                         r"\1@/%s" % layer))
for seg in SHARED_SEGS:
    patterns.append((re.compile(r"(['\"])@/shared/%s\b" % seg), r"\1@/shared"))

changed = []
hits = 0
for p in ROOT.rglob("*"):
    if p.suffix not in (".ts", ".tsx") or not p.is_file():
        continue
    with p.open(encoding="utf-8", newline="") as f:  # сохраняем CRLF как есть
        text = f.read()
    new = text
    for rx, repl in patterns:
        new, n = rx.subn(repl, new)
        hits += n
    if new != text:
        with p.open("w", encoding="utf-8", newline="") as f:
            f.write(new)
        changed.append(str(p.relative_to(ROOT)))

print("hits:", hits, "| changed files:", len(changed))
for f in sorted(changed):
    print(" ", f)
