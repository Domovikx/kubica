// Параметрический D6: 16 мм, скруглённые рёбра r=1, пипсы r=1.6, глубина 1 мм
SIZE = 16;          // размер куба, мм
EDGE_R = 1;         // радиус скругления рёбер
PIP_R = 1.4;        // радиус сферы пипса
PIP_DEPTH = 0.8;    // глубина впадины пипса, мм
OFF = 3.0;          // смещение пипсов от центра грани
FN = 48;          // сегменты для пипсов
FN_EDGE = 64;     // сегменты для скругления рёбер (minkowski — медленный!)

PIP_LAYOUTS = [
  [[0, 0]],                                                   // 1
  [[3.0, 3.0], [-3.0, -3.0]],                                 // 2
  [[-3.0, -3.0], [0, 0], [3.0, 3.0]],                         // 3
  [[-3.0, -3.0], [-3.0, 3.0], [3.0, -3.0], [3.0, 3.0]],       // 4
  [[0, 0], [0, 3.0], [0, -3.0], [3.0, 0], [-3.0, 0]],         // 5
  [[-3.0, -3.0], [-3.0, 0], [-3.0, 3.0], [3.0, -3.0], [3.0, 0], [3.0, 3.0]], // 6
];

// 1 на +Z, 6 на -Z, 5 на +X, 2 на -X, 3 на +Y, 4 на -Y
FACE_PIPS = [[1, 6], [5, 2], [3, 4]];
AXES = [0, 1, 2];
SIGNS = [1, -1];

module body() {
  // скруглённый куб = выпуклая оболочка сфер в углах (hull намного быстрее minkowski)
  half = SIZE / 2 - EDGE_R;
  hull() {
    for (x = [-1, 1]) for (y = [-1, 1]) for (z = [-1, 1]) {
      translate([x * half, y * half, z * half])
        sphere(r = EDGE_R, $fn = FN_EDGE);
    }
  }
}

module pip_at(axis, sign, u, v) {
  // центр сферы чуть СНАРУЖИ грани: впадина глубиной PIP_DEPTH
  center = SIZE / 2 + PIP_R - PIP_DEPTH;
  pos = (axis == 0) ? [sign * center, u, v]
      : (axis == 1) ? [u, sign * center, v]
      :               [u, v, sign * center];
  translate(pos) sphere(r = PIP_R, $fn = FN);
}

module pips() {
  for (ai = [0:2]) {
    ax = AXES[ai];
    for (si = [0:1]) {
      sign = SIGNS[si];
      layout = FACE_PIPS[ai][si];
      for (pip = PIP_LAYOUTS[layout - 1]) {
        pip_at(ax, sign, pip[0], pip[1]);
      }
    }
  }
}

difference() {
  body();
  pips();
}