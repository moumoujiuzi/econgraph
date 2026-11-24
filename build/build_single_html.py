# -*- coding: utf-8 -*-
"""把 index.html + css + js + 图标 打包成单个 HTML 文件。"""
import base64
import io
import os
import re

SRC = r"J:\workplace\code\econ-graph"
OUT = r"J:\workplace\apps\EconGraph-网页版.html"

html = io.open(os.path.join(SRC, "index.html"), encoding="utf-8-sig").read()

# 1) 内联 CSS
css = io.open(os.path.join(SRC, "styles.css"), encoding="utf-8-sig").read()
html = html.replace(
    '<link rel="stylesheet" href="styles.css">',
    "<style>\n" + css + "\n</style>",
)

# 2) 图标 → base64（用 64px 版本，避免体积膨胀）
icon_path = os.path.join(SRC, "assets", "icon.png")
try:
    from PIL import Image
    im = Image.open(icon_path).convert("RGBA")
    im.thumbnail((64, 64), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    icon_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    html = html.replace(
        '<link rel="icon" href="assets/icon.png">',
        '<link rel="icon" href="data:image/png;base64,' + icon_b64 + '">',
    )
except Exception as e:
    print("icon skipped:", e)

# 3) 内联脚本（保持顺序）
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
print("inline scripts:", scripts)
for src in scripts:
    path = os.path.join(SRC, src.replace("/", os.sep))
    code = io.open(path, encoding="utf-8-sig").read()
    html = html.replace(
        '<script src="%s"></script>' % src,
        "<script>\n" + code + "\n</script>",
    )

# 3.5) 侧栏 logo 也内联
if 'icon_b64' in dir() or True:
    try:
        html = html.replace('src="assets/icon.png"', 'src="data:image/png;base64,' + icon_b64 + '"')
    except NameError:
        pass

# 4) 去掉残留的外部引用
html = html.replace('<link rel="icon" href="assets/icon.png">', "")

io.open(OUT, "w", encoding="utf-8-sig").write(html)
size = os.path.getsize(OUT)
print("written: %s  %.0f KB" % (OUT, size / 1024))
print("remaining external refs:", re.findall(r'(?:src|href)="(?!data:|#)([^"]+)"', html)[:10])
