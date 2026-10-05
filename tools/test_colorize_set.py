"""Тесты чистой логики blender-stl-colorize-set.py — без Blender.

Запуск (из корня репо):

    python -m unittest discover -s tools -p "test_*.py"

Что покрыто — только нужное, без оверхэда:

- зеркала габаритов SCAD <-> python <-> TS: дрейф = рассинхрон кадра/физики;
- values_for/OPP: пермутации 1..n и суммы противоположных граней (канон d20);
- is_pip_angle: guard белых рёбер d20 (баг 2.13), границы 3/60 градусов;
- digit_boxes/layout_for/pip_centers: входы pip-классификации;
- топологии вершин/граней каждого тетраэдра/икосаэдра.

Скрипт исполняет пайплайн на верхнем уровне (парсит argv, дергает bpy), поэтому
тест исполняет «чистую» часть исходника (всё до разбора argv) с заглушками
bpy/bmesh/mathutils — поведение пайплайна не меняется, тест правок в нём не требует.
"""

import math
import pathlib
import re
import sys
import types
import unittest


class Vector:
    """Минимальный mathutils.Vector: только то, что используют чистые функции."""

    __slots__ = ('_d',)

    def __init__(self, src=None):
        if src is None:
            self._d = [0.0, 0.0, 0.0]
        elif isinstance(src, Vector):
            self._d = list(src._d)
        else:
            self._d = [float(x) for x in src]

    def __getitem__(self, i):
        return self._d[i]

    def __iter__(self):
        return iter(self._d)

    def __len__(self):
        return 3

    def __add__(self, o):
        return Vector(a + b for a, b in zip(self._d, o._d))

    def __sub__(self, o):
        return Vector(a - b for a, b in zip(self._d, o._d))

    def __neg__(self):
        return Vector(-a for a in self._d)

    def __mul__(self, s):
        return Vector(a * s for a in self._d)

    __rmul__ = __mul__

    def __truediv__(self, s):
        return Vector(a / s for a in self._d)

    def dot(self, o):
        return sum(a * b for a, b in zip(self._d, o._d))

    def cross(self, o):
        a, b = self._d, o._d
        return Vector(
            [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
        )

    @property
    def length(self):
        return math.sqrt(sum(a * a for a in self._d))


def _load_pure_head():
    """Чистая секция скрипта: всё до разбора argv (см. докстринг модуля)."""
    sys.modules.setdefault('bpy', types.ModuleType('bpy'))
    sys.modules.setdefault('bmesh', types.ModuleType('bmesh'))
    mu = sys.modules.setdefault('mathutils', types.ModuleType('mathutils'))
    if not hasattr(mu, 'Vector'):
        mu.Vector = Vector
    path = pathlib.Path(__file__).with_name('blender-stl-colorize-set.py')
    src = path.read_text(encoding='utf-8')
    head, sep = src.split('STL = sys.argv', 1)
    assert sep, 'маркер разбора argv не найден — рефакторинг сломал загрузку теста'
    ns = {'__name__': 'colorize_set_pure'}
    exec(compile(head, str(path), 'exec'), ns)
    return ns


ns = _load_pure_head()

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIES = ('d4', 'd6', 'd8', 'd10', 'd12', 'd20')


class MirrorTest(unittest.TestCase):
    """Габариты и радиус: dice_set.scad <-> blender-colorize <-> geometry.ts."""

    @staticmethod
    def _scad():
        text = (ROOT / 'tools/dice_set.scad').read_text(encoding='utf-8')
        block = re.search(r'DIE_SIZES = \[(.*?)\];', text, re.S).group(1)
        sizes = {m[0]: float(m[1]) for m in re.findall(r'\["(d\d+)",\s*([\d.]+)\]', block)}
        edge = float(re.search(r'^EDGE_R = ([\d.]+);', text, re.M).group(1))
        return sizes, edge

    @staticmethod
    def _ts():
        text = (ROOT / 'src/entities/dice-geometry/geometry.ts').read_text(encoding='utf-8')
        block = re.search(r'const DIE_SIZES[^{]*\{(.*?)\}', text, re.S).group(1)
        sizes = {m[0]: float(m[1]) for m in re.findall(r'(d\d+):\s*([\d.]+)', block)}
        edge = float(re.search(r'const EDGE_R = ([\d.]+)', text).group(1))
        return sizes, edge

    def test_sizes_three_way(self):
        py_sizes, py_edge = ns['DIE_SIZES'], float(ns['EDGE_R'])
        scad_sizes, scad_edge = self._scad()
        ts_sizes, ts_edge = self._ts()
        self.assertEqual(py_sizes, scad_sizes)
        self.assertEqual(py_sizes, ts_sizes)
        self.assertEqual(py_edge, scad_edge)
        self.assertEqual(py_edge, ts_edge)
        self.assertEqual(sorted(py_sizes), sorted(DIES))


class TopologyTest(unittest.TestCase):
    def test_vert_and_face_counts(self):
        want = {
            'd4': (4, 4),
            'd6': (8, 6),
            'd8': (6, 8),
            'd10': (12, 10),
            'd12': (20, 12),
            'd20': (12, 20),
        }
        for die, (nv, nf) in want.items():
            self.assertEqual(len(ns['verts'](die)), nv, die)
            self.assertEqual(len(ns['faces'](die)), nf, die)


class ValuesTest(unittest.TestCase):
    """Канон цифр: пермутация 1..n, противоположные грани в сумме дают n+1."""

    def test_opposite_sums(self):
        for die, n in (('d6', 6), ('d8', 8), ('d12', 12), ('d20', 20)):
            vals = [ns['values_for'](die, fi, n) for fi in range(n)]
            self.assertEqual(sorted(vals), list(range(1, n + 1)), die)
            opp = ns['OPP'][die]
            self.assertEqual(len(opp), n, die)
            for fi in range(n):
                self.assertEqual(opp[opp[fi]], fi, f'{die}: OPP не инволюция, face {fi}')
                self.assertEqual(vals[fi] + vals[opp[fi]], n + 1, f'{die}: face {fi}')

    def test_d4_is_vertex_index(self):
        self.assertEqual([ns['values_for']('d4', i, 4) for i in range(4)], [1, 2, 3, 4])

    def test_d10_faces_are_zero_to_nine(self):
        vals = [ns['values_for']('d10', fi, 10) for fi in range(10)]
        self.assertEqual(sorted(vals), list(range(10)))


class GuardTest(unittest.TestCase):
    """Баг 2.13: фаска (5-11 градусов) не красится; лицо и стенка — красятся."""

    def test_boundaries(self):
        f = ns['is_pip_angle']
        self.assertTrue(f(0.0))
        self.assertTrue(f(3.0))
        self.assertFalse(f(3.5))
        self.assertFalse(f(5.5))  # реальный угол фаски d20 из баг-репорта
        self.assertFalse(f(11.0))
        self.assertFalse(f(45.0))
        self.assertTrue(f(60.0))
        self.assertTrue(f(90.0))  # стенка глифа

    def test_constants(self):
        self.assertEqual(ns['FLAT_MAX_DEG'], 3.0)
        self.assertEqual(ns['WALL_MIN_DEG'], 60.0)


class PipInputsTest(unittest.TestCase):
    def test_digit_boxes_counts_and_values(self):
        for die in ('d6', 'd8', 'd10', 'd12', 'd20'):
            n = int(die[1:])
            boxes = ns['digit_boxes'](die)
            self.assertEqual(len(boxes), n, die)
            want = sorted(range(10) if die == 'd10' else range(1, n + 1))
            self.assertEqual(sorted(b[5] for b in boxes), want, die)

    def test_d4_corner_boxes(self):
        boxes = ns['digit_boxes']('d4')
        self.assertEqual(len(boxes), 12)  # 4 вершины x 3 грани
        self.assertEqual({b[5] for b in boxes}, {1, 2, 3, 4})

    def test_layout_pip_counts(self):
        for v in range(1, 7):
            self.assertEqual(len(ns['layout_for'](v)), v, f'layout {v}')
        self.assertEqual(ns['layout_for'](0), [])
        for v in (7, 9, 11):  # нечётное: ring(v-1) + центр
            self.assertEqual(len(ns['layout_for'](v)), v, f'layout {v}')

    def test_pip_centers_d6(self):
        # 21 пипс (1+2+...+6), все точки конечные и на ненулевой сфере.
        centers = ns['pip_centers']('d6')
        self.assertEqual(len(centers), 21)
        for c in centers:
            self.assertFalse(math.isnan(c.length))
            self.assertGreater(c.length, 1.0)


if __name__ == '__main__':
    unittest.main()
