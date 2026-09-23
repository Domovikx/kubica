const BASE = import.meta.env.BASE_URL

export interface ModelDef {
  id: string
  label: string
  url: string
  source: string
  /**
   * Образец для сравнения CAD-стеков (не наш игровой набор).
   * Скрыт из основного UI; позже переедет на страницу референсов.
   */
  reference?: boolean
}

export const MODELS: ModelDef[] = [
  {
    id: 'd6-freecad',
    label: 'D6 · FreeCAD (сравнение)',
    url: `${BASE}cad/cad-d6.glb`,
    source: 'FreeCAD 1.1.3',
    reference: true,
  },
  {
    id: 'd6-openscad',
    label: 'D6 · OpenSCAD (сравнение)',
    url: `${BASE}cad/cad-d6-openscad.glb`,
    source: 'OpenSCAD 2021.01',
    reference: true,
  },
  {
    id: 'd6-cadquery',
    label: 'D6 · CadQuery (сравнение)',
    url: `${BASE}cad/cad-d6-cadquery.glb`,
    source: 'CadQuery 2.8.0',
    reference: true,
  },
  {
    id: 'd4',
    label: 'D4 · цифры на вершинах',
    url: `${BASE}cad/set/d4.glb`,
    source: 'OpenSCAD · цифры',
  },
  { id: 'd6', label: 'D6 · цифры 1–6', url: `${BASE}cad/set/d6.glb`, source: 'OpenSCAD · цифры' },
  { id: 'd8', label: 'D8 · цифры 1–8', url: `${BASE}cad/set/d8.glb`, source: 'OpenSCAD · цифры' },
  {
    id: 'd10',
    label: 'D10 · цифры 0–9',
    url: `${BASE}cad/set/d10.glb`,
    source: 'OpenSCAD · цифры',
  },
  {
    id: 'd12',
    label: 'D12 · цифры 1–12',
    url: `${BASE}cad/set/d12.glb`,
    source: 'OpenSCAD · цифры',
  },
  {
    id: 'd20',
    label: 'D20 · цифры 1–20',
    url: `${BASE}cad/set/d20.glb`,
    source: 'OpenSCAD · цифры',
  },
]

export const DEFAULT_SELECTED = ['d6', 'd20']
