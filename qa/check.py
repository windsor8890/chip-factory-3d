"""Offline acceptance checks. Run with --phase gray, final, or interactions."""

import argparse
import base64
import io
import json
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from browser import Browser, HTML, RESULTS, gpu_info, source_hash, write_json


def state(page):
    return page.evaluate("window.__fab.state()")


def capture(page, action, arg, file=None, interface=False, measure_gate=False):
    # The framebuffer read must happen in the task that synchronously set the shot.
    info, encoded = page.evaluate("""([action,arg,read,gate]) => {
      const f=window.__fab;
      if(action==='seek') f.seek(arg); else f.sample(arg[0],arg[1]);
      const state=f.state();
      if(gate && state.active.length===2) {
        state.doorBounds=state.active.map((id,k)=>{
          const s=F.stage(id),portal=(k===0?s.portals.at(-1):s.portals[0]).group;
          // Project the matching models' real geometry bounds, independently of the optical-axis anchors.
          const box=new THREE.Box3().setFromObject(portal,true), v=new THREE.Vector3();
          const u=[],w=[];
          for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])
            for(const z of [box.min.z,box.max.z]){v.set(x,y,z).project(s.camera);u.push(.5+v.x/2);w.push(.5-v.y/2);}
          return [Math.min(...u),Math.min(...w),Math.max(...u),Math.max(...w)];
        });
      }
      return [state,read?document.getElementById('view').toDataURL('image/png').split(',')[1]:null];
    }""", [action, arg, not interface, measure_gate])
    data = page.screenshot(animations="allow") if interface else base64.b64decode(encoded)
    if file:
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data)
    im = Image.open(io.BytesIO(data)).convert("RGB")
    return info, im


def image_diff(a, b):
    pix_a = np.asarray(a, dtype=np.int16)
    pix_b = np.asarray(b, dtype=np.int16)
    delta = np.abs(pix_a - pix_b)
    return {"mean": round(float(delta.mean()), 6), "max": int(delta.max())}


def dark_diff(a, b):
    pix = np.asarray(a, dtype=np.int16)
    h, w = pix.shape[:2]
    yy, xx = np.ogrid[:h, :w]
    outside = (xx < w * .12) | (xx >= w * .88) | (yy < h * .16) | (yy >= h * .86)
    mask = outside & (pix.max(axis=2) <= 22) & (pix.max(axis=2) >= 2)
    if mask.sum() < w*h*.002:
        raise RuntimeError("Too few non-black background samples for flicker measurement")
    diff = np.abs(pix - np.asarray(b, dtype=np.int16))[mask]
    return {"pixels": int(mask.sum()), "mean": round(float(diff.mean()), 6),
            "p99": round(float(np.quantile(diff, .99)), 2), "max": int(diff.max())}


