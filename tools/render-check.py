import bpy
import sys

# usage: blender --background --python render-check.py -- GLB OUT
GLB = sys.argv[sys.argv.index('--') + 1]
OUT = sys.argv[sys.argv.index('--') + 2]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
obj = bpy.context.active_object
obj.rotation_euler = (0.75, 0.35, 0.5)

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 800
scene.render.resolution_y = 800
scene.render.image_settings.file_format = 'PNG'

cam = scene.camera
if cam is None:
    cam_data = bpy.data.cameras.new('Cam')
    cam = bpy.data.objects.new('Cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
cam.location = (0, -22, 8)
cam.rotation_euler = (1.2, 0, 0)
cam.data.lens = 60

sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.rotation_euler = (0.9, 0.2, 0.5)
scene.collection.objects.link(sun)

scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('RENDERED', OUT)