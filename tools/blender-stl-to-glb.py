import bpy
import sys

STL = sys.argv[sys.argv.index('--') + 1]
OUT = sys.argv[sys.argv.index('--') + 2]

bpy.ops.wm.stl_import(filepath=STL)
obj = bpy.context.active_object

mat = bpy.data.materials.new('CAD_Body')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.22, 0.23, 0.26, 1.0)
bsdf.inputs['Roughness'].default_value = 0.35
if obj.data.materials:
    obj.data.materials[0] = mat
else:
    obj.data.materials.append(mat)

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=True,
)
print('OK: converted', STL, '->', OUT)