def sheet(items, path, columns, tile):
    tw, th = tile
    columns = min(columns, len(items))
    gutter, legend = 6, 24
    rows = math.ceil(len(items) / columns)
    plate = Image.new("RGB", (columns * (tw + gutter) + gutter, rows * (th + legend + gutter) + gutter), "#141619")
    draw = ImageDraw.Draw(plate)
    try:
        font = ImageFont.truetype("consola.ttf", 14)
    except OSError:
        font = ImageFont.load_default()
    for i, (name, im) in enumerate(items):
        x = gutter + (i % columns) * (tw + gutter)
        y = gutter + (i // columns) * (th + legend + gutter)
        im = im.copy()
        im.thumbnail((tw, th), Image.Resampling.LANCZOS)
        plate.paste(im, (x + (tw - im.width) // 2, y + (th - im.height) // 2))
        draw.text((x + 3, y + th + 4), name, fill="#d7aa64", font=font)
    path.parent.mkdir(parents=True, exist_ok=True)
    plate.save(path)


def check_scene(harness, phase, fmt, root, part="all"):
    gray = phase == "gray"
    portrait = fmt == "9x16"
    dims = (432, 768) if portrait and gray else (768, 432) if gray else (1080, 1920) if portrait else (1920, 1080)
    page, log = harness.page(*dims)
    check = {"phase": phase, "format": fmt, "viewport": list(dims), "sourceSha256": source_hash(), "errors": [], "console": log,
             "chapters": [], "handoffs": [], "stages": []}
    errs = check["errors"]
    area = root / fmt
    try:
        opts = {"instant": 1, "still": 1, "tourat": 0, "ar": fmt}
        if gray:
            opts["hideui"] = 1
        harness.open(page, opts)
        check["gpu"] = gpu_info(page)
        meta = page.evaluate("""() => ({duration:__fab.duration,edges:__fab.edges,
                                       chapters:__fab.chapters.map(c=>({start:c.start,end:c.end,at:c.at,title:c.title}))})""")
        check["duration"] = meta["duration"]
        duration = float(meta["duration"])
        check["loadMilliseconds"] = page.evaluate("Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd)")
        if len(meta["chapters"]) != 11 or len(meta["edges"]) != 8:
            errs.append("Expected 11 chapter intervals and 8 forward handoffs")
        chapters = []
        marks = meta["chapters"]
        if part == "measurements":
            previous = json.loads((area / "chapter-evidence.json").read_text(encoding="utf-8"))
            if previous["sourceSha256"] != check["sourceSha256"]:
                raise RuntimeError("Recapture chapter images after a build change")
            check["chapters"] = previous["chapters"]
            check["chapterConsole"] = previous["console"]
            errs.extend(previous["errors"])
            marks = []
        for i, mark in enumerate(marks):
            t = float(mark["at"])
            info, im = capture(page, "seek", t, area / "chapters" / f"{i+1:02}.png", interface=not gray)
            chapters.append((f"{i+1:02}  {t:05.2f}s", im))
            # The public chapter ordinal can be zero- or one-based, but must advance exactly once.
            evidence = {"ordinal": info["chapter"], "sec": t, "index": info["index"], "q": info["q"]}
            if not gray:
                layout = page.evaluate("""() => {
                  const visible=e=>e.checkVisibility({opacityProperty:true,visibilityProperty:true});
                  const rect=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,r:r.right,b:r.bottom,id:e.id||e.textContent.slice(0,18)}};
                  const tags=[...document.querySelectorAll('.annotation:not([hidden])')].filter(visible).map(rect);
                  const hud=[...document.querySelectorAll('#hud [data-avoid]')].filter(visible).map(rect);
                  const critical=[...document.querySelectorAll('[data-safe]')].filter(visible).map(rect);
                  const collide=(a,b)=>Math.min(a.r,b.r)-Math.max(a.x,b.x)>2&&Math.min(a.b,b.b)-Math.max(a.y,b.y)>2;
                  const clashes=[];tags.forEach((tag,n)=>{[...tags.slice(n+1),...hud].forEach(b=>{if(collide(tag,b))clashes.push([tag.id,b.id]);});});
                  const cap=document.getElementById('chaptername'),copy=document.getElementById('chaptercopy');
                  return {tags:tags.length,clashes,critical,title:cap?.textContent,
                          titlePx:cap?parseFloat(getComputedStyle(cap).fontSize):0,
                          copyPx:copy?parseFloat(getComputedStyle(copy).fontSize):0};
                }""")
                evidence["layout"] = layout
                if layout["clashes"]:
                    errs.append(f"Chapter {i+1} projected annotation overlaps {layout['clashes']}")
                if info["index"] >= 3 and layout["tags"] > 5:
                    errs.append(f"Chapter {i+1} exceeds five engineering annotations")
                if portrait:
                    if layout["titlePx"] < 56 or layout["copyPx"] < 28:
                        errs.append(f"Chapter {i+1} portrait typography {layout['titlePx']}/{layout['copyPx']} px")
                    for rect in layout["critical"]:
                        if rect["x"] < -1 or rect["r"] > dims[0]*.84+1 or rect["y"] < dims[1]*.10-1 or rect["b"] > dims[1]*.78+1:
                            errs.append(f"Chapter {i+1} portrait critical item outside safe rect {rect}")
            check["chapters"].append(evidence)
        ordinals = [x["ordinal"] for x in check["chapters"]]
        if ordinals not in (list(range(11)), list(range(1, 12))):
            errs.append(f"Unexpected chapter sequence {ordinals}")
        if chapters:
            sheet(chapters, area / "chapters.jpg", 4 if portrait else 3, (152, 270) if portrait else (318, 179))
        if part == "chapters":
            return check
        del chapters
        for i in range(9):
            detail, image = capture(page, "sample", [i + .43, 0])
            entry = {k: detail.get(k) for k in ("index", "active", "calls", "tris")}
            if entry["index"] != i or entry["active"] != [i]:
                errs.append(f"L{i} render isolation {entry}")
            if entry["calls"] >= 250 or entry["tris"] >= 800_000:
                errs.append(f"L{i} over the per-stage budget {entry}")
            check["stages"].append(entry)
        if not gray:
            check["stageWorst"] = page.evaluate("""() => {
              const budgets=Array.from({length:9},()=>({calls:0,tris:0}));
              for(let id=0;id<9;id++)for(const p of [.06,.17,.32,.43,.58,.74,.88,.94]){
                const s=__fab.sample(id+p,3.2);
                for(const r of s.stages){let b=budgets[r.id];
                  b.calls=Math.max(b.calls,r.calls);b.tris=Math.max(b.tris,r.tris);}
              } return budgets;
            }""")
            for i, budget in enumerate(check["stageWorst"]):
                if budget["calls"] >= 250 or budget["tris"] >= 800000:
                    errs.append(f"L{i} interior pose exceeds scene budget {budget}")
        times = [(i,t,False) for i,t in enumerate(meta["edges"])]
        if not gray:
            reverse = page.evaluate("""() => Array.from({length:8},(_,k)=>{
              const i=8-k;let lo=__fab.chapters[10].start,hi=__fab.duration;
              for(let j=0;j<44;j++){let m=(lo+hi)/2;if(F.locate(m).q>i)lo=m;else hi=m;}
              return [i-1,(lo+hi)/2];
            })""")
            times.extend((i,t,True) for i,t in reverse)
        sheets = {"handoffs":[],"return-handoffs":[]}
        check["returnHandoffs"] = []
        for i, at, returning in times:
            src,dest = (i+1,i) if returning else (i,i+1)
            out_dir = "return-handoffs" if returning else "handoffs"
            edge = {"from": src, "to": dest, "sec": float(at), "samples": [],
                    "maxAnchorOffset": 0, "maxProjectedBoundsOffset": 0}
            for off in (-3, -2, -1, 1, 2, 3):
                sample = at + off/60
                file = area / out_dir / f"L{src}-L{dest}_{off:+d}.png"
                info, im = capture(page, "seek", sample, file, measure_gate=True)
                arr = np.asarray(im.resize((120, 80), Image.Resampling.BOX), dtype=np.float32)
                rank = float(np.quantile(arr.max(axis=2), .97))
                sample_log = {"frameOffset": off, "q": info["q"], "active": info["active"],
                              "mean": round(float(arr.mean()), 2), "p97": round(rank, 2)}
                anchors = info.get("anchors", [])
                if list(info["active"]) != [i, i+1] or len(anchors) != 2:
                    errs.append(f"Edge {i}, frame {off}: isolation / two reference anchors {info['active']} {anchors}")
                else:
                    ax = math.dist(anchors[0], anchors[1])
                    sample_log["anchorDistance"] = round(ax, 6)
                    edge["maxAnchorOffset"] = max(edge["maxAnchorOffset"], round(ax, 6))
                    if ax >= .05:
                        errs.append(f"Edge {i}, frame {off}: anchor drift {ax:.3%}")
                    b0, b1 = info["doorBounds"]
                    err_bounds = max(abs(a-b) for a,b in zip(b0,b1))
                    sample_log["boundsOffset"] = round(err_bounds, 6)
                    edge["maxProjectedBoundsOffset"] = max(edge["maxProjectedBoundsOffset"], round(err_bounds, 6))
                    if err_bounds >= .05:
                        errs.append(f"Edge {i}, frame {off}: gate footprint differs by {err_bounds:.2%}")
                if rank < 18 or arr.mean() > 235:
                    errs.append(f"Edge {i}, frame {off}: potential blank or flash frame")
                edge["samples"].append(sample_log)
                im.thumbnail((210, 140) if not portrait else (100, 150), Image.Resampling.LANCZOS)
                sheets[out_dir].append((f"{src}>{dest}   {off:+d}f", im))
            check["returnHandoffs" if returning else "handoffs"].append(edge)
        for label, items in sheets.items():
            if items:
                sheet(items, area / f"{label}.jpg", 6, (176, 99) if not portrait else (84, 149))
        _, begin = capture(page, "seek", 0., area / "loop" / "first.png")
        _, end = capture(page, "seek", duration, area / "loop" / "last.png")
        check["loop"] = image_diff(begin, end)
        _, one = capture(page, "sample", [0, 0])
        _, two = capture(page, "sample", [0, 1/60])
        check["flicker"] = dark_diff(one, two)
        _, section = capture(page, "sample", [1.43, 0])
        _, section_next = capture(page, "sample", [1.43, 1/60])
        check["sectionFlicker"] = dark_diff(section, section_next)
        if max(check["loop"]["mean"], check["flicker"]["mean"],check["sectionFlicker"]["mean"]) > .25:
            errs.append("Loop/flicker mean absolute channel delta exceeds 0.25/255")
    finally:
        if log["errors"] or log["warnings"] or log["externalRequests"]:
            errs.append("Browser console errors, warnings or external resource requests captured")
        write_json(area / ("chapter-evidence.json" if part == "chapters" else "report.json"), check)
        page.context.close()
    return check


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--phase", choices=("gray", "stage", "final", "interactions"), default="final")
    p.add_argument("--stages", nargs="+", type=int, choices=range(9), default=list(range(9)),
                   help="Stage review indices for --phase stage.")
    p.add_argument("--match", help="Only run input checks whose names contain this text.")
    p.add_argument("--part", choices=("all","chapters","measurements"), default="all",
                   help="Prioritize chapter stills or finish measurements from a matching chapter capture.")
    p.add_argument("--format", choices=("16x9", "9x16", "both"), default="both")
    p.add_argument("--headless", action="store_true", help="Use an invisible browser window for a quick diagnostic.")
    args = p.parse_args()
    if not HTML.is_file():
        p.error(f"Build {HTML.name} with node build.js before checking it")
    root = RESULTS / args.phase
    with Browser(args.headless) as harness:
        result = []
        if args.phase == "stage":
            formats = ("16x9", "9x16") if args.format == "both" else (args.format,)
            for fmt in formats:
                dims = (1200, 675) if fmt == "16x9" else (675, 1200)
                page, log = harness.page(*dims)
                harness.open(page, {"ar": fmt, "still": 1, "instant": 1, "hideui": 1, "nodata": 1, "nolabels": 1})
                for n in args.stages:
                    info, _ = capture(page, "sample", [n+.43, 3.2], root / fmt / f"L{n}.png")
                    print(f"L{n} {fmt}: {info['calls']} calls, {info['tris']} triangles", flush=True)
                result.append({"errors": log["errors"] + log["externalRequests"]})
                page.context.close()
        elif args.phase == "interactions":
            from interactions import check_inputs
            result.append(check_inputs(harness, root / "subset" if args.match else root, args.match))
        else:
            for fmt in (("16x9", "9x16") if args.format == "both" else (args.format,)):
                result.append(check_scene(harness, args.phase, fmt, root, args.part))
    errors = [s for report in result for s in report["errors"]]
    for err in errors:
        print(err)
    print(f"{args.phase}: {len(result)} fixture(s), {len(errors)} failed checks. {root}", flush=True)
    raise SystemExit(bool(errors))


if __name__ == "__main__":
    main()
