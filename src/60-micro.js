/* DF-02 · Surface film, die metallization, interconnect cutaway and GAA device.
   All masks, reticle markings, device sections and material samples are generated here. */
((F, T) => {
  'use strict';
  const pi = Math.PI,
    half = pi / 2;
  const label = (s, pos, zh, en, value) => s.labels.push({ pos, zh, en, value });
  const samples = {};
  function sectionMaterial(color, metal, roughness, kind = 'cleave') {
    if (!samples[kind]) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d'),
        im = ctx.createImageData(256, 256),
        rnd = F.rng(kind === 'copper' ? 0xc701 : 0x81a2);
      for (let y = 0; y < 256; y++) {
        const slice =
          (kind === 'copper' ? 3.5 : 6) * Math.sin(y * 0.79) + 2.5 * Math.sin(y * 0.076) + rnd() * 5;
        for (let x = 0; x < 256; x++) {
          const k = 4 * (y * 256 + x),
            tone = 201 + slice + 29 * rnd();
          im.data[k] = tone;
          im.data[k + 1] = tone - (kind === 'copper' ? 12 : 0);
          im.data[k + 2] = tone - (kind === 'copper' ? 23 : 0);
          im.data[k + 3] = 255;
        }
      }
      ctx.putImageData(im, 0, 0);
      samples[kind] = F.texture(c);
    }
    const m = F.mat(color, metal, roughness).clone();
    m.map = samples[kind];
    m.bumpMap = samples[kind];
    m.bumpScale = kind === 'copper' ? 0.006 : 0.012;
    return m;
  }
  function dimension(s, a, b, tick, ink) {
    F.rod(s, ink, a, b, 0.031, 6);
    for (const p of [a, b])
      F.rod(
        s,
        ink,
        [p[0] - tick[0], p[1] - tick[1], p[2] - tick[2]],
        [p[0] + tick[0], p[1] + tick[1], p[2] + tick[2]],
        0.042,
        6
      );
  }
  function cross(s, mat, x, y, z, size) {
    F.box(s, mat, x, y, z, size, 0.018, 0.067);
    F.box(s, mat, x, y + 0.006, z, 0.067, 0.018, size);
  }
  // Light grayscale records lithographic density. Repeated SRAM banks, mirrored
  // logic cores and interleaved routing buses remain legible at different LODs.
  function maskAtlas(large) {
    const c = document.createElement('canvas');
    c.width = large ? 1024 : 512;
    c.height = large ? 768 : 512;
    const g = c.getContext('2d'),
      W = c.width,
      H = c.height,
      rand = F.rng(large ? 0x4d33 : 0xd1e7);
    function fill(color, x, y, w, h) {
      g.fillStyle = color;
      g.fillRect(x, y, w, h);
    }
    function stroke(color, x, y, w, h, t = 1) {
      g.strokeStyle = color;
      g.lineWidth = t;
      g.strokeRect(x + t * 0.5, y + t * 0.5, w - t, h - t);
    }
    const ox = large ? 28 : 13,
      oy = large ? 25 : 12,
      gutter = large ? 11 : 6;
    fill('#282c2c', 0, 0, W, H);
    stroke('#d4c9aa', ox * 0.38, oy * 0.38, W - ox * 0.76, H - oy * 0.76, 3);
    stroke('#737c69', ox * 0.66, oy * 0.66, W - ox * 1.32, H - oy * 1.32, 1);
    const gold = ['#a79873', '#cfc5a1', '#858c7b', '#aeb2a1', '#716c56'];
    function bank(x, y, w, h, flip) {
      fill('#505649', x, y, w, h);
      stroke('#bbb08b', x, y, w, h, 2);
      const columns = flip ? 4 : 3,
        rows = flip ? 3 : 4,
        vx = (w - 11) / columns,
        vy = (h - 11) / rows;
      for (let i = 0; i < columns; i++)
        for (let j = 0; j < rows; j++) {
          const xx = x + 5 + i * vx,
            yy = y + 5 + j * vy,
            bw = vx - 3,
            bh = vy - 3;
          fill((i + j) % 3 ? '#636b57' : '#79806b', xx, yy, bw, bh);
          for (let k = 2; k < (flip ? bw : bh) - 1; k += 3) {
            if (flip) fill('#a0a68b', xx + k, yy + 1, 1, bh - 2);
            else fill('#a7ab92', xx + 1, yy + k, bw - 2, 1);
          }
          if (flip) fill('#423f32', xx, yy + bh * 0.54, bw, 2);
          else fill('#423f32', xx + bw * 0.46, yy, 2, bh);
        }
    }
    function logic(x, y, w, h) {
      fill('#454c45', x, y, w, h);
      stroke('#928d70', x, y, w, h);
      const colors = ['#777e70', '#a3a58c', '#606b60', '#c2b893', '#92947a'];
      for (let yy = y + 4; yy < y + h - 3; yy += 4.3) {
        let xx = x + 3;
        while (xx < x + w - 4) {
          const n = Math.min(2 + rand() * 10, x + w - xx - 2);
          fill(colors[Math.floor(rand() * colors.length)], xx, yy, n, 1 + rand() * 1.6);
          xx += n + 1.3 + rand() * 2.4;
        }
      }
      for (let k = 0; k < 4; k++) {
        const sx = x + 3 + rand() * w * 0.34,
          sy = y + 3 + rand() * (h - 8),
          tx = x + w * 0.58 + rand() * w * 0.31;
        g.strokeStyle = gold[k];
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(tx - 5, sy);
        g.lineTo(tx, sy + 5);
        g.lineTo(tx, y + h - 4);
        g.stroke();
      }
    }
    const innerW = W - 2 * ox,
      innerH = H - 2 * oy;
    const cols = large ? [0.23, 0.23, 0.29, 0.25] : [0.52, 0.48],
      rows = large ? [0.28, 0.3, 0.24, 0.18] : [0.28, 0.46, 0.26];
    let y = oy;
    rows.forEach((rh, j) => {
      let x = ox;
      cols.forEach((cw, i) => {
        const w = cw * innerW - gutter,
          h = rh * innerH - gutter;
        if ((j + i) % 3 === 0 || (large && (i === 0 || i === 1) && j < 2))
          bank(x, y, w, h, !!((j + i) % 2));
        else if ((j + i) % 3 === 1) {
          logic(x, y, w, h * 0.54);
          bank(x, y + h * 0.54 + 3, w * 0.64, h * 0.46 - 3, !!(j % 2));
          logic(x + w * 0.64 + 3, y + h * 0.54 + 3, w * 0.36 - 3, h * 0.46 - 3);
        } else logic(x, y, w, h);
        for (let k = 1; k <= 4; k++)
          fill(gold[k % gold.length], x + w + k * 1.8, y, 1, h + gutter * 0.6);
        for (let k = 1; k <= 4; k++)
          fill(gold[(k + 1) % gold.length], x, y + h + k * 1.8, w + gutter * 0.6, 1);
        x += cw * innerW;
      });
      y += rh * innerH;
    });
    // Edge alignment targets, test pads and the scribe lane.
    for (let x = ox; x < W - ox; x += large ? 13 : 19) {
      fill('#d9caa4', x, 3, large ? 5 : 4, 4);
      fill('#b1a57d', x, H - 8, large ? 5 : 4, 4);
    }
    for (let y = oy; y < H - oy; y += large ? 14 : 19) {
      fill('#c8c39e', 3, y, 4, 5);
      fill('#c8c39e', W - 7, y, 4, 5);
    }
    for (const x of [5, W - 13])
      for (const y of [6, H - 13]) {
        fill('#d4d4b8', x, y + 3, 9, 2);
        fill('#d4d4b8', x + 3, y, 2, 9);
      }
    const t = F.texture(c);
    t.wrapS = t.wrapT = large ? T.ClampToEdgeWrapping : T.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }
  const filmVS = [
    'varying vec3 worldP; varying vec3 normP; varying vec2 localUv;',
    'void main(){vec4 w=modelMatrix*vec4(position,1.);worldP=w.xyz;normP=normalize(mat3(modelMatrix)*normal);',
    'localUv=uv;gl_Position=projectionMatrix*viewMatrix*w;}'
  ].join('\n');
  // Approximate interference at three visible wavelengths. Local film thickness
  // and the viewing angle vary the optical path; the metal mask modulates reflection.
  const filmFS = [
    'precision highp float;varying vec3 worldP;varying vec3 normP;varying vec2 localUv;',
    'uniform sampler2D atlas;uniform float dieView;',
    'void main(){vec3 N=normalize(normP),V=normalize(cameraPosition-worldP);float mu=clamp(dot(N,V),0.,1.);',
    'vec2 q=worldP.xz;vec2 uv=mix((q+vec2(.0,.0))/vec2(1.8,1.2),localUv,dieView);',
    'vec3 mask=sqrt(max(texture2D(atlas,uv).rgb,vec3(0.)));float pat=dot(mask,vec3(.28,.57,.15));',
    'float r=length(q*.0667);float thickness=585.+(q.x*.87+q.y*.43)*7.2+31.*r*r+21.*sin(q.y*.105-q.x*.052);',
    'float refracted=sqrt(max(0.,1.-(1.-mu*mu)/(1.64*1.64)));',
    'vec3 phase=6.2831853*(2.*1.64*thickness*refracted/vec3(625.,535.,452.));',
    'vec3 interference=.5+.5*cos(phase+vec3(.18,.5,.76));',
    'float luma=dot(interference,vec3(.25,.58,.17));interference=mix(vec3(luma),interference,.69);',
    'float ribbon=.26+.69*(.5+.5*cos(q.x*.127-q.y*.074+mu*.75));',
    'vec3 body=mix(vec3(.20,.235,.25),vec3(.052,.056,.048)+interference*vec3(.51,.49,.425),ribbon*(1.-dieView*.69));',
    'vec3 layer=mix(body*.22,body*1.42+vec3(.055,.047,.024),smoothstep(.15,.81,pat));',
    'vec3 reflected=reflect(-V,N);float rack=pow(max(0.,1.-abs(reflected.x*.80+reflected.z*.29+.34)*1.35),13.);',
    'layer+=vec3(.22,.21,.18)*rack*(.22+pat*.78)+vec3(.025,.030,.026)*(1.-mu);',
    'vec2 whole=q/vec2(1.8,1.2);vec2 edge=min(fract(whole),1.-fract(whole));vec2 fw=min(fwidth(whole),vec2(.08));',
    'vec2 open=smoothstep(vec2(.009)-fw*.49,vec2(.022)+fw*.49,edge);',
    'layer*=mix(.40,1.,mix(min(open.x,open.y),1.,dieView));',
    'gl_FragColor=vec4(layer,1.);}'
  ].join('\n');
  function film(s, geo, isDie, y) {
    const material = new T.ShaderMaterial({
      extensions: { derivatives: true },
      uniforms: { atlas: { value: maskAtlas(isDie) }, dieView: { value: isDie ? 1 : 0 } },
      vertexShader: filmVS,
      fragmentShader: filmFS
    });
    const o = F.mesh(s, geo, material, 0, y, 0);
    o.rotation.x = -half;
    return o;
  }
  function waferShape(r) {
    const shape = new T.Shape();
    const a = 0.036;
    shape.moveTo(r * Math.sin(a), -r * Math.cos(a));
    for (let i = 0; i <= 224; i++) {
      const t = -half + a + ((2 * pi - 2 * a) * i) / 224;
      shape.lineTo(r * Math.cos(t), r * Math.sin(t));
    }
    shape.quadraticCurveTo(0, -r + 0.54, r * Math.sin(a), -r * Math.cos(a));
    shape.closePath();
    return shape;
  }
  F.define(5, (s) => {
    const steel = F.mat(0xb0b1a6, 0.83, 0.22),
      chuck = F.mat(0x363d3c, 0.71, 0.33);
    const silver = F.mat(0x848c8a, 0.88, 0.2),
      gold = F.mat(0xc4a168, 0.63, 0.34);
    // A 300-mm notched disk, nominally 0.0775 local units thick (=775 µm).
    F.cyl(s, chuck, 0, -0.71, 0, 15.28, 14.59, 0.9, 0, 0, 0, 128);
    F.cyl(s, silver, 0, -0.393, 0, 15.21, 15.16, 0.091, 0, 0, 0, 144);
    F.cyl(s, chuck, 0, -0.211, 0, 15.16, 15.16, 0.19, 0, 0, 0, 144);
    for (let j = 0; j < 3; j++) {
      const a = (j * 2 * pi) / 3 + 0.26,
        x = 15.16 * Math.sin(a),
        z = 15.16 * Math.cos(a);
      F.box(s, silver, x, -0.095, z, 0.93, 0.16, 0.65, 0, a, 0);
      F.box(s, chuck, x, 0.012, z, 0.62, 0.059, 0.38, 0, a, 0);
    }
    const shell = F.mesh(
      s,
      new T.ExtrudeGeometry(waferShape(15), { depth: 0.0775, bevelEnabled: false, curveSegments: 36 }),
      steel,
      0,
      -0.0775,
      0
    );
    shell.rotation.x = -half;
    film(s, new T.ShapeGeometry(waferShape(15), 48), false, 0.01);
    // Every full die gets optical corner fiducials batched into two draw calls.
    const dark = F.mat(0x303b3d, 0.5, 0.35);
    const corners = [];
    for (let ix = -8; ix < 9; ix++)
      for (let iz = -12; iz < 13; iz++) {
        const cx = (ix + 0.5) * 1.8,
          cz = (iz + 0.5) * 1.2;
        if (Math.hypot(Math.abs(cx) + 0.86, Math.abs(cz) + 0.55) > 14.88) continue;
        corners.push(
          [cx - 0.78, 0.025, cz - 0.48, 0.11, 0.012, 0.035, 0, 0, 0],
          [cx - 0.83, 0.025, cz - 0.425, 0.03, 0.012, 0.14, 0, 0, 0]
        );
      }
    F.inst(s, new T.BoxGeometry(), gold, corners);
    for (let j = 0; j < 48; j++) {
      const a = (j * pi) / 24,
        x = 14.55 * Math.sin(a),
        z = 14.55 * Math.cos(a);
      F.box(
        s,
        j % 6 ? dark : gold,
        x,
        0.028,
        z,
        j % 6 ? 0.035 : 0.089,
        0.012,
        j % 6 ? 0.16 : 0.25,
        0,
        a,
        0
      );
    }
    const sx = 3.6,
      sz = 2.4,
      w = 3.6,
      h = 2.22;
    for (const dx of [-1, 1])
      for (const dz of [-1, 1]) {
        const x = sx + (dx * w) / 2,
          z = sz + (dz * h) / 2;
        F.box(s, gold, x - dx * 0.22, 0.051, z, 0.46, 0.021, 0.054);
        F.box(s, gold, x, 0.051, z - dz * 0.15, 0.054, 0.021, 0.33);
      }
    cross(s, steel, -11.7, 0.036, 4.62, 0.52);
    label(s, [3.6, 0.075, 2.4], '目标裸片', 'DIE OF INTEREST', 'LOT-A7F3');
    label(s, [-9.7, 0.02, -10.0], '薄膜干涉', 'THIN FILM', '随观察角度变化');
    label(s, [0.04, 0.02, 14.7], '定向缺口', 'ORIENTATION NOTCH', 'Ø 300 mm');
    label(s, [12.9, -0.02, 6.7], '硅基片', 'SILICON WAFER', '厚约 775 μm');
  });
  F.define(6, (s) => {
    const base = F.mat(0x41494c, 0.78, 0.33),
      side = F.mat(0x747879, 0.83, 0.25);
    const barrier = F.mat(0x91856b, 0.73, 0.31),
      gold = F.mat(0xcbaf78, 0.6, 0.29),
      dark = F.mat(0x38413e, 0.59, 0.4);
    F.box(s, base, 0, -0.68, 0, 36, 1.22, 23.2);
    for (let k = 0; k < 5; k++)
      F.box(s, k % 2 ? barrier : side, 0, -0.19 + k * 0.067, 0, 36.02, 0.036, 23.22);
    const top = film(s, new T.PlaneGeometry(35.8, 23.0), true, 0.17);
    top.material.polygonOffset = true;
    top.material.polygonOffsetFactor = 1;
    // Solder pads and on-chip seal ring follow the upper side of the saw cut.
    for (let i = -29; i <= 29; i++) {
      for (const z of [-11.03, 11.03]) {
        F.box(s, base, i * 0.59, 0.197, z, 0.4, 0.052, 0.49);
        F.box(s, gold, i * 0.59, 0.24, z, 0.29, 0.045, 0.36);
      }
    }
    for (let i = -17; i <= 17; i++)
      for (const x of [-17.46, 17.46]) {
        F.box(s, base, x, 0.2, i * 0.595, 0.48, 0.051, 0.4);
        F.box(s, gold, x, 0.245, i * 0.595, 0.35, 0.043, 0.29);
      }
    const inset = [
      [-15.4, -7.2],
      [-6.5, -7.2],
      [-15.4, -1.0],
      [-6.5, -1.0]
    ];
    const cells = [];
    for (const [x, z] of inset) {
      for (let j = 0; j < 7; j++)
        for (let k = 0; k < 9; k++) {
          cells.push([x + k * 0.56, 0.215, z + j * 0.44, 0.47, 0.053, 0.31, 0, 0, 0]);
        }
    }
    F.inst(s, new T.BoxGeometry(), F.mat(0x8c967d, 0.69, 0.34), cells);
    for (let j = 0; j < 12; j++) {
      const z = -8 + j * 0.105,
        x = 1.2 + j * 0.1;
      F.box(s, barrier, -1.4, 0.23, z, 5.2, 0.036, 0.035);
      F.box(s, barrier, x, 0.24, (z - 1.1) / 2 + 1.1, 0.035, 0.038, Math.abs(z + 1.1));
    }
    // Inspection window is registered to the same die corner as the next scene.
    const cx = 5,
      cz = 3;
    F.box(s, dark, cx, 0.257, cz, 5.02, 0.08, 3.18);
    for (let j = -5; j <= 5; j++) F.box(s, barrier, cx + j * 0.39, 0.315, cz, 0.11, 0.042, 2.88);
    for (let j = -3; j <= 3; j++) F.box(s, gold, cx, 0.351, cz + j * 0.38, 4.57, 0.04, 0.068);
    for (const x of [cx - 2.5, cx + 2.5]) F.box(s, gold, x, 0.371, cz, 0.049, 0.044, 3.19);
    for (const z of [cz - 1.59, cz + 1.59]) F.box(s, gold, cx, 0.371, z, 5.02, 0.044, 0.049);
    cross(s, gold, 13.4, 0.26, -8.7, 0.55);
    label(s, [-11.1, 0.35, -3.6], '静态存储阵列', 'SRAM BANK', '重复存储单元');
    label(s, [5, 0.49, 3], '互连窗口', 'METAL WINDOW', '当前层 M3');
    label(s, [16.8, 0.28, 6.3], '周边焊盘', 'I/O PAD', '引出与测试');
    label(s, [1.5, 0.27, -6.8], '标准单元区', 'STANDARD CELLS', '逻辑门阵列');
  });
  F.define(7, (s) => {
    const si = sectionMaterial(0x3e4d54, 0.58, 0.42),
      silicide = sectionMaterial(0x78817d, 0.65, 0.37);
    const copper = sectionMaterial(0xc8875a, 0.66, 0.37, 'copper'),
      topCopper = sectionMaterial(0xd69a68, 0.71, 0.34, 'copper');
    const barrier = F.mat(0x74513e, 0.66, 0.42),
      stud = F.mat(0xb97b54, 0.8, 0.27);
    const marking = F.mat(0xb5a080, 0.44, 0.41),
      cutEdge = F.mat(0x647478, 0.35, 0.47);
    const oxide = new T.MeshPhysicalMaterial({
      color: 0x93a4a7,
      metalness: 0.12,
      roughness: 0.46,
      transparent: true,
      opacity: 0.118,
      depthWrite: false
    });
    F.box(s, si, 0, -0.49, 0, 30, 1.49, 19);
    F.box(s, silicide, 0, 0.278, 0, 29.86, 0.095, 18.83);
    // Gates in the exposed device layer remain below the bottom dielectric.
    for (let x = -13.4; x < 14; x += 1.22)
      for (let z = -7.9; z < 8.9; z += 1.26) {
        F.box(s, si, x, 0.358, z, 0.85, 0.09, 0.76);
        F.box(s, cutEdge, x, 0.444, z, 0.17, 0.104, 0.82);
        if (z > 3.2) F.box(s, silicide, x + 0.23, 0.443, z, 0.21, 0.09, 0.34);
      }
    for (let k = 0; k < 5; k++)
      F.box(s, k % 2 ? silicide : si, 0, -1.11 + k * 0.125, 0, 30.025, 0.025, 19.025);
    // Fracture terraces expose the front-right quadrant. The alternating Cu
    // tracks and the intervening via plugs meet face-to-face at each level.
    const levels = [],
      back = -8.0,
      left = -14.35,
      right = 14.35;
    for (let level = 0; level < 12; level++) {
      const leftFront = 7.91 - level * 0.37,
        rightFront = 3.18 - level * 0.695,
        stepX = 0.74 - level * 0.27;
      const y = 0.787 + level * 0.8,
        th = 0.18 + level * 0.008,
        pitch = level < 6 ? 1.2 : 2.4;
      const lineW = level < 6 ? 0.27 : level < 10 ? 0.51 : 0.77,
        mat = level >= 9 ? topCopper : copper;
      const leftW = stepX - left,
        rightW = right - stepX;
      F.box(
        s,
        oxide,
        (left + stepX) / 2,
        y - 0.142,
        (back + leftFront) / 2,
        leftW,
        0.68,
        leftFront - back
      );
      F.box(
        s,
        oxide,
        (right + stepX) / 2,
        y - 0.142,
        (back + rightFront) / 2,
        rightW,
        0.68,
        rightFront - back
      );
      F.box(s, cutEdge, (left + stepX) / 2, y - 0.391, leftFront, leftW, 0.055, 0.065);
      F.box(s, cutEdge, (right + stepX) / 2, y - 0.391, rightFront, rightW, 0.055, 0.065);
      F.box(
        s,
        cutEdge,
        stepX,
        y - 0.391,
        (leftFront + rightFront) / 2,
        0.065,
        0.055,
        leftFront - rightFront
      );
      for (let slot = -12; slot <= 12; slot++) {
        const coord = slot * pitch;
        if (level % 2 === 0) {
          if (coord < back + 0.22 || coord > leftFront - 0.16) continue;
          const stop = coord <= rightFront - 0.13 ? right : stepX;
          F.box(
            s,
            barrier,
            (left + stop) / 2,
            y - 0.04,
            coord,
            stop - left - 0.2,
            th + 0.025,
            lineW + 0.045
          );
          F.box(s, mat, (left + stop) / 2, y, coord, stop - left - 0.16, th, lineW);
        } else {
          if (coord < left + 0.3 || coord > right - 0.3) continue;
          const stop = coord < stepX - 0.12 ? leftFront : rightFront;
          F.box(
            s,
            barrier,
            coord,
            y - 0.04,
            (back + stop) / 2,
            lineW + 0.045,
            th + 0.025,
            stop - back - 0.18
          );
          F.box(s, mat, coord, y, (back + stop) / 2, lineW, th, stop - back - 0.16);
        }
      }
      levels.push({ y, th, pitch, stepX, leftFront, rightFront, lineW });
    }
    const vias = [],
      capped = [];
    for (let k = 1; k < levels.length; k++) {
      const lo = levels[k - 1],
        hi = levels[k],
        xp = (k % 2 ? hi : lo).pitch,
        zp = (k % 2 ? lo : hi).pitch;
      for (let i = -12; i <= 12; i++)
        for (let j = -7; j <= 7; j++) {
          const x = i * xp,
            z = j * zp;
          if (x < left + 0.32 || x > right - 0.32 || z < back + 0.32) continue;
          if (
            z >
            Math.min(
              x < lo.stepX ? lo.leftFront : lo.rightFront,
              x < hi.stepX ? hi.leftFront : hi.rightFront
            ) -
              0.22
          )
            continue;
          if (F.mod(i * 7 + j * 5 + k, 5) !== 0 && F.mod(i - j + k, 7) !== 0) continue;
          const lowY = lo.y + lo.th * 0.5,
            highY = hi.y - hi.th * 0.5,
            radius = hi.pitch < 2 ? 0.105 : 0.17;
          vias.push([x, (lowY + highY) / 2, z, radius, highY - lowY, radius, 0, 0, 0]);
          capped.push([x, highY - 0.041, z, radius * 1.32, 0.077, radius * 1.32, 0, 0, 0]);
        }
    }
    F.inst(s, new T.CylinderGeometry(1, 1, 1, 12), stud, vias);
    F.inst(s, new T.CylinderGeometry(1, 1, 1, 12), topCopper, capped);
    // Copper stops at the barrier liner; the bottom plug finishes on silicon.
    F.cyl(s, si, 3, 0.569, 3, 1.85, 1.95, 0.54, 0, 0, 0, 56);
    F.cyl(s, barrier, 3, 0.915, 3, 1.2, 1.36, 0.61, 0, 0, 0, 56);
    F.cyl(s, topCopper, 3, 1.084, 3, 1.08, 1.08, 0.29, 0, 0, 0, 56);
    F.cyl(s, stud, 3, 1.249, 3, 0.78, 0.82, 0.072, 0, 0, 0, 56);
    for (const n of [0, 3, 7, 11]) {
      const L = levels[n];
      F.decal(s, 'M' + (n + 1), left + 1.1, L.y - 0.16, L.leftFront + 0.087, 1.41, 0.41, {
        color: '#d5c4a5'
      });
    }
    dimension(s, [-14.83, 0.75, 8.1], [-14.83, 9.75, 8.1], [0.24, 0, 0.0], marking);
    label(s, [-6.5, 9.61, 0.45], '顶层铜布线', 'UPPER METAL', 'M12');
    label(s, [7.2, 4.9, -1.54], '层间通孔', 'COPPER VIA', '上下层电气连接');
    label(s, [-5.4, 3.11, 6.9], '层间介质', 'LOW-k DIELECTRIC', '12 层互连示意');
    label(s, [3, 1.29, 3], '底层接触孔', 'CONTACT PLUG', '通往有源器件');
  });
  function rounded(path, w, h, r) {
    const l = -w / 2,
      b = -h / 2,
      a = w / 2,
      t = h / 2;
    r = Math.min(r, h / 2, w / 2);
    path.moveTo(l + r, b);
    path.lineTo(a - r, b);
    path.quadraticCurveTo(a, b, a, b + r);
    path.lineTo(a, t - r);
    path.quadraticCurveTo(a, t, a - r, t);
    path.lineTo(l + r, t);
    path.quadraticCurveTo(l, t, l, t - r);
    path.lineTo(l, b + r);
    path.quadraticCurveTo(l, b, l + r, b);
    path.closePath();
    return path;
  }
  // The section is drawn in (-Z,Y) and extruded in +X along the channel.
  function extrusion(s, shape, x, y, z, length, mat) {
    const g = new T.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 6 });
    g.rotateY(half);
    return F.mesh(s, g, mat, x, y, z);
  }
  function ring(s, x, y, len, ow, oh, iw, ih, mat, cut = false) {
    const R = Math.min(oh / 2 - 0.02, 0.64),
      r = Math.min(ih / 2 - 0.02, 0.37);
    const shape = new T.Shape();
    if (!cut) {
      rounded(shape, ow, oh, R);
      shape.holes.push(rounded(new T.Path(), iw, ih, r));
    } else {
      const start = -0.76,
        a = ow / 2,
        b = iw / 2,
        t = oh / 2,
        k = ih / 2;
      shape.moveTo(start, -t);
      shape.lineTo(a - R, -t);
      shape.quadraticCurveTo(a, -t, a, -t + R);
      shape.lineTo(a, t - R);
      shape.quadraticCurveTo(a, t, a - R, t);
      shape.lineTo(start, t);
      shape.lineTo(start, k);
      shape.lineTo(b - r, k);
      shape.quadraticCurveTo(b, k, b, k - r);
      shape.lineTo(b, -k + r);
      shape.quadraticCurveTo(b, -k, b - r, -k);
      shape.lineTo(start, -k);
      shape.closePath();
    }
    return extrusion(s, shape, x, y, 0, len, mat);
  }
  function cleavedFace(s, center, width, front, positive) {
    const W = 176,
      H = 304,
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d'),
      im = g.createImageData(W, H),
      rng = F.rng(positive ? 0x8c7 : 0x4d3);
    // Graded doping and growth fronts bend around the three silicon-sheet ends.
    // The random texture is fixed in the cleaved plane, including during recording.
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = positive ? x / (W - 1) : 1 - x / (W - 1),
          v = 1 - y / (H - 1);
        let carrier = 0,
          edge = 0;
        for (const cy of [0.214, 0.487, 0.761]) {
          const k = Math.hypot((u + 0.08) * 1.12, (v - cy) * 4.88);
          carrier += Math.exp(-3.6 * k * k);
          edge +=
            Math.exp(-Math.pow((k - 0.53) * 18, 2)) + 0.58 * Math.exp(-Math.pow((k - 0.71) * 23, 2));
        }
        const noise = (rng() - 0.5) * 28,
          stria = 3.2 * Math.sin(y * 0.64 + x * 0.042) + 2.7 * Math.sin(y * 0.17 - x * 0.014);
        const n = 4 * (y * W + x),
          m = 100 + noise + stria + carrier * 42 + edge * 14;
        im.data[n] = m * 0.79;
        im.data[n + 1] = m * 0.96;
        im.data[n + 2] = m * 1.045;
        im.data[n + 3] = 255;
      }
    g.putImageData(im, 0, 0);
    const mat = new T.MeshStandardMaterial({ map: F.texture(c), roughness: 0.61, metalness: 0.21 });
    F.mesh(s, new T.PlaneGeometry(width, 7.48), mat, center, 4.535, front + 0.029);
  }
  function epitaxy(s, x, mat, lining, core) {
    const uv = [
      [-2.6, 0],
      [2.6, 0],
      [4.46, 1.48],
      [4.86, 3.05],
      [4.48, 5.65],
      [3.39, 7.07],
      [2.46, 7.57],
      [-2.46, 7.57],
      [-3.39, 7.07],
      [-4.48, 5.65],
      [-4.86, 3.05],
      [-4.46, 1.48]
    ];
    function profile(scale) {
      const p = new T.Shape();
      uv.forEach(([u, v], i) => {
        const y = (v - 3.62) * scale + 3.62;
        i ? p.lineTo(u * scale, y) : p.moveTo(u * scale, y);
      });
      p.closePath();
      return p;
    }
    const positive = x > 0,
      front = positive ? 2.0 : 2.61,
      cap = positive ? 1.03 : 1.32;
    const cutWidth = 4.7 - cap,
      cutX = positive ? x : x + cap,
      fullX = positive ? x + cutWidth : x;
    const geo = new T.ExtrudeGeometry(profile(1), {
      depth: cap,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.082,
      bevelThickness: 0.064
    });
    geo.rotateY(half);
    F.mesh(s, geo, mat, fullX, 0.75, 0);
    const polygon = [];
    for (let i = 0; i < uv.length; i++) {
      const a = uv[i],
        b = uv[(i + 1) % uv.length];
      if (a[0] >= -front) polygon.push(a);
      if (a[0] >= -front !== b[0] >= -front) {
        const t = (-front - a[0]) / (b[0] - a[0]);
        polygon.push([-front, a[1] + t * (b[1] - a[1])]);
      }
    }
    const cleave = new T.Shape();
    polygon.forEach(([u, v], i) => (i ? cleave.lineTo(u, v) : cleave.moveTo(u, v)));
    cleave.closePath();
    extrusion(s, cleave, cutX, 0.75, 0, cutWidth, mat);
    cleavedFace(s, cutX + cutWidth * 0.5, cutWidth - 0.03, front, positive);
    // Two close doping contours on the outer cleaved face of the epitaxial region.
    const start = x > 0 ? x + 4.758 : x - 0.117;
    extrusion(s, profile(0.9), start, 0.75, 0, 0.048, lining);
    extrusion(s, profile(0.875), x > 0 ? start + 0.046 : start - 0.031, 0.75, 0, 0.036, mat);
    extrusion(s, profile(0.694), x > 0 ? start + 0.08 : start - 0.056, 0.75, 0, 0.031, core);
    // Growth terraces visible on the gently tilted outer facet.
    for (let i = 0; i < 6; i++) {
      const y = 2.35 + i * 0.57,
        slope = y - 0.75 < 3.05 ? 4.46 + (0.4 * (y - 2.23)) / 1.57 : 4.86 - (0.38 * (y - 3.8)) / 2.6;
      F.box(s, lining, fullX + cap * 0.5, y, slope, cap - 0.075, 0.027, 0.035);
    }
  }
  F.define(8, (s) => {
    const si = sectionMaterial(0x3c4d59, 0.52, 0.45),
      epi = sectionMaterial(0x718291, 0.52, 0.39);
    const epiEdge = sectionMaterial(0x5e7180, 0.52, 0.41),
      epiCore = sectionMaterial(0x76848e, 0.45, 0.4);
    const chan = sectionMaterial(0xa6b6b4, 0.56, 0.33),
      ox = F.mat(0x918b73, 0.43, 0.34);
    const gate = sectionMaterial(0xd0a968, 0.7, 0.31, 'copper'),
      liner = F.mat(0x8e744a, 0.67, 0.38);
    const ins = F.mat(0x636a6b, 0.34, 0.45),
      copper = F.mat(0xc8875a, 0.78, 0.32);
    const tungsten = F.mat(0x969b96, 0.81, 0.29),
      dark = F.mat(0x28363e, 0.53, 0.48);
    F.box(s, si, 0, -0.9, 0, 30, 2.06, 17.8);
    F.box(s, dark, 0, 0.15, 0, 29.9, 0.18, 17.69);
    for (let n = 0; n < 5; n++)
      F.box(s, n % 2 ? dark : ins, 0, -1.86 + n * 0.15, 0, 30.025, 0.039, 17.82);
    // Three ridge fins on the substrate continue beneath the active device.
    for (const z of [-6, 0, 6]) {
      F.box(s, dark, 0, 0.392, z, 27.45, 0.4, 2.57);
      F.box(s, epi, 0, 0.64, z, 25.8, 0.33, 1.48);
    }
    // Neighbouring device footprints share bundles. The central cell is cleaved open.
    const inactive = [];
    for (const z of [-6.86, 6.86])
      for (const x of [-11, -8.7, 8.7, 11]) {
        inactive.push([x, 0.91, z, 0.94, 0.39, 1.71, 0, 0, 0]);
      }
    F.inst(s, new T.BoxGeometry(), ins, inactive);
    for (const x of [-8.1, 8.1]) F.box(s, ox, x, 0.68, 0, 5.8, 0.31, 8.61);
    epitaxy(s, -11.25, epi, epiEdge, epiCore);
    epitaxy(s, 6.45, epi, epiEdge, epiCore);
    // Faceted source/drain epitaxy, silicide landing, tungsten plug and Cu contact.
    for (const x of [-8.87, 8.87]) {
      F.box(s, tungsten, x, 8.38, 0, 4.67, 0.3, 4.81);
      const pad = rounded(new T.Shape(), 4.17, 1.56, 0.34);
      extrusion(s, pad, x - 1.46, 9.22, 0, 2.92, tungsten);
      F.box(s, copper, x, 10.1, 0, 3.22, 0.43, 4.37);
      for (const z of [-1.56, -0.79, 0, 0.79, 1.56]) F.box(s, liner, x, 10.334, z, 2.74, 0.034, 0.034);
    }
    // Each individual silicon sheet is enclosed on all four sides by a high-k
    // dielectric and gate metal. The nearer half of the right gate is removed.
    const activeY = [2.37, 4.44, 6.51];
    for (const y of activeY) {
      const silicon = rounded(new T.Shape(), 6.45, 0.66, 0.295);
      extrusion(s, silicon, -6.63, y, 0, 13.26, chan);
      ring(s, -3.18, y, 3.22, 7.17, 1.21, 6.46, 0.67, ox);
      ring(s, -3.11, y, 3.04, 8.12, 1.86, 7.18, 1.23, gate);
      ring(s, -0.06, y, 3.07, 7.17, 1.21, 6.46, 0.67, ox, true);
      ring(s, -0.05, y, 3.0, 8.12, 1.86, 7.18, 1.23, gate, true);
      ring(s, -4.32, y, 0.5, 7.4, 1.52, 6.46, 0.67, ins, true);
      ring(s, 3.72, y, 0.52, 7.4, 1.52, 6.46, 0.67, ins, true);
    }
    F.box(s, liner, -0.12, 4.43, -4.14, 6.06, 6.77, 0.5);
    F.box(s, gate, -0.12, 7.84, -3.26, 5.97, 1.05, 2.23);
    F.box(s, tungsten, -0.13, 8.63, -3.45, 3.04, 0.61, 1.49);
    F.box(s, copper, -0.13, 9.11, -3.45, 3.25, 0.38, 1.75);
    // Sidewall spacers are opened on the front face as part of the section.
    for (const x of [-3.69, 3.58]) {
      F.box(s, ins, x, 4.39, -3.83, 0.64, 7.2, 0.77);
      for (const y of [1.24, 3.46, 5.51, 7.53]) F.box(s, ins, x, y, -2.24, 0.64, 0.43, 3.92);
    }
    // Visible cross-section interface below the first suspended channel.
    F.box(s, ins, 0, 0.87, 0, 11.57, 0.47, 8.71);
    F.box(s, si, 0, 1.16, 0, 10.81, 0.19, 7.68);
    for (const x of [-8.8, 8.8]) {
      F.box(s, dark, x, 0.39, 4.96, 5.14, 0.2, 0.79);
      F.box(s, ins, x, 0.514, 4.96, 4.94, 0.14, 0.63);
      F.box(s, epiEdge, x, 0.592, 4.96, 4.76, 0.055, 0.45);
    }
    F.shadow(s, -8.5, 0.85, 0, 9.7, 12, 0.54);
    F.shadow(s, 8.5, 0.85, 0, 9.7, 12, 0.54);
    F.shadow(s, 0, 1.266, 0, 11.8, 9.6, 0.43);
    dimension(s, [4.91, 2.32, 4.54], [4.91, 6.52, 4.54], [0.27, 0, 0], liner);
    label(s, [4.38, 4.46, 2.98], '三层纳米片', 'SILICON NANOSHEETS', '3 层沟道');
    label(s, [0.52, 6.98, -2.74], '环绕栅金属', 'GATE ALL AROUND', '高 k 栅介质');
    label(s, [-8.8, 7.68, 2.03], '源极 / 漏极', 'SOURCE / DRAIN', '外延半导体');
    label(s, [8.81, 10.24, 0.1], '接触金属', 'METAL CONTACT', '3 nm 为工艺代号');
  });
})(F, THREE);
