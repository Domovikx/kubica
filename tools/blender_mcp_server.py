import bpy
import sys
import traceback

BUILD_SCRIPT = 'C:/Users/Domo/workspace/dnd-dice-blender/tools/blender/make_d6.py'
BUILD_LOG = 'C:/Users/Domo/workspace/dnd-dice-blender/tools/blender/build.log'
SELF_TEST = 'C:/Users/Domo/workspace/dnd-dice-blender/tools/blender/self_test.py'


def run_file(path: str) -> None:
    with open(path, encoding='utf-8') as f:
        code = f.read()
    env = {'__name__': '__main__'}
    exec(compile(code, path, 'exec'), env)


def main() -> None:
    if 'blender_mcp_addon' not in bpy.context.preferences.addons:
        bpy.ops.preferences.addon_enable(module='blender_mcp_addon')
    from blender_mcp_addon.handlers.script.executor import configure_script_execution
    from blender_mcp_addon.server.socket_server import start_socket_server

    configure_script_execution(enabled=True)
    result = start_socket_server(host='127.0.0.1', port=9876)
    print('[blender-mcp]', result)

    try:
        run_file(SELF_TEST)
        if '--build' in sys.argv:
            run_file(BUILD_SCRIPT)
        with open(BUILD_LOG, 'w', encoding='utf-8') as f:
            f.write('READY\n')
    except Exception:
        with open(BUILD_LOG, 'w', encoding='utf-8') as f:
            f.write(traceback.format_exc())
        print('[startup] FAILED, см. build.log')

    if result.get('ok'):
        bpy.app.timers.register(lambda: 1.0, persistent=True)


main()