# -*- coding: utf-8 -*-
"""下载 Electron 运行时 zip（npmmirror 镜像）。"""
import sys, time, urllib.request

URL = "https://npmmirror.com/mirrors/electron/45.4.1/electron-v45.4.1-win32-x64.zip"
OUT = r"J:\workplace\code\econ-graph-build\electron-v45.4.1-win32-x64.zip"

def main():
    t0 = time.time()
    with urllib.request.urlopen(URL, timeout=60) as r, open(OUT, "wb") as f:
        total = int(r.headers.get("Content-Length") or 0)
        done = 0
        last = 0
        while True:
            chunk = r.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)
            done += len(chunk)
            if time.time() - last > 2:
                last = time.time()
                pct = (done / total * 100) if total else 0
                print(".. %.1f%%  %.1f/%.1f MB  %.1f MB/s" % (
                    pct, done / 1048576, total / 1048576,
                    done / 1048576 / max(0.001, time.time() - t0)), flush=True)
    print("DONE %.1f MB in %.1fs" % (done / 1048576, time.time() - t0))

if __name__ == "__main__":
    main()
