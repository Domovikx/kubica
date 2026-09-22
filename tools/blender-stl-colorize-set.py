import bpy
import bmesh
import math
import sys

from mathutils import Vector

# Использование: blender --background --python blender-stl-colorize-set.py -- STL OUT DIE
# DIE: d4|d6|d8|d10|d12|d20
# Красит грани-впадины (пипсы/цифры) красным, тело — тёмным графитом.
# Определение: грань принадлежит пипсу, если её центр лежит на поверхности
# сферы-пипса (расстояние до центра пипса ≈ PIP_R). Тело так не бывает:
# плоские грани на расстоянии 0.6 от центра пипса (не 1.4).

PIP_R = 1.4
DIGIT_DEPTH = 0.1

# ---------- геометрия (зеркало tools/dice_set.scad) ----------

def phi():
    return (1 + math.sqrt(5)) / 2

ICOSA_V = [
    [-1, phi(), 0], [1, phi(), 0], [-1, -phi(), 0], [1, -phi(), 0],
    [0, -1, phi()], [0, 1, phi()], [0, -1, -phi()], [0, 1, -phi()],
    [phi(), 0, -1], [phi(), 0, 1], [-phi(), 0, -1], [-phi(), 0, 1],
]

ICOSA_F = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
]

TETRA_V = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]
TETRA_F = [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]]

OCTA_V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
OCTA_F = [[0, 4, 2], [0, 2, 5], [0, 5, 3], [0, 3, 4], [1, 4, 3], [1, 3, 5], [1, 5, 2], [1, 2, 4]]

CUBE_V = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]]
CUBE_F = [[0, 1, 3, 2], [4, 6, 7, 5], [2, 3, 7, 6], [0, 1, 5, 4], [0, 2, 6, 4], [1, 3, 7, 5]]

TRAPEZO_V = [
    [0.0, 0.0, 1.1764706], [-0.0, -0.0, -1.1764706],
    [0.8944272, 0.6498394, 0.1242033], [0.3416408, 1.0514622, -0.1242033],
    [-0.3416408, 1.0514622, 0.1242033], [-0.8944272, 0.6498394, -0.1242033],
    [-1.1055728, 0.0, 0.1242033], [-0.8944272, -0.6498394, -0.1242033],
    [-0.3416408, -1.0514622, 0.1242033], [0.3416408, -1.0514622, -0.1242033],
    [0.8944272, -0.6498394, 0.1242033], [1.1055728, -0.0, -0.1242033],
]

TRAPEZO_F = [
    [0, 10, 11, 2], [1, 2, 3, 11], [0, 2, 3, 4], [1, 4, 5, 3], [0, 4, 5, 6],
    [1, 6, 7, 5], [0, 6, 7, 8], [1, 8, 9, 7], [0, 8, 9, 10], [1, 10, 11, 9],
]


def centroid(v, face):
    return sum((Vector(v[i]) for i in face), Vector()) / len(face)


def normalize(v):
    return v / v.length


def dodeca_verts():
    return [normalize(centroid(ICOSA_V, f)) * 1.5 for f in ICOSA_F]


def dodeca_faces():
    ring = [[] for _ in ICOSA_V]
    for fi, f in enumerate(ICOSA_F):
        for vi in f:
            ring[vi].append(fi)
    return ring


def verts(die):
    return {
        'd4': TETRA_V, 'd6': CUBE_V, 'd8': OCTA_V,
        'd12': dodeca_verts(), 'd20': ICOSA_V,
        'd10': TRAPEZO_V,
    }[die]


def faces(die):
    return {
        'd4': TETRA_F, 'd6': CUBE_F, 'd8': OCTA_F,
        'd12': dodeca_faces(), 'd20': ICOSA_F,
        'd10': TRAPEZO_F,
    }[die]


# ---------- раскладки ----------

PIP_LAYOUTS = [
    [[0, 0]],
    [[3.0, 3.0], [-3.0, -3.0]],
    [[-3.0, -3.0], [0, 0], [3.0, 3.0]],
    [[-3.0, -3.0], [-3.0, 3.0], [3.0, -3.0], [3.0, 3.0]],
    [[0, 0], [0, 3.0], [0, -3.0], [3.0, 0], [-3.0, 0]],
    [[-3.0, -3.0], [-3.0, 0], [-3.0, 3.0], [3.0, -3.0], [3.0, 0], [3.0, 3.0]],
]


def ring(n, r):
    return [[math.cos(2 * math.pi * i / n) * r, math.sin(2 * math.pi * i / n) * r] for i in range(n)]


def layout_for(v):
    if v == 0:
        return []
    if v <= 6:
        return PIP_LAYOUTS[v - 1]
    layout = ring(v - 1, 4.2)
    if v % 2 == 1:
        layout.append([0, 0])
    return layout


OPP = {
    'd6': [1, 0, 3, 2, 5, 4],
    'd8': [5, 4, 7, 6, 1, 0, 3, 2],
    'd12': [3, 2, 1, 0, 7, 6, 5, 4, 11, 10, 9, 8],
    'd20': [13, 12, 11, 10, 14, 17, 18, 19, 15, 16, 3, 2, 1, 0, 4, 8, 9, 5, 6, 7],
}


def values_for(die, fi, n):
    if die == 'd10':
        o = [5, 6, 7, 8, 9, 0, 1, 2, 3, 4][fi]
        return fi if fi < o else (n - 1) - o
    if die == 'd4':
        return fi + 1
    o = OPP[die][fi]
    return fi + 1 if fi < o else n - o


def face_normal(v, face):
    a, b, c = (Vector(v[i]) for i in face[:3])
    return normalize((b - a).cross(c - a))


