((F, T) => {
  'use strict';
  const lineKinds = {
    power: [2.0, 0.5, 0],
    water: [0.7, 0.45, 1],
    gas: [2.5, 0.65, 2],
    exhaust: [1.0, 0.65, 3],
    air: [0.4, 0.55, 1],
    oht: [1.5, 0.6, 2]
  };
  const lineVert =
    'attribute float lineDistance;varying float dist;void main(){dist=lineDistance;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  const lineFrag =
    'precision mediump float;uniform vec3 ink;uniform vec3 dash;uniform float t;varying float dist;void main(){float u=mod(dist,dash.x+dash.y);if(u>dash.x||(dash.z>1.5&&u>dash.x*.26&&u<dash.x*.44)||(dash.z>2.5&&u>dash.x*.60&&u<dash.x*.76))discard;float pulse=pow(max(0.,1.-abs(mod(dist-t*1.9+8.,16.)-8.)/1.9),1.5);gl_FragColor=vec4(ink*(.76+pulse*1.8),.56+pulse*.42);}';
  F.dataLine = (s, points, kind = 'power') => {
    if (points.length < 2) return;
    const buf = new Float32Array(points.length * 3),
      lengths = new Float32Array(points.length);
    for (let i = 0; i < points.length; i++) {
      buf.set(points[i], i * 3);
      if (i)
        lengths[i] =
          lengths[i - 1] +
          Math.hypot(
            points[i][0] - points[i - 1][0],
            points[i][1] - points[i - 1][1],
            points[i][2] - points[i - 1][2]
          );
    }
    const pattern = lineKinds[kind] || lineKinds.power;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(buf, 3));
    geo.setAttribute('lineDistance', new T.BufferAttribute(lengths, 1));
    const mat = new T.ShaderMaterial({
      vertexShader: lineVert,
      fragmentShader: lineFrag,
      uniforms: {
        ink: { value: new T.Color(kind === 'air' ? 0xd4bf8f : 0xefab51) },
        dash: { value: new T.Vector3(...pattern) },
        t: { value: 0 }
      },
      transparent: true,
      depthWrite: false
    });
    const line = new T.Line(geo, mat);
    line.renderOrder = 2;
    s.root.add(line);
    s.flows.push(line);
    let arrows;
    if (kind === 'air') {
      const pos = [],
        start = points[0],
        end = points[points.length - 1];
      for (let y = end[1] + 1.4; y < start[1] - 0.2; y += 2.7)
        pos.push(
          start[0] - 0.19,
          y + 0.39,
          start[2],
          start[0],
          y,
          start[2],
          start[0],
          y,
          start[2],
          start[0] + 0.19,
          y + 0.39,
          start[2]
        );
      const ag = new T.BufferGeometry();
      ag.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      arrows = new T.LineSegments(
        ag,
        new T.LineBasicMaterial({ color: 0xdfc997, transparent: true, opacity: 0.69, depthWrite: false })
      );
      s.root.add(arrows);
    }
    s.anim.push((t) => {
      line.visible = F.view.data;
      mat.uniforms.t.value = t;
      if (arrows) {
        arrows.visible = line.visible;
        arrows.position.y = -F.mod(t * 0.38, 1.25);
      }
    });
    return line;
  };
  const v3 = new T.Vector3(),
    svgNS = 'http://www.w3.org/2000/svg',
    nodes = [],
    beacons = [],
    blocked = [],
    reserved = [];
  let project = null,
    wires = null,
    dimension = null,
    lastLayout = '',
    layoutTick = 0;
  const dimensions = [
    null,
    null,
    null,
    [[-10.7, 4.8, 5.9], [-6.7, 4.8, 5.9], '400 mm'],
    [[0.5, 2.08, 5], [15.5, 2.08, 5], 'Ø 300 mm'],
    [[-15, 0.11, 0], [15, 0.11, 0], 'Ø 300 mm'],
    [[-18, 0.16, 11.7], [18, 0.16, 11.7], '18 mm'],
    [[-13.7, 0.75, 7.8], [-13.7, 9.75, 7.8], '0.90 μm'],
    [[4.91, 2.32, 4.54], [4.91, 6.52, 4.54], '4.2 nm']
  ];
  const put = (node, str) => {
    if (node.textContent !== str) node.textContent = str;
  };
  function makeNode() {
    const tag = document.createElement('button');
    tag.className = 'annotation';
    tag.tabIndex = -1;
    const title = document.createElement('strong'),
      value = document.createElement('em'),
      sub = document.createElement('small');
    tag.append(title, value, sub);
    project.append(tag);
    const group = document.createElementNS(svgNS, 'g'),
      line = document.createElementNS(svgNS, 'path'),
      tip = document.createElementNS(svgNS, 'circle');
    group.append(line, tip);
    wires.append(group);
    tip.setAttribute('r', '2.05');
    return { tag, title, value, sub, group, line, tip };
  }
  function init() {
    project = document.getElementById('projected');
    wires = document.getElementById('wires');
    for (let i = 0; i < 7; i++) nodes.push(makeNode());
    for (let i = 0; i < 24; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'beacon';
      b.setAttribute('aria-label', '设备');
      project.append(b);
      beacons.push(b);
    }
    const group = document.createElementNS(svgNS, 'g'),
      line = document.createElementNS(svgNS, 'path'),
      label = document.createElementNS(svgNS, 'text');
    group.classList.add('dimline');
    group.append(line, label);
    wires.append(group);
    dimension = { group, line, label };
  }
  const inset = (a, b, c, d) => ({ x: a, y: b, w: c, h: d });
  function overlaps(x, y, w, h, pad) {
    for (const list of [blocked, reserved])
      for (const r of list)
        if (x < r.x + r.w + pad && r.x < x + w + pad && y < r.y + r.h + pad && r.y < y + h + pad)
          return true;
    return false;
  }
  function screen(pos, cam, w, h, out) {
    if (pos.isVector3) v3.copy(pos);
    else v3.fromArray(pos);
    v3.applyMatrix4(cam.matrixWorldInverse);
    if (v3.z > -0.02 || v3.z < -cam.far * 0.84) return false;
    v3.applyMatrix4(cam.projectionMatrix);
    if (v3.z < -1 || v3.z > 1 || Math.abs(v3.x) > 0.97 || Math.abs(v3.y) > 0.97) return false;
    out.x = (v3.x * 0.5 + 0.5) * w;
    out.y = (0.5 - v3.y * 0.5) * h;
    return true;
  }
  const pin = { x: 0, y: 0 },
    offsets = [
      [1, -1],
      [-1, -1],
      [1, 1],
      [-1, 1],
      [1, -2],
      [-1, -2],
      [1, 2],
      [-1, 2]
    ];
  const pa = { x: 0, y: 0 },
    pb = { x: 0, y: 0 },
    carrierLeft = new T.Vector3(),
    carrierRight = new T.Vector3();
  function drawDimension(v, s, w, h, enabled) {
    dimension.group.setAttribute('hidden', '');
    const def = dimensions[s.id];
    if (!def || !enabled) return false;
    let left = def[0],
      right = def[1];
    if (s.id === 3 && s.lotFocus) {
      const f = s.lotFocus;
      left = carrierLeft.set(f.x - 2, f.y + 1.75, f.z + 1.86);
      right = carrierRight.set(f.x + 2, f.y + 1.75, f.z + 1.86);
    }
    if (!screen(left, s.camera, w, h, pa) || !screen(right, s.camera, w, h, pb)) return false;
    const dx = pb.x - pa.x,
      dy = pb.y - pa.y,
      len = Math.hypot(dx, dy);
    if (len < 12) return false;
    const nx = -dy / len,
      ny = dx / len,
      cx = (pa.x + pb.x) / 2,
      cy = (pa.y + pb.y) / 2,
      fs = v.portrait ? w * 0.021 : 11;
    const tw = def[2].length * fs * 0.67 + 8,
      th = fs + 6;
    for (const sign of s.id === 3 ? [-1, 1] : [1, -1]) {
      const shift = sign * (v.portrait ? w * 0.038 : 24),
        ox = nx * shift,
        oy = ny * shift,
        tx = cx + ox,
        ty = cy + oy - th * 0.38;
      if (
        tx < tw * 0.5 ||
        tx + tw * 0.5 > w ||
        ty < th ||
        ty + th > h ||
        overlaps(tx - tw * 0.5, ty - th * 0.8, tw, th, 3)
      )
        continue;
      const ax = pa.x + ox,
        ay = pa.y + oy,
        bx = pb.x + ox,
        by = pb.y + oy;
      dimension.line.setAttribute(
        'd',
        'M' +
          pa.x +
          ' ' +
          pa.y +
          'L' +
          (ax + 4 * nx * sign) +
          ' ' +
          (ay + 4 * ny * sign) +
          'M' +
          ax +
          ' ' +
          ay +
          'L' +
          bx +
          ' ' +
          by +
          'M' +
          pb.x +
          ' ' +
          pb.y +
          'L' +
          (bx + 4 * nx * sign) +
          ' ' +
          (by + 4 * ny * sign)
      );
      dimension.label.setAttribute('x', tx);
      dimension.label.setAttribute('y', ty);
      dimension.label.style.fontSize = fs + 'px';
      put(dimension.label, def[2]);
      dimension.group.removeAttribute('hidden');
      reserved.push(inset(tx - tw * 0.5, ty - th * 0.8, tw, th));
      return true;
    }
    return false;
  }
  F.invalidateLabels = () => {
    lastLayout = '';
  };
  function measure(v, w, h) {
    const key = [w, h, v.portrait, v.selection, v.hide, document.getElementById('app').className].join(
      '|'
    );
    if (lastLayout === key && ++layoutTick % 45 !== 0) return;
    lastLayout = key;
    blocked.length = 0;
    const root = document.getElementById('app').getBoundingClientRect();
    document.querySelectorAll('#hud [data-avoid]').forEach((e) => {
      const b = e.getBoundingClientRect();
      if (b.width && b.height)
        blocked.push(inset(b.left - root.left, b.top - root.top, b.width, b.height));
    });
    if (v.portrait) {
      blocked.push(
        inset(0, 0, w, h * 0.2),
        inset(w * 0.84, 0, w * 0.16, h),
        inset(0, h * 0.77, w, h * 0.23)
      );
    }
  }
  F.drawData = (v, s, w, h, blend = false) => {
    if (!project) init();
    let count = 0,
      shown = 0;
    reserved.length = 0;
    const cam = s.camera,
      engineering = s.id >= 3,
      disable = v.hide || v.film;
    if (!disable) measure(v, w, h);
    const dimensionShown = drawDimension(v, s, w, h, !disable && v.labels && !blend);
    if (!disable && v.labels && !blend) {
      let i = 0;
      for (const item of s.labels) {
        if (!screen(item.pos, cam, w, h, pin)) continue;
        if (overlaps(pin.x - 2, pin.y - 2, 4, 4, 1)) continue;
        const val = typeof item.value === 'function' ? item.value(v.sim) : item.value;
        const measure = (str, ascii, cjk) => {
          let n = 0;
          for (const ch of String(str || '')) n += ch.charCodeAt(0) > 255 ? cjk : ascii;
          return n;
        };
        const nominal = Math.max(
          86,
          measure(item.zh, 7, 12) + measure(val, 5.6, 9.4) + 24,
          measure(item.en, 5.1, 8) + 15
        );
        const tagWidth = v.portrait
          ? Math.min(w * 0.315, nominal * w * 0.00192)
          : Math.min(224, nominal);
        const th = v.portrait ? Math.max(20, w * 0.105) : 34,
          dx = v.portrait ? w * 0.028 : Math.max(18, w * 0.018),
          dy = v.portrait ? h * 0.022 : h * 0.033;
        let x,
          y,
          dir,
          found = false;
        for (let j = 0; j < offsets.length; j++) {
          let of = offsets[(j + (i % 2 === 1 ? 1 : 0)) % offsets.length];
          dir = of[0];
          x = pin.x + dir * dx - (dir < 0 ? tagWidth : 0);
          y = pin.y + of[1] * dy - (of[1] < 0 ? th : 0);
          if (
            x < 5 ||
            x + tagWidth > w - 5 ||
            y < 5 ||
            y + th > h - 5 ||
            overlaps(x, y, tagWidth, th, 4)
          )
            continue;
          found = true;
          break;
        }
        if (!found) {
          i++;
          continue;
        }
        const n = nodes[count];
        n.tag.hidden = false;
        n.group.removeAttribute('hidden');
        n.tag.classList.toggle('eng', engineering);
        n.tag.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
        n.tag.style.width = Math.ceil(tagWidth) + 'px';
        n.tag.classList.toggle('inspectable', item.id !== undefined);
        if (item.id !== undefined) n.tag.dataset.unit = item.id;
        else n.tag.removeAttribute('data-unit');
        if (engineering) n.tag.dataset.note = s.id;
        else n.tag.removeAttribute('data-note');
        n.tag.style.pointerEvents = item.id !== undefined || engineering ? 'auto' : 'none';
        n.tag.tabIndex = item.id !== undefined || engineering ? 0 : -1;
        put(n.title, item.zh);
        put(n.value, val ? String(val) : '');
        put(n.sub, item.en || '');
        const ex = dir > 0 ? x : x + tagWidth,
          ey = y + Math.min(th * 0.6, 16),
          bend = ex - dir * Math.min(12, dx * 0.4);
        n.line.setAttribute(
          'd',
          'M' +
            pin.x.toFixed(1) +
            ' ' +
            pin.y.toFixed(1) +
            ' L' +
            bend.toFixed(1) +
            ' ' +
            ey.toFixed(1) +
            ' H' +
            ex.toFixed(1)
        );
        n.tip.setAttribute('cx', pin.x.toFixed(1));
        n.tip.setAttribute('cy', pin.y.toFixed(1));
        reserved.push(inset(x, y, tagWidth, th));
        count++;
        i++;
        if (count === (v.portrait ? 3 : engineering ? 5 : 4) - (dimensionShown ? 1 : 0)) break;
      }
    }
    for (let i = count; i < nodes.length; i++) {
      nodes[i].tag.hidden = true;
      nodes[i].group.setAttribute('hidden', '');
    }
    if (!disable && v.data && !blend)
      for (const unit of s.units) {
        if (!screen(unit.pos, cam, w, h, pin) || overlaps(pin.x - 3, pin.y - 3, 6, 6, 2)) continue;
        const st = F.SIM.status(unit.id, v.sim),
          b = beacons[shown];
        b.hidden = false;
        b.dataset.unit = unit.id;
        b.className = 'beacon ' + st;
        b.title = F.SIM.code(unit.id) + ' · ' + F.SIM.name(unit.id);
        b.setAttribute('aria-label', b.title);
        b.style.transform = 'translate(' + Math.round(pin.x - 4) + 'px,' + Math.round(pin.y - 4) + 'px)';
        if (st === 'down') b.style.setProperty('--spread', 1 + F.mod(v.sim, 1.1) * 7 + 'px');
        if (++shown === beacons.length) break;
      }
    for (let i = shown; i < beacons.length; i++) beacons[i].hidden = true;
  };
})(F, THREE);
