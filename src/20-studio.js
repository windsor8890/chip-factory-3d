((F, T) => {
  'use strict';
  const rect = new T.BoxGeometry(),
    circle = new T.CylinderGeometry(0.5, 0.5, 1, 80);
  F.shared.add(rect);
  F.shared.add(circle);
  const stages = [
    [
      '厂区总览',
      'FAB CAMPUS',
      400,
      [0, 3, 0, 32, 33, 167, 36],
      [0, 3, 0, 27, 32, 157, 36],
      [-7, 12, -4, 24, 40, 54, 36]
    ],
    [
      '厂房剖面',
      'FACTORY SECTION',
      100,
      [0, 16, 0, 24, 40, 67.5, 36],
      [0, 7, 1, 29, 20, 80, 36],
      [0, 8, 12, 10, 12, 34, 36]
    ],
    [
      '洁净室',
      'CLEANROOM',
      25,
      [0, 7, 17, 10, 12, 51, 36],
      [0, 6, 2, 21, 20, 74, 36],
      [-9, 5, -5, 15, 14, 19.5, 36]
    ],
    [
      '光刻设备',
      'EXPOSURE TOOL',
      5,
      [0, 7, 0, 15, 14, 39, 36],
      [0, 6, 0, 28, 20, 54, 36],
      [2, 7, 0, 9, 12, 17, 36]
    ],
    [
      'EUV 光路',
      'EUV OPTICS',
      0.45,
      [0, 5, 8, 9, 12, 34, 36],
      [0, 5, -1, 24, 26, 72, 36],
      [8, 2, 5, 16, 47, 22.5, 36]
    ],
    [
      '晶圆表面',
      'WAFER SURFACE',
      0.3,
      [0, 0, 0, 16, 47, 45, 36],
      [0, 0, 0, -17, 47, 54, 36],
      [3.6, 0.1, 2.4, 9, 65, 5.4, 36]
    ],
    [
      '裸片版图',
      'DIE FLOORPLAN',
      0.018,
      [0, 0, 0, 9, 65, 54, 36],
      [0, 0, 0, -14, 53, 64, 36],
      [5, 0.48, 3, 16, 58, 7.5, 36]
    ],
    [
      '铜互连',
      'INTERCONNECT',
      0.000003,
      [0, 10, 0, 16, 58, 45, 36],
      [0, 5, 0, 30, 20, 56, 36],
      [3, 1.1, 3, 12, 45, 6, 36]
    ],
    [
      '环绕栅晶体管',
      'GATE ALL AROUND',
      0.00000005,
      [0, 9, 0, 12, 45, 36, 36],
      [0, 3, 0, 31, 20, 60, 36],
      [0, 3, 0, 25, 17, 48, 36]
    ]
  ];
  const metres = [2.5, 1, 0.25, 0.1, 0.02, 0.01, 0.0005, 1e-7, 1e-9];
  F.stages = stages.map(([zh, en, field, A, B, C], id) => ({
    id,
    zh,
    en,
    field,
    A,
    B,
    C,
    metresPerUnit: metres[id]
  }));
  F.widthOut = [40, 24, 13, 12, 15, 3.6, 5, 4];
  F.widthIn = [50, 36, 26, 24, 30, 36, 30, 24];
  let env = null;
  function environment(r) {
    if (env) return env;
    const w = 128,
      h = 64,
      px = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const u = x / w,
          v = y / h,
          k = (y * w + x) * 4;
        const flag = (cx, cy, wx, wy) =>
          Math.exp(-Math.pow((u - cx) / wx, 4) - Math.pow((v - cy) / wy, 4));
        const key = flag(0.26, 0.68, 0.15, 0.15) * 2.6,
          rim = flag(0.74, 0.61, 0.055, 0.22) * 1.8,
          top = flag(0.5, 0.9, 0.43, 0.09);
        px[k] = 0.15 + key + rim * 0.69 + top * 0.5;
        px[k + 1] = 0.16 + key * 0.93 + rim * 0.85 + top * 0.55;
        px[k + 2] = 0.17 + key * 0.82 + rim + top * 0.61;
        px[k + 3] = 1;
      }
    const tex = new T.DataTexture(px, w, h, T.RGBAFormat, T.FloatType);
    tex.mapping = T.EquirectangularReflectionMapping;
    tex.needsUpdate = true;
    const gen = new T.PMREMGenerator(r);
    env = gen.fromEquirectangular(tex);
    gen.dispose();
    tex.dispose();
    return env;
  }
  const lights = [
    [2.5, 1.0, 1.12],
    [2.1, 1.15, 1.1],
    [2.15, 1.15, 1.15],
    [1.9, 1.0, 1.05],
    [2.05, 1.1, 1.0],
    [2.3, 1.2, 1.0],
    [2.15, 1.08, 1.1],
    [2.15, 1.05, 1.1],
    [2.2, 1.05, 1.05]
  ];
  F.instances = [];
  F.stage = (id) => {
    if (F.instances[id]) return F.instances[id];
    const d = F.stages[id],
      scene = new T.Scene(),
      root = new T.Group(),
      camera = new T.PerspectiveCamera(36, 1, 0.1, 900);
    scene.add(root);
    scene.background = new T.Color(id < 3 ? 0x131717 : 0x0e1112);
    scene.fog = new T.FogExp2(0x141819, id < 3 ? 0.0032 : 0.0023);
    scene.environment = environment(F.renderer).texture;
    const [key, rim, sky] = lights[id];
    scene.add(new T.HemisphereLight(0xe2e6e5, 0x4c493e, sky * 0.71));
    const lamp = (color, intensity, x, y, z) => {
      const l = new T.DirectionalLight(color, intensity);
      l.position.set(x, y, z);
      scene.add(l);
      return l;
    };
    const keyLight = lamp(0xffeee0, key, -44, 67, 39);
    lamp(0xd4e5ee, rim, 55, 28, -47);
    if (!F.params.has('lq') && [0, 1, 2, 3, 4, 7, 8].includes(id)) {
      keyLight.castShadow = true;
      const span = [67, 36, 32, 26, 27, 0, 0, 24, 22][id];
      Object.assign(keyLight.shadow.camera, {
        left: -span,
        right: span,
        top: span,
        bottom: -span,
        near: 12,
        far: 182
      });
      keyLight.shadow.mapSize.set(1536, 1536);
      keyLight.shadow.bias = -0.00023;
      keyLight.shadow.normalBias = span * 0.0008;
      keyLight.shadow.autoUpdate = false;
      keyLight.shadow.needsUpdate = true;
    }
    if (id === 3) lamp(0xffc94d, 1.1, -30, 10, 24);
    const s = {
      id,
      scene,
      root,
      camera,
      fogDensity: scene.fog.density,
      anim: [],
      labels: [],
      units: [],
      flows: [],
      batches: new Map(),
      portals: [],
      enterFrame: d.A,
      exitFrame: d.C,
      build() {
        F.builders[id](s);
        F.flush(s);
      },
      update(t, p) {
        for (const fn of s.anim) fn(t, p);
        for (const door of s.portals) door.update(p);
      },
      dispose() {
        const privateAssets = new Set();
        s.root.traverse((o) => {
          if (o.isInstancedMesh) o.dispose();
          if (o.geometry) privateAssets.add(o.geometry);
          if (o.material)
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
              if (F.shared.has(m)) continue;
              privateAssets.add(m);
              for (const tex of Object.values(m)) if (tex?.isTexture) privateAssets.add(tex);
            }
        });
        for (const asset of privateAssets) if (!F.shared.has(asset)) asset.dispose();
        keyLight.shadow.dispose();
        s.root.removeFromParent();
        s.root.clear();
        F.instances[id] = null;
      }
    };
    s.build();
    if (keyLight.castShadow)
      s.root.traverse((obj) => {
        if (obj.isMesh && obj.material?.isMeshStandardMaterial && !obj.material.transparent) {
          obj.receiveShadow = true;
          obj.castShadow =
            obj.parent === s.root &&
            ((obj.isInstancedMesh && obj.instanceMatrix.usage !== T.DynamicDrawUsage) ||
              obj.geometry.type === 'ExtrudeGeometry');
        }
      });
    if (id < 3) studioFloor(s);
    if (id) F.portal(s, id - 1, 'in', d.A.slice(0, 3), F.widthIn[id - 1]);
    if (id < 8) F.portal(s, id, 'out', d.C.slice(0, 3), F.widthOut[id]);
    F.instances[id] = s;
    return s;
  };
  function studioFloor(s) {
    const size = s.id === 0 ? 310 : 145,
      level = [-2.19, -0.81, -0.56][s.id];
    const g = new T.PlaneGeometry(size, size);
    g.rotateX(-Math.PI / 2);
    const material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { span: { value: size } },
      vertexShader:
        'varying vec2 at;void main(){at=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec2 at;uniform float span;void main(){float v=length(at/vec2(1.18,.91))/(span*.5);float disk=1.-smoothstep(.20,.91,v);vec2 uv=at/(span*.039);vec2 ed=abs(fract(uv-.5)-.5)/max(fwidth(uv),vec2(.00001));float grid=1.-min(min(ed.x,ed.y),1.);vec3 c=mix(vec3(.006,.008,.008),vec3(.019,.023,.022),grid*.32+disk*.17);gl_FragColor=vec4(c,disk*.82);}'
    });
    material.extensions.derivatives = true;
    const floor = F.mesh(s, g, material, 0, level, 0);
    floor.renderOrder = -3;
  }
  const maps = new Map();
  function doorAtlas(index) {
    if (maps.has(index)) return maps.get(index);
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 512;
    const g = c.getContext('2d'),
      w = c.width,
      h = c.height,
      seed = F.rng(0x20ab + index);
    const bases = [
      '#9ba19c',
      '#b2b8b0',
      '#c9c7b7',
      '#5f6869',
      '#77817f',
      '#817662',
      '#7f6a57',
      '#78624f'
    ];
    g.fillStyle = bases[index];
    g.fillRect(0, 0, w, h);
    const pix = g.getImageData(0, 0, w, h);
    for (let k = 0; k < pix.data.length; k += 4) {
      const d = (seed() - 0.5) * (index === 4 ? 3 : 9);
      pix.data[k] += d;
      pix.data[k + 1] += d;
      pix.data[k + 2] += d;
    }
    g.putImageData(pix, 0, 0);
    const fill = (x, y, a, b, col) => {
      g.fillStyle = col;
      g.fillRect(x, y, a, b);
    };
    const stroke = (x, y, a, b, col, wid = 2) => {
      g.lineWidth = wid;
      g.strokeStyle = col;
      g.strokeRect(x, y, a, b);
    };
    const lettering = (str, x, y, size, col = '#d9dbc8') => {
      g.fillStyle = col;
      g.font = 'bold ' + size + 'px Consolas,monospace';
      g.fillText(str, x, y);
    };
    if (index === 0) {
      for (let y = 0; y < h; y += 25) {
        fill(0, y, w, 2, '#727b74');
        fill(0, y + 2, w, 2, '#bac0b4');
      }
      for (let x = 25; x < w; x += 92) fill(x, 0, 1, h, '#737a71');
      stroke(9, 9, w - 18, h - 18, '#5d665f', 6);
      for (let row = 0; row < 2; row++)
        for (let i = 0; i < 5; i++) {
          const x = 55 + i * 132,
            y = 56 + row * 289;
          fill(x + 4, y + 6, 104, 72, '#515a54');
          fill(x, y, 104, 72, '#b1b7aa');
          stroke(x + 3, y + 3, 98, 66, '#748076');
          for (let j = 0; j < 14; j++) fill(x + 8 + j * 6, y + 8, 3, 55, '#848c81');
        }
      lettering('FAB 02   /   MECHANICAL ROOF', 64, 266, 20, '#626c62');
    } else if (index <= 3) {
      stroke(10, 12, w - 20, h - 24, '#4d5753', 5);
      for (let i = 0; i < 6; i++) {
        const x = 24 + i * 124;
        stroke(x, 35, 109, 439, '#798179', 2);
        for (let k = 0; k < 9; k++) fill(x + 9, 368 + k * 7, 90, 3, '#505750');
      }
      if (index === 1) {
        for (let i = 0; i < 8; i++) {
          let x = 21 + i * 91;
          fill(x, 120, 86, 168, i < 3 ? '#cfad58' : '#879e96');
          fill(x + 3, 124, 79, 15, '#d8d9bd');
          fill(x, 268, 86, 6, '#4d5551');
        }
      } else {
        fill(68, 114, 250, 123, index === 2 ? '#504d38' : '#303b3a');
        stroke(70, 115, 246, 121, '#8a9282', 5);
        for (let j = 0; j < 7; j++) fill(92, 139 + j * 12, 166 - j * 11, 3, '#bac2a8');
        fill(498, 140, 113, 89, '#293631');
        fill(509, 153, 37, 5, '#c6ad70');
        fill(511, 175, 75, 2, '#93a791');
      }
      lettering(
        ['', 'CLEANROOM   /   PLENUM', 'EXPOSURE   /   04', 'VACUUM OPTICS'][index],
        35,
        78,
        24,
        '#404b44'
      );
      for (let i = 0; i < 7; i++) fill(567 + i * 16, 480, 9, 8, '#c2a267');
    } else if (index === 4 || index === 5 || index === 6) {
      const cw = index === 4 ? 33 : 116,
        ch = index === 4 ? 29 : 89;
      for (let x = 0; x < w; x += cw)
        for (let y = 0; y < h; y += ch) {
          stroke(
            x + 1,
            y + 1,
            cw - 2,
            ch - 2,
            index === 4 ? '#687570' : '#484f4b',
            index === 4 ? 0.9 : 2
          );
          for (let j = 0; j < 4; j++) {
            const sx = x + 3 + seed() * 0.45 * cw,
              sy = y + 3 + seed() * 0.55 * ch;
            fill(
              sx,
              sy,
              Math.max(1, seed() * cw * 0.4),
              index === 4 ? 1 : 2,
              j % 2 ? '#a2946d' : '#7b887a'
            );
          }
        }
      if (index !== 4) {
        stroke(8, 8, w - 16, h - 16, '#ba9b67', 5);
        lettering('M3   /   LOT-A7F3', 30, 60, 23);
      }
    } else {
      for (let i = 0; i < 13; i++) {
        g.strokeStyle = i % 2 ? '#a77d55' : '#4c5855';
        g.lineWidth = i < 3 ? 10 : 3;
        g.beginPath();
        g.ellipse(w / 2, h / 2, w * 0.45 - i * 8, h * 0.45 - i * 5, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = '#433d32';
      g.beginPath();
      g.ellipse(w / 2, h / 2, w * 0.16, h * 0.16, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (index < 4)
      for (const x of [16, 365, 401, 752])
        for (const y of [17, 248, 494]) {
          g.fillStyle = '#4b5651';
          g.beginPath();
          g.arc(x, y, 3, 0, Math.PI * 2);
          g.fill();
          fill(x - 1, y, 3, 1, '#c2c7b8');
        }
    const tex = F.texture(c);
    maps.set(index, tex);
    F.shared.add(tex);
    return tex;
  }
  F.portal = (s, index, role, center, width) => {
    const flat = index === 0 || index >= 4,
      round = index === 4 || index === 7;
    const gr = new T.Group();
    gr.position.fromArray(center);
    s.root.add(gr);
    const tint = [0x777772, 0xccc9b0, 0xd6ccae, 0x6e736e, 0x777773, 0x937654, 0x946951, 0xb58b65][index];
    const halfGroups = [],
      materials = [];
    const skin = new T.MeshStandardMaterial({
      color: tint,
      metalness: 0.53,
      roughness: 0.43,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    const face = new T.MeshStandardMaterial({
      map: doorAtlas(index),
      metalness: index >= 4 ? 0.59 : 0.35,
      roughness: index >= 4 ? 0.36 : 0.55,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -4
    });
    materials.push(skin, face);
    if (round) {
      const body = new T.Mesh(circle, skin);
      body.scale.set(width, width * 0.018, width);
      body.position.y = -width * 0.006;
      gr.add(body);
      const top = new T.Mesh(new T.CircleGeometry(width * 0.499, 96), face);
      top.rotation.x = -Math.PI / 2;
      top.position.y = width * 0.0045;
      gr.add(top);
    } else {
      for (let side = 0; side < 2; side++) {
        const part = new T.Group(),
          base = new T.Mesh(rect, skin);
        part.add(base);
        gr.add(part);
        halfGroups.push(part);
        const g = new T.PlaneGeometry(width * 0.499, width * (flat ? 0.6 : 0.54));
        const uv = g.attributes.uv;
        for (let j = 0; j < uv.count; j++) uv.setX(j, uv.getX(j) * 0.5 + side * 0.5);
        const surf = new T.Mesh(g, face);
        part.add(surf);
        if (flat) {
          base.scale.set(width * 0.5, width * 0.018, width * 0.6);
          base.position.y = -width * 0.006;
          surf.rotation.x = -Math.PI / 2;
          surf.position.y = width * 0.004;
        } else {
          base.scale.set(width * 0.5, width * 0.54, width * 0.025);
          base.position.z = -width * 0.008;
          surf.position.z = width * 0.005;
        }
      }
    }
    const update = (p) => {
      const a = role === 'in' ? 1 - F.smooth((p - 0.045) / 0.29) : F.smooth((p - 0.67) / 0.225);
      gr.visible = a > 0.001;
      for (const m of materials) {
        m.opacity = a;
        m.depthWrite = a > 0.98;
      }
      for (let k = 0; k < halfGroups.length; k++)
        halfGroups[k].position.x =
          (k ? 1 : -1) * width * (0.25 + (role === 'in' && index < 4 ? (1 - a) * 0.42 : 0));
    };
    s.portals.push({ group: gr, update });
    return gr;
  };
  F.foup = (s, x, y, z, scale = 1) => {
    const group = new T.Group();
    const local = { root: group, batches: new Map() };
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    s.root.add(group);
    const shell = F.mat(0xa87433, 0.28, 0.34),
      lid = F.mat(0x464844, 0.58, 0.34),
      handle = F.mat(0xc1bdb1, 0.52, 0.35);
    F.box(local, shell, 0, 0, 0, 2.0, 2.0, 1.8);
    F.box(local, lid, 0, -0.92, 0, 2.14, 0.18, 1.94);
    F.box(local, lid, 0, 0, 0.94, 1.82, 1.74, 0.12);
    for (let i = 0; i < 5; i++) F.box(local, shell, 0, -0.58 + i * 0.28, 1.015, 1.46, 0.04, 0.04);
    F.box(local, handle, 0, 1.1, 0, 1.1, 0.18, 0.48);
    F.flush(local);
    return group;
  };
})(F, THREE);
