"""Render the two DF-02 films one simulation frame at a time, then encode H.264."""

import argparse
import base64
import io
import json
import re
import shutil
import subprocess
import time
from pathlib import Path

import numpy as np
from PIL import Image

from browser import Browser, RESULTS, ROOT, gpu_info, source_hash, write_json


CAPTURE = """() => {
  const i=window.__rec.step();
  const c=document.getElementById('view');
  // Read inside the same browser task as painting, before a WebGL buffer swap.
  return [i, c.toDataURL('image/png').split(',')[1], window.__rec.done, window.__fab.state().time];
}"""


def ffmpeg_path():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        from imageio_ffmpeg import get_ffmpeg_exe
        return get_ffmpeg_exe()
    except (ImportError, RuntimeError):
        return None


def pixels(data):
    return np.asarray(Image.open(io.BytesIO(data)).convert("RGB"), dtype=np.int16)


def verify_video(exe, target, count, fps, dims):
    """Ask FFmpeg to decode the entire file and count real output frames."""
    proc = subprocess.run(
        [exe, "-hide_banner", "-i", str(target), "-map", "0:v:0", "-an", "-vf", "vfrdet", "-f", "null",
         "-", "-progress", "pipe:1", "-nostats"], capture_output=True, text=True, errors="replace", check=True,
    )
    final = {}
    for line in proc.stdout.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            final[k] = v
    if int(final.get("frame", -1)) != count:
        raise RuntimeError(f"Encoded frame count {final.get('frame')} != expected {count}")
    desc = next((s.strip() for s in proc.stderr.splitlines() if "Video: h264" in s), "")
    if f"{dims[0]}x{dims[1]}" not in desc or f"{fps} fps" not in desc or "yuv420p" not in desc:
        raise RuntimeError(f"Unexpected output stream {desc!r}")
    vfr = re.search(r"VFR:[\d.]+\s+\((\d+)/(\d+)\)", proc.stderr)
    if count > 1 and (not vfr or int(vfr.group(1)) != 0):
        raise RuntimeError("Encoded output has variable frame intervals")
    ends = []
    for t in (0, (count-1)/fps):
        pic = subprocess.run(
            [exe, "-v", "error", "-ss", f"{t:.8f}", "-i", str(target), "-frames:v", "1",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], capture_output=True, check=True,
        ).stdout
        if len(pic) != dims[0]*dims[1]*3:
            raise RuntimeError(f"Could not read encoded end frame at {t}s")
        ends.append(np.frombuffer(pic, dtype=np.uint8).astype(np.int16))
    delta = np.abs(ends[0]-ends[1])
    return {"decodedFrames": count, "variableFrameIntervals": 0, "stream": desc,
            "actualEncodedSeam": {"rgbMeanAbs": round(float(delta.mean()), 6),
                                  "p99": round(float(np.quantile(delta, .99)), 2)}}


def scan_exposure(exe, path, width, height, expected):
    """Check every decoded frame for field-wide blanks, whiteouts and abrupt luminance shifts."""
    small = (96,54) if width>height else (54,96)
    data = subprocess.run([exe,"-v","error","-threads","2","-i",str(path),"-map","0:v:0","-an","-vf",
                          f"scale={small[0]}:{small[1]}:flags=area","-pix_fmt","rgb24","-f","rawvideo","pipe:1"],
                          capture_output=True,check=True).stdout
    frames = np.frombuffer(data,dtype=np.uint8).reshape(-1,small[0]*small[1],3)
    if len(frames)!=expected:
        raise RuntimeError(f"Exposure pass decoded {len(frames)} instead of {expected} frames")
    means = frames.mean(axis=(1,2))
    high = np.quantile(frames.max(axis=2),.98,axis=1)
    step = np.abs(np.diff(means))
    return {"decodedFrames":len(frames),"blackOrWhiteFrames":int(((high<18)|(means>235)).sum()),
            "minBrightnessP98":round(float(high.min()),2),"maximumMean":round(float(means.max()),2),
            "peakAdjacentMeanChange":round(float(step.max()),3),"peakChangeAt":int(np.argmax(step)+1)}


