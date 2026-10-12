# -*- coding: utf-8 -*-
"""Развернуть длинные однострочные import-ы из дверей '@/...' в многострочные.

Один спецификатор на строку — стиль проекта (см. store.ts). Срабатывает при
длине строки > 100 символов. Только `import { ... } from '@/...'` (value/type
со скобками), default/namespace и относительные импорты не трогает.

Запуск: python tools/wrap_long_imports.py
"""
import re
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / "src"
LIMIT = 100
ONE = re.compile(r"^import (type )?\{ (.+) \} from '(@/[^']+)'$")

wrapped = 0
for p in ROOT.rglob("*"):
    if p.suffix not in (".ts", ".tsx") or not p.is_file():
        continue
    with p.open(encoding="utf-8", newline="") as f:
        text = f.read()
    crlf = "\r\n" in text
    sfx = "\r" if crlf else ""
    lines = text.split("\n")
    out = []
    changed = False
    for line in lines:
        raw = line.rstrip("\r")
        m = ONE.match(raw)
        if m and len(raw) > LIMIT:
            type_kw = m.group(1) or ""
            specs = [s.strip() for s in m.group(2).split(",") if s.strip()]
            out.append("import %s{" % type_kw + sfx)
            for s in specs:
                out.append("  %s," % s + sfx)
            out.append("} from '%s'" % m.group(3) + sfx)
            wrapped += 1
            changed = True
        else:
            out.append(line)
    if changed:
        with p.open("w", encoding="utf-8", newline="") as f:
            f.write("\n".join(out))
        print("wrapped in", p.relative_to(ROOT))

print("lines wrapped:", wrapped)
