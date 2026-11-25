"""Input, deterministic simulation, responsive layout and hardware timing checks."""

import statistics
from time import perf_counter

import numpy as np

from browser import HTML, gpu_info, source_hash, write_json


def verify(condition, message):
    if not condition:
        raise AssertionError(message)


def check_inputs(harness, root, match=None):
    root.mkdir(parents=True, exist_ok=True)
    logbook = {"checks": [], "errors": [], "browser": harness.browser.version, "sourceSha256": source_hash(), "consoles": []}
    page, log = harness.page(1920, 1080)
    logbook["consoles"].append(log)

    def test(name, callback):
        if match and match.lower() not in name.lower():
            return
        before = sum(len(c["warnings"]) for c in logbook["consoles"])
        try:
            page.bring_to_front()
            evidence = callback()
            logbook["checks"].append({"name": name, "pass": True, "evidence": evidence})
        except Exception as exc:
            reason = str(exc).split("Call log:")[0][:800]
            logbook["errors"].append(name + " / " + reason)
            logbook["checks"].append({"name": name, "pass": False, "reason": reason})
        after = sum(len(c["warnings"]) for c in logbook["consoles"])
        logbook["checks"][-1]["newConsoleWarnings"] = after-before
        write_json(root / "report.json", logbook)

    def state():
        return page.evaluate("__fab.state()")

    def wait(expr, arg=None, timeout=5000):
        page.wait_for_function(expr, arg=arg, timeout=timeout)

    def jump(n):
        page.keyboard.press(str(n))
        wait("n=>__fab.state().index===n", n)

    def flag(key):
        s = state()
        return (s.get("flags") or {}).get(key, s.get(key))

    def toggle(key, hotkey):
        old = flag(key)
        verify(isinstance(old, bool), f"Unknown {key} flag")
        page.keyboard.press(hotkey)
        wait("([key,v])=>{const s=__fab.state();return (s.flags?.[key]??s[key])===v}", [key, not old])
        page.keyboard.press(hotkey)
        wait("([key,v])=>{const s=__fab.state();return (s.flags?.[key]??s[key])===v}", [key, old])
        return {"default": old, "afterFirstPress": not old}

    def startup():
        page.add_init_script("""window.addEventListener('DOMContentLoaded',()=>{
          function probe(t){if(window.__fab?.ready){window.__qaReadyMs=performance.now();return;}requestAnimationFrame(probe);}
          requestAnimationFrame(probe);});""")
        t = perf_counter()
        harness.open(page, {})
        wait("window.__qaReadyMs>0")
        elapsed = page.evaluate("Math.round(window.__qaReadyMs)")
        logbook["gpu"] = gpu_info(page)
        logbook["fileBytes"] = HTML.stat().st_size
        logbook["firstReadyMs"] = elapsed
        verify(HTML.stat().st_size < 2_500_000, "Standalone HTML exceeds 2.5 MB")
        verify(elapsed < 4000, f"First interactive frame took {elapsed} ms")
        verify(page.locator("[data-stage]").count() >= 9, "Stage index is incomplete")
        page.wait_for_timeout(900)
        page.screenshot(path=str(root / "desktop.png"), animations="allow")
        return {"offline": page.context is not None, "readyMs": elapsed,
                "navigationWallMs": round(1000*(perf_counter()-t)), "sizeBytes": HTML.stat().st_size}

    def stage_index():
        nav = page.locator("[data-stage]").first
        selected = page.locator('[data-stage="6"],[data-stage="L6"]').first
        verify(nav.is_visible() and selected.is_visible(), "Stage navigation is not visible")
        selected.click()
        wait("__fab.state().index===6")
        jump(8)
        jump(0)
        return [6, 8, 0]

    def scroll():
        jump(2)
        q0 = state()["q"]
        page.mouse.move(960, 530)
        page.mouse.wheel(0, 285)
        wait("q=>Math.abs(__fab.state().q-q)>.01", q0)
        q1 = state()["q"]
        return {"before": q0, "after": q1}

    def tour_control():
        jump(0)
        started = flag("playing")
        verify(started is False, "Unexpected active tour before interaction")
        page.keyboard.press("Space")
        wait("__fab.state().playing===true")
        page.keyboard.press("Escape")
        wait("__fab.state().playing===false")
        page.keyboard.press("Space")
        page.mouse.move(955, 525)
        page.mouse.down()
        page.mouse.move(1125, 563, steps=8)
        page.mouse.up()
        wait("__fab.state().playing===false")
        return "Space / Escape and drag both exited the tour."

    def speed():
        got = []
        observed = []
        for rate in (2, 4, 1):
            btn = page.locator(f'[data-act="speed"][data-rate="{rate}"]')
            verify(btn.is_visible(), f"No visible {rate}× simulation rate control")
            btn.click()
            got.append(flag("rate"))
            slope = page.evaluate("""() => new Promise(resolve=>{
              const before=__fab.state().sim,t=performance.now();
              setTimeout(()=>requestAnimationFrame(()=>resolve((__fab.state().sim-before)*1000/(performance.now()-t))),340);
            })""")
            observed.append(round(slope,2))
            verify(abs(slope-rate)<max(.4,rate*.25),f"Measured {slope:.2f}× for {rate}×")
        verify(set(got) == {1, 2, 4}, str(got))
        return {"controls":got,"measuredClockRates":observed}

    def screen_mode():
        page.keyboard.press("f")
        wait("!!document.fullscreenElement")
        page.keyboard.press("f")
        wait("!document.fullscreenElement")
        return "Fullscreen entered and exited."

    def inspector():
        jump(2)
        page.wait_for_function("document.querySelector('[data-unit]')!==null", timeout=6500)
        node = page.locator("[data-unit]:visible").first
        verify(node.is_visible(), "No visible projected machine label for device inspection")
        device = node.get_attribute("data-unit")
        node.click()
        wait("__fab.state().selection!==null")
        selected = state()["selection"]
        page.screenshot(path=str(root / "inspector.png"))
        page.keyboard.press("Escape")
        wait("__fab.state().selection===null")
        return {"clicked": device, "selected": selected}

    def orbit():
        page.evaluate("__fab.sample(2.43,0)")
        before = state()
        page.mouse.move(895, 545)
        page.mouse.down()
        page.mouse.move(1080, 610, steps=10)
        page.mouse.up()
        wait("o=>Math.abs(__fab.state().orbitX-o)>1", before["orbitX"])
        after = state()
        return {"initial": [before["orbitX"], before["orbitY"]], "final": [after["orbitX"], after["orbitY"]]}

    def zoom_and_dock():
        jump(4)
        z0 = state()["zoom"]
        page.mouse.move(950, 525)
        page.keyboard.down("Shift")
        try:
            page.mouse.wheel(0, 170)
        finally:
            page.keyboard.up("Shift")
        wait("z=>Math.abs(__fab.state().zoom-z)>.01", z0)
        z1 = state()["zoom"]
        page.locator('[data-act="reset"]').click()
        wait("__fab.state().index===0 && __fab.state().zoom===1 && __fab.state().orbitX===0")
        nav = page.locator('#nav')
        page.locator('[data-act="stages"]').click()
        verify(not nav.is_visible(), "Scale index failed to close")
        page.locator('[data-act="stages"]').click()
        verify(nav.is_visible(), "Scale index failed to reopen")
        return {"localZoom": [z0,z1], "resetStage": state()["index"]}

    def deterministic_record():
        opts = {"rec": 1, "ar": "9x16", "film": 1, "fps": 60, "w": 324, "h": 576, "instant": 1}
        framesets = []
        for _ in range(2):
            independent, new_log = harness.page(324,576)
            logbook["consoles"].append(new_log)
            try:
                harness.open(independent, opts)
                independent.wait_for_function("window.__rec?.ready===true")
                frames_before = independent.evaluate("__fab.state().frame")
                independent.wait_for_timeout(150)
                verify(frames_before == independent.evaluate("__fab.state().frame"), "Record mode advanced without an explicit step")
                facts = independent.evaluate("""() => {
              const pixels=[], times=[], digits=[]; const c=document.getElementById('view');
              const scratch=document.createElement('canvas');scratch.width=c.width;scratch.height=c.height;
              const reader=scratch.getContext('2d',{willReadFrequently:true});
              for(let i=0;i<8;i++){digits.push(__rec.step());times.push(__fab.state().time);
                reader.drawImage(c,0,0);const buf=reader.getImageData(0,0,c.width,c.height).data;
                // FNV-1a of all RGBA bytes, including burned-in film lettering.
                let h=0x811c9dc5;for(let n=0;n<buf.length;n++)h=Math.imul(h^buf[n],0x01000193);
                pixels.push(h>>>0);}
              return {pixels,times,digits,dpr:__fab.state().dpr,samples:__fab.state().msaa};
            }""")
            finally:
                independent.context.close()
            verify(facts["digits"] == list(range(8)), str(facts["digits"]))
            verify(all(abs(t-i/60)<1e-8 for i,t in enumerate(facts["times"])), str(facts["times"]))
            verify(facts["dpr"] == 1 and facts["samples"] == 4, str(facts))
            framesets.append(facts)
        verify(framesets[0]["pixels"] == framesets[1]["pixels"], "Independent sessions disagree on image hashes")
        return framesets[0]

    def query_modes():
        harness.open(page, {"instant": 1, "still": 1, "raw": 1, "lq": 1, "nodata": 1,
                            "nolabels": 1, "hideui": 1, "debug": 1, "stage": "L7", "sim": 4})
        s = state()
        verify((s["index"], s["rate"], s["data"], s["labels"], s["hide"], s["msaa"])
               == (7, 4, False, False, True, 0), str(s))
        page.wait_for_timeout(220)
        verify(state()["time"] == s["time"] and state()["sim"] == s["sim"], "Still mode advanced its clocks")
        return {k: s[k] for k in ["index", "rate", "data", "labels", "hide", "quality", "msaa"]}

    def film_layout():
        page.add_init_script(r"""(() => {
          const p=CanvasRenderingContext2D.prototype,orig=p.fillText;
          p.fillText=function(str,x,y,...args){
            if(this.canvas.id==='view' && window.__filmProbe){
              const tm=this.measureText(str),size=Number(this.font.match(/([\d.]+)px/)?.[1]);
              window.__filmProbe.push({str,x:x-tm.actualBoundingBoxLeft,y:y-tm.actualBoundingBoxAscent,
                                       r:x+tm.actualBoundingBoxRight,b:y+tm.actualBoundingBoxDescent,size});
            }
            return orig.call(this,str,x,y,...args);
          };
        })()""")
        harness.open(page, {"rec": 1, "fps": 60, "w": 1080, "h": 1920, "ar": "9x16"})
        rendered = page.evaluate("""() => __fab.chapters.map(c=>{
          window.__filmProbe=[];__fab.seek(c.at);
          const ink=window.__filmProbe;window.__filmProbe=null;return {title:c.title,caption:c.caption,ink};
        })""")
        sizes = []
        for chapter in rendered:
            title = [row for row in chapter["ink"] if row["str"] == chapter["title"]]
            body = [row for row in chapter["ink"] if row["str"] and row["str"] in chapter["caption"] and row["str"] != chapter["title"]]
            verify(len(title)==1 and title[0]["size"] >= 56 and body and min(row["size"] for row in body) >= 28,
                   f"Film captions missing or too small: {chapter['title']}")
            for row in chapter["ink"]:
                verify(row["x"]>=-1 and row["r"]<=.84*1080+1 and row["y"]>=.10*1920-1 and row["b"]<=.78*1920+1,
                       f"{chapter['title']} burned-in text outside safe area: {row}")
            sizes.append({"title":chapter["title"], "px":title[0]["size"], "bodyPx":body[0]["size"]})
        harness.open(page, {"rec": 1, "fps": 60, "w": 1920, "h": 1080, "ar": "16x9"})
        bars = page.evaluate("""() => {
          __fab.seek(__fab.chapters[0].at);const c=document.getElementById('view'),g=c.getContext('2d');
          const b=(c.height-c.width/2.39)/2,column=g.getImageData(2,2,1,c.height-4).data;
          return [b,[...column.slice(0,4)],[...column.slice(-4)]];
        }""")
        verify(bars[1] == bars[2] == [6,7,8,255], f"Unexpected scope masking {bars}")
        return {"chapterFontSizes":sizes, "scopeBarPixels":round(bars[0],2)}

    def deterministic_sim():
        sim = page.evaluate("""() => {
          const sim=F.SIM, observed=[], last=new Map();
          for(let t=0;t<=716;t+=1){
            for(let id=0;id<24;id++){
              const s=sim.status(id,t);
              if(s==='down'&&!last.has(id))last.set(id,t);
              if(s!=='down'&&last.has(id)){observed.push(t-last.get(id));last.delete(id);}
            }
          }
          return {observed,telemetry:sim.read(4),events:sim.alarms(35),repeat:JSON.stringify(sim.read(4))===JSON.stringify(sim.read(4))};
        }""")
        durations = sim["observed"]
        verify(len(durations) >= 2 and min(durations) >= 6 and max(durations) <= 15, str(durations))
        verify(sim["repeat"] and len(sim["events"]), "Sim event replay failed")
        return {"eventsObserved": len(durations), "minS": min(durations), "maxS": max(durations),
                "channels": list(sim["telemetry"].keys())}

    def machine_outputs():
        result = page.evaluate("""() => {
          const s=F.stage(2),dynamic=s.root.children.filter(o=>o.isInstancedMesh&&o.count===24&&o.instanceMatrix.usage===THREE.DynamicDrawUsage);
          const lamps=dynamic.find(o=>o.instanceColor),arms=dynamic.find(o=>o.geometry.type==='BoxGeometry'&&!o.instanceColor);
          const c=new THREE.Color(),m=new THREE.Matrix4(),bad=[];
          for(const t of [0,4.5,5.5,17,38,65]){
            s.update(t,.43);
            for(let id=0;id<24;id++){lamps.getColorAt(id,c);const status=F.SIM.status(id,t);
              if(c.getHex()!==({run:0x9ed6b4,idle:0xf2a73b,down:0xff5638})[status])bad.push([t,id,status]);}
          }
          const ids=s.units.map(u=>u.id),down=ids.find(id=>F.SIM.status(id,4.2)==='down');
          function x(id,t){s.update(t,.43);arms.getMatrixAt(id,m);return m.elements[12];}
          let end=5;while(F.SIM.status(down,end)==='down')end++;
          const parkedDown=[x(down,4.2),x(down,5.2)],parkedIdle=[x(0,1),x(0,2)];
          const restart=[x(down,end+.3),x(down,end+.7)];
          return {physicalUnits:new Set(ids).size,colorChecks:144,bad,downId:down,parkedDown,parkedIdle,restart};
        }""")
        verify(result["physicalUnits"]==24 and not result["bad"],str(result))
        verify(result["parkedDown"][0]==result["parkedDown"][1] and result["parkedIdle"][0]==result["parkedIdle"][1],str(result))
        verify(abs(result["restart"][0]-result["restart"][1])>1e-6,str(result))
        return result

    def realtime_chapters():
        harness.open(page, {"instant": 1, "tour": 1, "tourfast": 1})
        verify(state()["playing"], "tour=1 did not start automatically")
        # Compile each local material once before using the accelerated 8× timing probe.
        for i in range(9):
            page.evaluate("i=>__fab.sample(i+.43,0)", i)
        elapsed = page.evaluate("""() => new Promise(resolve=>{
          __fab.seek(0);document.querySelector('[data-act=tour]').click();
          const marks=[__fab.state().chapter],start=performance.now();let last=marks[0];
          function tick(t){const s=__fab.state(), ch=s.chapter;
            if(ch!==last){marks.push(ch);last=ch;}
            if(marks.length>=12||t-start>18000){resolve({marks,seconds:(t-start)/1000,
              focus:document.hasFocus(),hidden:document.hidden});return;}
            requestAnimationFrame(tick);
          } requestAnimationFrame(tick);
        })""")
        seq = elapsed["marks"]
        verify(seq[:11] in (list(range(11)), list(range(1, 12))), f"Real-time tour sequence {seq}")
        return elapsed

    def performance():
        harness.open(page, {"instant": 1})
        values = []
        for n in range(9):
            page.bring_to_front()
            jump(n)
            page.wait_for_timeout(400)
            initial_frame = state()["frame"]
            intervals = page.evaluate("""() => new Promise(resolve=>{
              const out=[],start=performance.now();let last=0;
              const tick=t=>{if(last)out.push(t-last);last=t;
                if(out.length===91||t-start>4500)resolve(out.slice(1));else requestAnimationFrame(tick)};
              requestAnimationFrame(tick);
            })""")
            s = state()
            rendered = s["frame"]-initial_frame
            verify(rendered >= .95*len(intervals), f"L{n} rendered {rendered} times across {len(intervals)} display pulses")
            values.append({"stage": n, "p50Ms": round(statistics.median(intervals), 2),
                           "p95Ms": round(float(np.quantile(intervals, .95)), 2),
                           "fps": round(1000*len(intervals)/sum(intervals), 2),
                           "dpr": s["dpr"], "calls": s["calls"], "samples": s["msaa"],
                           "renderedFrames":rendered, "pageFocus":page.evaluate("document.hasFocus()")})
        logbook["timing"] = values
        return values

    def mobile():
        phone, phone_log = harness.page(393, 698, mobile=True)
        logbook["consoles"].append(phone_log)
        try:
            harness.open(phone, {"instant": 1, "ar": "9x16", "tourat": 3})
            facts = phone.evaluate("""() => ({
              w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollWidth,
              critical:[...document.querySelectorAll('[data-safe]')].map(el=>{
                const r=el.getBoundingClientRect(),style=getComputedStyle(el);
                return {key:el.getAttribute('data-safe')||el.id, x:r.x,y:r.y,r:r.right,b:r.bottom,size:parseFloat(style.fontSize),visible:r.width>0&&r.height>0&&style.visibility!=='hidden'&&style.display!=='none'};
              }).filter(v=>v.visible)})""")
            verify(facts["scroll"] <= facts["w"], f"Horizontal page overflow {facts}")
            verify(len(facts["critical"]) >= 2, "Missing measurable native portrait critical text")
            for r in facts["critical"]:
                verify(r["x"] >= -1 and r["r"] <= facts["w"]*.84+1 and r["y"] >= facts["h"]*.10-1 and r["b"] <= facts["h"]*.78+1,
                       f"Portrait safe area violation {r} at {(facts['w'],facts['h'])}")
            phone.screenshot(path=str(root / "mobile.png"))
            phone.evaluate("__fab.sample(2.43,0)")
            touch = phone.context.new_cdp_session(phone)
            q = phone.evaluate("__fab.state().q")
            def event(kind, separation):
                points = [] if kind == "touchEnd" else [
                    {"x": 178-separation, "y": 315, "id": 11},
                    {"x": 178+separation, "y": 315, "id": 12},
                ]
                touch.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": points})
            event("touchStart", 35)
            for span in (40, 50, 62, 75, 82):
                event("touchMove", span)
            event("touchEnd", 0)
            phone.wait_for_function("q=>Math.abs(__fab.state().q-q)>.01", arg=q, timeout=5000)
            facts["pinch"] = [q, phone.evaluate("__fab.state().q")]
            return facts
        finally:
            phone.context.close()

    test("cold standalone startup, desktop HUD and payload", startup)
    test("click stage index and hotkey stage jumps", stage_index)
    test("wheel continuous scrub", scroll)
    test("D toggles data layer", lambda: toggle("data", "d"))
    test("L toggles annotations", lambda: toggle("labels", "l"))
    test("H toggles UI", lambda: toggle("hide", "h"))
    test("V switches native aspect layout", lambda: toggle("portrait", "v"))
    test("simulation speed selector", speed)
    test("Space, Escape and drag control tour", tour_control)
    test("drag orbits camera", orbit)
    test("Shift-wheel lens zoom, dock reset and stage menu", zoom_and_dock)
    test("machine beacon, inspector and dismissal", inspector)
    test("F fullscreen", screen_mode)
    test("seeded alarms recover after 6–15 seconds", deterministic_sim)
    test("24 actual instance lamps and parked equipment actuators", machine_outputs)
    test("real-clock, ordered 11-chapter playback", realtime_chapters)
    test("1920x1080 live hardware frame timing", performance)
    test("mobile native viewport and safe items", mobile)
    test("query flags, manual stage, low quality and still clock", query_modes)
    test("burned-in 9:16 film text and 2.39:1 scope masking", film_layout)
    test("independent 60fps recorder sessions produce exact same frames", deterministic_record)
    page.context.close()
    for l in logbook["consoles"]:
        if l["errors"] or l["warnings"] or l["externalRequests"]:
            logbook["errors"].append("A browser error, warning or external request was recorded")
    write_json(root / "report.json", logbook)
    return logbook
