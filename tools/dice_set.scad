// Параметрический генератор D&D набора (OpenSCAD)
// -D DIE="d4|d6|d8|d10|d12|d20"
SIZE = 16;
EDGE_R = 1;
PIP_R = 1.4;
PIP_DEPTH = 0.8;
OFF = 3.0;
FN = 24;            // сегменты пипсов (мелкие, фасеты не видны)
FN_EDGE = 48;       // сегменты скругления (hull из 8 сфер)

DIE = "d6";

// ---------- геометрия (проверенные формулы) ----------

function phi() = (1 + sqrt(5)) / 2;

function icosa_verts() = [
  [-1, phi(), 0], [1, phi(), 0], [-1, -phi(), 0], [1, -phi(), 0],
  [0, -1, phi()], [0, 1, phi()], [0, -1, -phi()], [0, 1, -phi()],
  [phi(), 0, -1], [phi(), 0, 1], [-phi(), 0, -1], [-phi(), 0, 1],
];

ICOSA_F = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

function sumv(list) = [for (i = [0 : len(list[0]) - 1]) sum_col(list, i)];

function sum_col(list, col) =
  len(list) == 1 ? list[0][col] : list[0][col] + sum_col([for (i = [1 : len(list) - 1]) list[i]], col);

function centroid(v, face) = sumv([for (i = face) v[i]]) / len(face);

function normalize_safe(v) = norm(v) < 0.0001 ? v : v / norm(v);

function normalize(v) = v / norm(v);

function dodeca_verts() = [for (f = ICOSA_F) normalize(centroid(icosa_verts(), f)) * 1.5];

function faces_around(v, faces) =
  [for (vi = [0 : len(v) - 1])
    let (ring = [for (fi = [0 : len(faces) - 1]) if (faces[fi][0] == vi || faces[fi][1] == vi || faces[fi][2] == vi) fi])
    ring];

function dodeca_faces() = faces_around(icosa_verts(), ICOSA_F);

// Пентагональный трапецоэдр (d10) как полярный дуал правильной антипризмы:
// 12 вершин, 10 плоских кайтов, все грани компланарны.
function trapezo_verts() = [
  [0.0, 0.0, 1.1764706], [-0.0, -0.0, -1.1764706],
  [0.8944272, 0.6498394, 0.1242033], [0.3416408, 1.0514622, -0.1242033],
  [-0.3416408, 1.0514622, 0.1242033], [-0.8944272, 0.6498394, -0.1242033],
  [-1.1055728, 0.0, 0.1242033], [-0.8944272, -0.6498394, -0.1242033],
  [-0.3416408, -1.0514622, 0.1242033], [0.3416408, -1.0514622, -0.1242033],
  [0.8944272, -0.6498394, 0.1242033], [1.1055728, -0.0, -0.1242033],
];

TRAPEZO_F = [
  [0, 10, 11, 2], [1, 2, 3, 11], [0, 2, 3, 4], [1, 4, 5, 3], [0, 4, 5, 6],
  [1, 6, 7, 5], [0, 6, 7, 8], [1, 8, 9, 7], [0, 8, 9, 10], [1, 10, 11, 9],
];

TETRA_V = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
TETRA_F = [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]];

OCTA_V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
OCTA_F = [[0, 4, 2], [0, 2, 5], [0, 5, 3], [0, 3, 4], [1, 4, 3], [1, 3, 5], [1, 5, 2], [1, 2, 4]];

CUBE_V = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]];
CUBE_F = [[0, 1, 3, 2], [4, 6, 7, 5], [2, 3, 7, 6], [0, 1, 5, 4], [0, 2, 6, 4], [1, 3, 7, 5]];

function unit_verts(die) =
  die == "d4" ? TETRA_V : die == "d6" ? CUBE_V : die == "d8" ? OCTA_V
  : die == "d12" ? dodeca_verts() : die == "d20" ? icosa_verts() : trapezo_verts();

// Нормировка: у всех костей грани должны лежать на расстоянии 8.0 от центра,
// иначе пипсы не прорезаются (d8/d10) или кость огромная (d12/d20).
function face_dist(v, face) = abs(centroid(v, face) * face_normal(v, face));

