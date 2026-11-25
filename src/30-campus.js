(function (F, T) {
  'use strict';
  const PI = Math.PI,
    H = PI / 2,
    box = F.box,
    cyl = F.cyl,
    rod = F.rod;
  const mat = (c, m = 0.27, r = 0.56, e = 0) => F.mat(c, m, r, e);
  const plate = (s, m, x, y, z, w, h, d, cut = 0.9) => {
    const a = w / 2,
      b = d / 2,
      shape = new T.Shape();
    shape.moveTo(-a + cut, -b);
    shape.lineTo(a - cut, -b);
    shape.lineTo(a, -b + cut);
    shape.lineTo(a, b - cut);
    shape.lineTo(a - cut, b);
    shape.lineTo(-a + cut, b);
    shape.lineTo(-a, b - cut);
    shape.lineTo(-a, -b + cut);
    shape.closePath();
    const g = new T.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-H);
    return F.mesh(s, g, m, x, y, z);
  };
  function marking(s, text, x, y, z, w, h, opts = {}) {
    F.decal(s, text, x, y, z, w, h, { color: '#cdcdbb', ...opts });
  }
  function fan(s, p, x, y, z, r) {
    cyl(s, p.silver, x, y, z, r, r, 0.23);
    cyl(s, p.black, x, y + 0.14, z, r * 0.89, r * 0.89, 0.12);
    for (let i = 0; i < 7; i++) {
      const a = (i * 2 * PI) / 7;
      box(
        s,
        p.steel,
        x + Math.cos(a) * r * 0.49,
        y + 0.23,
        z + Math.sin(a) * r * 0.49,
        r * 0.67,
        0.09,
        r * 0.22,
        0,
        -a - 0.24,
        0
      );
    }
    cyl(s, p.silver, x, y + 0.3, z, r * 0.19, r * 0.19, 0.17, 0, 0, 0, 12);
  }
  function ladder(s, p, x, z, foot, top) {
    for (const dx of [-0.42, 0.42])
      box(s, p.silver, x + dx, (foot + top) / 2, z, 0.085, top - foot, 0.1);
    for (let y = foot + 0.3; y <= top; y += 0.48) box(s, p.steel, x, y, z, 0.88, 0.075, 0.11);
  }
  function guards(s, p, x, z, w, d, y) {
    for (const zn of [z - d / 2, z + d / 2]) {
      for (let xx = x - w / 2; xx < x + w / 2 + 0.3; xx += 2.5)
        box(s, p.steel, xx, y + 0.38, zn, 0.09, 0.78, 0.09);
      box(s, p.silver, x, y + 0.77, zn, w, 0.11, 0.1);
    }
    for (const xx of [x - w / 2, x + w / 2]) box(s, p.silver, xx, y + 0.77, z, 0.1, 0.11, d);
  }
  function palette() {
    return {
      base: mat(0x292e2c, 0.6),
      edge: mat(0x414643, 0.66),
      steel: mat(0x606964, 0.63),
      silver: mat(0xa5aaa0, 0.6, 0.42),
      ivory: mat(0xc0c0ae, 0.36),
      white: mat(0xdad8c6, 0.27),
      clad: mat(0x93998f, 0.42),
      dark: mat(0x414740, 0.42),
      black: mat(0x292f2c, 0.36),
      trim: mat(0x727565, 0.42),
      glass: mat(0x445450, 0.55, 0.23),
      glassLit: mat(0x9fae9b, 0.42, 0.31, 0.1),
      yellow: mat(0xe4bc62, 0.32, 0.38, 0.18),
      lamp: mat(0xe8d9b0, 0.1, 0.45, 0.48),
      ochre: mat(0xa78649, 0.38),
      pipe: mat(0x9a9e8e, 0.62, 0.39)
    };
  }
  function siteMap(s) {
    const c = document.createElement('canvas');
    c.width = 1536;
    c.height = 1024;
    const ctx = c.getContext('2d'),
      w = 105,
      d = 70,
      rng = F.rng(0x324a),
      grain = document.createElement('canvas');
    grain.width = grain.height = 96;
    const nc = grain.getContext('2d'),
      im = nc.createImageData(96, 96);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.round(52 + 11 * rng());
      im.data[i] = v;
      im.data[i + 1] = v + 2;
      im.data[i + 2] = v - 1;
      im.data[i + 3] = 255;
    }
    nc.putImageData(im, 0, 0);
    ctx.fillStyle = ctx.createPattern(grain, 'repeat');
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.setTransform(c.width / w, 0, 0, c.height / d, c.width / 2, c.height / 2);
    const rect = (x, z, ww, dd, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x - ww / 2, z - dd / 2, ww, dd);
    };
    const line = (pts, color, width = 0.1, dash = []) => {
      ctx.beginPath();
      ctx.setLineDash(dash);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      pts.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    // A single surveyed asphalt atlas keeps road paint and ground shadows stable at a distance.
    for (const x of [-38, 22, 44]) rect(x, 0, 5.0, 61, '#252a28');
    for (const z of [-24, 14, 31]) rect(1, z, 87, 4.7, '#252a28');
    for (const x of [-38, 22, 44])
      line(
        [
          [x, -29],
          [x, 29]
        ],
        '#a69d78',
        0.13,
        [1.8, 1.5]
      );
    for (const z of [-24, 14, 31])
      line(
        [
          [-44, z],
          [45, z]
        ],
        '#aaa281',
        0.13,
        [2.1, 1.65]
      );
    for (const z of [-23.2, 13.2, 30.2])
      line(
        [
          [-40, z - 1.4],
          [39, z - 1.4]
        ],
        '#8a8c76',
        0.09
      );
    for (const [x, z, l, dep] of [
      [-7, -3.6, 51, 28],
      [29, -10, 14, 22],
      [28, 22, 14, 12],
      [-28, 23, 14, 10]
    ]) {
      rect(x, z, l + 0.7, dep + 0.7, '#8d8b71');
      rect(x, z, l + 0.34, dep + 0.34, '#6d7065');
      ctx.save();
      ctx.shadowBlur = 13;
      ctx.shadowColor = 'rgba(0,0,0,.75)';
      ctx.shadowOffsetX = 9;
      ctx.shadowOffsetY = -5;
      rect(x, z, l - 0.2, dep - 0.1, '#434840');
      ctx.restore();
    }
    for (let x = -27; x < 17; x += 5.4) {
      line(
        [
          [x, 9.8],
          [x, 11.8],
          [x + 2.8, 11.8],
          [x + 2.8, 9.8]
        ],
        '#c3bc91',
        0.1
      );
    }
    for (let x = -12; x < 12; x += 2.3)
      line(
        [
          [x, 24],
          [x + 1, 21.1],
          [x + 3.0, 21.1]
        ],
        '#b5b8a4',
        0.11
      );
    for (const x of [-38, 22, 43])
      for (let j = 0; j < 6; j++) rect(x - 1.9 + j * 0.74, 17.7, 0.39, 2.0, '#bebda3');
    function arrow(x, z, a) {
      ctx.save();
      ctx.translate(x, z);
      ctx.rotate(a);
      ctx.fillStyle = '#a8a98e';
      ctx.beginPath();
      for (const [i, pt] of [
        [-0.2, 1.25],
        [0.2, 1.25],
        [0.2, -0.2],
        [0.7, -0.2],
        [0, -1.25],
        [-0.7, -0.2],
        [-0.2, -0.2]
      ].entries())
        i ? ctx.lineTo(...pt) : ctx.moveTo(...pt);
      ctx.fill();
      ctx.restore();
    }
    for (const x of [-27, -4, 12, 33]) {
      arrow(x, 14.9, H);
      arrow(x, -23, -H);
    }
    for (const [x, z, label] of [
      [-43, 5, 'N₂'],
      [1, 18, 'TRANSFER ROAD'],
      [31, 29, 'U-02'],
      [-26, 29, 'CF-03']
    ]) {
      ctx.fillStyle = '#bbba9b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 1.12px Consolas,monospace';
      ctx.fillText(label, x, z);
    }
    for (let i = 0; i < 8; i++)
      line(
        [
          [28 + i * 0.8, 13.2],
          [29.3 + i * 0.8, 11.6]
        ],
        '#9b8457',
        0.19
      );
    const g = new T.PlaneGeometry(w, d);
    g.rotateX(-H);
    F.mesh(
      s,
      g,
      new T.MeshStandardMaterial({ map: F.texture(c), roughness: 0.95, metalness: 0.05 }),
      0,
      0.035,
      0
    );
  }
  function mainFab(s, p) {
    const x = -7,
      z = -4,
      w = 49,
      d = 27,
      front = z + d / 2,
      side = x + w / 2;
    box(s, p.black, x, 0.48, z, w + 0.8, 0.9, d + 0.9);
    box(s, p.clad, x, 5.75, z, w, 10.8, d);
    // Glazed inspection gallery, deep projecting mullions and a shaded roof fascia.
    box(s, p.dark, x, 6.2, front + 0.04, w - 0.5, 4.65, 0.2);
    box(s, p.dark, side + 0.05, 6.2, z, 0.2, 4.65, d - 0.4);
    for (let k = 0; k < 17; k++) {
      const xx = x - w / 2 + 1.78 + 2.86 * k,
        glass = k < 6 ? p.yellow : k % 5 === 1 ? p.glassLit : p.glass;
      box(s, glass, xx, 6.12, front + 0.16, 2.62, 3.68, 0.11);
      box(s, p.silver, xx, 6.12, front + 0.24, 0.075, 3.7, 0.12);
      box(s, p.silver, xx + 1.38, 6.12, front + 0.3, 0.18, 4.52, 0.58);
    }
    for (let i = 0; i < 9; i++) {
      const zz = z - d / 2 + 1.6 + i * 2.95;
      box(s, i % 4 === 1 ? p.glassLit : p.glass, side + 0.17, 6.13, zz, 0.12, 3.68, 2.72);
      box(s, p.silver, side + 0.25, 6.15, zz + 1.4, 0.54, 4.52, 0.17);
    }
    for (const y of [4.25, 6.18, 8.02]) {
      box(s, p.black, x, y, front + 0.31, w, 0.15, 0.3);
      box(s, p.black, side + 0.31, y, z, 0.3, 0.15, d);
    }
    for (const y of [3.85, 8.52, 10.93]) {
      box(s, p.silver, x, y, front + 0.28, w + 0.4, 0.17, 0.58);
      box(s, p.silver, side + 0.28, y, z, 0.58, 0.17, d + 0.4);
    }
    box(s, p.white, x, 9.74, front + 0.03, w, 0.96, 0.19);
    for (let xx = x - w / 2 + 0.8; xx < x + w / 2; xx += 2.53)
      box(s, p.trim, xx, 9.67, front + 0.155, 0.075, 1.68, 0.04);
    for (let i = 0; i < 5; i++) {
      const xx = -26.9 + i * 6.2;
      box(s, p.dark, xx, 1.68, front + 0.14, 3.26, 2.77, 0.22);
      for (let j = 0; j < 8; j++) box(s, p.steel, xx, 0.72 + j * 0.28, front + 0.28, 2.91, 0.15, 0.1);
      box(s, p.lamp, xx, 3.29, front + 0.35, 0.57, 0.13, 0.2);
    }
    box(s, p.edge, x, 11.47, z, w + 0.5, 0.53, d + 0.56);
    box(s, p.clad, x, 11.79, z, w - 0.3, 0.19, d - 0.28);
    for (let i = 0; i < 24; i++) box(s, p.silver, -30.8 + i * 2, 11.91, z, 0.055, 0.06, d - 0.72);
    for (const zz of [z - d / 2, z + d / 2]) box(s, p.silver, x, 12.03, zz, w + 0.2, 0.5, 0.3);
    for (const xx of [x - w / 2, x + w / 2]) box(s, p.silver, xx, 12.03, z, 0.28, 0.5, d);
    // The transferable roof panel is clear in the middle. AHUs sit on its service margins.
    for (const xx of [-29.37, 15.65]) {
      for (let i = 0; i < 6; i++) {
        const zz = -14.5 + i * 4.12;
        box(s, p.dark, xx, 12.12, zz, 2.67, 0.37, 3.43);
        box(s, p.ivory, xx, 12.74, zz, 2.42, 1.04, 3.14);
        box(s, p.steel, xx, 13.27, zz, 2.42, 0.15, 3.17);
        fan(s, p, xx, 13.4, zz, 0.85);
      }
    }
    for (let i = 0; i < 3; i++)
      rod(
        s,
        p.pipe,
        [-25.8, 12.26 + i * 0.04, -16.9 - i * 0.23],
        [12, 12.26 + i * 0.04, -16.9 - i * 0.23],
        0.12
      );
    const rooftop = new T.Group(),
      rs = { root: rooftop, batches: new Map() };
    s.root.add(rooftop);
    for (const xx of [-19, -9.7, -0.4, 8.7])
      for (const zz of [-10.8, -4.5]) {
        box(rs, p.edge, xx, 12.07, zz, 6.64, 0.2, 3.7);
        box(rs, p.steel, xx, 12.68, zz, 6.12, 0.97, 3.18);
        box(rs, p.clad, xx, 13.28, zz, 6.22, 0.3, 3.26);
        for (const dx of [-1.52, 1.52]) {
          cyl(rs, p.dark, xx + dx, 13.49, zz, 1.24, 1.24, 0.15, 0, 0, 0, 24);
          fan(rs, p, xx + dx, 13.57, zz, 1.18);
        }
        for (let j = 0; j < 9; j++)
          box(rs, p.dark, xx - 2.69 + j * 0.66, 12.72, zz + 1.61, 0.31, 0.68, 0.08);
      }
    for (let i = 0; i < 3; i++) {
      const zz = -7.62 + i * 0.32;
      rod(rs, p.pipe, [-24.2, 12.29, zz], [11.8, 12.29, zz], 0.12);
      for (let j = 0; j < 8; j++)
        cyl(rs, p.steel, -22 + j * 4.4, 12.29, zz, 0.17, 0.17, 0.12, 0, 0, H, 12);
    }
    box(rs, p.dark, -3.9, 12.005, 3.59, 15.9, 0.1, 4.31);
    const sign = F.decal(rs, 'FAB  02', -3.9, 12.068, 3.59, 13.55, 3.13, { rx: -H, color: '#d3c396' });
    for (let i = 0; i < 8; i++)
      box(rs, p.ochre, 5.7 + i * 0.46, 12.015, 2.15, 0.24, 0.09, 2.21, 0, -0.44, 0);
    F.flush(rs);
    // Services on the removable roof cassette recede with the inspection cover.
    s.anim.push((t, progress) => {
      const lift = F.smooth((progress - 0.66) / 0.18);
      rooftop.position.y = -2.12 * lift;
      rooftop.visible = lift < 0.995;
      sign.visible = lift < 0.85;
    });
    marking(s, 'DF–02    /    FAB', -17.2, 9.65, front + 0.19, 12.6, 1.43, {
      bg: '#767d72',
      color: '#eff1db'
    });
    marking(s, '02', side + 0.19, 9.68, 1.2, 4.0, 1.72, { ry: H, color: '#424940' });
    ladder(s, p, 13.9, front + 0.76, 0.24, 11.91);
  }
  function coolingPlant(s, p) {
    const x = 30,
      z = -9;
    box(s, p.edge, x, 0.44, z, 14, 0.77, 22);
    box(s, p.ivory, x, 3.06, z, 13.1, 4.62, 20.8);
    for (let i = 0; i < 8; i++) {
      const zz = -17.85 + i * 2.6;
      box(s, p.dark, 36.62, 3.03, zz, 0.15, 3.15, 2.38);
      for (let k = 0; k < 6; k++) box(s, p.steel, 36.73, 1.86 + k * 0.46, zz, 0.25, 0.19, 2.21);
    }
    box(s, p.steel, x, 5.58, z, 13.85, 0.58, 21.38);
    for (const xx of [27.1, 32.8])
      for (const zz of [-15.55, -9.05, -2.55]) {
        box(s, p.black, xx, 5.96, zz, 4.9, 0.44, 5.38);
        box(s, p.clad, xx, 6.85, zz, 4.42, 1.52, 4.93);
        for (let k = 0; k < 5; k++) box(s, p.dark, xx, 6.24 + k * 0.25, zz + 2.49, 4.01, 0.105, 0.12);
        cyl(s, p.silver, xx, 7.76, zz, 2.01, 2.18, 0.62, 0, 0, 0, 24);
        fan(s, p, xx, 8.07, zz, 2.0);
      }
    box(s, p.clad, 30, 3.08, 1.58, 13.1, 4.55, 0.16);
    for (let i = 0; i < 12; i++) box(s, p.dark, 24.25 + i * 1.03, 2.7, 1.75, 0.52, 2.75, 0.12);
    marking(s, 'UTILITY  /  02', 30, 4.87, 1.72, 8, 0.77, { bg: '#576058', color: '#e3ddc6' });
    ladder(s, p, 35.6, 1.88, 0.4, 5.8);
    for (let i = 0; i < 3; i++) {
      const zz = -22.6 - i * 0.52;
      rod(s, p.pipe, [-31, 4.25, zz], [24, 4.25, zz], 0.24);
      rod(s, p.pipe, [24, 4.25, zz], [24, 4.25, -8 + i * 0.6], 0.24);
      for (let xx = -29; xx < 23; xx += 4.8)
        cyl(s, p.steel, xx, 4.25, zz, 0.31, 0.31, 0.14, 0, 0, H, 12);
    }
    for (let xx = -30; xx <= 25; xx += 6) {
      for (const zz of [-23.9, -21.8]) box(s, p.dark, xx, 2.0, zz, 0.3, 3.92, 0.32);
      box(s, p.steel, xx, 3.88, -22.8, 0.47, 0.31, 2.7);
    }
    for (const xx of [26, 29.1, 32.2]) {
      cyl(s, p.dark, xx, 1.12, -26, 1.47, 1.47, 2.05);
      cyl(s, p.ivory, xx, 7.36, -26, 0.72, 0.82, 10.47, 0, 0, 0, 20);
      for (const y of [3.1, 7.55, 11.88]) cyl(s, p.steel, xx, y, -26, 0.91, 0.91, 0.24, 0, 0, 0, 20);
      cyl(s, p.black, xx, 12.67, -26, 0.69, 0.69, 0.1, 0, 0, 0, 20);
    }
  }
  function gasFarm(s, p) {
    const profile = [
      [0, -0.5],
      [0.55, -0.48],
      [0.82, -0.43],
      [0.97, -0.36],
      [1, -0.29],
      [1, 0.31],
      [0.97, 0.38],
      [0.83, 0.445],
      [0.56, 0.482],
      [0.18, 0.5],
      [0, 0.5]
    ];
    const vessel = new T.LatheGeometry(
      profile.map((v) => new T.Vector2(...v)),
      28
    );
    const rows = [];
    for (const x of [25.35, 30.15, 34.95])
      for (const z of [18.75, 23.9]) {
        box(s, p.edge, x, 0.39, z, 4.32, 0.65, 4.4);
        for (const dx of [-0.93, 0.93]) box(s, p.steel, x + dx, 1.19, z, 0.33, 1.4, 1.21);
        rows.push([x, 4.61, z, 1.78, 6.71, 1.78]);
        cyl(s, p.steel, x, 7.98, z, 0.43, 0.43, 0.27);
        for (const y of [2.42, 6.82]) cyl(s, p.clad, x, y, z, 1.795, 1.795, 0.14, 0, 0, 0, 28);
        rod(s, p.pipe, [x + 1.83, 1.16, z], [x + 1.83, 7.35, z], 0.11);
        rod(s, p.pipe, [x + 1.83, 1.16, z], [x + 2.29, 1.16, 26.2], 0.11);
      }
    F.inst(s, vessel, p.white, rows);
    for (let i = 0; i < 2; i++)
      rod(s, p.silver, [23, 1.1 + i * 0.34, 26.3], [37.5, 1.1 + i * 0.34, 26.3], 0.18);
    guards(s, p, 30.0, 21.2, 15.7, 12.6, 0.1);
  }
  function support(s, p) {
    // Louvred electrical substation, miniature loading vehicles and a utility yard.
    const x = -27,
      z = 22;
    box(s, p.edge, x, 0.42, z, 15.9, 0.7, 9.5);
    box(s, p.clad, x, 2.29, z, 15, 3.41, 8.68);
    box(s, p.steel, x, 4.12, z, 15.9, 0.42, 9.39);
    for (let i = 0; i < 4; i++) {
      const xx = x - 5.65 + i * 3.78;
      box(s, p.dark, xx, 2.28, z + 4.41, 3.22, 2.4, 0.18);
      for (let j = 0; j < 5; j++) box(s, p.steel, xx, 1.4 + j * 0.43, z + 4.54, 2.86, 0.16, 0.15);
      box(s, p.ivory, xx, 4.62, z, 2.83, 0.64, 4.58);
      fan(s, p, xx, 5.02, z, 1.06);
    }
    for (let i = 0; i < 4; i++) {
      const xx = -28 + i * 6.15,
        zz = 11.25;
      box(s, p.dark, xx, 0.43, zz, 1.51, 0.31, 3.98);
      box(s, i % 2 ? p.clad : p.white, xx, 1.03, zz - 0.51, 1.57, 1.21, 2.85);
      box(s, p.ivory, xx, 0.87, zz + 1.36, 1.59, 0.94, 0.92);
      box(s, p.glass, xx, 1.08, zz + 1.84, 1.32, 0.43, 0.06);
      for (const dx of [-0.79, 0.79])
        for (const dz of [-1.21, 1.27])
          cyl(s, p.black, xx + dx, 0.34, zz + dz, 0.3, 0.3, 0.18, 0, 0, H, 10);
    }
    for (let i = 0; i < 7; i++) {
      const xx = -11 + i * 3.12,
        zz = 22.6;
      box(s, p.black, xx, 0.34, zz, 1.26, 0.39, 2.42);
      box(s, i % 3 ? p.silver : p.dark, xx, 0.66, zz - 0.1, 1.2, 0.42, 2.05);
      box(s, p.glass, xx, 0.91, zz - 0.05, 0.98, 0.16, 1.12);
    }
    for (const xx of [-18, -12, -6, 0, 6, 12]) {
      box(s, p.dark, xx, 1.18, -28.75, 4.86, 2.12, 5.31);
      for (let i = 0; i < 7; i++) box(s, p.silver, xx - 1.91 + i * 0.64, 2.54, -28.75, 0.34, 0.83, 4.65);
      for (const zz of [-30.1, -27.4]) cyl(s, p.ivory, xx, 3.23, zz, 0.38, 0.38, 0.81, 0, 0, 0, 12);
    }
    for (const [xx, zz] of [
      [-42, -23],
      [-40, 15],
      [19, 10],
      [42, -18],
      [42, 25],
      [-17, 30],
      [9, -27]
    ]) {
      cyl(s, p.dark, xx, 2.97, zz, 0.115, 0.145, 5.84, 0, 0, 0, 8);
      box(s, p.steel, xx + 0.5, 5.91, zz, 1.13, 0.14, 0.17);
      box(s, p.lamp, xx + 1.04, 5.8, zz, 0.68, 0.13, 0.39);
    }
  }
  function landscaping(s, p) {
    const rng = F.rng(742),
      buds = [[], []],
      leaf = new T.IcosahedronGeometry(1, 1);
    const groves = [];
    for (let i = 0; i < 13; i++) groves.push([-48 + (i % 2) * 1.02, -27 + i * 4.5]);
    for (let i = 0; i < 9; i++) groves.push([-34 + i * 4.0, 32.9 + (i % 2) * 0.65]);
    for (let i = 0; i < 5; i++) groves.push([45.4, -29 + i * 5.1]);
    for (const [x, z] of groves) {
      const sc = 0.72 + rng() * 0.54;
      box(s, p.dark, x, 0.13, z, 2.06, 0.18, 2.1);
      cyl(s, p.trim, x, 1.32 * sc, z, 0.12 * sc, 0.22 * sc, 2.48 * sc, 0, 0, 0, 8);
      for (let k = 0; k < 10; k++) {
        const a = k * 2.4 + rng() * 0.39,
          rad = k === 0 ? 0.15 : sc * (0.46 + rng() * 0.56);
        const r = sc * (0.69 + rng() * 0.43);
        buds[k % 3 ? 0 : 1].push([
          x + Math.cos(a) * rad,
          sc * (2.86 + rng() * 0.82),
          z + Math.sin(a) * rad,
          r,
          1.05 * r,
          r * 0.91,
          0,
          a,
          0
        ]);
      }
    }
    F.inst(s, leaf, mat(0x474e3c, 0.02, 0.94), buds[0]);
    F.inst(s, leaf, mat(0x5b6147, 0.02, 0.93), buds[1]);
    for (const zz of [-33.8, 34.2]) {
      for (let xx = -48; xx < 50; xx += 4.2) box(s, p.steel, xx, 0.74, zz, 0.16, 1.47, 0.16);
      for (const y of [0.48, 1.16]) box(s, p.trim, 0, y, zz, 97.3, 0.11, 0.12);
    }
    for (const xx of [-50, 49]) {
      for (let zz = -32; zz < 32; zz += 4.3) box(s, p.steel, xx, 0.75, zz, 0.16, 1.47, 0.16);
      box(s, p.trim, xx, 1.15, 0, 0.12, 0.12, 65);
    }
  }
  F.define(0, (s) => {
    const p = palette();
    plate(s, p.black, 0, -2.15, 0, 109, 1.05, 74, 3.4);
    plate(s, p.edge, 0, -1.17, 0, 109.6, 0.74, 74.6, 3.55);
    plate(s, p.base, 0, -0.46, 0, 108.7, 0.47, 73.65, 3.1);
    siteMap(s);
    mainFab(s, p);
    coolingPlant(s, p);
    gasFarm(s, p);
    support(s, p);
    landscaping(s, p);
    marking(s, 'DF–02    /    300 MM LOGIC FAB', -5, -0.62, 37.13, 25, 0.62, { color: '#b4b9a8' });
    for (let i = 0; i < 8; i++) box(s, p.trim, -42 + i * 12, -0.6, 37.16, 1.7, 0.11, 0.08);
    F.dataLine(
      s,
      [
        [-27, 1.5, 22],
        [-20, 1.5, 22],
        [-20, 0.5, 14],
        [-8, 0.5, 14],
        [-8, 3.5, 9.7]
      ],
      'power'
    );
    F.dataLine(
      s,
      [
        [29, 4, -7],
        [20.4, 4, -7],
        [20.4, 4, -19],
        [-4, 4, -19],
        [-4, 4, -16]
      ],
      'water'
    );
    F.dataLine(
      s,
      [
        [30, 1.6, 23.5],
        [39, 1.6, 23.5],
        [39, 1.6, 5],
        [17.5, 1.6, 5]
      ],
      'gas'
    );
    F.dataLine(
      s,
      [
        [-28, 8.4, -16],
        [-28, 5.8, -21.4],
        [26, 5.8, -21.4],
        [26, 12.8, -26]
      ],
      'exhaust'
    );
    s.labels.push(
      {
        pos: [-14, 12.4, 2],
        zh: '主洁净厂房',
        en: 'FAB  /  01',
        value: (t) => F.SIM.read(t).temp.toFixed(1) + ' °C'
      },
      {
        pos: [30, 8.5, -8],
        zh: '中央供能站',
        en: 'CUP  /  02',
        value: (t) => F.SIM.read(t).mw.toFixed(1) + ' MW'
      },
      { pos: [31, 7.9, 20], zh: '高纯特气站', en: 'GAS  /  03', value: 'N₂ · Ar' },
      { pos: [-29, 5.4, 22], zh: '动力变配电', en: 'POWER  /  04', value: '110 kV' }
    );
  });
  F.define(1, (s) => {
    const p = palette(),
      floor = mat(0xc6c8ba, 0.26, 0.52),
      warm = mat(0xcdad67, 0.3, 0.5),
      filter = mat(0xbfc7b4, 0.17, 0.56, 0.16),
      strip = mat(0xdedec5, 0.12, 0.42, 0.5);
    plate(s, p.black, 0, -0.77, 0, 54.8, 0.58, 29.2, 1.15);
    plate(s, p.edge, 0, -0.19, 0, 54.3, 0.48, 28.7, 1.04);
    box(s, p.steel, 0, 0.42, 0, 51.75, 0.36, 25.57);
    box(s, p.black, 0, 4.21, 0, 51.3, 0.67, 25.02);
    box(s, floor, 0, 4.64, 0, 51.35, 0.28, 25.08);
    box(s, p.edge, 0, 12.37, -7.63, 51.6, 0.45, 9.8);
    for (const xx of [-22.6, 22.6]) box(s, p.edge, xx, 12.37, 4.42, 6.5, 0.45, 14.5);
    // Roof and service return are opened on their camera-facing sides like a section model.
    box(s, p.clad, 0, 14.1, -10.18, 50.7, 2.7, 4.9);
    box(s, p.white, 0, 8.62, -12.2, 50.8, 7.7, 0.33);
    box(s, p.clad, -25.08, 8.75, -2.66, 0.33, 7.74, 18.48);
    for (let xx = -23.8; xx < 25; xx += 2.76) {
      box(s, p.silver, xx, 8.61, -11.99, 0.07, 7.33, 0.13);
      box(s, p.trim, xx, 14.45, -7.7, 0.066, 1.66, 0.08);
    }
    const topRail = (y, depth) => {
      for (const zz of [-12.38, 12.27]) box(s, p.steel, 0, y, zz, 51.75, 0.37, depth);
    };
    for (const y of [0.88, 4.27, 12.44, 15.71]) topRail(y, 0.49);
    for (const x of [-25.26, 25.26]) {
      for (const z of [-12.25, -5.0, 3.4, 12.18]) {
        box(s, p.steel, x, 7.93, z, 0.52, 15.4, 0.64);
        for (const y of [0.78, 4.37, 12.38, 15.66]) box(s, p.silver, x, y, z, 0.83, 0.25, 0.91);
      }
      for (const y of [4.29, 12.38, 15.7]) box(s, p.silver, x, y, 0, 0.57, 0.31, 25.04);
    }
    for (const x of [-19, -12.6, -6.3, 0, 6.3, 12.6, 19]) {
      box(s, p.steel, x, 2.38, 12.2, 0.31, 3.36, 0.41);
      box(s, p.clad, x, 13.82, 12.2, 0.28, 2.66, 0.43);
    }
    for (let xx = -24.2; xx < 26; xx += 4.6) {
      box(s, p.ivory, xx, 12.58, -0.15, 0.23, 0.5, 24.4);
      box(s, p.white, xx, 4.82, 0.15, 0.055, 0.025, 24.2);
    }
    for (let zz = -10; zz < 13; zz += 3.0) box(s, p.silver, 0, 4.827, zz, 50, 0.025, 0.045);
    // Subfab pumps, exhaust manifolds, flanged process-water mains and cable trays.
    for (let i = 0; i < 10; i++) {
      const xx = -22.6 + i * 5.04;
      for (const zz of [-7.4, 2.65]) {
        box(s, p.dark, xx, 0.91, zz, 3.85, 0.39, 4.2);
        box(s, p.clad, xx, 1.75, zz - 1.03, 2.9, 1.36, 1.45);
        cyl(s, p.silver, xx - 0.89, 1.74, zz + 0.71, 0.7, 0.7, 1.17, H, 0, 0, 16);
        cyl(s, p.edge, xx + 0.24, 1.76, zz + 0.57, 0.48, 0.48, 1.38, 0, 0, H, 16);
        for (let n = 0; n < 5; n++)
          box(s, p.steel, xx - 0.97 + n * 0.37, 2.48, zz - 1.02, 0.18, 0.19, 1.34);
      }
      box(s, p.black, xx, 3.68, 1, 0.17, 0.22, 23);
    }
    box(s, p.dark, 0, 2.3, -11.68, 50, 3.24, 0.31);
    for (let i = 0; i < 4; i++) {
      const zz = 10.23 + i * 0.78,
        yy = 1.21 + i * 0.54;
      rod(s, i % 2 ? p.clad : p.pipe, [-24.5, yy, zz], [24.5, yy, zz], 0.29);
      for (let xx = -22; xx < 25; xx += 4.75) cyl(s, p.steel, xx, yy, zz, 0.38, 0.38, 0.14, 0, 0, H, 12);
    }
    for (let i = 0; i < 7; i++) {
      const xx = -21 + i * 6.7;
      box(s, p.dark, xx, 0.59, 13.0, 2.68, 0.37, 1.05);
      cyl(s, p.silver, xx, 1.19, 13.0, 0.5, 0.5, 2.12, 0, 0, H, 16);
      cyl(s, p.ochre, xx, 1.84, 13.0, 0.18, 0.18, 0.65);
      cyl(s, p.steel, xx, 2.19, 13.0, 0.43, 0.43, 0.12);
    }
    // Repeated process bays are visible across the lit slice, with a filtered yellow photobay.
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 3; j++) {
        const xx = -21.3 + i * 6.95,
          zz = -7.95 + j * 6.18,
          yellow = i < 3,
          skin = yellow ? warm : p.white;
        box(s, p.dark, xx, 5.07, zz, 4.05, 0.49, 4.21);
        box(s, skin, xx, 6.92, zz - 0.22, 3.84, 3.35, 3.61);
        box(s, p.ivory, xx - 0.65, 8.8, zz - 0.72, 2.51, 0.5, 2.95);
        box(s, yellow ? p.yellow : p.glassLit, xx, 7.48, zz + 1.63, 2.95, 1.02, 0.1);
        box(s, p.silver, xx + 0.91, 6.36, zz + 1.73, 0.1, 1.29, 0.12);
        box(s, p.steel, xx - 1.08, 5.75, zz + 2.1, 1.17, 0.48, 0.7);
        box(s, p.dark, xx - 1.08, 6.11, zz + 2.15, 0.83, 0.33, 0.49);
      }
    for (let xx = -23; xx < 25; xx += 4.28)
      for (const zz of [-7.64, -0.28, 6.95]) {
        if (zz > 0 && Math.abs(xx) < 16) continue;
        box(s, p.silver, xx, 12.16, zz, 3.95, 0.17, 4.61);
        box(s, xx < -6 ? p.yellow : filter, xx, 12.04, zz, 3.44, 0.13, 4.06);
        for (const dx of [-1.55, 1.55])
          box(s, xx < -6 ? p.yellow : strip, xx + dx, 11.93, zz, 0.13, 0.14, 3.84);
      }
    for (const z of [-5.6, 0.1, 6.1])
      for (let j = 0; j < 4; j++) {
        const xx = -19 + j * 12.5;
        if (z > 0 && Math.abs(xx) < 10) continue;
        box(s, p.dark, xx, 13.24, z, 8.82, 0.58, 2.07);
        for (let n = 0; n < 7; n++) box(s, p.silver, xx - 3.7 + n * 1.22, 13.65, z, 0.15, 0.29, 2.05);
      }
    for (let j = 0; j < 10; j++) {
      const xx = -22.5 + j * 5.03;
      box(s, p.edge, xx, 15.42, -9.53, 4.46, 0.38, 3.72);
      box(s, p.clad, xx, 15.75, -9.53, 4.05, 0.43, 3.42);
      fan(s, p, xx, 16.02, -9.53, 1.18);
    }
    // Exposed RHS frame, bracing and a narrow service stair establish the scale.
    for (const zz of [-8.65, -0.8, 8.1]) {
      rod(s, p.steel, [25.65, 4.83, zz - 3.3], [25.65, 12.05, zz + 3.3], 0.16);
      rod(s, p.steel, [25.65, 12.05, zz - 3.3], [25.65, 4.83, zz + 3.3], 0.16);
    }
    for (let n = 0; n < 15; n++)
      box(s, p.silver, 23.48 - n * 0.42, 0.8 + n * 0.267, 13.08, 1.07, 0.19, 1.6);
    rod(s, p.steel, [23.48, 1.83, 13.82], [17.5, 5.58, 13.82], 0.085);
    const glass = new T.MeshPhysicalMaterial({
      color: 0x889b88,
      transparent: true,
      opacity: 0.19,
      roughness: 0.19,
      metalness: 0.22,
      depthWrite: false
    });
    for (const xx of [-18.2, 19]) {
      box(s, glass, xx, 8.4, 12.0, 10.6, 5.74, 0.13);
      for (let k = 0; k < 5; k++) box(s, p.silver, xx - 4.72 + k * 2.35, 8.53, 12.16, 0.13, 6.9, 0.28);
      box(s, p.silver, xx, 8.7, 12.2, 10.74, 0.15, 0.28);
    }
    for (const [x, w, light] of [
      [-18.9, 12.0, p.yellow],
      [8.7, 28.6, strip]
    ]) {
      box(s, light, x, 11.69, -11.81, w, 0.22, 0.19);
      box(s, light, x, 11.82, 11.89, w, 0.18, 0.22);
    }
    const yellowLight = new T.PointLight(0xffc94d, 135, 22, 2);
    yellowLight.position.set(-15.6, 10.8, 4);
    s.root.add(yellowLight);
    for (const [y, title] of [
      [2.2, '01  /  SUBFAB'],
      [8.0, '02  /  CLEAN BAY'],
      [13.93, '03  /  AIR PLENUM']
    ]) {
      box(s, p.dark, -21.38, y, 12.64, 7.6, 1.06, 0.1);
      marking(s, title, -21.38, y, 12.72, 7.04, 0.77, { color: '#e9e6cc' });
    }
    F.dataLine(
      s,
      [
        [-23.1, 2.1, 9.35],
        [22.6, 2.1, 9.35],
        [22.6, 8.3, 9.35],
        [18.2, 8.3, 9.35]
      ],
      'water'
    );
    F.dataLine(
      s,
      [
        [-23, 1.6, -3.4],
        [-13, 1.6, -3.4],
        [-13, 7.3, -3.4],
        [-5, 7.3, -3.4]
      ],
      'gas'
    );
    F.dataLine(
      s,
      [
        [23.3, 0.95, 11.8],
        [23.3, 10.89, 11.8],
        [4, 10.89, 11.8]
      ],
      'power'
    );
    F.dataLine(
      s,
      [
        [-18, 7.6, 0],
        [-18, 14.3, 0],
        [-18, 14.3, -8],
        [18, 14.3, -8]
      ],
      'exhaust'
    );
    s.labels.push(
      { pos: [-10, 8.8, 5], zh: '黄光工艺区', en: 'PHOTOLITHOGRAPHY', value: '±0.1 °C' },
      { pos: [11, 12.04, 2], zh: '风机过滤单元', en: 'FFU / PLENUM', value: '0.38 m/s' },
      { pos: [8, 2.0, 10], zh: '下技术夹层', en: 'SUBFAB RETURN', value: '18.2 MΩ·cm' }
    );
  });
})(F, THREE);
