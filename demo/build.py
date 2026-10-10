#!/usr/bin/env python3
"""Genera demo.html a partir de index.html: cambia supabase-js por el simulador local.
Uso (desde la raíz del repositorio):  python3 demo/build.py
Vuelve a ejecutarlo cada vez que cambies index.html."""
import re, pathlib
raiz = pathlib.Path(__file__).resolve().parent.parent
html = (raiz / "index.html").read_text(encoding="utf-8")
html, n = re.subn(r'<script src="https://unpkg\.com/@supabase/supabase-js@[^"]*"></script>',
                  '<script src="demo/supabase-demo.js"></script>', html)
assert n == 1, "No encontré la etiqueta de supabase-js en index.html"
html = html.replace("<title>Imperio Store Barber — Agenda tu cita</title>",
                    '<title>DEMO · Imperio Store Barber</title>\n<meta name="robots" content="noindex,nofollow">', 1)
(raiz / "demo.html").write_text(html, encoding="utf-8")
print("demo.html generado:", len(html), "bytes")