function die_inradius(die) = min([for (f = faces(die)) face_dist(unit_verts(die), f)]);

function verts(die) = [for (v = unit_verts(die)) v / die_inradius(die)];

function faces(die) =
  die == "d4" ? TETRA_F : die == "d6" ? CUBE_F : die == "d8" ? OCTA_F
  : die == "d12" ? dodeca_faces() : die == "d20" ? ICOSA_F : TRAPEZO_F;

// ---------- раскладки ----------

PIP_LAYOUTS = [
  [[0, 0]],
  [[OFF, OFF], [-OFF, -OFF]],
  [[-OFF, -OFF], [0, 0], [OFF, OFF]],
  [[-OFF, -OFF], [-OFF, OFF], [OFF, -OFF], [OFF, OFF]],
  [[0, 0], [0, OFF], [0, -OFF], [OFF, 0], [-OFF, 0]],
  [[-OFF, -OFF], [-OFF, 0], [-OFF, OFF], [OFF, -OFF], [OFF, 0], [OFF, OFF]],
];

function ring(n, r) = [for (i = [0 : n - 1]) [cos(360 * i / n), sin(360 * i / n)] * r];

function layout_for(v) = v == 0 ? []
  : v <= 6 ? PIP_LAYOUTS[v - 1]
  : v == 7 ? concat(ring(6, OFF + 1.2), [[0, 0]])
  : v == 8 ? ring(7, OFF + 1.2)
  : v == 9 ? concat(ring(8, OFF + 1.2), [[0, 0]])
  : v == 10 ? ring(10, OFF + 1.2)
  : v == 11 ? concat(ring(10, OFF + 1.2), [[0, 0]])
  : v == 12 ? ring(12, OFF + 1.2)
  : v == 13 ? concat(ring(12, OFF + 1.2), [[0, 0]])
  : v == 14 ? ring(13, OFF + 1.2)
  : v == 15 ? concat(ring(14, OFF + 1.2), [[0, 0]])
  : v == 16 ? ring(15, OFF + 1.2)
  : v == 17 ? concat(ring(16, OFF + 1.2), [[0, 0]])
  : v == 18 ? ring(17, OFF + 1.2)
  : v == 19 ? concat(ring(18, OFF + 1.2), [[0, 0]])
  : ring(20, OFF + 1.2);

// числа на гранях: противоположные грани в сумме N+1 (d6:7, d8:9, d12:13, d20:21)
// d10: цифры 0-9, противоположные в сумме 9
function values_for(die, fi, n) =
  die == "d10" ? let (o = [5, 6, 7, 8, 9, 0, 1, 2, 3, 4][fi]) (fi < o ? fi : (n - 1) - o)
  : let (o = opposite(die, fi)) fi < o ? fi + 1 : n - o;

// индексы противоположных граней
function opposite(die, fi) =
  die == "d6" ? [1, 0, 3, 2, 5, 4][fi]
  : die == "d8" ? [5, 4, 7, 6, 1, 0, 3, 2][fi]
  : die == "d12" ? [3, 2, 1, 0, 7, 6, 5, 4, 11, 10, 9, 8][fi]
  : die == "d20" ? [13, 12, 11, 10, 14, 17, 18, 19, 15, 16, 3, 2, 1, 0, 4, 8, 9, 5, 6, 7][fi]
  : fi;

// ---------- построение ----------

function face_normal(v, face) =
  let (a = v[face[0]], b = v[face[1]], c = v[face[2]],
       n = normalize(cross(b - a, c - a)),
       cen = centroid(v, face))
  // нормировка: у всех граней плоскость на расстоянии 1 от центра,
  // нормаль должна смотреть наружу (иначе гравировка уйдёт внутрь кости)
  n * (n * cen < 0 ? -1 : 1);

