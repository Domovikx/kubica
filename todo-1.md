# TODO-1 — следующая сессия

## Состояние на входе

- Проект: `dnd-dice-blender` (git, remote: github.com/Domovikx/dnd-dice-blender, ветка master)
- D6 16 мм готов и запушен: FreeCAD / OpenSCAD / CadQuery — все с красными пипсами, филе r=1, тёмный
  графит (страница three.js, 3 панели).
- Набор d4–d20 готов и запушен: OpenSCAD-генератор (`tools/dice_set.scad`), 6 STL + 6 GLB (все кости
  набора — с красными цифрами; d6-набор с цифрами 1–6, глубина гравировки 0.5 мм), страница — список
  с чекбоксами (ID моделей).
- CadQuery MCP: починен (в venv установлен `mcp<2`, версия 1.30.0; `cadquery-mcp.exe` отвечает 4
  инструментами). Нужен перезапуск opencode, чтобы статус стал Connected.

## Что было сделано (2026-09-21)

### OpenSCAD-генератор набора — ПОЧИНЕН

- Причина падения: OpenSCAD 2021.01 (CGAL) не тянул hull из 8 сфер + пипсы (d6 = 95 c, d20 —
  таймаут). Скачан снапшот **2026.09.18 (Manifold)**: весь набор рендерится за ~7 c суммарно.
- Исправленные баги геометрии (в `dice_set.scad`):
  1. **inradius-нормировка**: `verts = unit_verts / die_inradius(die)` — у всех костей плоскости
     граней на 8.0, иначе у d8/d10 пипсы не прорезались.
  2. **face_normal наружу**: обмотка TETRA_F давала нормали внутрь → гравировка d4 уходила в центр.
     Теперь нормаль всегда наружу.
  3. **d10 = полярный дуал антипризмы** (12 вершин, 10 плоских кайтов): старые «кайты» были
     некомпланарны. Противоположные пары F0↔F5…F4↔F9.
  4. **`opposite()` для N+1**: d6:7, d8:9, d12:13, d20:21; d10: 0–9, сумма 9.
  5. **`layout_for(0)`** возвращает `[]` (раньше `list[-1]` давал 6 пипсов).
  6. **Текст d4/d10**: `linear_extrude(text)` в difference; нужен
     `FONTCONFIG_FILE=tools/openscad/openscad-2026.09.18/fonts/fonts.conf`, иначе fontconfig не
     находит шрифты и text() рендерит мусор.
  7. **Масштаб гравировки**: координаты нормированы (inradius=1), тело масштабируется ×7 → цифры
     тоже ×(SIZE/2-EDGE_R).
  8. **Печатные габариты (2026-09-22)**: `DIE_SIZES` — face-to-face на кость (d6=16.0 — точный
     стандарт, остальные под коммерческие пропорции): d4-10/d6-16/d8-12/d10-16/d12-17.5/d20-17.5.
     Итоговые габариты: d4-16/d6-16/d8-19/d10-24/d12-20/d20-22 мм; объёмы соответствуют коммерческим
     (d4 больше не тяжелее d20). Маркировка в абсолютных мм — читаемость не зависит от масштаба; d4:
     frac 0.55 + кегль 4.5 (на 0.62/5.0 вылезала за грань).
- Цвет: `blender-stl-colorize-set.py` (обобщение для любого полиэдра). Пипсы = центры граней на
  сферах-пипсах; цифры d4/d10 = грани с r < 7.7.

## Задачи (следующая сессия)

### 1. d100 (процентиль) и mapping.json

- d100 как второй d10 с маркировкой «×10» или отдельная кость;
- mapping.json: диэ → значения граней → игровая логика.

### 2. Тест честности

- Центр масс и тензор инерции тела (OpenSCAD/FreeCAD позволяют посчитать).
- Проверка симметрии: противоположные грани N+1 уже есть.

### 3. Рендер и полировка страницы

- Проверить страницу в браузере: 9 панелей, d4/d10 цифры читаются?
- Возможно превью-скриншоты моделей в README.

### 4. Нейминг и брендирование (мысль, не апрувнуто)

- Кандидат: **dndice** (рус. «Диэндик» — звучит, вроде не перебор).
- Если апрувним: проработать брендинг целиком и переехать (чеклист): имя репозитория + GitHub Pages
  URL, `<title>`/SEO/og-карточки, PWA-манифест (name/short_name, иконки), TG-бот и Mini App
  название, тексты футера/About, `docs/BUSINESS.md` § positioning.
- До апрува: везде остаётся рабочее `dnd-dice-blender`, новый нейминг никуда не вшивать.

## Известные баги/обходы (копия из README)

- **FreeCAD MCP**: Part::Box занимает 0..16 → центрировать placement; boolean_operation создаёт
  новый объект на вырез → брать имя из ответа; export_stl сломан → Shape.exportStl(); chamfer_edges
  требует список рёбер.
- **CadQuery 2.8.0**: Solid.makeSphere = полусфера (angleDegrees2=90); Workplane.translate() не
  двигает солиды; boolean в отрицательных координатах → невалидное тело; плоскость построения сферы
  по оси грани (X→YZ, Y→XZ, Z→XY), иначе шов ломает cut.
- **OpenSCAD 2021.01**: minkowski зависает → hull() из 8 сфер; встроенного sum() нет; N поштучных
  boolean-вырезов вешают CGAL → объединять пипсы в один union; **для набора нужен 2026.09.18+
  (Manifold)**, иначе d6 = 95 c, d20 = таймаут.
- **OpenSCAD headless**: text() требует FONTCONFIG_FILE на fonts.conf (см. выше).
- **Blender colorize**: у впадин CadQuery инвертированные нормали → скрипт переворачивает грани с
  нормалями к центру куба.

## Полезные команды

```bash
npm run dev            # страница http://localhost:5173/
npm run build          # сборка dist
# Набор (OpenSCAD 2026.09.18 + Manifold):
SCAD="tools/openscad/openscad-2026.09.18/openscad.exe"
export FONTCONFIG_FILE="tools/openscad/openscad-2026.09.18/fonts/fonts.conf"
for die in d4 d6 d8 d10 d12 d20; do
  "$SCAD" -o "assets/cad/set/$die.stl" -D "DIE=\"$die\"" tools/dice_set.scad
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background \
    --python tools/blender-stl-colorize-set.py -- \
    "assets/cad/set/$die.stl" "public/cad/set/$die.glb" "$die"
done
# D6 сборки:
PYTHONIOENCODING=utf-8 tools/freecad-venv-embedded/Scripts/python.exe tools/freecad-build-d6.py
PYTHONIOENCODING=utf-8 tools/cadquery-venv/Scripts/python.exe tools/d6_cadquery.py
```
