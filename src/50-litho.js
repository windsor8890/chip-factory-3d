/* DF-02 · The load port and the reflective EUV train. Distances within the
   optics bench are diagrammatic, enabling every reflection to be seen. */
((F, T) => {
  'use strict';
  const pi = Math.PI;
  const label = (s, pos, zh, en, value) => s.labels.push({ pos, zh, en, value });
  let metalGrain;
  function finish(color, metal, roughness) {
    if (!metalGrain) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d'),
        img = ctx.createImageData(256, 256),
        rng = F.rng(0x13a50);
      for (let y = 0; y < 256; y++) {
        const stroke = 5 * Math.sin(y * 1.1) + rng() * 10;
        for (let x = 0; x < 256; x++) {
          const n = (256 * y + x) * 4,
            v = 210 + stroke + 20 * rng();
          img.data[n] = v;
          img.data[n + 1] = v;
          img.data[n + 2] = v;
          img.data[n + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      metalGrain = F.texture(c);
    }
    const mat = F.mat(color, metal, roughness).clone();
    mat.map = metalGrain;
    mat.bumpMap = metalGrain;
    mat.bumpScale = 0.012;
    return mat;
  }
  function caseBody(s, x, base, front, w, h, d, material, clip = 0.6) {
    const a = w / 2,
      c = Math.min(clip, h / 3, a / 2),
      shape = new T.Shape();
    shape.moveTo(-a + c * 0.25, 0);
    shape.lineTo(a - c * 0.25, 0);
    shape.lineTo(a, c * 0.25);
    shape.lineTo(a, h - c);
    shape.lineTo(a - c, h);
    shape.lineTo(-a + c, h);
    shape.lineTo(-a, h - c);
    shape.lineTo(-a, c * 0.25);
    shape.closePath();
    return F.mesh(
      s,
      new T.ExtrudeGeometry(shape, {
        depth: d,
        bevelEnabled: true,
        bevelThickness: 0.055,
        bevelSize: 0.055,
        bevelSegments: 1,
        curveSegments: 2
      }),
      material,
      x,
      base,
      front - d
    );
  }
  function pins(s, m, x, y, z, w, h) {
    for (const i of [-1, 1])
      for (const j of [-1, 1]) {
        F.cyl(s, m, x + i * w * 0.46, y + j * h * 0.44, z, 0.078, 0.078, 0.045, pi / 2, 0, 0, 8);
      }
  }
  function polyTube(s, m, pts, r, n = 12) {
    for (let i = 1; i < pts.length; i++) F.rod(s, m, pts[i - 1], pts[i], r, n);
  }
  function light(s, color, x, y, z, power, dist) {
    const o = new T.PointLight(color, power, dist, 2);
    o.position.set(x, y, z);
    s.scene.add(o);
  }
  F.define(3, (s) => {
    const skin = finish(0xe2d8c1, 0.27, 0.43),
      panel = finish(0xc3c6b8, 0.37, 0.42);
    const pin = F.mat(0xbdc4bd, 0.8, 0.22),
      seam = F.mat(0x232b2b, 0.45, 0.42);
    const iron = F.mat(0x4a504c, 0.7, 0.37),
      bloom = F.mat(0xffcf53, 0.13, 0.34, 0.66);
    const bronze = F.mat(0x947848, 0.62, 0.35),
      deck = finish(0x666862, 0.56, 0.41);
    const screen = F.mat(0x1c2825, 0.36, 0.24),
      ice = F.mat(0xbfddda, 0.16, 0.36, 0.23);
    // Grounded isolation table, machined leveling mounts and service floor.
    F.box(s, seam, 0, -0.95, -0.4, 37, 1.1, 21.5);
    F.box(s, deck, 0, -0.33, -0.4, 36.7, 0.18, 21.15);
    for (let x = -16; x <= 16; x += 3.2) F.box(s, iron, x, -0.219, -0.4, 0.037, 0.026, 20.55);
    for (let z = -9; z <= 9; z += 3) F.box(s, iron, 0, -0.215, z, 36.2, 0.028, 0.038);
    for (const x of [-13, -6, 3, 12])
      for (const z of [-6.6, 2.5]) {
        F.cyl(s, iron, x, 0.08, z, 0.56, 0.83, 0.58, 0, 0, 0, 16);
        F.cyl(s, pin, x, 0.48, z, 0.3, 0.3, 0.39);
        F.cyl(s, seam, x, 0.7, z, 0.59, 0.55, 0.17);
      }
    F.box(s, iron, -0.4, 1.0, -3.1, 31, 0.54, 11.4);
    F.shadow(s, -0.4, -0.18, -1.4, 36, 18, 0.63);
    // Interlocking enclosure sections, with a recessed front service bay and
    // a lower load-port tower. The optical door at (2,7,0) is supplied centrally.
    caseBody(s, -6.5, 1.29, -0.73, 14.2, 12.5, 9, skin, 1.58);
    caseBody(s, 3.05, 1.29, -1.12, 9.7, 12.95, 9.25, skin, 0.82);
    caseBody(s, 10.42, 1.29, -1.02, 5.0, 11.3, 8.92, panel, 1.0);
    F.box(s, seam, 2.0, 7.0, -0.46, 12.17, 6.93, 0.9);
    F.box(s, iron, 2, 7, -0.04, 11.8, 6.62, 0.12);
    for (const xx of [-3.22, 7.2]) F.box(s, pin, xx, 7, 0.075, 0.13, 5.88, 0.06);
    F.box(s, bronze, 2, 10.16, 0.08, 11, 0.11, 0.09);
    F.box(s, F.mat(0x565e57, 0.6, 0.34), 2, 7, 0.077, 9.87, 4.82, 0.056);
    // Fasteners and the inspection viewport belong to the removable door.
    for (const xx of [-3.42, -0.8, 2, 4.8, 7.42])
      for (const yy of [4.05, 9.93]) F.cyl(s, pin, xx, yy, 0.14, 0.11, 0.11, 0.065, pi / 2, 0, 0, 8);
    F.box(s, seam, 2, 7.21, 0.144, 5.47, 0.79, 0.09);
    F.box(s, screen, 2, 7.21, 0.199, 5.14, 0.54, 0.033);
    F.box(s, bronze, 2, 7.04, 0.225, 4.52, 0.061, 0.023);
    for (const x of [-1.92, 0.02, 1.98, 3.93, 5.87]) {
      for (let j = 0; j < 3; j++) F.box(s, iron, x, 5.17 + j * 0.23, 0.119, 1.27, 0.057, 0.045);
    }
    F.decal(s, 'VACUUM   /   OPTICAL ACCESS', 2, 8.56, 0.124, 7.06, 0.43, { color: '#d3d9c8' });
    for (const x of [-11.52, -8.13, -4.75]) {
      F.box(s, seam, x, 7.4, -0.41, 3.26, 10.66, 0.56);
      F.box(s, skin, x, 7.43, -0.09, 3.09, 10.4, 0.19);
      pins(s, iron, x, 7.43, 0.04, 3.04, 10.06);
      F.box(s, iron, x + 1.05, 7.9, 0.09, 0.17, 0.68, 0.15);
      for (let j = 0; j < 7; j++) F.box(s, iron, x, 3.79 + j * 0.19, 0.04, 2.14, 0.066, 0.04);
    }
    for (let k = 0; k < 3; k++) {
      const x = 8.25 + 1.52 * k;
      F.box(s, seam, x, 5.4, -0.71, 1.49, 7.43, 0.59);
      F.box(s, panel, x, 5.4, -0.374, 1.35, 7.25, 0.2);
      for (let u = 0; u < 9; u++) F.box(s, iron, x, 6.1 + u * 0.208, -0.257, 0.89, 0.074, 0.035);
    }
    // UV-filtered inspection corridor and the cassette hand-off.
    const sk = F.mat(0x91805a, 0.48, 0.3);
    caseBody(s, -8.65, 0.32, 5.5, 9.0, 4.2, 6.9, sk, 0.26);
    F.box(s, iron, -8.65, 4.59, 2.53, 9.25, 0.31, 6.58);
    for (let j = 0; j < 3; j++) {
      const x = -11.5 + 2.86 * j;
      F.box(s, seam, x, 2.13, 5.57, 2.62, 3.4, 0.12);
      F.box(s, panel, x, 2.14, 5.67, 2.41, 3.2, 0.12);
      F.box(s, iron, x + 0.78, 2.82, 5.75, 0.16, 0.76, 0.11);
      for (let k = 0; k < 4; k++) F.box(s, iron, x, 1.06 + k * 0.17, 5.746, 1.67, 0.06, 0.033);
    }
    F.box(s, pin, -8.7, 4.85, 3.16, 4.78, 0.24, 3.65);
    F.box(s, seam, -8.7, 5.08, 3.18, 4.36, 0.23, 3.46);
    for (const x of [-10.36, -7.04]) F.box(s, bloom, x, 5.22, 3.12, 0.18, 0.1, 3.15);
    const carrier = F.foup(s, -8.7, 7.09, 3.13, 1.85);
    s.lotFocus = carrier.position;
    const lotAnchor = [-8.7, 7.45, 5.03];
    // Identification plate is fixed to the port; the witness mark belongs to this lot.
    F.decal(s, 'LOT-A7F3', -8.7, 4.34, 5.885, 4.15, 0.56, { color: '#f2d594', bg: '#373a32' });
    for (let t = 0; t < 10; t++)
      F.box(s, t % 3 ? iron : bloom, -13.0 + t * 0.22, 4.75, 5.65, 0.09, 0.13, 0.035);
    // OHT pick-up rail clears the camera above the left load station.
    for (const z of [2.32, 3.96]) {
      F.box(s, iron, -9.6, 15.35, z, 11.45, 0.35, 0.22);
      F.box(s, pin, -9.6, 15.58, z, 11.5, 0.11, 0.32);
    }
    for (const x of [-14.9, -4.54]) F.box(s, iron, x, 15.35, 3.13, 0.22, 0.3, 1.95);
    F.box(s, iron, -8.7, 14.89, 3.13, 2.62, 0.61, 2.21);
    F.box(s, bloom, -8.7, 14.54, 3.13, 1.79, 0.08, 0.62);
    // The hoist pays out two webbing straps to the gripper. Each jaw holds the
    // side of the top flange, then opens after the cassette seats on the port.
    const head = new T.Group();
    s.root.add(head);
    const crossbar = { root: head, batches: new Map() };
    F.box(crossbar, iron, 0, 0, 0, 2.98, 0.24, 0.66);
    F.box(crossbar, pin, 0, 0.16, 0, 2.65, 0.1, 0.47);
    F.box(crossbar, bronze, 0, -0.08, 0.37, 1.58, 0.12, 0.065);
    F.flush(crossbar);
    const straps = [],
      jaws = [],
      strapGeo = new T.BoxGeometry(1, 1, 1);
    const web = F.mat(0x797164, 0.18, 0.72),
      yAxis = new T.Vector3(0, 1, 0);
    const lower = new T.Vector3(),
      leg = new T.Vector3();
    for (const sign of [-1, 1]) {
      const top = new T.Vector3(-8.7 + sign * 0.82, 14.42, 3.13);
      F.cyl(s, pin, top.x, top.y + 0.055, top.z, 0.19, 0.19, 0.33, pi / 2, 0, 0, 16);
      const ribbon = F.mesh(s, strapGeo, web);
      straps.push({ sign, top, ribbon });
      const jaw = new T.Group();
      head.add(jaw);
      jaws.push({ sign, jaw });
      const jawParts = { root: jaw, batches: new Map() };
      F.box(jawParts, iron, 0, -0.21, 0, 0.24, 0.55, 0.5);
      F.box(jawParts, pin, -sign * 0.13, -0.43, 0, 0.4, 0.12, 0.48);
      F.cyl(jawParts, bronze, 0, -0.08, 0.27, 0.13, 0.13, 0.08, pi / 2, 0, 0, 12);
      F.flush(jawParts);
    }
    s.anim.push((t, p) => {
      const lowerCarrier = F.smooth((p - 0.075) / 0.3);
      const openJaws = F.smooth((p - 0.379) / 0.066),
        retract = F.smooth((p - 0.445) / 0.15);
      carrier.position.set(-8.7, 7.09 + 4.1 * (1 - lowerCarrier), 3.13 + 0.27 * (1 - lowerCarrier));
      lotAnchor[1] = carrier.position.y + 0.46;
      lotAnchor[2] = carrier.position.z + 1.9;
      head.position.set(
        carrier.position.x,
        F.mix(carrier.position.y + 2.45, 14.02, retract),
        F.mix(carrier.position.z, 3.13, retract)
      );
      for (const { sign, jaw } of jaws) jaw.position.x = sign * (1.15 + 0.3 * openJaws);
      for (const { sign, top, ribbon } of straps) {
        lower.set(head.position.x + sign * 0.82, head.position.y + 0.15, head.position.z);
        leg.subVectors(top, lower);
        const length = leg.length();
        ribbon.position.copy(lower).addScaledVector(leg, 0.5);
        ribbon.quaternion.setFromUnitVectors(yAxis, leg.multiplyScalar(1 / length));
        ribbon.scale.set(0.135, length, 0.22);
      }
    });
    // The yellow room's louvred filter bank casts a long, warm grazing light.
    // Its section is confined to the rear wall so that the load port stays readable.
    const filter = F.mat(0xffc94d, 0.14, 0.38, 0.36);
    for (const x of [-14.5, -9.9, -5.3, -0.7, 3.9, 8.5, 13.1]) {
      F.box(s, iron, x, 10.18, -9.92, 4.61, 7.3, 0.29);
      F.box(s, filter, x, 10.21, -9.72, 4.31, 6.98, 0.13);
      for (let k = 0; k < 5; k++) F.box(s, bronze, x, 7.25 + 1.46 * k, -9.61, 4.4, 0.071, 0.066);
    }
    F.box(s, iron, -0.66, 14.1, -9.8, 32.4, 0.26, 0.77);
    F.box(s, filter, -0.66, 14.04, -9.26, 31.7, 0.18, 0.24);
    // A vacuum manifold at the exposed service end with quick-connect flanges.
    for (const z of [-7.6, -5.42, -3.22]) {
      const x = 13.24;
      F.cyl(s, iron, x, 5.78, z, 0.75, 0.78, 8.48, 0, 0, 0, 24);
      for (const y of [2.1, 4.6, 7.25, 9.52]) F.cyl(s, pin, x, y, z, 0.84, 0.84, 0.17, 0, 0, 0, 24);
      F.cyl(s, bronze, x, 10.13, z, 0.31, 0.63, 0.72);
      polyTube(
        s,
        pin,
        [
          [x, 10.51, z],
          [x, 10.94, z],
          [11.85, 11.52, z]
        ],
        0.16
      );
    }
    for (let z = -8.4; z < -0.8; z += 0.62) F.box(s, iron, 12.99, 4.74, z, 0.09, 3.46, 0.17);
    F.box(s, seam, -6.4, 12.92, -0.485, 11.63, 0.77, 0.45);
    F.box(s, bloom, -6.4, 12.92, -0.235, 10.94, 0.34, 0.058);
    F.box(s, bloom, 3.01, 13.48, -1.1, 7.93, 0.19, 0.28);
    F.box(s, bloom, 10.32, 11.14, -0.92, 3.45, 0.15, 0.14);
    F.box(s, pin, 11.04, 8.03, 0.24, 0.15, 0.45, 2.2);
    F.box(s, seam, 11.04, 8.32, 1.33, 2.48, 1.85, 0.31, -0.12);
    F.box(s, screen, 11.04, 8.32, 1.53, 2.21, 1.57, 0.058, -0.12);
    for (let i = 0; i < 5; i++)
      F.box(s, i === 0 ? bloom : ice, 10.85, 8.0 + i * 0.17, 1.62, 1.33 - 0.11 * (i % 3), 0.04, 0.025);
    F.decal(s, 'LITHOGRAPHY', -6.6, 11.42, 0.035, 6.73, 0.62, { color: '#383f37' });
    F.decal(s, 'EUV   /   04', 10.3, 9.89, -0.25, 3.6, 0.53, { color: '#40463e' });
    F.decal(s, 'LOAD PORT    01', -8.95, 1.98, 5.765, 3.22, 0.28, { color: '#454738' });
    // Access hatches, rail runners and ventilation grilles remain visible from above.
    for (const xx of [-9.6, -4.1, 1.3, 6.0]) {
      const yy = xx < 0 ? 13.9 : 14.35;
      F.box(s, iron, xx, yy, -4.8, 3.74, 0.12, 4.97);
      for (let k = 0; k < 13; k++) F.box(s, panel, xx, yy + 0.081, -7.03 + k * 0.36, 3.48, 0.069, 0.14);
    }
    for (const xx of [-9.8, -7.55]) F.shadow(s, xx, 4.96, 3.3, 4, 4.8, 0.32);
    light(s, 0xffc23a, -12.4, 12.2, 7.1, 160, 25);
    light(s, 0xffcd51, 8.8, 11.2, 3.6, 128, 26);
    label(s, lotAnchor, '晶圆盒', 'LOT-A7F3', '25 片 / FOUP');
    label(s, [2, 8.6, 0.45], '光路舱', 'OPTICAL CHAMBER', '真空反射系统');
    label(s, [10.6, 9.2, 0.4], '黄光照明', 'YELLOW BAY', '控温 ±0.1 °C');
  });
  function pulseDot(s, pts, mat, speed, offset, radius) {
    const dot = F.mesh(s, new T.SphereGeometry(radius, 9, 6), mat);
    const vec = pts.map((p) => new T.Vector3(...p)),
      travel = [0];
    for (let i = 1; i < vec.length; i++) travel.push(travel[i - 1] + vec[i].distanceTo(vec[i - 1]));
    const total = travel[travel.length - 1];
    s.anim.push((t) => {
      const d = F.mod(t * speed + offset, total);
      let segment = 1;
      while (segment < travel.length - 1 && d > travel[segment]) segment++;
      dot.position.lerpVectors(
        vec[segment - 1],
        vec[segment],
        (d - travel[segment - 1]) / (travel[segment] - travel[segment - 1])
      );
    });
  }
  F.define(4, (s) => {
    const iron = finish(0x525958, 0.7, 0.39),
      black = finish(0x303839, 0.5, 0.43);
    const titanium = finish(0xb9b9a9, 0.76, 0.31),
      alloy = finish(0x79837e, 0.79, 0.32);
    const copper = F.mat(0x98754d, 0.73, 0.31),
      glass = F.mat(0xb8d8d7, 0.79, 0.22, 0.045);
    const core = F.mat(0xcfeeff, 0.03, 0.27, 1.22),
      glint = F.ink(0xe5f6ff);
    const mist = new T.MeshBasicMaterial({
      color: 0xb9e1ee,
      transparent: true,
      opacity: 0.082,
      depthWrite: false,
      side: T.FrontSide,
      blending: T.AdditiveBlending
    });
    // Blackened optical bench with a tapered, chamfered chassis and flotation feet.
    caseBody(s, 0, -1.72, 10.95, 39.9, 1.83, 22.8, iron, 0.55);
    F.box(s, black, 0, 0.235, -0.4, 39.4, 0.32, 22);
    for (const x of [-16, 0, 16])
      for (const z of [-7.9, 7.9]) {
        F.cyl(s, black, x, -2.05, z, 1.05, 1.32, 0.63, 0, 0, 0, 32);
        F.cyl(s, titanium, x, -1.78, z, 0.77, 0.77, 0.33);
      }
    for (let x = -18.5; x < 19; x += 1.09) F.box(s, alloy, x, 0.414, -0.4, 0.063, 0.033, 21.51);
    for (let x = -18; x < 19; x += 2.25)
      for (let z = -9.5; z < 11; z += 2.35)
        F.cyl(s, black, x, 0.438, z, 0.104, 0.104, 0.026, 0, 0, 0, 8);
    // Only the rear half of the source vessel is retained in this engineering
    // section. The open split flange exposes the light path to the collector.
    const vesselX = -13.25,
      vesselY = 5.02,
      vesselZ = 1.08,
      R = 4.58;
    const wall = F.mesh(
      s,
      new T.CylinderGeometry(R, R, 7.45, 48, 1, true, 0.5 * pi, 1.03 * pi),
      finish(0x9daba9, 0.71, 0.34),
      vesselX,
      vesselY,
      vesselZ
    );
    wall.rotation.z = pi / 2;
    wall.material.side = T.DoubleSide;
    for (const x of [-17.05, -16.64, -9.88, -9.45]) {
      const pts = [];
      for (let k = 0; k <= 22; k++) {
        const a = 0.5 * pi + (1.03 * pi * k) / 22;
        pts.push([x, vesselY + R * Math.sin(a), vesselZ + R * Math.cos(a)]);
      }
      polyTube(s, titanium, pts, 0.16, 10);
      if (x === -17.05 || x === -9.45)
        for (let k = 0; k < pts.length; k += 3)
          F.cyl(s, iron, pts[k][0], pts[k][1], pts[k][2], 0.23, 0.23, 0.24, 0, 0, pi / 2, 6);
    }
    for (const x of [-15.9, -10.5]) {
      F.box(s, iron, x, 0.83, -0.94, 1.03, 0.79, 6.01);
      F.rod(s, titanium, [x, 1.07, -3.48], [x, 3.7, -3.21], 0.22);
    }
    // Vacuum-chamber backplane, ribbed bulkheads, inspection blanks and cable
    // glands. Its front and lid are sectioned away to expose the projection train.
    caseBody(s, 1.0, 0.43, -7.0, 22.5, 8.62, 1.63, iron, 0.64);
    const face = finish(0x8d9894, 0.67, 0.33);
    for (let i = 0; i < 3; i++) {
      const x = -6.0 + i * 7.0;
      F.box(s, black, x, 4.52, -6.82, 6.71, 7.42, 0.3);
      F.box(s, face, x, 4.52, -6.6, 6.39, 7.12, 0.19);
      for (let j = 0; j < 5; j++) F.box(s, alloy, x, 1.48 + j * 1.49, -6.43, 6.3, 0.054, 0.088);
      const cy = 5.39,
        rr = i === 1 ? 1.01 : 0.79;
      F.cyl(s, iron, x, cy, -6.27, rr, rr, 0.29, pi / 2, 0, 0, 32);
      F.cyl(s, titanium, x, cy, -6.04, rr * 0.83, rr * 0.86, 0.16, pi / 2, 0, 0, 32);
      F.cyl(s, black, x, cy, -5.93, rr * 0.63, rr * 0.64, 0.065, pi / 2, 0, 0, 32);
      for (let k = 0; k < 8; k++) {
        const a = (k * pi) / 4;
        F.cyl(
          s,
          copper,
          x + rr * 0.92 * Math.cos(a),
          cy + rr * 0.92 * Math.sin(a),
          -6.075,
          0.08,
          0.081,
          0.087,
          pi / 2,
          0,
          0,
          6
        );
      }
      F.box(s, alloy, x, 1.63, -6.2, 3.4, 0.88, 0.57);
      for (let j = 0; j < 5; j++) F.box(s, black, x - 1.25 + j * 0.63, 1.63, -5.88, 0.22, 0.48, 0.22);
    }
    for (const x of [-10.41, 12.4]) {
      F.box(s, titanium, x, 5.05, -7.06, 0.27, 9.05, 0.65);
      F.box(s, iron, x, 0.87, -5.15, 0.98, 0.72, 4.14);
      F.rod(s, alloy, [x, 1.08, -3.12], [x, 4.84, -6.86], 0.16);
    }
    F.box(s, alloy, 1.0, 9.12, -7.32, 22.81, 0.32, 0.98);
    F.decal(s, 'EXPOSURE OPTICS     /     VACUUM', 1.1, 8.03, -6.45, 10.2, 0.49, { color: '#d2d7c8' });
    F.decal(s, 'REFLECTIVE OPTICS     /     13.5 nm', -7.3, -0.74, 11.0, 14.2, 0.63, {
      color: '#d2d5c7'
    });
    F.decal(s, 'VACUUM BENCH     06', 12.0, -0.68, 11.0, 7.9, 0.4, { color: '#b9c0b5' });
    // Tin droplet generator and converging CO2 beam lines.
    const source = [-14.5, 5.3, 3.1];
    F.cyl(s, iron, -14.5, 8.55, 3.1, 0.78, 1.1, 3.1, 0, 0, 0, 28);
    F.cyl(s, copper, -14.5, 6.79, 3.1, 0.58, 0.13, 0.53, 0, 0, 0, 28);
    for (const y of [7.18, 7.66, 8.34, 9.26, 9.89]) F.cyl(s, titanium, -14.5, y, 3.1, 1.02, 1.02, 0.15);
    F.rod(s, iron, [-17, 0.6, 2.8], [-17, 8.92, 2.8], 0.31);
    F.rod(s, alloy, [-17, 8.92, 2.8], [-14.4, 8.92, 2.8], 0.33);
    F.cyl(s, black, -17, 0.8, 2.8, 1.0, 0.93, 0.68);
    for (let i = 0; i < 4; i++) F.cyl(s, titanium, -14.5, 5.63 + i * 0.19, 3.1, 0.079, 0.078, 0.096);
    const input = [[-19, 4.6, 7.9], [-16.6, 5, 5.1], source];
    F.rod(s, alloy, input[0], input[1], 0.52, 24);
    F.rod(s, copper, [-17.14, 4.89, 5.74], [-16.67, 4.99, 5.2], 0.65, 24);
    F.rod(s, core, input[1], source, 0.079);
    F.rod(s, core, [-14.95, 3.15, 6.23], source, 0.039);
    F.mesh(s, new T.SphereGeometry(0.255, 14, 10), glint, ...source);
    // Each multilayer mirror normal bisects the incident and reflected directions.
    const ray = [
      source,
      [-11.1, 6.7, -2.5],
      [-7.5, 4.4, 1.64],
      [-5.4, 9.5, -3.95],
      [-1.18, 11.6, 0.67],
      [0.7, 6.2, -4.95],
      [4.82, 9.55, -2.42],
      [6.7, 6.33, 1.36],
      [8, 2.09, 5]
    ];
    const up = new T.Vector3(0, 1, 0);
    const faceGeo = new T.CylinderGeometry(1, 1, 0.11, 48);
    function orient(g, m, c, q, w, d, h = 1, off = 0, norm = null) {
      const o = F.mesh(s, g, m, ...c);
      o.scale.set(w, h, d);
      o.quaternion.copy(q);
      if (norm) o.position.addScaledVector(norm, off);
      return o;
    }
    for (let i = 1; i < ray.length - 1; i++) {
      const c = ray[i],
        v = new T.Vector3(...c);
      const n = new T.Vector3(...ray[i - 1])
        .sub(v)
        .normalize()
        .add(new T.Vector3(...ray[i + 1]).sub(v).normalize())
        .normalize();
      const q = new T.Quaternion().setFromUnitVectors(up, n);
      const isMask = i === 4,
        w = i === 1 ? 2.08 : i < 4 ? 1.59 : 1.27,
        d = w * (isMask ? 0.79 : 0.68);
      if (isMask) {
        const o = F.mesh(s, new T.BoxGeometry(3.08, 0.23, 2.25), copper, ...c);
        o.quaternion.copy(q);
        const p = F.mesh(s, new T.BoxGeometry(2.81, 0.083, 1.99), glass, ...c);
        p.quaternion.copy(q);
        p.position.addScaledVector(n, 0.15);
        const back = F.mesh(s, new T.BoxGeometry(2.76, 0.062, 1.96), alloy, ...c);
        back.quaternion.copy(q);
        back.position.addScaledVector(n, -0.145);
        for (let j = 0; j < 5; j++) {
          const mark = F.mesh(s, new T.BoxGeometry(1.91, 0.027, 0.062), titanium, ...c);
          mark.quaternion.copy(q);
          const shift = new T.Vector3(0, -0.192, (j - 2) * 0.25).applyQuaternion(q);
          mark.position.add(shift);
        }
      } else {
        orient(faceGeo, black, c, q, w * 1.16, d * 1.16, 3.1, -0.17, n);
        orient(faceGeo, copper, c, q, w * 1.065, d * 1.065, 1.18, -0.02, n);
        orient(faceGeo, glass, c, q, w, d, 1, 0.095, n);
      }
      const bx = c[0] - 0.33,
        bz = c[2] - 0.53;
      F.cyl(s, black, bx, 0.63, bz, 0.77, 0.95, 0.44);
      F.cyl(s, alloy, bx, (c[1] - 0.4) / 2 + 0.44, bz, 0.21, 0.26, c[1] - 0.4);
      for (let j = 1; j <= 3; j++) F.cyl(s, titanium, bx, 0.7 + j * 0.26, bz, 0.36, 0.37, 0.12);
      const tang = new T.Vector3(1, 0, 0).applyQuaternion(q),
        backPos = v.clone().addScaledVector(n, -0.56);
      for (const side of [-1, 1]) {
        const shoulder = backPos.clone().addScaledVector(tang, side * w * 0.65);
        F.rod(s, alloy, [bx, c[1] - 1.21, bz], shoulder.toArray(), 0.15, 12);
        F.rod(
          s,
          titanium,
          shoulder.toArray(),
          shoulder.clone().addScaledVector(n, 0.38).toArray(),
          0.21,
          12
        );
      }
      F.shadow(s, bx, 0.445, bz, 3.6, 3.0, 0.45);
    }
    for (let i = 1; i < ray.length; i++) {
      F.rod(s, core, ray[i - 1], ray[i], i > 4 ? 0.058 : 0.077, 9);
      F.rod(s, mist, ray[i - 1], ray[i], i > 4 ? 0.2 : 0.28, 11);
    }
    pulseDot(s, ray, glint, 6.7, 0, 0.105);
    pulseDot(s, ray, glint, 6.7, 18, 0.105);
    // Kinematic wafer stage with a silicon disk and metrology fiducials.
    F.box(s, black, 8, 0.79, 5, 16.75, 0.73, 12.8);
    F.cyl(s, alloy, 8, 1.28, 5, 7.82, 7.93, 0.44, 0, 0, 0, 96);
    F.cyl(s, black, 8, 1.6, 5, 7.69, 7.77, 0.23, 0, 0, 0, 96);
    F.cyl(s, titanium, 8, 1.79, 5, 7.58, 7.58, 0.13, 0, 0, 0, 96);
    F.cyl(s, finish(0x434f50, 0.71, 0.29), 8, 1.925, 5, 7.48, 7.48, 0.105, 0, 0, 0, 96);
    for (const x of [0.6, 15.4])
      for (let j = 0; j < 15; j++) F.box(s, iron, x, 0.94, -0.92 + j * 0.69, 0.77, 0.54, 0.36);
    for (const z of [-2.4, 11.8]) F.box(s, titanium, 8, 0.94, z, 14.2, 0.24, 0.36);
    for (let k = 0; k < 32; k++) {
      const a = (2 * pi * k) / 32,
        xx = 8 + 7.64 * Math.cos(a),
        zz = 5 + 7.64 * Math.sin(a);
      F.cyl(s, black, xx, 1.854, zz, 0.073, 0.073, 0.035, 0, 0, 0, 8);
    }
    for (let j = -6; j <= 6; j++) {
      const L = Math.sqrt(54.8 - j * j) * 2;
      F.box(s, alloy, 8 + j, 1.984, 5, 0.025, 0.007, L);
      F.box(s, alloy, 8, 1.985, 5 + j, L, 0.007, 0.025);
    }
    light(s, 0xcfeeff, -12.5, 6.7, 2.2, 26, 13);
    label(s, source, '锡滴等离子体', 'TIN PLASMA', '20–30 μm · 约 50 kHz');
    label(s, ray[2], '多层膜反射镜', 'Mo / Si MIRROR', '13.5 nm');
    label(s, ray[4], '反射式掩模', 'REFLECTIVE MASK', '4× 投影缩小');
    label(s, [11.5, 2.05, 6.1], '晶圆台', 'WAFER STAGE', 'Ø 300 mm');
  });
})(F, THREE);
