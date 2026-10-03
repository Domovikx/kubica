import bpy
import bmesh
import math
import sys

from mathutils import Vector

STL = sys.argv[sys.argv.index('--') + 1]
OUT = sys.argv[sys.argv.index('--') + 2]

CENTRAL = 6.2      # центральная зона грани (вне фаски/скругления)
TILT_MIN = 8.0     # мин. наклон нормали, чтобы считать грань стенкой впадины (градусы)
DEEP = 0.35        # глубина, ниже которой грань красится при любом наклоне

bpy.ops.wm.stl_import(filepath=STL)
obj = bpy.context.active_object

body = bpy.data.materials.new('D6_body')
body.use_nodes = True
bsdf = body.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.07, 0.075, 0.09, 1.0)
bsdf.inputs['Roughness'].default_value = 0.35

pips = bpy.data.materials.new('D6_pips')
pips.use_nodes = True
bsdf2 = pips.node_tree.nodes['Principled BSDF']
bsdf2.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0)
bsdf2.inputs['Roughness'].default_value = 0.3

obj.data.materials.append(body)
obj.data.materials.append(pips)

bm = bmesh.new()
bm.from_mesh(obj.data)
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()

lo = [min(v.co[i] for v in bm.verts) for i in range(3)]
hi = [max(v.co[i] for v in bm.verts) for i in range(3)]
center = [(lo[i] + hi[i]) / 2 for i in range(3)]
center_vec = Vector(center)

for face in bm.faces:
    c = sum((v.co for v in face.verts), Vector()) / len(face.verts)
    if face.normal.dot(c - center_vec) < 0:
        face.normal_flip()

AXIS_VECS = [Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))]

for face in bm.faces:
    c = sum((v.co for v in face.verts), Vector()) / len(face.verts)
    dists = [min(abs(c[i] - lo[i]), abs(hi[i] - c[i])) for i in range(3)]
    depth = min(dists)
    k = dists.index(depth)
    u_axis = [i for i in range(3) if i != k]
    if not all(abs(c[i] - center[i]) <= CENTRAL for i in u_axis):
        face.material_index = 0
        continue
    side = 1.0 if (hi[k] - c[k]) < (c[k] - lo[k]) else -1.0
    axis_dir = AXIS_VECS[k] * side
    tilt = math.degrees(face.normal.angle(axis_dir))
    is_pip = depth > DEEP or tilt > TILT_MIN
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