def pip_centers(die):
    v = verts(die)
    f = faces(die)
    out = []
    for fi in range(len(f)):
        nv = face_normal(v, f[fi])
        ref = Vector((0, 0, 1)) if abs(nv[2]) < 0.9 else Vector((0, 1, 0))
        bu = normalize(ref.cross(nv))
        bv = nv.cross(bu)
        for p in layout_for(values_for(die, fi, len(f))):
            out.append(nv * (8.0 + PIP_R - 0.8) + bu * p[0] + bv * p[1])
    return out


# ---------- применение ----------

def digit_boxes(die):
    # Зеркало SCAD-разметки digits_d4()/digits_centered():
    # (pos, nv, bu, bv, size, val) в НОРМИРОВАННЫХ координатах (verts / inradius),
    # как в SCAD-функции verts(). Python-модуль verts() возвращает unit-вершины,
    # поэтому делим pos на inradius.
    v = verts(die)
    f = faces(die)
    n = len(f)
    inr = min(
        abs(sum((Vector(v[i]) for i in face), Vector())
            .dot(face_normal(v, face)) / len(face)) for face in f
    )
    out = []
    if die == 'd4':
        for vi in range(4):
            for fj in range(4):
                if vi not in f[fj]:
                    continue
                c = centroid(v, f[fj])
                nv = face_normal(v, f[fj])
                if nv.dot(c) < 0:
                    nv = -nv
                bv = normalize(Vector(v[vi]) - c)
                bu = normalize(nv.cross(bv))
                pos = (c + (Vector(v[vi]) - c) * 0.62) / inr
                out.append((pos, nv, bu, bv, 5.0, vi + 1))
    else:
        # d6/d8/d10/d12/d20: цифра в центре грани, "вверх" = к первой вершине
        sizes = {'d6': 4.0, 'd8': 3.2, 'd10': 3.0, 'd12': 3.5, 'd20': 2.0}
        size = sizes[die]
        for fi in range(n):
            c = centroid(v, f[fi])
            nv = face_normal(v, f[fi])
            if nv.dot(c) < 0:
                nv = -nv
            anchor = f[fi][0]
            bv = normalize(Vector(v[anchor]) - c)
            bu = normalize(nv.cross(bv))
            out.append((c / inr, nv, bu, bv, size, values_for(die, fi, n)))
    return out


SIZE = 16.0
EDGE_R = 1.0

STL = sys.argv[sys.argv.index('--') + 1]
OUT = sys.argv[sys.argv.index('--') + 2]
DIE = sys.argv[sys.argv.index('--') + 3] if len(sys.argv) > sys.argv.index('--') + 3 else 'd6'

bpy.ops.wm.stl_import(filepath=STL)
obj = bpy.context.active_object

body = bpy.data.materials.new('D_body')
body.use_nodes = True
bsdf = body.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.07, 0.075, 0.09, 1.0)
bsdf.inputs['Roughness'].default_value = 0.35

pips = bpy.data.materials.new('D_pips')
pips.use_nodes = True
bsdf2 = pips.node_tree.nodes['Principled BSDF']
bsdf2.inputs['Base Color'].default_value = (0.937, 0.192, 0.141, 1.0)
bsdf2.inputs['Roughness'].default_value = 0.3

obj.data.materials.append(body)
obj.data.materials.append(pips)

bm = bmesh.new()
bm.from_mesh(obj.data)
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()

lo = [min(v.co[i] for v in bm.verts) for i in range(3)]
hi = [max(v.co[i] for v in bm.verts) for i in range(3)]
center = Vector([(lo[i] + hi[i]) / 2 for i in range(3)])

for face in bm.faces:
    c = sum((v.co for v in face.verts), Vector()) / len(face.verts)
    if face.normal.dot(c - center) < 0:
        face.normal_flip()

is_digit_die = DIE in ('d4', 'd6', 'd8', 'd10', 'd12', 'd20')
boxes = digit_boxes(DIE) if is_digit_die else []
s = SIZE / 2 - EDGE_R
for face in bm.faces:
    c = sum((v.co for v in face.verts), Vector()) / len(face.verts)
    if is_digit_die:
        # цифры: грань красная, если её центр внутри бокса какой-либо
        # цифры (в плоскости грани, в пределах глифа) и утоплен ниже плоскости грани.
        # pos/nv/bu/bv — в нормированных координатах (inradius=1), масштаб = s.
        # Двузначные числа шире: half_u с запасом; подчёркивание 6/9 уходит ниже.
        is_pip = False
        for pos, nv, bu, bv, size, val in boxes:
            plane_d = s * pos.dot(nv) + EDGE_R
            u0 = s * pos.dot(bu)
            v0 = s * pos.dot(bv)
            uu = c.dot(bu) - u0
            vv = c.dot(bv) - v0
            depth = plane_d - c.dot(nv)
            # Точный бокс по размеру глифа: цифра ~0.64*size шириной на символ,
            # ~0.73*size высотой; планка 6/9: центр на -0.62*size, низ на -0.70*size.
            # Скругления у рёбер тоже ниже плоскости — широкий бокс красил бы их,
            # поэтому запас минимальный (+0.15).
            two = len(str(val)) > 1
            half_u = size * (0.70 if two else 0.45) + 0.4
            half_v = size * 0.45 + 0.4
            lo = -half_v - (size * 0.35 if val in (6, 9) else 0.0)
            if abs(uu) < half_u and lo < vv < half_v and 0.005 < depth < DIGIT_DEPTH + 0.3:
                is_pip = True
                break
    face.material_index = 1 if is_pip else 0

bm.to_mesh(obj.data)
bm.free()

pips_count = sum(1 for f in obj.data.polygons if f.material_index == 1)
print(f'граней пипсов: {pips_count} из {len(obj.data.polygons)}')

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=True,
)
print('OK: colored', STL, '->', OUT)