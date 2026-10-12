# -*- coding: utf-8 -*-
"""Слить повторяющиеся import-ы из одного источника в один statement.

Только источники '@/...' (двери слоёв FSD). Группировка: (source, type-only):
value-импорты сливаются с value, type-импорты — с type (inline 'type' внутри
скобок сохраняется). Повторяющиеся имена дедуплицируются.

Каждая группа обрабатывается на живом тексте с повторным сканом — иначе
сдвиги после предыдущих правок врут. Хвостовой перевод строки НЕ входит в
match (иначе удаление соседа съедает '\n' и строки склеиваются).

Запуск: python tools/merge_layer_imports.py
"""
import re
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / "src"
IMP = re.compile(
    r"import\s+(type\s+)?\{([^}]*)\}\s*from\s*'(@/[^']*)'[ \t]*;?",
    re.S,
)

merged_files = 0
total_merged = 0
for p in ROOT.rglob("*"):
    if p.suffix not in (".ts", ".tsx") or not p.is_file():
        continue
    with p.open(encoding="utf-8", newline="") as f:
        text = f.read()
    orig = text
    removed_here = 0
    src = None
    while True:
        groups = {}
        for m in IMP.finditer(text):
            groups.setdefault((m.group(3), bool(m.group(1))), []).append(m)
        target = next((v for v in groups.values() if len(v) > 1), None)
        if target is None:
            break
        src, type_only = target[0].group(3), bool(target[0].group(1))
        specs, seen = [], set()
        for m in target:
            for s in m.group(2).split(","):
                s = s.strip()
                if s and s not in seen:
                    seen.add(s)
                    specs.append(s)
        head = "import type {" if type_only else "import {"
        merged_stmt = "%s %s } from '%s'" % (head, ", ".join(specs), src)
        first = target[0]
        # удалить все, кроме первого (с конца: позиции валидны для text)
        for m in reversed(target[1:]):
            start = m.start()
            if start > 0 and text[start - 1] == "\n":
                start -= 1
            text = text[:start] + text[m.end():]
        idx = text.find(first.group(0))
        assert idx != -1, src
        text = text[:idx] + merged_stmt + text[idx + len(first.group(0)):]
        removed_here += len(target) - 1
    if text != orig:
        with p.open("w", encoding="utf-8", newline="") as f:
            f.write(text)
        merged_files += 1
        total_merged += removed_here
        print("merged in", p.relative_to(ROOT), "->", src)

print("files:", merged_files, "| statements removed:", total_merged)
