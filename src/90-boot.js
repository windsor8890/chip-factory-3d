((F) => {
  'use strict';
  const $ = (id) => document.getElementById(id),
    icons = {
      lot: '<path d="m3 7 9-4 9 4v11l-9 4-9-4zM3 7l9 4 9-4M12 11v11M8 4.8l9 4"/>',
      stages: '<path d="M4 5h5v3H4zm0 6h5v3H4zm0 6h5v3H4zm9-11h7m-7 6h7m-7 6h7"/>',
      layers: '<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
      tag: '<path d="M3 4h9l9 9-8 8-10-10z"/><circle cx="7.5" cy="8.5" r="1"/>',
      play: '<path d="m6 3 14 9-14 9z" fill="currentColor" stroke="none"/>',
      pause: '<path d="M7 4v16m10-16v16" stroke-width="4"/>',
      reset: '<path d="M4 11a8 8 0 1 1 1 6M3 4v7h7"/>',
      full: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
      orbit:
        '<ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-25 12 12)"/><circle cx="12" cy="12" r="2"/>'
    };
  const icon = (name) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[name] + '</svg>';
  const fmt = new Intl.NumberFormat('en-US');
  const stateText = { run: '运行', idle: '待机', down: '故障' };
  const notes = {
    LOT: [
      'LOT-A7F3 · 工艺履历',
      '工序 412 / 1186，当前层 M3，已用 41 天。沉积、涂胶、曝光、显影、刻蚀、去胶清洗及离子注入或 CMP 按层重复。先进工艺使用数十层掩模，完整周期约三个月。'
    ],
    L3: [
      '黄光与装载',
      '封闭式 FOUP 可容纳 25 片晶圆。天车将晶圆盒放在装载口，机械手逐片取出。光刻胶对紫外光和蓝光敏感，黄光区过滤短波，局部温控可达 ±0.1 °C。'
    ],
    L4: [
      '13.5 nm · 极紫外曝光',
      '直径约 20–30 μm 的锡滴每秒约 5 万个。CO₂ 激光的预脉冲展开锡滴，主脉冲使其产生发光等离子体。真空中的 Mo/Si 多层膜反射镜将光送至反射式掩模，再经 4× 缩小投影抵达晶圆。'
    ],
    L5: [
      '300 mm · 晶圆',
      '12 英寸规格的硅片直径 300 mm，厚约 775 μm。薄膜的光程差随膜厚、表面法线和观察角变化，反射颜色随之改变。'
    ],
    L6: [
      '裸片 · 功能分区',
      '同一块裸片包含存储阵列和标准逻辑单元。划片道隔开相邻裸片，金属配线与边缘焊盘连接测试接口。'
    ],
    L7: [
      '铜互连 · M1–M12',
      '层间介质隔离不同金属层。局部剖面展示 12 层铜线与通孔，底部接触孔连接有源器件。尺寸为示意数据。'
    ],
    L8: [
      '环绕栅 · 三层纳米片',
      '栅极从四周包围硅沟道以控制源漏间电流。图中三层纳米片、包覆栅和接触金属采用剖切展示。3 nm 为工艺代号，标注尺寸属于本示意截面。'
    ]
  };
  const metrics = [
    ['capacity', '月产能', '片'],
    ['wip', '在制晶圆 WIP', '片'],
    ['oee', '设备 OEE', '%'],
    ['clean', '洁净度', ''],
    ['particles', '粒子 ≥ 0.1 μm', '个/m³'],
    ['oht', '在线天车', '台'],
    ['climate', '温湿度', ''],
    ['upw', '超纯水', 'MΩ·cm'],
    ['mw', '电力负荷', 'MW']
  ];
  let nav = [],
    speed = [],
    rows = {},
    alarmRows = [],
    previous = '',
    lastTime = -99,
    lastDraw = -99;
  const text = (node, value) => {
    if (node.textContent !== value) node.textContent = value;
  };
  const clock = (t) => {
    const d = F.mod(Math.floor(t) + 8 * 3600 + 42 * 60, 86400);
    return [Math.floor(d / 3600), Math.floor(d / 60) % 60, d % 60]
      .map((v) => String(v).padStart(2, '0'))
      .join(':');
  };
  const Mag = (q) => Math.round(Math.exp(Math.log(1e10) * F.clamp(q / 9)));
  function lengthLabel(m) {
    return m >= 1
      ? Number(m.toPrecision(2)) + ' m'
      : m >= 0.001
        ? Number((m * 1e3).toPrecision(2)) + ' mm'
        : m >= 1e-6
          ? Number((m * 1e6).toPrecision(2)) + ' μm'
          : Number((m * 1e9).toPrecision(2)) + ' nm';
  }
  function construct() {
    document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
    for (const st of F.stages) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.stage = st.id;
      b.className = 'navrow';
      b.innerHTML = '<span class="navno">L' + st.id + '</span><b>' + st.zh + '</b>';
      b.title = st.en + ' · ' + st.id;
      $('navlist').append(b);
      nav.push(b);
    }
    speed = Array.from(document.querySelectorAll('[data-rate]'));
    for (const [name, dash] of [
      ['电力', '7 2'],
      ['超纯水', '2 2'],
      ['特气', '6 2 1 2'],
      ['排风', '4 2 1 2 1 2']
    ]) {
      const item = document.createElement('span');
      item.innerHTML =
        '<svg viewBox="0 0 23 3" aria-hidden="true"><path d="M0 1.5h23" stroke-dasharray="' +
        dash +
        '"/></svg>' +
        name;
      $('linekeys').append(item);
    }
    for (const [key, label, unit] of metrics) {
      let line = document.createElement('div');
      line.className = 'keyline';
      line.innerHTML =
        '<span>' + label + '</span><span class="stat-val"><b></b> <em>' + unit + '</em></span>';
      rows[key] = line.querySelector('b');
      rows[key].style.fontWeight = '450';
      $('metrics').append(line);
    }
    for (let i = 0; i < 2; i++) {
      let d = document.createElement('div');
      d.className = 'alarmrow';
      d.innerHTML = '<time></time><b></b>';
      $('alerts').append(d);
      alarmRows.push(d);
    }
    let list = [];
    for (let i = 0; i < 62; i++) {
      const val = F.SIM.read(i * 14).yield;
      list.push([(i * 180) / 61, 18 - (val - 98.55) * 65 + 2 * Math.sin(i * 1.71)]);
    }
    const curve = 'M' + list.map((p) => p.map((a) => a.toFixed(1)).join(',')).join(' L');
    $('sparkline').setAttribute('d', curve);
    $('sparkfill').setAttribute('d', curve + ' V22 H0 Z');
  }
  F.hudUpdate = (v, s, w, h) => {
    if (v.film) return;
    const layout = [
      $('app').className,
      s.id,
      v.playing,
      v.follow,
      v.data,
      v.labels,
      v.rate,
      v.selection,
      v.chapter
    ].join('/');
    const changed = layout !== previous;
    previous = layout;
    if (changed) {
      nav.forEach((b, i) => b.setAttribute('aria-current', i === s.id ? 'true' : 'false'));
      speed.forEach((b) => b.setAttribute('aria-pressed', +b.dataset.rate === v.rate));
      for (const [k, val] of [
        ['data', v.data],
        ['labels', v.labels],
        ['tour', v.playing]
      ])
        document.querySelector('[data-act="' + k + '"]').setAttribute('aria-pressed', val);
      $('playlabel').textContent = v.playing ? '停止' : '巡游';
      document.querySelector('.play .icon').innerHTML = icon(v.playing ? 'pause' : 'play');
      $('telemetry').hidden = !v.data;
      $('lot').hidden = !v.data;
      $('inspector').hidden = v.selection === null;
      $('linekeys').hidden = !v.data || s.id > 2;
      const tour = v.follow || v.playing,
        ch = F.chapters[v.chapter] || F.chapters[0];
      text(
        $('chapterid'),
        tour
          ? String(v.chapter + 1).padStart(2, '0') + ' / 11   ' + ch.en
          : 'L' + s.id + '  /  ' + F.stages[s.id].en
      );
      text($('chaptername'), tour ? ch.title : F.stages[s.id].zh);
      const descriptions = [
        '从厂区屋面进入，跟随 LOT-A7F3 抵达晶体管。',
        '生产、送风与回风系统的垂直剖面。',
        '天车运送晶圆盒，FFU 向工艺区垂直送风。',
        '主角晶圆盒抵达黄光区的设备装载口。',
        '真空中，13.5 nm 极紫外光经反射镜完成 4× 缩小投影。',
        '直径 300 mm · 厚约 775 μm 的薄膜晶圆。',
        '逻辑区、存储阵列与金属配线构成一颗裸片。',
        '金属层与接触孔将器件连至上层电路。',
        '三层纳米片 · 3 nm 为工艺代号，实际尺寸另行标注。'
      ];
      text($('chaptercopy'), tour ? ch.caption : descriptions[s.id]);
      const legends = [
        '',
        '',
        '',
        '装载口 / 真空舱',
        'Mo/Si 反射镜 / 真空光路',
        '薄膜 / 硅衬底',
        '逻辑单元 / 存储阵列',
        '铜 / 层间介质 / 接触孔',
        '源漏 / 硅沟道 / 栅极'
      ];
      $('legend').style.display = s.id >= 3 && v.labels ? 'block' : 'none';
      $('legend').innerHTML =
        '<b>剖面图例</b><br>' +
        legends[s.id]
          .split(' / ')
          .map((x) => '<i></i>' + x)
          .join('');
      F.invalidateLabels();
    }
    if (v.hide) return;
    if (changed || Math.abs(v.sim - lastTime) > 0.22) {
      lastTime = v.sim;
      const m = F.SIM.read(v.sim);
      text($('clock'), clock(v.sim));
      text($('yield'), m.yield.toFixed(2));
      $('gauge').style.strokeDasharray = ((106.814 * m.yield) / 100).toFixed(2) + ' 106.814';
      for (const [k] of metrics) {
        const val =
          k === 'climate'
            ? m.temp.toFixed(1) + '°C / ' + m.rh.toFixed(0) + '%RH'
            : k === 'capacity' || k === 'wip'
              ? fmt.format(m[k])
              : k === 'oee' || k === 'mw'
                ? m[k].toFixed(1)
                : String(m[k]);
        text(rows[k], val);
      }
      const events = F.SIM.alarms(v.sim);
      alarmRows.forEach((row, i) => {
        const e = events[i];
        if (!e) return;
        row.className = 'alarmrow ' + e.type;
        text(row.children[0], clock(e.time));
        text(row.children[1], F.SIM.code(e.id) + ' ' + (e.type === 'down' ? '设备异常' : '已恢复'));
      });
      if (typeof v.selection === 'string') {
        const note = notes[v.selection];
        text($('insname'), note[0]);
        text($('insdesc'), note[1]);
      } else if (v.selection !== null) {
        text(
          $('insname'),
          F.SIM.code(v.selection) + ' · ' + stateText[F.SIM.status(v.selection, v.sim)]
        );
        text(
          $('insdesc'),
          F.SIM.name(v.selection) + ' 工位｜批次 LOT-A7F3。当前工序 412 / 1186，生产信息为示意数据。'
        );
      }
    }
    const mag = '×' + fmt.format(Mag(v.q));
    text($('zoomval'), mag);
    text($('pzoom'), mag + '   /   示意数据 · DEMO');
    const field = v.metresPerPixel * 72,
      pow = Math.pow(10, Math.floor(Math.log10(field))),
      nice = (field / pow < 2 ? 1 : field / pow < 5 ? 2 : 5) * pow;
    text($('scale'), lengthLabel(nice));
    $('scale').style.minWidth = '0';
    $('scale').style.width = nice / v.metresPerPixel + 'px';
    $('rulertip').style.top = (v.q / 9) * 100 + '%';
    $('progress').style.width = (v.follow ? v.time / F.duration : v.q / 9) * 100 + '%';
    if (changed || !v.playing || Math.abs(v.time - lastDraw) > 0.028) {
      F.drawData(v, s, w, h, F.contents(v.q).ids.length > 1);
      lastDraw = v.time;
    }
    if (F.params.has('debug')) {
      $('debug').hidden = false;
      text(
        $('debug'),
        'L' +
          s.id +
          ' · q ' +
          v.q.toFixed(3) +
          ' · ' +
          v.perf.toFixed(0) +
          ' FPS · ' +
          v.quality.toFixed(2) +
          ' Q'
      );
    }
  };
  function wrap(c, content, max) {
    const lines = [];
    let line = '';
    for (const ch of content) {
      if (line && c.measureText(line + ch).width > max) {
        lines.push(line);
        line = ch;
      } else line += ch;
    }
    if (line) lines.push(line);
    return lines;
  }
  let scrim = null,
    scrimH = 0;
  F.filmGraphics = (c, w, h, v) => {
    const p = v.portrait,
      ch = F.chapters[v.chapter],
      t = v.time,
      fade = F.smooth(Math.min((t - ch.start) / 0.21, (ch.end - t) / 0.23));
    const left = w * (p ? 0.065 : 0.055),
      sans = '"Microsoft YaHei UI","Microsoft YaHei",sans-serif',
      mono = 'Consolas,"Microsoft YaHei",monospace';
    c.save();
    c.textBaseline = 'alphabetic';
    if (!p) {
      const bar = Math.max(0, (h - w / 2.39) * 0.5);
      c.fillStyle = '#060708';
      c.fillRect(0, 0, w, bar);
      c.fillRect(0, h - bar, w, bar);
    } else {
      if (scrimH !== h) {
        scrimH = h;
        scrim = c.createLinearGradient(0, h * 0.54, 0, h * 0.81);
        scrim.addColorStop(0, 'rgba(6,7,8,0)');
        scrim.addColorStop(0.66, 'rgba(6,7,8,.69)');
        scrim.addColorStop(1, 'rgba(6,7,8,.84)');
      }
      c.fillStyle = scrim;
      c.fillRect(0, h * 0.54, w, h * 0.46);
    }
    c.fillStyle = '#dea753';
    c.font = '600 ' + Math.round(w * (p ? 0.036 : 0.013)) + 'px ' + mono;
    c.fillText('DF–02', left, h * (p ? 0.135 : 0.074));
    const logoW = c.measureText('DF–02').width;
    c.fillStyle = '#e4e5d8';
    c.font = '500 ' + Math.round(w * (p ? 0.03 : 0.011)) + 'px ' + sans;
    c.fillText('12 英寸晶圆厂', left + logoW + w * 0.014, h * (p ? 0.135 : 0.074));
    c.fillStyle = '#abafa2';
    c.font = Math.round(w * (p ? 0.022 : 0.0085)) + 'px ' + mono;
    if (p) {
      c.fillText('×' + fmt.format(Mag(v.q)) + '   /   示意数据 · DEMO', left, h * 0.165);
    } else {
      c.textAlign = 'right';
      c.fillText('示意数据 · DEMO    /    LOT-A7F3', w - left, h * 0.074);
      c.textAlign = 'left';
    }
    if (fade > 0.001) {
      c.globalAlpha = fade;
      const y = p ? h * 0.646 : h * 0.899;
      c.font = Math.round(w * (p ? 0.023 : 0.009)) + 'px ' + mono;
      c.fillStyle = '#e7b467';
      c.fillRect(left, y - 3, w * 0.025, 1.5);
      c.fillText(String(v.chapter + 1).padStart(2, '0') + ' / 11    ' + ch.en, left + w * 0.036, y);
      c.fillStyle = '#eeeee3';
      c.font = '600 ' + Math.round(w * (p ? 0.06 : 0.024)) + 'px ' + sans;
      c.fillText(ch.title, left, y + h * (p ? 0.044 : 0.048));
      c.fillStyle = '#bdc2b4';
      c.font = Math.round(w * (p ? 0.028 : 0.01)) + 'px ' + sans;
      if (p) {
        wrap(c, ch.caption, w * 0.74).forEach((line, k) =>
          c.fillText(line, left, y + h * 0.071 + k * w * 0.04)
        );
      } else {
        c.fillText(ch.caption, left, y + h * 0.076);
        c.font = Math.round(w * 0.011) + 'px ' + mono;
        c.textAlign = 'right';
        c.fillText('×' + fmt.format(Mag(v.q)), w - left, y + h * 0.05);
        c.textAlign = 'left';
      }
      const yy = p ? h * 0.768 : h * 0.984;
      c.fillStyle = '#555a50';
      c.fillRect(left, yy, p ? w * 0.73 : w * 0.89, 1);
      c.fillStyle = '#d5a15a';
      c.fillRect(left, yy, ((p ? w * 0.73 : w * 0.89) * t) / F.duration, 2);
    }
    c.restore();
  };
  F.bindUI = (v, ctl) => {
    const app = $('app'),
      canvas = $('view'),
      p = F.params;
    construct();
    if (p.has('instant') || v.rec || v.film || p.has('tourat') || p.has('still'))
      app.classList.add('instant');
    requestAnimationFrame(() => app.classList.add('entered'));
    const stop = () => {
      v.playing = false;
    };
    const clearOrbit = () => {
      v.orbitX = 0;
      v.orbitY = 0;
      v.zoom = 1;
    };
    const toStage = (i) => {
      stop();
      clearOrbit();
      v.follow = false;
      v.selection = null;
      app.classList.remove('nav-open');
      ctl.manual(i ? i + 0.43 : 0, v.sim);
    };
    const play = () => {
      if (v.playing) {
        stop();
      } else {
        clearOrbit();
        v.selection = null;
        ctl.setTourTime(v.follow ? v.time : 0);
        v.playing = true;
        v.follow = true;
      }
      ctl.render();
    };
    const toggleAR = () => {
      stop();
      v.explicitPortrait = !v.portrait;
      v.wideScreen = v.portrait;
      v.portrait = !v.portrait;
      app.classList.remove('nav-open');
      ctl.resize();
    };
    const full = () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else app.requestFullscreen?.().catch(() => {});
    };
    const action = (name) => {
      if (name !== 'tour') stop();
      switch (name) {
        case 'stages':
          app.classList.toggle(v.portrait ? 'nav-open' : 'nav-closed');
          break;
        case 'data':
          v.data = !v.data;
          break;
        case 'labels':
          v.labels = !v.labels;
          break;
        case 'tour':
          play();
          return;
        case 'reset':
          v.sim = 0;
          v.time = 0;
          toStage(0);
          return;
        case 'fullscreen':
          full();
          break;
        case 'portrait':
          toggleAR();
          return;
        case 'lot':
          v.selection = 'LOT';
          break;
        case 'close':
          v.selection = null;
          app.classList.remove('nav-open');
          break;
      }
      F.invalidateLabels();
      ctl.render();
    };
    app.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) {
        if (v.playing) {
          stop();
          ctl.render();
        }
        return;
      }
      if (b.hasAttribute('data-stage')) {
        toStage(+b.dataset.stage);
        return;
      }
      if (b.hasAttribute('data-unit')) {
        stop();
        v.selection = +b.dataset.unit;
        F.invalidateLabels();
        ctl.render();
        return;
      }
      if (b.hasAttribute('data-note')) {
        stop();
        v.selection = 'L' + b.dataset.note;
        F.invalidateLabels();
        ctl.render();
        return;
      }
      if (b.dataset.act === 'speed') {
        stop();
        v.rate = +b.dataset.rate;
        ctl.render();
        return;
      }
      if (b.dataset.act) action(b.dataset.act);
    });
    const pointers = new Map();
    let pinch = 0,
      dragged = false,
      originX = 0,
      originY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (v.rec) return;
      stop();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      if (pointers.size === 1) {
        dragged = false;
        originX = e.clientX;
        originY = e.clientY;
      }
      if (pointers.size === 2) {
        const [a, b] = pointers.values();
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
      ctl.render();
    });
    canvas.addEventListener('pointermove', (e) => {
      const old = pointers.get(e.pointerId);
      if (!old) return;
      let dx = e.clientX - old.x,
        dy = e.clientY - old.y;
      old.x = e.clientX;
      old.y = e.clientY;
      if (Math.hypot(e.clientX - originX, e.clientY - originY) > 3) dragged = true;
      if (pointers.size === 2) {
        const [a, b] = pointers.values();
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 2 && dist > 2) {
          v.follow = false;
          ctl.manual(v.q + Math.log(dist / pinch) * 1.1, v.sim);
        }
        pinch = dist;
      } else if (dragged) {
        v.orbitX -= dx * 0.27;
        v.orbitY = F.clamp(v.orbitY + dy * 0.2, -48, 52);
        ctl.render();
      }
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      canvas.addEventListener(event, (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = 0;
      });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        stop();
        const amt = e.deltaY * (e.deltaMode === 1 ? 15 : e.deltaMode === 2 ? innerHeight : 1);
        if (e.shiftKey || e.altKey) {
          v.zoom = F.clamp(v.zoom * Math.exp(amt * 0.001), 0.68, 1.75);
          ctl.render();
        } else {
          v.follow = false;
          ctl.manual(v.q + amt * 0.0017, v.sim);
        }
      },
      { passive: false }
    );
    addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (/^[0-8]$/.test(k)) {
        e.preventDefault();
        toStage(+k);
        return;
      }
      if (k === 'h') {
        e.preventDefault();
        v.hide = !v.hide;
        app.classList.toggle('hide-ui', v.hide);
        ctl.render();
        return;
      }
      const keys = {
        d: 'data',
        l: 'labels',
        ' ': 'tour',
        v: 'portrait',
        f: 'fullscreen',
        escape: 'close'
      };
      if (keys[k]) {
        e.preventDefault();
        action(keys[k]);
      }
    });
    // Orientation is also reachable on touch hardware with no keyboard.
    $('pzoom').style.pointerEvents = 'auto';
    $('pzoom').title = '切换横竖屏 (V)';
    $('pzoom').addEventListener('dblclick', toggleAR);
  };
})(F);

