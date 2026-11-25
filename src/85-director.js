((F, T) => {
  'use strict';
  const W = (F.doorBand = 0.055),
    D = 0.64;
  const rows = [
    [2.1, 0, 0.43, 0.8, '厂区总览', 'FAB CAMPUS', '从约 400 m 的厂区全景，追踪 LOT-A7F3。'],
    [2.75, 0.43, 1.43, 0.85, '打开厂房', 'FACTORY SECTION', '屋面展开，洁净生产层悬在机电夹层之间。'],
    [
      2.85,
      1.43,
      2.43,
      0.82,
      '追踪晶圆盒',
      'OVERHEAD TRANSFER',
      '天花轨道上的晶圆盒，装着同批次的 25 片晶圆。'
    ],
    [2.35, 2.43, 3.2, 0.86, '进入黄光区', 'YELLOW BAY', '滤去蓝光和紫外光，保护尚未曝光的光刻胶。'],
    [1.85, 3.2, 4 - W, 0.82, '真空舱内', 'VACUUM CHAMBER', '晶圆盒停靠装载口，晶圆被送入曝光舱。'],
    [3.1, 4 - W, 4.58, 0.87, '光之路', 'PATH OF LIGHT', '13.5 nm 极紫外光经多层膜反射镜抵达晶圆。'],
    [2.85, 4.58, 5.48, 0.84, '一片晶圆', 'ON THE WAFER', '300 mm 硅片上的薄膜，随观察角度改变颜色。'],
    [2.7, 5.48, 6.48, 0.84, '裸片版图', 'DIE FLOORPLAN', '从一颗裸片，进入存储阵列与逻辑单元之间。'],
    [2.75, 6.48, 7.48, 0.84, '铜互连', 'COPPER STACK', '十余层金属线路，通过接触孔连接至器件。'],
    [
      3.45,
      7.48,
      9,
      0.83,
      '三层纳米片',
      'GATE ALL AROUND',
      '视域约 50 nm，栅极包围三层沟道。3 nm 是工艺代号。'
    ],
    [10.5, 9, 0, 0.96, '返回厂区', 'RETURN TO ORIGIN', '沿同一批晶圆的路径，回到灯火通明的厂区。']
  ];
  const chapters = [],
    parts = [],
    edges = [];
  let elapsed = 0;
  for (const [length, from, to, split, title, en, caption] of rows) {
    const dir = Math.sign(to - from),
      cuts = [from, to];
    for (let i = 1; i <= 8; i++)
      for (const q of [i - W, i + W]) if ((q - from) * dir > 1e-6 && (to - q) * dir > 1e-6) cuts.push(q);
    cuts.sort((a, b) => (a - b) * dir);
    let segments = [],
      doorCount = 0,
      travel = 0;
    for (let k = 1; k < cuts.length; k++) {
      let a = cuts[k - 1],
        b = cuts[k],
        mid = (a + b) / 2,
        i = Math.round(mid);
      let door = i > 0 && i < 9 && Math.abs(mid - i) < W - 1e-6;
      segments.push({ a, b, door, i });
      if (door) doorCount++;
      else travel += Math.abs(b - a);
    }
    const start = elapsed;
    for (const p of segments) {
      const dt = p.door ? D : ((length - D * doorCount) * Math.abs(p.b - p.a)) / travel;
      p.start = elapsed;
      p.end = elapsed + dt;
      p.split = split;
      if (dir > 0 && p.door) edges[p.i - 1] = elapsed + dt * 0.5;
      parts.push(p);
      elapsed += dt;
    }
    const last = chapters.length;
    // Observe from the target stage after its incoming door has opened.
    chapters.push({
      start,
      end: elapsed,
      at: start + length * [0.42, 0.94, 0.94, 0.88, 0.54, 0.87, 0.94, 0.94, 0.94, 0.88, 0.975][last],
      title,
      en,
      caption,
      from,
      to,
      split
    });
  }
  const duration = (F.duration = +elapsed.toFixed(6));
  Object.assign(F, { chapters, edges });
  const moment = { q: 0, chapter: 0, time: 0 };
  F.locate = (t) => {
    t = F.clamp(t, 0, duration);
    if (t >= duration - 1e-7) {
      moment.q = moment.time = moment.chapter = 0;
      return moment;
    }
    const ch = chapters.findIndex((c) => t < c.end - 1e-9),
      p = parts.find((k) => t < k.end - 1e-9) || parts[parts.length - 1];
    const u = F.clamp((t - p.start) / (p.end - p.start));
    const x = p.door
      ? u
      : u < p.split
        ? p.split * F.smooth(u / p.split)
        : p.split + (1 - p.split) * F.smooth((u - p.split) / (1 - p.split));
    moment.q = F.mix(p.a, p.b, x);
    moment.chapter = ch;
    moment.time = t;
    return moment;
  };
  F.simAt = (t) => t - duration * F.smooth((t - chapters[10].start) / (duration - chapters[10].start));
  const single = { ids: [0], progress: [0], blend: 0 },
    pair = { ids: [0, 1], progress: [1, 0], blend: 0 };
  F.contents = (q) => {
    const i = Math.round(q);
    if (i > 0 && i < 9 && Math.abs(q - i) < W - 1e-8) {
      pair.ids[0] = i - 1;
      pair.ids[1] = i;
      pair.blend = (q - i + W) / (2 * W);
      return pair;
    }
    const id = F.clamp(Math.floor(q), 0, 8),
      lo = id ? W : 0,
      hi = id === 8 ? 1 : 1 - W;
    single.ids[0] = id;
    single.progress[0] = F.clamp((q - id - lo) / (hi - lo));
    return single;
  };
  const pose = new Float64Array(7);
  F.camera = (s, p, w, h, v) => {
    const d = F.stages[s.id],
      pivot = (0.43 - (s.id ? W : 0)) / ((s.id === 8 ? 1 : 1 - W) - (s.id ? W : 0));
    const left = p < pivot,
      fr = left ? d.A : d.B,
      to = left ? d.B : d.C;
    const k = F.ease(F.clamp(left ? p / pivot : (p - pivot) / (1 - pivot)));
    for (let i = 0; i < 7; i++)
      pose[i] = i === 5 ? Math.exp(F.mix(Math.log(fr[i]), Math.log(to[i]), k)) : F.mix(fr[i], to[i], k);
    if (s.lotFocus && v.follow) {
      const f = s.lotFocus,
        weight =
          Math.pow(Math.sin(Math.PI * (left ? p / pivot : (p - pivot) / (1 - pivot))), 2) *
          (s.id === 2 ? 0.43 : 0.31);
      pose[0] = F.mix(pose[0], f.isVector3 ? f.x : f[0], weight);
      pose[1] = F.mix(pose[1], f.isVector3 ? f.y : f[1], weight);
      pose[2] = F.mix(pose[2], f.isVector3 ? f.z : f[2], weight);
    }
    const { orbitX, orbitY, zoom, portrait } = v,
      aspect = w / h;
    const az = ((pose[3] + orbitX) * Math.PI) / 180,
      el = (F.clamp(pose[4] + orbitY, 5, 83) * Math.PI) / 180;
    const fit = portrait ? Math.max(1, 1.36 / aspect) : Math.max(1, 1.38 / aspect);
    s.scene.fog.density = s.fogDensity / fit;
    const distance = pose[5] * zoom * fit * (v.film && !portrait ? 1.07 : 1),
      cam = s.camera;
    cam.userData.focusDistance = distance;
    cam.userData.metresPerHeight = 2 * Math.tan((pose[6] * Math.PI) / 360) * distance * d.metresPerUnit;
    cam.aspect = aspect;
    cam.fov = pose[6];
    cam.near = Math.max(0.018, distance * 0.0035);
    cam.far = Math.max(240, distance * 6);
    cam.position.set(
      pose[0] + distance * Math.cos(el) * Math.sin(az),
      pose[1] + distance * Math.sin(el),
      pose[2] + distance * Math.cos(el) * Math.cos(az)
    );
    cam.lookAt(pose[0], pose[1], pose[2]);
    cam.setViewOffset(w, h, (0.5 - v.cx) * w, (0.5 - v.cy) * h, w, h);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  };
  F.scaleAt = (q) => {
    const i = F.clamp(Math.floor(q), 0, 8),
      a = F.stages[i].field,
      b = F.stages[Math.min(i + 1, 8)].field;
    return Math.exp(F.mix(Math.log(a), Math.log(b), F.clamp(q - i)));
  };
})(F, THREE);
