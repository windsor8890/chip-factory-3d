'use strict';
const F = (window.F = {});
((F, T) => {
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const mod = (x, n) => ((x % n) + n) % n;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const smooth = (x) => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
  };
  function rng(seed) {
    let x = seed >>> 0;
    return () => {
      x = (Math.imul(1664525, x) + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }
  Object.assign(F, {
    clamp,
    mix,
    mod,
    ease,
    smooth,
    rng,
    params: new URLSearchParams(location.search),
    palette: {
      bg: 0x060708,
      amber: 0xf2a73b,
      run: 0x9ed6b4,
      idle: 0xf2a73b,
      down: 0xff5638,
      photon: 0xcfeeff,
      yellow: 0xffc94d,
      copper: 0xc8875a
    }
  });
  F.builders = [];
  F.define = (id, fn) => {
    F.builders[id] = fn;
  };
  const shared = (F.shared = new WeakSet());
  const cache = new Map(),
    geos = new Map(),
    stamp = new T.Object3D(),
    a = new T.Vector3(),
    b = new T.Vector3(),
    up = new T.Vector3(0, 1, 0);
  const cached = (key, fn) => {
    if (!cache.has(key)) {
      const obj = fn();
      cache.set(key, obj);
      shared.add(obj);
    }
    return cache.get(key);
  };
  const geo = (key, fn) => {
    if (!geos.has(key)) {
      const g = fn();
      geos.set(key, g);
      shared.add(g);
    }
    return geos.get(key);
  };
  F.mat = (c, m = 0.25, r = 0.48, e = 0) =>
    cached(
      [c, m, r, e].join('/'),
      () =>
        new T.MeshStandardMaterial({
          color: c,
          metalness: m,
          roughness: r,
          emissive: e ? c : 0,
          emissiveIntensity: e
        })
    );
  F.ink = (c) => cached('ink' + c, () => new T.MeshBasicMaterial({ color: c }));
  F.mesh = (s, g, m, x = 0, y = 0, z = 0) => {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    (s.root || s).add(o);
    return o;
  };
  function batch(s, g, m, matrix) {
    const key = g.uuid + m.uuid;
    let q = s.batches.get(key);
    if (!q) {
      q = { g, m, items: [] };
      s.batches.set(key, q);
    }
    q.items.push(matrix.clone());
  }
  function transform(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    stamp.position.set(x, y, z);
    stamp.rotation.set(rx, ry, rz);
    stamp.scale.set(sx, sy, sz);
    stamp.updateMatrix();
    return stamp.matrix;
  }
  const cube = () => geo('box', () => new T.BoxGeometry());
  const cylinder = (ratio, n) =>
    geo('c' + ratio + 'x' + n, () => new T.CylinderGeometry(ratio, 1, 1, n));
  F.box = (s, m, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) =>
    batch(s, cube(), m, transform(x, y, z, w, h, d, rx, ry, rz));
  F.cyl = (s, m, x, y, z, rt, rb, h, rx = 0, ry = 0, rz = 0, n = 16) => {
    if (!rb) {
      rb = 1e-4;
    }
    batch(s, cylinder(rt / rb, n), m, transform(x, y, z, rb, h, rb, rx, ry, rz));
  };
  F.rod = (s, m, p, q, r, n = 8) => {
    a.fromArray(p);
    b.fromArray(q).sub(a);
    const h = b.length();
    if (h < 1e-6) return;
    stamp.position.copy(a).addScaledVector(b, 0.5);
    stamp.quaternion.setFromUnitVectors(up, b.multiplyScalar(1 / h));
    stamp.scale.set(r, h, r);
    stamp.updateMatrix();
    batch(s, cylinder(1, n), m, stamp.matrix);
  };
  F.inst = (s, g, m, rows) => {
    for (const row of rows) batch(s, g, m, transform(...row));
  };
  F.flush = (s) => {
    for (const { g, m, items } of s.batches.values()) {
      const inst = new T.InstancedMesh(g, m, items.length);
      items.forEach((matrix, i) => inst.setMatrixAt(i, matrix));
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      s.root.add(inst);
    }
    s.batches.clear();
  };
  F.texture = (canvas) => {
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };
  F.decal = (s, str, x, y, z, w, h, opts = {}) => {
    const key = 'decal' + str + [opts.color, opts.bg, opts.font, w / h].join('/');
    const m = cached(key, () => {
      const c = document.createElement('canvas');
      c.width = Math.min(1024, Math.max(96, Math.round((100 * w) / h)));
      c.height = 100;
      const ctx = c.getContext('2d');
      if (opts.bg) {
        ctx.fillStyle = opts.bg;
        ctx.fillRect(0, 0, c.width, 100);
      }
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = opts.color || '#dde1d9';
      ctx.font = opts.font || '600 72px Bahnschrift,"Microsoft YaHei",sans-serif';
      ctx.fillText(str, c.width * 0.5, 52, c.width * 0.95);
      return new T.MeshBasicMaterial({
        map: F.texture(c),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        side: T.DoubleSide
      });
    });
    const o = F.mesh(
      s,
      geo('plane', () => new T.PlaneGeometry()),
      m,
      x,
      y,
      z
    );
    o.scale.set(w, h, 1);
    o.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
    return o;
  };
  F.shadow = (s, x, y, z, w, d, opacity = 0.38) => {
    const m = cached('shadow' + opacity, () => {
      let tex = cached('shadowTex', () => {
        let c = document.createElement('canvas');
        c.width = c.height = 128;
        let ctx = c.getContext('2d'),
          g = ctx.createRadialGradient(64, 64, 8, 64, 64, 63);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.57, 'rgba(0,0,0,.75)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        return F.texture(c);
      });
      return new T.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3
      });
    });
    let o = F.mesh(
      s,
      geo('plane', () => new T.PlaneGeometry()),
      m,
      x,
      y,
      z
    );
    o.rotation.x = -Math.PI / 2;
    o.scale.set(w, d, 1);
    return o;
  };
  // Sampling the event table by absolute time makes sim rates, reverse motion and seeks repeatable.
  const random = rng(0xa7f3),
    cycle = 720,
    events = [];
  for (let start = 4; start < cycle - 17; start += 14 + Math.floor(random() * 8)) {
    events.push({ start, end: start + 6 + Math.floor(random() * 10), id: Math.floor(random() * 24) });
  }
  const systems = ['光刻', '薄膜', '刻蚀', '抛光', '清洗', '量测'];
  const SIM = (F.SIM = {
    name: (id) => systems[id % 6] + ' · ' + String(id + 1).padStart(2, '0'),
    code: (id) =>
      ['LTH', 'CVD', 'ETCH', 'CMP', 'CLN', 'MET'][id % 6] + '-' + String(id + 1).padStart(2, '0')
  });
  SIM.status = (id, t) => {
    const u = mod(t, cycle);
    for (const ev of events) if (ev.id === id && u >= ev.start && u < ev.end) return 'down';
    return mod(t + id * 16.1, 105) < 10 ? 'idle' : 'run';
  };
  SIM.alarms = (t) => {
    const epoch = t - mod(t, cycle),
      out = [];
    for (const shift of [-cycle, 0])
      for (const e of events) {
        const d = epoch + shift;
        if (d + e.start <= t) out.push({ time: d + e.start, id: e.id, type: 'down' });
        if (d + e.end <= t) out.push({ time: d + e.end, id: e.id, type: 'run' });
      }
    return out.sort((a, b) => b.time - a.time).slice(0, 4);
  };
  SIM.read = (t) => ({
    capacity: 42000,
    wip: 18342 + Math.round(17 * Math.sin(t * 0.039)),
    yield: 98.64 + 0.07 * Math.sin(t * 0.026),
    oee: 92.8 + 0.35 * Math.sin(t * 0.031),
    oht: 32,
    clean: 'ISO 4',
    particles: 31 + Math.round(3 * Math.sin(t * 0.083)),
    temp: 22 + 0.06 * Math.sin(t * 0.19),
    rh: 45 + 0.26 * Math.sin(t * 0.12),
    upw: 18.2,
    mw: 34.7 + 0.28 * Math.sin(t * 0.064)
  });
})(F, THREE);
