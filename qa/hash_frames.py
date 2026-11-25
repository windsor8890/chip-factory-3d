"""Prove a PNG sequence matches a new release by comparing every decoded RGBA byte."""

import argparse
import hashlib
import json
import time
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

from browser import Browser, RESULTS, ROOT, gpu_info, source_hash, write_json


def png_hash(path):
    with Image.open(path) as image:
        return hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest()


def manifest_path(fmt):
    return RESULTS / f"record-rgba-reference-{fmt}.json"


def reference(fmt, workers):
    meta = json.loads((RESULTS / f"record-{fmt}.json").read_text(encoding="utf-8"))
    folder = ROOT / "frames" / fmt
    names = [folder/f"{i:06d}.png" for i in range(meta["frameFiles"])]
    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        hashes = list(pool.map(png_hash,names))
    rollup = hashlib.sha256(bytes.fromhex("".join(hashes))).hexdigest()
    saved = {"format":fmt,"frames":len(hashes),"width":meta["width"],"height":meta["height"],"fps":meta["fps"],
             "recordBuild":meta["sourceSha256"],"rgbaSequenceSha256":rollup,"seconds":round(time.perf_counter()-start,2),
             "hashes":hashes}
    write_json(manifest_path(fmt),saved)
    print(f"{fmt}: {len(hashes)} full RGBA reference hashes, {rollup}",flush=True)
    return saved


def verify(fmt, saved):
    w,h,fps = saved["width"],saved["height"],saved["fps"]
    hashes = saved["hashes"]
    release_hash = source_hash()
    start = time.perf_counter()
    observed, mismatches = [], []
    with Browser() as harness:
        page,log = harness.page(w,h)
        gpu = gpu_info(page)
        harness.open(page,{"rec":1,"film":1,"instant":1,"w":w,"h":h,"ar":fmt,"fps":fps})
        page.wait_for_function("window.__rec?.ready===true")
        count = page.evaluate("__rec.frames-1")
        if count!=len(hashes):
            raise RuntimeError(f"Release has {count} numbered frames; reference has {len(hashes)}")
        page.evaluate("""() => {
          const c=document.getElementById('view'),copy=document.createElement('canvas');
          copy.width=c.width;copy.height=c.height;
          const g=copy.getContext('2d',{alpha:false,willReadFrequently:true});
          window.__rgbaDigest=async function(first,end,fps){
            const out=[];
            for(let n=first;n<end;n++){
              const i=__rec.step(),t=__fab.state().time;
              if(i!==n || Math.abs(t-i/fps)>1e-8)throw new Error('Unexpected recorder index/time at '+n);
              g.drawImage(c,0,0);
              const rgba=g.getImageData(0,0,c.width,c.height).data;
              const raw=await crypto.subtle.digest('SHA-256',rgba);
              out.push([...new Uint8Array(raw)].map(x=>x.toString(16).padStart(2,'0')).join(''));
            }
            return out;
          };
        }""")
        for first in range(0,count,20):
            stop = min(first+20,count)
            batch = page.evaluate("([a,b,f])=>__rgbaDigest(a,b,f)",[first,stop,fps])
            observed.extend(batch)
            for i,got in enumerate(batch,first):
                if got!=hashes[i]:
                    mismatches.append(i)
            if first%400==0 or stop==count:
                print(f"{fmt}: {stop}/{count} rendered hashes; {len(mismatches)} mismatches",flush=True)
        page.context.close()
    release_rollup = hashlib.sha256(bytes.fromhex("".join(observed))).hexdigest()
    report = {"format":fmt,"width":w,"height":h,"method":"SHA-256 of full-resolution RGBA8, row-major; every frame advanced by __rec.step().",
              "recordBuild":saved["recordBuild"],"releaseBuild":release_hash,"framesCompared":len(observed),
              "mismatches":len(mismatches),"mismatchIndices":mismatches,
              "referenceSequenceSha256":saved["rgbaSequenceSha256"],"releaseSequenceSha256":release_rollup,
              "renderer":gpu,"console":log,"seconds":round(time.perf_counter()-start,2)}
    write_json(RESULTS / f"record-rgba-verification-{fmt}.json",report)
    if release_hash != source_hash():
        raise RuntimeError("Release HTML changed during the full-frame comparison")
    if mismatches or log["errors"] or log["warnings"] or log["externalRequests"]:
        raise RuntimeError("Full-frame comparison failed; see the exact frame index list in the report.")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--format", choices=("9x16","16x9","both"), default="9x16")
    parser.add_argument("--reference-only", action="store_true", help="Hash already captured PNGs using CPU only.")
    parser.add_argument("--workers", type=int, default=3)
    args = parser.parse_args()
    for fmt in (("9x16","16x9") if args.format=="both" else (args.format,)):
        cached=manifest_path(fmt)
        if args.reference_only or not cached.exists():
            saved=reference(fmt,max(1,args.workers))
        else:
            saved=json.loads(cached.read_text(encoding="utf-8"))
        if not args.reference_only:
            verify(fmt,saved)


if __name__ == "__main__":
    main()