((F, T) => {
  'use strict';
  const P = F.params,
    flag = (k) => P.has(k) && P.get(k) !== '0';
  const rec = flag('rec'),
    film = flag('film') || rec,
    still = flag('still'),
    at = P.has('tourat');
  const recordWide = P.get('ar') === '16x9',
    recordW = +P.get('w') || (recordWide ? 1920 : 1080),
    recordH = +P.get('h') || (recordWide ? 1080 : 1920);
  const portraitRequested = P.get('ar') === '9x16' || (rec && !P.has('ar') && recordW < recordH);
  const app = document.getElementById('app'),
    view = document.getElementById('view'),
    glCanvas = film ? document.createElement('canvas') : view;
  const v = (F.view = {
    q: 0,
    time: 0,
    sim: 0,
    chapter: 0,
    playing: flag('tour') || flag('film'),
    film,
    rec,
    still,
    portrait: portraitRequested,
    explicitPortrait: portraitRequested,
    wideScreen: recordWide || (rec && !portraitRequested),
    follow: at || flag('tour') || film,
    data: !film && !flag('nodata'),
    labels: !film && !flag('nolabels'),
    hide: flag('hideui') || film,
    rate: [1, 2, 4].includes(+P.get('sim')) ? +P.get('sim') : 1,
    orbitX: 0,
    orbitY: 0,
    zoom: 1,
    cx: 0.5,
    cy: 0.5,
    perf: 60,
    quality: flag('lq') ? 0.77 : 1,
    selection: null
  });
  let r;
  try {
    r = new T.WebGLRenderer({
      canvas: glCanvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: rec,
      powerPreference: 'high-performance',
      stencil: false
    });
  } catch (e) {
    document.getElementById('fatal').textContent =
      '无法建立 WebGL 图形上下文。请启用浏览器硬件加速后重新打开。';
    throw e;
  }
  F.renderer = r;
  r.info.autoReset = false;
  r.toneMapping = T.NoToneMapping;
  r.outputColorSpace = T.SRGBColorSpace;
  r.shadowMap.enabled = !flag('lq');
  r.shadowMap.type = T.PCFShadowMap;
  const post = F.makePost(r),
    ink = film ? view.getContext('2d', { alpha: false }) : null;
  let width = 1,
    height = 1,
    bufferW = 1,
    bufferH = 1,
    stats = [],
    active = [],
    built = false,
    renderId = 0,
    dpr = 1,
    recClock = null;
  const anchors = [],
    anchorPool = [
      [0, 0],
      [0, 0]
    ],
    scenes = [];
  function resize() {
    const sw = innerWidth,
      sh = innerHeight;
    if (!v.explicitPortrait) v.portrait = sw / sh < 0.83 && !v.wideScreen;
    if (rec) {
      width = F.clamp(Math.floor(recordW), 128, 8192);
      height = F.clamp(Math.floor(recordH), 128, 8192);
    } else if (v.portrait && sw / sh > 0.64) {
      height = sh;
      width = Math.round((sh * 9) / 16);
    } else if (v.wideScreen && sw / sh < 1) {
      width = sw;
      height = Math.round((sw * 9) / 16);
    } else {
      width = sw;
      height = sh;
    }
    const displayScale = Math.min(sw / width, sh / height);
    app.style.cssText =
      'width:' +
      Math.round(width * displayScale) +
      'px;height:' +
      Math.round(height * displayScale) +
      'px;left:50%;top:50%;transform:translate(-50%,-50%)';
    app.classList.toggle('portrait', v.portrait);
    app.classList.toggle('film', film);
    app.classList.toggle('hide-ui', v.hide);
    dpr = rec ? 1 : Math.min(devicePixelRatio || 1, 1.75) * v.quality;
    bufferW = Math.max(1, Math.round(width * dpr));
    bufferH = Math.max(1, Math.round(height * dpr));
    r.setSize(bufferW, bufferH, false);
    post.resize(bufferW, bufferH);
    if (film) {
      view.width = bufferW;
      view.height = bufferH;
    }
    v.cx = v.portrait ? 0.455 : 0.495;
    v.cy = v.portrait ? 0.435 : 0.455;
    if (built) render();
  }
  resize();
  const vp = new T.Vector3();
  function render() {
    const c = F.contents(v.q);
    active = c.ids;
    scenes.length = anchors.length = active.length;
    for (let i = 0; i < active.length; i++) {
      const s = F.stage(active[i]);
      scenes[i] = s;
      s.update(v.sim, c.progress[i]);
      F.camera(s, c.progress[i], width, height, v);
      const frame = i === 0 && active.length === 2 ? s.exitFrame : s.enterFrame;
      vp.fromArray(frame).project(s.camera);
      const coord = anchorPool[i];
      coord[0] = vp.x * 0.5 + 0.5;
      coord[1] = 0.5 - vp.y * 0.5;
      anchors[i] = coord;
    }
    const scale0 = scenes[0].camera.userData.metresPerHeight / height;
    v.metresPerPixel =
      scenes.length === 1
        ? scale0
        : Math.exp(
            F.mix(
              Math.log(scale0),
              Math.log(scenes[1].camera.userData.metresPerHeight / height),
              c.blend
            )
          );
    stats = post.render(scenes, c.blend, v.q, v.cx, v.cy);
    v.index = c.ids[c.ids.length === 2 && c.blend > 0.5 ? 1 : 0];
    if (film) {
      ink.drawImage(glCanvas, 0, 0, bufferW, bufferH);
      if (F.filmGraphics) F.filmGraphics(ink, bufferW, bufferH, v);
    }
    if (F.hudUpdate) F.hudUpdate(v, scenes[c.ids.length === 2 && c.blend > 0.5 ? 1 : 0], width, height);
    ++renderId;
  }
  function setTourTime(t) {
    const s = F.locate(t);
    v.q = s.q;
    v.chapter = s.chapter;
    v.time = s.time;
    v.sim = F.simAt(s.time) * v.rate;
  }
  function manual(q, t) {
    v.playing = false;
    v.follow = false;
    v.q = F.clamp(q, 0, 9);
    v.sim = t;
    v.chapter = F.clamp(Math.floor(q) + (q >= 4 ? 1 : 0), 0, 9);
    render();
  }
  function seek(t) {
    recClock = null;
    v.playing = false;
    v.follow = true;
    setTourTime(t);
    render();
  }
  function state() {
    return {
      q: v.q,
      index: v.index,
      chapter: v.chapter,
      active: active.slice(),
      calls: stats.reduce((n, s) => n + s.calls, 0),
      tris: stats.reduce((n, s) => n + s.tris, 0),
      stages: stats,
      anchors,
      playing: v.playing,
      time: recClock === null ? v.time : recClock,
      timelineTime: v.time,
      sim: v.sim,
      data: v.data,
      labels: v.labels,
      rate: v.rate,
      portrait: v.portrait,
      hide: v.hide,
      selection: v.selection,
      orbitX: v.orbitX,
      orbitY: v.orbitY,
      zoom: v.zoom,
      frame: renderId,
      dpr,
      quality: v.quality,
      msaa: post.targets[0].samples,
      perf: v.perf,
      width,
      height
    };
  }
  F.api = window.__fab = {
    ready: false,
    sample: (q, t = 0) => {
      manual(q, t);
      return state();
    },
    seek(t) {
      seek(t);
      return state();
    },
    state,
    duration: F.duration,
    chapters: F.chapters,
    edges: F.edges
  };
  let fps = Number(P.get('fps')) || 60;
  fps = F.clamp(fps, 1, 120);
  const frames = Math.ceil(F.duration * fps - 1e-8) + 1;
  let frame = 0;
  if (rec) {
    v.playing = false;
    window.__rec = {
      ready: false,
      frames,
      time: 0,
      done: false,
      step() {
        if (frame >= frames) return frames - 1;
        const i = frame++;
        this.time = recClock = i / fps;
        setTourTime(i === frames - 1 ? F.duration : recClock);
        render();
        this.done = frame === frames;
        return i;
      }
    };
  }
  const startStage = /^L?([0-8])$/i.exec(P.get('stage') || '');
  if (startStage) {
    const i = +startStage[1];
    v.q = i ? i + 0.43 : 0;
  }
  if (at) {
    setTourTime(+P.get('tourat') || 0);
    v.playing = false;
  }
  F.controls = { render, resize, seek, manual, setTourTime };
  if (F.bindUI) F.bindUI(v, F.controls);
  render();
  built = true;
  F.api.ready = true;
  if (rec) window.__rec.ready = true;
  let last = performance.now(),
    budgetT = 0,
    frameCount = 0;
  function tick(now) {
    const wall = (now - last) / 1000;
    last = now;
    if (!document.hidden && !rec) {
      const advance = !at && !still;
      if (v.playing) {
        setTourTime(F.mod(v.time + wall * (flag('tourfast') ? 8 : 1), F.duration));
        render();
      } else if (advance) {
        v.sim += wall * v.rate;
        render();
      }
      if (advance) {
        budgetT += wall;
        frameCount++;
        if (budgetT > 2.75) {
          v.perf = frameCount / budgetT;
          if (v.perf < 45 && v.quality > 0.55 && !flag('lq')) {
            v.quality = Math.max(0.55, v.quality * 0.83);
            resize();
          }
          budgetT = 0;
          frameCount = 0;
        }
      }
    }
    if (!rec) requestAnimationFrame(tick);
  }
  if (!rec) requestAnimationFrame(tick);
  addEventListener('resize', resize);
  let pending = 1;
  function prebuild() {
    if (pending > 8) return;
    F.stage(pending++);
    if (pending <= 8) schedule();
  }
  function schedule() {
    if ('requestIdleCallback' in window) requestIdleCallback(prebuild, { timeout: 800 });
    else setTimeout(prebuild, 60);
  }
  schedule();
})(F, THREE);
