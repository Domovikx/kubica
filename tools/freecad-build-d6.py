"""Сборка CAD-D6 через FreeCAD Robust MCP Server (официальный python-клиент mcp).

Куб 16x16x16 мм, фаска 1 мм, 21 сфера-пипс (r=1.4), вырезы, экспорт STEP/STL/FCStd.
"""
import asyncio
import json
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

SERVER = r'C:/Users/Domo/workspace/kubica/tools/freecad-venv-embedded/Scripts/freecad-mcp.exe'
OUT = r'C:/Users/Domo/workspace/kubica/assets/cad'

PIP_LAYOUTS = {
    '+z': [[0, 0]],
    '-z': [[-3.0, -3.0], [-3.0, 0], [-3.0, 3.0], [3.0, -3.0], [3.0, 0], [3.0, 3.0]],
    '+x': [[0, 0], [0, 3.0], [0, -3.0], [3.0, 0], [-3.0, 0]],
    '-x': [[3.0, 3.0], [-3.0, -3.0]],
    '+y': [[-3.0, -3.0], [0, 0], [3.0, 3.0]],
    '-y': [[-3.0, -3.0], [-3.0, 3.0], [3.0, -3.0], [3.0, 3.0]],
}
FACE_CENTER = {
    '+z': [0, 0, 8.6], '-z': [0, 0, -8.6],
    '+x': [8.6, 0, 0], '-x': [-8.6, 0, 0],
    '+y': [0, 8.6, 0], '-y': [0, -8.6, 0],
}


async def main() -> None:
    params = StdioServerParameters(
        command=SERVER,
        args=['--mode', 'embedded', '--log-level', 'DEBUG'],
        env=None,
        errlog=open(r'C:/Users/Domo/workspace/kubica/debug/freecad-server.log', 'w'),
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            print(f'подключено, инструментов: {len(tools.tools)}', flush=True)

            def step(msg):
                print(f'\n>>> {msg}', flush=True)

            async def call(tool_name, **args):
                result = await session.call_tool(tool_name, arguments=args)
                if result.isError:
                    err_text = '\n'.join(c.text or '' for c in result.content)
                    raise RuntimeError(f'{tool_name}: isError: {err_text[:6000]}')
                text = '\n'.join(c.text or '' for c in result.content)
                if text.startswith('Error executing tool'):
                    raise RuntimeError(f'{tool_name}: {text[:600]}')
                return text

            async def call_json(tool_name, **args):
                text = await call(tool_name, **args)
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    raise RuntimeError(f'{tool_name}: ответ не JSON: {text[:400]}')

            step('1. документ')
            await call_json('create_document', name='CAD_D6')

            step('2. куб 16x16x16 мм')
            box = await call_json('create_box', length=16, width=16, height=16)
            print('   объём:', box.get('volume'), 'мм3')

            step('3. центрирование куба (Part::Box занимает 0..16!)')
            await call_json('set_placement', object_name='Part__Box', position=[-8, -8, -8])
            print('   центр -> (-8,-8,-8)')

            step('4. рёбра куба')
            edges_raw = await call('execute_python', code=(
                'import FreeCAD\n'
                "doc = App.getDocument('CAD_D6')\n"
                "obj = doc.getObject('Part__Box')\n"
                'print(len(obj.Shape.Edges))'
            ))
            n_edges = int(json.loads(edges_raw).get('result') or json.loads(edges_raw).get('stdout') or 0)
            edge_names = [f'Edge{i}' for i in range(1, n_edges + 1)]
            print(f'   рёбер: {n_edges}')

            step('5. скругление рёбер r=1 мм')
            fillet = await call_json('fillet_edges', object_name='Part__Box', radius=1, edges=edge_names, name='D6_blank')
            body = fillet['name']
            print(f'   тело: {body}')

            step('6. сферы-пипсы (21 шт, r=1.4)')
            i = 0
            positions = []
            for face, pips in PIP_LAYOUTS.items():
                cx, cy, cz = FACE_CENTER[face]
                for u, v in pips:
                    if face in ('+z', '-z'):
                        pos = [cx + u, cy + v, cz]
                    elif face in ('+x', '-x'):
                        pos = [cx, cy + u, cz + v]
                    else:
                        pos = [cx + u, cy, cz + v]
                    name = f'Pip_{i:02d}'
                    await call_json('create_sphere', radius=1.4, name=name)
                    await call_json('set_placement', object_name=name, position=pos)
                    positions.append(name)
                    i += 1
            print(f'   создано: {len(positions)}')

            step('7. вычитание пипсов (boolean cut)')
            current = body
            for k, pip in enumerate(positions):
                res = await call_json('boolean_operation',
                                      operation='cut', object1_name=current, object2_name=pip, result_name='D6_body')
                current = res['name']
            print(f'   готово: 21 вырез, финальный объект: {current}')

            step('8. диагностика перед экспортом')
            diag = await call('execute_python', code=(
                "import FreeCAD\n"
                "import Mesh\n"
                "import Part\n"
                "doc = FreeCAD.ActiveDocument\n"
                "obj = doc.getObject('D6_body')\n"
                "mesh = Mesh.Mesh()\n"
                "print('obj:', obj.Name, 'shape null:', obj.Shape.isNull())\n"
                "try:\n"
                "    mesh.addFacets(obj.Shape.tessellate(0.1)[0])\n"
                "    print('addFacets OK, tris:', len(mesh.Facets))\n"
                "except Exception as e:\n"
                "    print('addFacets FAIL:', type(e).__name__, e)\n"
            ))
            print('   ', json.loads(diag).get('stdout'))

            step('9. экспорт STEP / STL / FCStd')
            print('   ', await call('export_step', file_path=f'{OUT}/cad-d6.step', object_names=[current]))
            stl_export = await call('execute_python', code=(
                "import FreeCAD\n"
                f"obj = FreeCAD.ActiveDocument.getObject({current!r})\n"
                f"obj.Shape.exportStl({OUT + '/cad-d6.stl'!r}, 0.01)\n"
                "print('STL exported')"
            ))
            print('   ', json.loads(stl_export).get('stdout') or json.loads(stl_export).get('error_type'))
            print('   ', await call('save_document', path=f'{OUT}/cad-d6.fcstd'))

            step('10. контроль геометрии')
            check = await call('execute_python', code=(
                "import FreeCAD\n"
                "doc = App.getDocument('CAD_D6')\n"
                f"s = doc.getObject({current!r}).Shape\n"
                f"print('BBox:', round(s.BoundBox.XLength,3), 'x', round(s.BoundBox.YLength,3), 'x', round(s.BoundBox.ZLength,3))\n"
                "print('Volume:', round(s.Volume,3))\n"
                "print('Faces:', len(s.Faces))"
            ))
            data = json.loads(check)
            print('   ', data.get('stdout') or data.get('result'))
            if not data.get('success'):
                print('   ERROR:', data.get('error_traceback', '')[-400:])

            step('ГОТОВО')


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except BaseException as exc:
        import traceback
        traceback.print_exc()
        sys.exit(1)