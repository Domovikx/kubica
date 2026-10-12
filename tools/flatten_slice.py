# -*- coding: utf-8 -*-
"""Уплощение слайса: файлы из подпапок переезжают в корень слайса (KISS/YAGNI).

Что делает:
  1. Переписывает относительные импорты файлов слайса на плоские
     ('../model/x' -> './x', двери папок './Chip' остаются как есть —
     после переезда Chip.tsx лежит в том же корне);
  2. Удаляет barrel-индексы подпапок (git rm .../index.ts) — их импорты
     продолжают резолвиться в файл с тем же именем;
  3. git mv всех файлов подпапок в корень слайса.

Корневой index.ts слайса НЕ трогает (двери слоя/слайса решает вызывающий).
Коллизии имён — отказ.

Запуск: python tools/flatten_slice.py src/widgets/mobileTable
"""
import os
import re
import subprocess
import sys
import pathlib

SLICE = pathlib.Path(sys.argv[1]).resolve()
ROOT = pathlib.Path(__file__).resolve().parent.parent
REL = re.compile(r"""(?:from|import)\s*\(?\s*(['"])(\.[^'"]+)\1""")

def strip_ext(p: pathlib.Path) -> str:
    n = p.name
    if n.endswith(".tsx") or n.endswith(".ts"):
        n = n.rsplit(".", 1)[0]
    return n

files = [
    p for p in SLICE.rglob("*")
    if p.is_file() and p.suffix in (".ts", ".tsx")
]

# --- 1. расчёт и применение новых спецификаторов (по старой раскладке) ---
moved_total = 0
for p in files:
    text = p.read_text(encoding="utf-8", newline="")
    repl = {}
    for m in REL.finditer(text):
        spec = m.group(2)
        resolved = (p.parent / spec).resolve()
        if SLICE not in resolved.parents and resolved != SLICE:
            continue  # наружу из слайса не ходим
        if resolved == SLICE / "index.ts":
            sys.exit(f"FAIL: {p} импортирует дверь слайса {spec} — разбери вручную")
        if resolved.name == "index.ts" and resolved.parent != SLICE:
            new = "./" + resolved.parent.name  # дверь папки -> файл с тем же именем
        elif resolved.is_dir():
            new = "./" + resolved.name
        else:
            new = "./" + strip_ext(resolved)
        if new != spec:
            repl[spec] = new
    for old, new in repl.items():
        text = text.replace(f"'{old}'", f"'{new}'").replace(f'"{old}"', f'"{new}"')
        moved_total += 1
    if repl:
        p.write_text(text, encoding="utf-8", newline="")
        print("imports:", p.relative_to(ROOT), repl)

# --- 2. коллизии имён (без index.ts подпапок) ---
subdir_indexes, movers = [], []
names = {}
for p in files:
    if p.parent == SLICE:
        continue
    if p.name == "index.ts":
        subdir_indexes.append(p)
        continue
    if p.name in names:
        sys.exit(f"FAIL: коллизия имени {p.name}: {names[p.name]} vs {p}")
    names[p.name] = p
    movers.append(p)

# --- 3. git rm barrel'ов подпапок + git mv в корень ---
for p in subdir_indexes:
    subprocess.run(["git", "rm", "-q", str(p)], cwd=ROOT, check=True)
    print("rm barrel:", p.relative_to(ROOT))
for p in movers:
    dst = SLICE / p.name
    subprocess.run(["git", "mv", str(p), str(dst)], cwd=ROOT, check=True)
    print("mv:", p.relative_to(ROOT), "->", dst.relative_to(ROOT))

# --- 4. пустые подпапки убрать ---
for d in sorted({p.parent for p in files}, key=lambda x: len(str(x)), reverse=True):
    if d != SLICE and d.is_dir() and not any(d.iterdir()):
        d.rmdir()
        print("rmdir:", d.relative_to(ROOT))

print(f"done: {moved_total} imports rewritten, {len(subdir_indexes)} barrels rm, {len(movers)} files moved")
