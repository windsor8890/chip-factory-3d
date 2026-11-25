"""Shared offline Playwright harness for DF-02."""

import json
import hashlib
import os
import shutil
from pathlib import Path
from urllib.parse import urlencode, urlsplit

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "chip-fab-3d.html"
RESULTS = ROOT / "qa" / "results"


def source_hash():
    return hashlib.sha256(HTML.read_bytes()).hexdigest()


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def local_url(params):
    return HTML.as_uri() + "?" + urlencode(params)


def gpu_info(page):
    return page.evaluate("""() => {
      const c=document.createElement('canvas');
      const gl=c.getContext('webgl2', {powerPreference:'high-performance'});
      if(!gl) return {webgl2:false};
      const d=gl.getExtension('WEBGL_debug_renderer_info');
      const info={webgl2:true, samples:gl.getParameter(gl.MAX_SAMPLES),
        renderer:d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
        vendor:d?gl.getParameter(d.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)};
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return info;
    }""")


def find_browser():
    custom = os.environ.get("DF02_CHROME")
    if custom:
        return custom
    for path in (
        Path(os.environ.get("PROGRAMFILES", "/")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", "/")) / "Microsoft/Edge/Application/msedge.exe",
    ):
        if path.is_file():
            return str(path)
    return next((p for name in ("google-chrome", "chromium", "chromium-browser") if (p := shutil.which(name))), None)


class Browser:
    def __init__(self, headless=False):
        self.headless = headless

    def __enter__(self):
        self.pw = sync_playwright().start()
        try:
            self.browser = self.pw.chromium.launch(
                executable_path=find_browser(), headless=self.headless,
                args=["--enable-gpu", "--ignore-gpu-blocklist",
                      "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
                      "--disable-backgrounding-occluded-windows",
                      "--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling",
                      "--force-device-scale-factor=1"],
            )
        except Exception:
            self.pw.stop()
            raise
        return self

    def __exit__(self, *_):
        self.browser.close()
        self.pw.stop()

    def page(self, width, height, mobile=False):
        context = self.browser.new_context(
            viewport={"width": width, "height": height}, device_scale_factor=1,
            is_mobile=mobile, has_touch=mobile, offline=True, locale="zh-CN",
        )
        page = context.new_page()
        log = {"errors": [], "warnings": [], "externalRequests": [], "requests": []}
        page.on("pageerror", lambda err: log["errors"].append(str(err)))

        def console(message):
            if message.type == "error":
                log["errors"].append(message.text)
            elif message.type == "warning":
                log["warnings"].append(message.text)

        def request(req):
            scheme = urlsplit(req.url).scheme
            if scheme not in ("file", "data", "blob", "about"):
                log["externalRequests"].append(req.url)
            if scheme in ("http", "https", "file"):
                log["requests"].append(req.url.split("?")[0])

        page.on("console", console)
        page.on("request", request)
        page.set_default_timeout(30000)
        return page, log

    def open(self, page, params):
        page.bring_to_front()
        page.goto(local_url(params), wait_until="load", timeout=90000)
        page.wait_for_function("window.__fab && window.__fab.ready === true", timeout=90000)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--diagnose", action="store_true", help="Measure physical RAF pulses on an empty page and the actual app.")
    parser.add_argument("--resize", action="store_true", help="Exercise hardware framebuffer resizes and inspect GL error flags.")
    parser.add_argument("--tour-driver", action="store_true", help="Inspect GL errors on each presentation tick of a complete tour.")
    opts = parser.parse_args()
    with Browser() as harness:
        probe, log = harness.page(640, 360)
        info = {"browser": harness.browser.version, "executable": find_browser(), **gpu_info(probe)}
        print(json.dumps(info, ensure_ascii=False))
        write_json(RESULTS / "gpu.json", info)
        if opts.tour_driver:
            rows=[]
            for warm in (True,False):
                p,driverlog=harness.page(1920,1080)
                harness.open(p,{"instant":1,"tour":1,"tourfast":1})
                if warm:
                    for i in range(9):
                        p.evaluate("i=>__fab.sample(i+.43,0)",i)
                run=p.evaluate("""() => new Promise(resolve=>{
                  __fab.seek(0);document.querySelector('[data-act=tour]').click();
                  const gl=F.renderer.getContext(),errors=[],changes=[],t0=performance.now();
                  let seenEnd=false,last=-1,count=0;
                  function frame(t){
                    const s=__fab.state(),e=gl.getError();count++;
                    if(e)errors.push({err:e,t:s.time,q:s.q,stages:s.active,dpr:s.dpr});
                    if(last!==s.dpr){changes.push([s.time,s.dpr]);last=s.dpr;}
                    if(s.chapter===10)seenEnd=true;
                    if(seenEnd&&s.chapter===0||t-t0>12000){resolve({count,errors,changes});return;}
                    requestAnimationFrame(frame);
                  }requestAnimationFrame(frame);
                })""")
                p.wait_for_timeout(100)
                rows.append({"warm":warm,"samples":run,"console":driverlog})
                print("warm",warm,"gl_errors",len(run["errors"]),"warnings",len(driverlog["warnings"]),
                      "drop",run["changes"],"first",run["errors"][:2],flush=True)
                p.context.close()
            write_json(RESULTS/"tour-driver-diagnostic.json",{"sourceSha256":source_hash(),"passes":rows})
        if opts.resize:
            probe.set_viewport_size({"width":1920,"height":1080})
            harness.open(probe,{"instant":1})
            steps = []
            for event in ("initial","v","v","f","f","small","restore"):
                count=len(log["warnings"])
                if event in ("v","f"):
                    probe.keyboard.press(event)
                elif event in ("small","restore"):
                    w,h=(800,600) if event=="small" else (1920,1080)
                    probe.set_viewport_size({"width":w,"height":h})
                probe.wait_for_timeout(250)
                sample=probe.evaluate("""() => {
                  const gl=F.renderer.getContext();gl.finish();const errors=[];
                  for(let n=0;n<5;n++){const e=gl.getError();if(!e)break;errors.push(e);}
                  const s=__fab.state();return {errors,w:s.width,h:s.height,full:!!document.fullscreenElement};
                }""")
                probe.wait_for_timeout(80)
                steps.append({"event":event,**sample,"driverWarnings":log["warnings"][count:]})
                print(event,sample,"warning count",len(log["warnings"])-count,flush=True)
            write_json(RESULTS/"resize-diagnostic.json",steps)
        if opts.diagnose:
            def pulses():
                return probe.evaluate("""() => new Promise(resolve=>{
                  const data=[],start=performance.now();let last;
                  function tick(t){if(last)data.push(Math.round((t-last)*10)/10);last=t;
                    if(t-start>2200){const sorted=[...data].sort((a,b)=>a-b),app=window.__fab?.state();
                      resolve({frames:data.length,p50:sorted[Math.floor(sorted.length*.5)],
                        p95:sorted[Math.floor(sorted.length*.95)],focus:document.hasFocus(),hidden:document.hidden,
                        dpr:devicePixelRatio,screen:[screen.width,screen.height],
                        stage:app?.index,calls:app?.calls,msaa:app?.msaa});}else requestAnimationFrame(tick);}
                  requestAnimationFrame(tick);
                })""")
            probe.bring_to_front()
            print("empty", json.dumps(pulses()), flush=True)
            for dims in ((1280,720),(1920,1080)):
                probe.set_viewport_size(dict(zip(("width","height"),dims)))
                harness.open(probe, {"instant":1})
                probe.bring_to_front()
                print(dims, json.dumps(pulses()), flush=True)
            probe.evaluate("""() => {window._fullEvents=[]; document.addEventListener('fullscreenchange',
              ()=>_fullEvents.push('change:'+!!document.fullscreenElement));
              document.addEventListener('fullscreenerror',()=>_fullEvents.push('error'));}""")
            for key in ("f","f"):
                probe.keyboard.press(key)
                probe.wait_for_timeout(450)
                print("fullscreen",probe.evaluate("({enabled:document.fullscreenEnabled,full:!!document.fullscreenElement,events:_fullEvents})"),flush=True)
