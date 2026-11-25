(function (F, T) {
  'use strict';
  const PI = Math.PI,
    H = PI / 2,
    box = F.box,
    cyl = F.cyl,
    rod = F.rod;
  function grating(s, x, w, warm) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    const c = canvas.getContext('2d');
    c.fillStyle = warm ? '#b8ad8c' : '#b4bdb1';
    c.fillRect(0, 0, 192, 192);
    c.strokeStyle = warm ? '#79715a' : '#737b71';
    c.lineWidth = 3;
    c.strokeRect(1.5, 1.5, 189, 189);
    c.strokeStyle = warm ? '#ddd0a9' : '#d7dfd2';
    c.lineWidth = 2;
    c.strokeRect(5, 5, 181, 181);
    for (let j = 0; j < 7; j++)
      for (let i = 0; i < 7; i++) {
        const xx = 22 + i * 24.5,
          yy = 22 + j * 24.5;
        c.fillStyle = warm ? '#d1c298' : '#d1d8cb';
        c.beginPath();
        c.arc(xx, yy + 1.4, 4.75, 0, 2 * PI);
        c.fill();
        c.fillStyle = warm ? '#756e55' : '#778074';
        c.beginPath();
        c.arc(xx, yy, 4.1, 0, 2 * PI);
        c.fill();
      }
    const tex = F.texture(canvas);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(w / 2.35, 34.6 / 2.35);
    const geom = new T.PlaneGeometry(w, 34.6);
    geom.rotateX(-H);
    F.mesh(
      s,
      geom,
      new T.MeshStandardMaterial({ map: tex, roughness: 0.56, metalness: 0.27 }),
      x,
      0.045,
      0.4
    );
  }
  function palette() {
    const m = F.mat;
    return {
      skirt: m(0x494f49, 0.45, 0.59),
      dark: m(0x303632, 0.55, 0.4),
      frame: m(0x68736b, 0.59, 0.46),
      metal: m(0xa5ada1, 0.62, 0.35),
      white: m(0xd1d2bf, 0.24, 0.47),
      edge: m(0xe4e1ce, 0.27, 0.43),
      warm: m(0xceac68, 0.24, 0.5),
      amber: m(0xf2be4f, 0.18, 0.43, 0.22),
      yellow: m(0xffcf5e, 0.18, 0.4, 0.47),
      lit: m(0xe6e8d3, 0.12, 0.42, 0.46),
      glass: m(0x414e48, 0.58, 0.23),
      lcd: m(0x9cab91, 0.21, 0.35, 0.16),
      mark: m(0xb8ab7c, 0.28, 0.6),
      black: m(0x222a25, 0.28, 0.6)
    };
  }
  function envelope(s, p) {
    box(s, p.dark, 0, -1.02, 0.4, 54.5, 0.52, 36.2);
    box(s, p.frame, 0, -0.57, 0.4, 54.0, 0.46, 35.8);
    box(s, p.white, 0, -0.24, 0.4, 53.25, 0.37, 34.95);
    grating(s, -16.25, 20.5, true);
    grating(s, 10.25, 32.5, false);
    for (let n = 0; n < 30; n++) box(s, p.dark, -25.6 + n * 1.76, -0.48, 18.26, 0.95, 0.29, 0.13);
    for (let n = 0; n < 18; n++) box(s, p.dark, 26.94, -0.48, -15.7 + n * 1.83, 0.13, 0.28, 0.99);
    for (let i = 0; i < 18; i++) {
      const x = -25.1 + i * 2.94;
      box(s, i < 7 ? p.warm : p.white, x, 5.74, -16.93, 2.88, 11.46, 0.37);
      box(s, p.metal, x + 1.46, 5.75, -16.67, 0.058, 11.37, 0.11);
      box(s, p.skirt, x, 1.27, -16.68, 2.67, 1.62, 0.13);
      for (let k = 0; k < 5; k++) box(s, p.metal, x, 0.7 + k * 0.23, -16.55, 2.37, 0.07, 0.07);
    }
    for (const x of [-26.22, 26.22]) {
      box(s, p.frame, x, 1.42, -1.1, 0.4, 2.76, 31.3);
      for (let z = -13.9; z < 16; z += 4.8) {
        box(s, p.metal, x, 5.7, z, 0.43, 11.27, 0.47);
        box(s, p.white, x, 1.33, z + 1.72, 0.46, 2.52, 2.95);
      }
      box(s, p.frame, x, 11.51, -0.72, 0.58, 0.54, 32.4);
    }
    box(s, p.frame, 0, 11.59, -16.43, 53.0, 0.67, 0.76);
    box(s, p.metal, 0, 11.69, -7.1, 52.5, 0.38, 0.4);
    for (let i = 0; i < 10; i++) {
      const x = -23.9 + i * 5.22;
      box(s, p.metal, x, 11.46, -9.0, 0.23, 0.39, 15.6);
      for (const z of [-12.6, -6.3, 1.0, 8.25]) {
        // The missing central ceiling bays expose the FOUP path and its load port.
        if (z > 0 && Math.abs(x) < 17) continue;
        box(s, p.frame, x, 11.66, z, 4.94, 0.38, 5.4);
        box(s, p.white, x, 11.83, z, 4.67, 0.2, 5.12);
        box(s, x < -6 ? p.amber : p.lit, x, 11.4, z, 4.55, 0.18, 4.84);
        for (let j = 0; j < 9; j++) box(s, p.metal, x - 1.83 + j * 0.45, 11.31, z, 0.044, 0.08, 4.63);
        for (const dx of [-2.12, 2.12])
          box(s, x < -6 ? p.yellow : p.lit, x + dx, 11.28, z, 0.13, 0.12, 4.79);
      }
    }
    // Open plenum at the back: supply trunk, flexible drop ducts and hygienic wall returns.
    for (const y of [9.2, 9.79]) rod(s, p.metal, [-25, y, -16.35], [25, y, -16.35], 0.21, 12);
    for (let i = 0; i < 7; i++) {
      const x = -21.7 + i * 7.23;
      cyl(s, p.frame, x, 8.12, -15.87, 0.37, 0.37, 2.24, 0, 0, 0, 16);
      for (let k = 0; k < 5; k++)
        cyl(s, p.metal, x, 7.23 + k * 0.44, -15.87, 0.44, 0.44, 0.1, 0, 0, 0, 16);
    }
    for (const [x, w, yellow] of [
      [-16.4, 19.2, true],
      [10.2, 32.2, false]
    ]) {
      box(s, yellow ? p.yellow : p.lit, x, 10.72, -16.52, w, 0.27, 0.29);
      const lamp = new T.PointLight(
        yellow ? 0xffbe35 : 0xf1f0d5,
        yellow ? 250 : 120,
        yellow ? 27 : 23,
        2
      );
      lamp.position.set(x, 9.25, -0.3);
      s.root.add(lamp);
    }
    for (const [x, z] of [
      [-18, 3],
      [4, 8.6],
      [14, -2]
    ]) {
      for (const dx of [-1, 1]) box(s, p.mark, x + dx * 0.52, 0.073, z, 0.09, 0.026, 4.66);
    }
    F.decal(s, 'A-04', -6.1, 0.081, 7.81, 3.65, 1.15, { rx: -H, color: '#5e644d' });
    F.decal(s, '02   /   YELLOW BAY', -17.4, 9.08, -16.55, 12.85, 1.27, {
      bg: '#a18a51',
      color: '#fcdf95'
    });
    F.decal(s, 'CLEAN  /  04', 14.48, 9.07, -16.51, 12, 1.22, { color: '#4c584e' });
  }
  function scanner(s, p) {
    const x = -9,
      z = -9.81;
    box(s, p.dark, x, 0.49, z, 14.65, 0.77, 9.05);
    box(s, p.metal, x, 0.97, z, 14.38, 0.22, 8.77);
    box(s, p.warm, x, 4.43, z, 13.93, 6.76, 8.55);
    box(s, p.frame, x, 8.13, z, 14.16, 0.54, 8.48);
    box(s, p.metal, x, 8.48, z - 0.28, 13.8, 0.26, 7.62);
    for (const dx of [-3.36, 3.36]) {
      box(s, p.edge, x + dx, 4.86, -5.42, 6.29, 5.64, 0.22);
      box(s, p.warm, x + dx, 4.93, -5.25, 5.86, 5.21, 0.14);
      box(s, p.glass, x + dx, 6.09, -5.12, 4.81, 1.3, 0.17);
      for (let i = 0; i < 4; i++)
        box(s, p.metal, x + dx - 1.77 + i * 0.93, 6.1, -5.015, 0.045, 1.11, 0.055);
      box(s, p.dark, x + dx + 2.29, 3.52, -5.11, 0.17, 1.26, 0.13);
      box(s, p.yellow, x + dx, 7.41, -5.1, 4.9, 0.14, 0.14);
    }
    box(s, p.frame, x, 3.18, -3.62, 4.07, 0.52, 2.71);
    box(s, p.white, x, 2.07, -3.8, 3.32, 2.02, 2.41);
    box(s, p.dark, x, 3.5, -3.3, 2.63, 0.16, 1.98);
    for (const xx of [-14.1, -10.9, -7.7, -4.5]) {
      box(s, p.dark, xx, 8.67, z - 0.84, 2.47, 0.31, 3.39);
      for (let i = 0; i < 6; i++) box(s, p.metal, xx, 8.87, z - 2.15 + i * 0.49, 2.14, 0.17, 0.16);
    }
    for (const xx of [-14.9, -13.7]) {
      cyl(s, p.metal, xx, 8.85, -12.56, 0.38, 0.38, 1.75, 0, 0, 0, 16);
      rod(s, p.frame, [xx, 9.62, -12.55], [xx, 9.62, -16.43], 0.37, 16);
    }
    F.decal(s, 'A7 / LITHO', -6.3, 7.01, -5.03, 3.43, 0.67, { bg: '#766b4d', color: '#f3dea4' });
  }
  const cells = [
    [-9, -9.8],
    [-21.64, -12.24],
    [-21.64, -6.15],
    [-21.6, 0.05],
    [-21.65, 6.05],
    [-20.4, 12.34],
    [-14.5, 11.67],
    [-5.9, 12.75],
    [0.1, 12.5],
    [6.0, 12.5],
    [12.2, 12.5],
    [19.3, 12.35],
    [20.6, 4.6],
    [14.52, 4.75],
    [8.17, 4.71],
    [2.24, 4.65],
    [-15.91, 1.14],
    [-8.66, 1.95],
    [2.06, -3.15],
    [9.0, -3.15],
    [16.24, -3.15],
    [2.77, -11.08],
    [10.11, -11.06],
    [18.16, -11.0]
  ];
  function station(s, p, id, x, z) {
    const compact = z > 8,
      h = compact ? 3.0 + (id % 3) * 0.27 : 4.54 + (id % 4) * 0.3,
      wide = id % 3 === 1 ? 3.55 : 4.04;
    const depth = compact ? 2.55 : 3.46,
      front = z + depth * 0.5,
      skin = x < -5 ? p.warm : p.white;
    box(s, p.dark, x, 0.39, z, wide + 0.15, 0.57, depth + 0.2);
    box(s, skin, x, h / 2 + 0.55, z, wide, h - 0.38, depth);
    box(s, p.metal, x, 0.88, front + 0.07, wide, 0.22, 0.22);
    box(s, p.edge, x, h + 0.42, z, wide + 0.04, 0.26, depth + 0.04);
    if (id % 3 === 1) {
      box(s, p.frame, x, h * 0.68, front + 0.07, wide * 0.82, h * 0.41, 0.16);
      for (let i = 0; i < 3; i++)
        box(
          s,
          p.glass,
          x - wide * 0.25 + i * wide * 0.25,
          h * 0.69,
          front + 0.2,
          wide * 0.202,
          h * 0.32,
          0.11
        );
      box(s, p.metal, x - 0.33, h + 0.83, z - 0.39, wide * 0.62, 0.65, depth * 0.57);
      const lockX = x + wide * 0.45;
      box(s, p.frame, lockX, 1.34, z - 0.15, 0.88, 1.97, depth * 0.52);
      cyl(s, p.metal, lockX, 2.66, z - 0.19, 0.43, 0.43, 0.74, 0, 0, 0, 12);
      cyl(s, p.frame, lockX, 3.11, z - 0.19, 0.46, 0.46, 0.12, 0, 0, 0, 12);
    } else if (id % 3 === 2) {
      box(s, p.metal, x - 0.36, h * 0.65, front + 0.1, wide * 0.6, h * 0.47, 0.13);
      cyl(s, p.frame, x - 0.4, h * 0.63, front + 0.18, h * 0.151, h * 0.151, 0.18, H, 0, 0, 12);
      cyl(s, p.glass, x - 0.4, h * 0.63, front + 0.32, h * 0.123, h * 0.123, 0.13, H, 0, 0, 16);
      box(s, p.metal, x + wide * 0.32, h * 0.57, front + 0.13, 0.15, 0.87, 0.2);
      cyl(s, p.frame, x - 0.49, h + 0.7, z - 0.35, 0.91, 0.91, 0.43, 0, 0, 0, 12);
      cyl(s, p.metal, x - 0.49, h + 1.0, z - 0.35, 0.79, 0.94, 0.32, 0, 0, 0, 12);
      box(s, p.frame, x - 0.49, h + 1.24, z - 0.35, 0.72, 0.14, 0.28);
    } else {
      box(s, p.glass, x, h * 0.69, front + 0.08, wide * 0.81, h * 0.29, 0.16);
      box(s, p.metal, x, h * 0.66, front + 0.16, 0.12, h * 0.37, 0.13);
      for (const dx of [-0.48, 0.48])
        cyl(s, p.frame, x + dx, h + 0.77, z - 0.4, 0.33, 0.33, 0.5, 0, 0, 0, 12);
      box(s, p.frame, x + wide * 0.34, h * 0.91, front + 0.13, 0.88, 0.14, 0.28);
    }
    box(s, p.frame, x - wide * 0.25, h * 0.31, front + 0.38, wide * 0.41, 0.28, 0.75);
    box(s, p.dark, x - wide * 0.25, h * 0.31 + 0.22, front + 0.36, wide * 0.29, 0.19, 0.51);
    box(s, p.lcd, x + wide * 0.31, h * 0.79, front + 0.17, 0.41, 0.37, 0.085);
    for (const dx of [-0.37, 0.37])
      box(s, p.frame, x + wide * dx, h * 0.52, front + 0.104, 0.038, h * 0.7, 0.035);
    for (let k = 0; k < 5; k++)
      box(s, p.frame, x + wide * 0.23, 1.15 + k * 0.125, front + 0.14, 0.71, 0.048, 0.07);
    const ductX = x - wide * 0.34;
    cyl(s, p.metal, ductX, h + 0.72, z - 0.7, 0.21, 0.21, 0.57, 0, 0, 0, 12);
    rod(s, p.frame, [ductX, h + 0.94, z - 0.72], [ductX, h + 0.94, z - depth * 0.58], 0.18, 12);
    for (let k = 0; k < 4; k++)
      box(s, p.skirt, x + wide * 0.5 + 0.05, 1.49 + k * 0.27, z + 0.09, 0.11, 0.104, depth * 0.65);
    F.decal(s, F.SIM.code(id), x - wide * 0.12, h * 0.89, front + 0.158, 1.94, 0.38, {
      bg: '#666e64',
      color: '#e9e9d5'
    });
    return [x + wide * 0.38, h + 0.99, z + depth * 0.29];
  }
  function movingInstances(s, geom, material, count) {
    const o = new T.InstancedMesh(geom, material, count);
    o.frustumCulled = false;
    o.instanceMatrix.setUsage(T.DynamicDrawUsage);
    s.root.add(o);
    return o;
  }
  function equipment(s, p) {
    const anchors = [],
      heights = [],
      cached = new Array(24).fill(''),
      workStops = new Float64Array(24),
      lastTimes = new Float64Array(24);
    for (let id = 0; id < cells.length; id++) {
      const [x, z] = cells[id],
        pos = id === 0 ? [-2.83, 8.85, -6.25] : station(s, p, id, x, z);
      anchors.push(pos);
      s.units.push({ id, pos });
      heights.push(id === 0 ? 4.05 : pos[1] * 0.48);
      box(s, p.dark, pos[0], pos[1] - 0.24, pos[2], 0.25, 0.43, 0.24);
    }
    const lampMaterial = new T.MeshBasicMaterial({ color: 0xffffff }),
      beacons = movingInstances(s, new T.CylinderGeometry(0.19, 0.19, 0.43, 10), lampMaterial, 24);
    const arms = movingInstances(s, new T.BoxGeometry(), p.metal, 24),
      dummy = new T.Object3D(),
      colors = { run: new T.Color(0x9ed6b4), idle: new T.Color(0xf2a73b), down: new T.Color(0xff5638) };
    for (let i = 0; i < 24; i++) {
      dummy.position.fromArray(anchors[i]);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      beacons.setMatrixAt(i, dummy.matrix);
      beacons.setColorAt(i, colors.run);
    }
    beacons.instanceMatrix.needsUpdate = true;
    beacons.instanceColor.needsUpdate = true;
    // The parked phase uses the absolute start of the non-running interval, including on seeks.
    s.anim.push((t) => {
      let changed = false;
      for (let id = 0; id < 24; id++) {
        const status = F.SIM.status(id, t);
        if (status !== cached[id]) {
          beacons.setColorAt(id, colors[status]);
          changed = true;
        }
        if (status !== 'run' && (status !== cached[id] || t < lastTimes[id] || t - lastTimes[id] > 1)) {
          let stop = status === 'idle' ? t - F.mod(t + id * 16.1, 105) : Math.floor(t);
          if (status === 'down') while (F.SIM.status(id, stop - 1) === 'down') stop--;
          workStops[id] = stop;
        }
        const phase = status === 'run' ? t : workStops[id],
          xx = cells[id][0],
          zz = cells[id][1];
        dummy.position.set(
          xx - 0.7 + 0.47 * Math.sin(phase * 1.45 + id),
          heights[id],
          zz + (id === 0 ? 4.9 : zz > 8 ? 1.75 : 2.1)
        );
        dummy.scale.set(0.87, 0.1, 0.22);
        dummy.updateMatrix();
        arms.setMatrixAt(id, dummy.matrix);
        cached[id] = status;
        lastTimes[id] = t;
      }
      if (changed) beacons.instanceColor.needsUpdate = true;
      arms.instanceMatrix.needsUpdate = true;
    });
  }
  function ceilingTransport(s, p) {
    const points = [],
      lengths = [];
    let length = 0;
    const point = (x, z) => {
      if (points.length) {
        const prev = points[points.length - 1];
        length += Math.hypot(x - prev[0], z - prev[1]);
      }
      points.push([x, z]);
      lengths.push(length);
    };
    const arc = (x, z, r, start, end) => {
      for (let j = 1; j <= 6; j++) {
        const a = start + ((end - start) * j) / 6;
        point(x + r * Math.cos(a), z + r * Math.sin(a));
      }
    };
    point(-9, -2.85);
    point(-16, -2.85);
    arc(-16, -1.05, 1.8, -H, -PI);
    point(-17.8, 5.2);
    arc(-16, 5.2, 1.8, PI, H);
    point(15.7, 7.0);
    arc(15.7, 5.2, 1.8, H, 0);
    point(17.5, -1.05);
    arc(15.7, -1.05, 1.8, 0, -H);
    point(-9, -2.85);
    const pose = (phase, out) => {
      const dist = F.mod(phase, 1) * length;
      let j = 1;
      while (j < points.length - 1 && lengths[j] < dist) j++;
      const a = points[j - 1],
        b = points[j],
        u = (dist - lengths[j - 1]) / (lengths[j] - lengths[j - 1]);
      out.x = F.mix(a[0], b[0], u);
      out.z = F.mix(a[1], b[1], u);
      out.angle = Math.atan2(b[0] - a[0], b[1] - a[1]);
    };
    for (let j = 1; j < points.length; j++) {
      const [x, z] = points[j - 1],
        [nx, nz] = points[j];
      rod(s, p.dark, [x, 9.87, z], [nx, 9.87, nz], 0.27, 8);
      rod(s, p.metal, [x, 10.11, z], [nx, 10.11, nz], 0.19, 8);
    }
    for (const x of [-14, -5, 4, 13])
      for (const z of [-2.85, 7.0]) {
        box(s, p.metal, x, 10.83, z, 0.14, 1.42, 0.19);
        box(s, p.frame, x, 11.46, z, 0.85, 0.27, 0.6);
      }
    const hero = new T.Group();
    s.root.add(hero);
    const fh = F.foup(s, 0, 0, 0, 0.91);
    hero.add(fh);
    const aux = { root: hero, batches: new Map() };
    box(aux, p.edge, 0, 0, 0, 2.03, 1.05, 2.94);
    box(aux, p.dark, 0, 0.42, 0, 1.75, 0.49, 2.44);
    box(aux, p.amber, 0, -0.01, 1.51, 1.82, 0.24, 0.07);
    box(aux, p.frame, 0, -0.59, 0, 1.51, 0.28, 1.9);
    F.flush(aux);
    const cable = F.mesh(aux, new T.BoxGeometry(), p.metal);
    cable.scale.set(0.12, 1, 0.12);
    F.decal(aux, 'A7F3', 0, 0.08, 1.55, 1.56, 0.42, { bg: '#64532f', color: '#ffe3a3' });
    const groupNames = ['cab', 'stripe', 'carrier', 'lid', 'hanger'],
      fleet = {};
    for (const [i, k] of groupNames.entries())
      fleet[k] = movingInstances(
        s,
        new T.BoxGeometry(),
        [p.white, p.dark, p.warm, p.frame, p.metal][i],
        4
      );
    const stamp = new T.Object3D(),
      position = { x: 0, z: 0, angle: 0 },
      heroTag = [0, 0, 0];
    s.lotFocus = heroTag;
    function part(i, k, dy, w, h, d) {
      stamp.position.set(position.x, 9.03 + dy, position.z);
      stamp.scale.set(w, h, d);
      stamp.updateMatrix();
      fleet[k].setMatrixAt(i, stamp.matrix);
    }
    s.labels.push({ pos: heroTag, zh: '主角晶圆盒', en: 'LOT–A7F3 · OHT', value: '25 片 / FOUP' });
    s.anim.push((t, progress) => {
      const advance = F.smooth((progress - 0.08) / 0.81);
      pose(0.22 + 0.78 * advance + 0.01 * Math.sin(t * 0.44) * (1 - advance), position);
      hero.position.set(position.x, 9.03, position.z);
      hero.rotation.y = position.angle;
      const drop = F.smooth((progress - 0.78) / 0.16),
        gap = 1.68 + 1.3 * drop;
      fh.position.set(0, -gap - 0.55, 0);
      cable.position.y = -0.63 - gap * 0.5;
      cable.scale.y = gap;
      heroTag[0] = position.x;
      heroTag[1] = 9.03 - gap;
      heroTag[2] = position.z;
      for (let i = 0; i < 4; i++) {
        pose(t * (0.0036 + i * 0.00029) + i * 0.25 + 0.055, position);
        stamp.rotation.set(0, position.angle, 0);
        part(i, 'cab', 0, 1.39, 0.8, 2.07);
        part(i, 'stripe', 0.46, 1.22, 0.22, 1.72);
        part(i, 'hanger', -0.73, 0.25, 0.82, 0.46);
        part(i, 'carrier', -1.62, 1.27, 1.21, 1.15);
        part(i, 'lid', -2.26, 1.36, 0.16, 1.23);
      }
      for (const k of groupNames) fleet[k].instanceMatrix.needsUpdate = true;
    });
    F.dataLine(
      s,
      points.map(([x, z]) => [x, 10.28, z]),
      'oht'
    );
  }
  F.define(2, (s) => {
    const p = palette();
    envelope(s, p);
    scanner(s, p);
    equipment(s, p);
    ceilingTransport(s, p);
    F.dataLine(
      s,
      [
        [-22, 0.19, 13.4],
        [-22, 0.19, -12],
        [-9, 0.19, -12],
        [-9, 4, -12]
      ],
      'power'
    );
    F.dataLine(
      s,
      [
        [24, 1.0, 10],
        [24, 1.0, -14],
        [8, 1.0, -14],
        [8, 2.6, -11.5]
      ],
      'water'
    );
    F.dataLine(
      s,
      [
        [-25.7, 5.8, 9],
        [-25.7, 5.8, -11.7],
        [-15.8, 5.8, -11.7]
      ],
      'gas'
    );
    F.dataLine(
      s,
      [
        [4.1, 5.4, -10.5],
        [4.1, 10.0, -10.5],
        [4.1, 10.0, -15.6],
        [21, 10.0, -15.6]
      ],
      'exhaust'
    );
    for (const x of [-13.5, 4.7, 12.6])
      F.dataLine(
        s,
        [
          [x, 10.8, -1.12],
          [x, 7.3, -1.12],
          [x, 3.5, -1.12],
          [x, 0.3, -1.12]
        ],
        'air'
      );
    s.labels.push(
      { pos: [-11, 7.94, -6], zh: '黄光曝光工位', en: 'LITHO / BAY A', value: '22.0 ±0.1 °C' },
      { pos: [10.3, 11.37, -7.41], zh: '垂直单向流', en: 'FFU / SUPPLY', value: '0.38 m/s' },
      { pos: [10.4, 0.2, 7.8], zh: '华夫板回风', en: 'RETURN PLENUM', value: 'ISO 4' }
    );
  });
})(F, THREE);