module pip_at(n, u, v, r) {
  ref = abs(n[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  bu = normalize(cross(ref, n));
  bv = cross(n, bu);
  c = n * (SIZE / 2 + r - PIP_DEPTH) + bu * u + bv * v;
  translate(c) sphere(r = r, $fn = FN);
}

module body(die) {
  v = verts(die);
  hull() for (p = v)
    translate(p * (SIZE / 2 - EDGE_R))
      sphere(r = EDGE_R, $fn = FN_EDGE);
}

// ---------- цифры (d4 — на вершинах, d10 — на гранях) ----------

FONT = "Liberation Sans:style=Bold";
DIGIT_DEPTH = 0.75;
DIGIT_SIZE_D4 = 5.0;
DIGIT_SIZE_D10 = 3.0;

// гравировка: текст ложится плоско на грань (нормаль nv), "вверх" = bv.
// pos, bu, bv, nv — в нормированных координатах; масштаб под тело применяется здесь.
// Текст зеркалится по X: вырез уходит внутрь кости, и снаружи видно «изнанку» дна —
// чтобы цифра читалась, рисуем её отражённой.
// under=true — подчёркивание под цифрой (для 6 и 9): тонкая планка той же глубины.
module engrave(pos, nv, bu, bv, txt, size, under = false) {
  s = SIZE / 2 - EDGE_R;
  plane_d = s * (pos * nv) + EDGE_R;
  u = s * (pos * bu);
  v = s * (pos * bv);
  multmatrix(m = [
    [bu[0], bv[0], -nv[0], nv[0] * plane_d],
    [bu[1], bv[1], -nv[1], nv[1] * plane_d],
    [bu[2], bv[2], -nv[2], nv[2] * plane_d],
    [0, 0, 0, 1],
  ]) {
    translate([u, v, 0])
      linear_extrude(height = DIGIT_DEPTH + 0.2)
        mirror([1, 0, 0])
          text(txt, size = size, halign = "center", valign = "center", font = FONT);
    if (under)
      translate([u, v - size * 0.62, -0.1])
        cube([size * 0.7, size * 0.16, DIGIT_DEPTH + 0.3]);
  }
}

// d4: цифра на каждой из 3 граней у вершины, читается от вершины
module digits_d4() {
  v = verts("d4");
  f = faces("d4");
  union() {
    for (vi = [0 : 3]) {
      val = values_for("d4", vi, 4);
      txt = str(val);
      for (fj = [0 : 3]) {
        if (len([for (x = f[fj]) if (x == vi) 1]) > 0) {
          c = centroid(v, f[fj]);
          nv = face_normal(v, f[fj]);
          bv = normalize(v[vi] - c);
          bu = normalize(cross(nv, bv));
          pos = c + (v[vi] - c) * 0.62;
          engrave(pos, nv, bu, bv, txt, DIGIT_SIZE_D4);
        }
      }
    }
  }
}

// d10: цифра 0-9 в центре каждой грани; у 6 и 9 — подчёркивание
module digits_d10() {
  v = verts("d10");
  f = faces("d10");
  union() {
    for (fi = [0 : 9]) {
      c = centroid(v, f[fi]);
      nv = face_normal(v, f[fi]);
      val = values_for("d10", fi, 10);
      pole = f[fi][0];
      bv = normalize(v[pole] - c);
      bu = normalize(cross(nv, bv));
      engrave(c, nv, bu, bv, str(val), DIGIT_SIZE_D10, val == 6 || val == 9);
    }
  }
}

module pips(die) {
  // ВАЖНО: всё вырезаемое объединяем в один объект и режем один раз —
  // иначе N boolean-вырезов против тела вешают CGAL (d20 = 210 сфер!)
  if (die == "d4") {
    digits_d4();
  } else if (die == "d10") {
    digits_d10();
  } else {
    union() {
      v = verts(die);
      f = faces(die);
      n = len(f);
      for (fi = [0 : n - 1]) {
        c = centroid(v, f[fi]);
        nv = face_normal(v, f[fi]);
        val = values_for(die, fi, n);
        for (p = layout_for(val)) pip_at(nv, p[0], p[1], PIP_R);
      }
    }
  }
}

difference() {
  body(DIE);
  pips(DIE);
}