def render(harness, fmt, args):
    dims = (1080, 1920) if fmt == "9x16" else (1920, 1080)
    if args.size:
        dims = tuple(int(n) for n in args.size.lower().split("x"))
    root = Path(args.output_root).resolve()
    frames = root / "frames" / fmt
    frames.mkdir(parents=True, exist_ok=True)
    page, log = harness.page(*dims)
    build_hash = source_hash()
    first, previous = None, None
    reused = False
    try:
        gpu = gpu_info(page)
        if not gpu.get("webgl2") or any(s in gpu["renderer"].lower() for s in ("swiftshader", "llvmpipe", "software")):
            raise RuntimeError(f"A hardware WebGL2 renderer is required for recording: {gpu}")
        harness.open(page, {"rec": 1, "film": 1, "instant": 1, "w": dims[0], "h": dims[1],
                            "ar": fmt, "fps": args.fps})
        page.wait_for_function("window.__rec?.ready === true", timeout=90000)
        total = int(page.evaluate("window.__rec.frames"))
        if total < 2:
            raise RuntimeError(f"Recording reported an invalid frame count: {total}")
        size = page.evaluate("() => { const c=document.getElementById('view');return [c.width,c.height] }")
        if list(dims) != size:
            raise RuntimeError(f"Frame buffer is {size} instead of {dims}")
        count = min(total, args.frames) if args.frames else total
        start_time = time.perf_counter()
        loop = None
        start_frame = 0
        if args.resume_sequence:
            if args.frames or not args.sequence_sha256 or not re.fullmatch(r"[A-Fa-f0-9]{64}",args.sequence_sha256):
                raise ValueError("Resuming requires a complete sequence and its original build SHA-256")
            names = sorted(p.name for p in frames.glob("[0-9][0-9][0-9][0-9][0-9][0-9].png"))
            if names != [f"{i:06d}.png" for i in range(total-1)]:
                raise RuntimeError("The existing numbered PNG sequence is incomplete")
            first = pixels((frames / names[0]).read_bytes())
            previous = pixels((frames / names[-1]).read_bytes())
            for base in range(0,total-1,90):
                end = min(base+90,total-1)
                page.evaluate("""([lo,hi,fps])=>{
                  for(let n=lo;n<hi;n++){const i=__rec.step();
                    if(i!==n||Math.abs(__fab.state().time-n/fps)>1e-8)throw new Error('Replay diverged at '+n);}
                }""",[base,end,args.fps])
            start_frame = total-1
            reused = True
        for expected in range(start_frame,count):
            number, encoded, done, seconds = page.evaluate(CAPTURE)
            if number != expected or done != (expected == total - 1):
                raise RuntimeError(f"Recorder lost frame order at {expected}, reported {(number, done)}")
            expected_time = expected/args.fps
            if abs(seconds-expected_time) > 1e-8:
                raise RuntimeError(f"Sample {expected}: expected {expected_time}, rendered {seconds}")
            data = base64.b64decode(encoded)
            if expected == 0:
                first = pixels(data)
                if np.quantile(first, .97) < 30:
                    raise RuntimeError("Opening frame appears empty")
            if expected == total-2:
                previous = pixels(data)
            if expected == total - 1:
                diff = np.abs(pixels(data) - first)
                near = np.abs(previous-first)
                loop = {"rgbMeanAbs": float(diff.mean()), "max": int(diff.max()),
                        "actualSourceSeamMean": round(float(near.mean()), 6),
                        "actualSourceSeamP99": round(float(np.quantile(near, .99)), 2)}
                if loop["rgbMeanAbs"] > .25:
                    raise RuntimeError(f"Recording loop discrepancy {loop}")
                # The duplicate endpoint is evidence. It must not add a beat to the MP4.
                endpoint = frames.parent / f"{fmt}-loop-end.png"
                endpoint.write_bytes(data)
            else:
                (frames / f"{expected:06d}.png").write_bytes(data)
            if expected % 180 == 0 or expected == count - 1:
                print(f"{fmt}  {expected + 1}/{count} PNG  {time.perf_counter() - start_time:.1f}s", flush=True)
        capture_seconds = time.perf_counter() - start_time
    finally:
        page.context.close()

    if log["errors"] or log["warnings"] or log["externalRequests"]:
        raise RuntimeError(f"Browser reported errors or external requests {log}")
    encoded_count = min(count, total - 1)
    meta = {"format": fmt, "width": dims[0], "height": dims[1], "fps": args.fps,
            "sourceSha256": build_hash, "totalSamples": total, "capturedSamples": count, "frameFiles": encoded_count,
            "captureSeconds": round(capture_seconds, 2), "renderer": gpu, "loop": loop, "console": log}
    if reused:
        first_file,last_file = frames / "000000.png",frames / f"{total-2:06d}.png"
        meta.update({"sourceSha256":args.sequence_sha256.lower(),"endpointBuild":build_hash,
                     "resume":f"Reused all {total-1} sequential source PNGs. Replayed every fixed-time sample in the release build and regenerated the verification endpoint.",
                     "endpointReplaySeconds":round(capture_seconds,2),
                     "captureSeconds":round(last_file.stat().st_mtime-first_file.stat().st_mtime,2),
                     "captureTiming":"Interval between first and last numbered file writes."})
    exe = ffmpeg_path()
    if exe and not args.no_encode:
        out = root / "out"
        out.mkdir(parents=True, exist_ok=True)
        name = f"df02_{fmt}" + ("" if count == total else "_sample")
        tmp = out / f"{name}.part.mp4"
        dest = out / f"{name}.mp4"
        encode_start = time.perf_counter()
        subprocess.run(
            [exe, "-hide_banner", "-loglevel", "warning", "-y", "-r", str(args.fps), "-start_number", "0",
             "-i", str(frames / "%06d.png"), "-frames:v", str(encoded_count), "-an", "-c:v", "libx264",
             "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(tmp)],
            check=True,
        )
        meta.update(verify_video(exe, tmp, encoded_count, args.fps, dims))
        tmp.replace(dest)
        meta.update({"mp4": str(dest.relative_to(root)), "bytes": dest.stat().st_size,
                     "encodeVerifySeconds": round(time.perf_counter() - encode_start, 2)})
    elif not exe:
        print("FFmpeg unavailable. PNG sequence saved.", flush=True)
    stats = RESULTS if root == ROOT else root / "qa" / "results"
    write_json(stats / f"record-{fmt}.json", meta)
    return meta


def compare_existing(harness, fmt, args):
    root = Path(args.output_root).resolve()
    stats = RESULTS if root == ROOT else root / "qa" / "results"
    saved = json.loads((stats / f"record-{fmt}.json").read_text(encoding="utf-8"))
    w,h,fps = saved["width"],saved["height"],saved["fps"]
    p,log = harness.page(w,h)
    try:
        harness.open(p, {"rec":1, "film":1, "instant":1, "w":w, "h":h, "ar":fmt, "fps":fps})
        sample_ids = p.evaluate("""fps => [...new Set([0,1,__rec.frames-2,...__fab.edges.map(t=>Math.round(t*fps)),
                  ...__fab.chapters.map(c=>Math.round(c.at*fps))])].sort((a,b)=>a-b)""",fps)
        checks = []
        for i in sample_ids:
            encoded = p.evaluate("""t=>{__fab.seek(t);return document.getElementById('view').toDataURL('image/png').split(',')[1]}""",i/fps)
            original = (root / "frames" / fmt / f"{i:06d}.png").read_bytes()
            fresh = base64.b64decode(encoded)
            delta = np.abs(pixels(original)-pixels(fresh))
            checks.append({"index":i,"mean":round(float(delta.mean()),8),"max":int(delta.max()),
                           "samePngBytes":original==fresh})
        report = {"format":fmt, "recordBuild":saved["sourceSha256"],"releaseBuild":source_hash(),
                  "pixelExact":all(x["max"]==0 for x in checks), "samples":checks, "console":log}
        if saved.get("mp4") and ffmpeg_path():
            report["exposure"] = scan_exposure(ffmpeg_path(),root / saved["mp4"],w,h,saved["frameFiles"])
        write_json(stats / f"record-equivalence-{fmt}.json",report)
        if not report["pixelExact"] or report.get("exposure",{}).get("blackOrWhiteFrames",0) or log["errors"] or log["warnings"] or log["externalRequests"]:
            raise RuntimeError("Release-vs-record frame comparison failed; inspect the equivalence report")
        return {"format":fmt, "equivalentFrames":len(checks), "recordBuild":saved["sourceSha256"],"releaseBuild":source_hash()}
    finally:
        p.context.close()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--format", choices=("both", "9x16", "16x9"), default="both")
    p.add_argument("--fps", type=int, default=60)
    p.add_argument("--frames", type=int, help="Render a short pilot; the resulting MP4 uses the _sample suffix.")
    p.add_argument("--size", help="Override the fixture's pixel dimensions, e.g. 540x960.")
    p.add_argument("--output-root", default=str(ROOT), help="Root of the frames/ and out/ directories.")
    p.add_argument("--no-encode", action="store_true")
    p.add_argument("--resume-sequence", action="store_true", help="Verify a complete, existing PNG sequence, regenerate its loop witness and encode it.")
    p.add_argument("--sequence-sha256", help="Build SHA-256 used for an existing complete numbered sequence.")
    p.add_argument("--compare-existing", action="store_true",
                   help="Compare first/last frames, all chapter shots and every handoff against previously recorded PNGs.")
    p.add_argument("--audit-exposure", action="store_true",
                   help="Scan every decoded MP4 frame with FFmpeg on CPU for black or white fields.")
    args = p.parse_args()
    if args.fps < 1 or (args.frames is not None and args.frames < 1):
        p.error("fps and frames must be positive")
    formats = ("9x16","16x9") if args.format=="both" else (args.format,)
    if args.audit_exposure:
        root=Path(args.output_root).resolve()
        stats=RESULTS if root==ROOT else root/"qa"/"results"
        for fmt in formats:
            saved=json.loads((stats/f"record-{fmt}.json").read_text(encoding="utf-8"))
            result=scan_exposure(ffmpeg_path(),root/saved["mp4"],saved["width"],saved["height"],saved["frameFiles"])
            write_json(stats/f"film-exposure-{fmt}.json",result)
            print(fmt,result,flush=True)
            if result["blackOrWhiteFrames"]:
                raise RuntimeError("Blank or white frames detected")
        return
    with Browser() as harness:
        for fmt in formats:
            summary = compare_existing(harness, fmt, args) if args.compare_existing else render(harness, fmt, args)
            print(json.dumps(summary, ensure_ascii=True), flush=True)


if __name__ == "__main__":
    main()
