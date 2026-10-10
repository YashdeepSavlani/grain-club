"""Assemble site/index.html from the files in src/. Run: python3 build.py"""
import pathlib
d = pathlib.Path(__file__).parent
head = (d / "src/head.html").read_text()
js = (d / "src/engine.js").read_text() + "\n" + (d / "src/app.js").read_text()
title, rest = head.split("\n", 1)
link, rest = rest.split("\n", 1)
assert title.startswith("<title>") and link.startswith("<link")
page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
{title}
<meta name="description" content="Grain Club: a retro film and digicam camera.">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Grain Club">
<meta name="theme-color" content="#000000">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
{link}
<style>:root{{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
</head>
<body>
{rest}
<script>
{js}
</script>
</body>
</html>
"""
(d / "site").mkdir(exist_ok=True)
(d / "site/index.html").write_text(page)
print(len(page), "bytes written to site/index.html")
