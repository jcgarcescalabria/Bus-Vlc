#!/usr/bin/env python3
"""Descarga el GTFS más reciente de la EMT desde el portal de datos abiertos de València.

Uso: python3 tools/download_gtfs.py <destino.zip>
"""
import json
import sys
import time
import urllib.request

API = "https://opendata.vlci.valencia.es/api/3/action/package_show?id=google-transit-lines-stops-bus-schedules"


def get(url, tries=5):
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return r.read()
        except Exception as e:  # el portal corta conexiones de vez en cuando
            if i == tries - 1:
                raise
            print(f"Reintentando ({e})", file=sys.stderr)
            time.sleep(5 * (i + 1))


def main(dst):
    meta = json.loads(get(API))["result"]
    zips = [r for r in meta["resources"] if (r.get("format") or "").upper() == "ZIP" or r["url"].endswith(".zip")]
    if not zips:
        sys.exit("No hay ningún ZIP en el conjunto de datos")
    latest = max(zips, key=lambda r: r.get("last_modified") or r.get("created") or "")
    print(f"Descargando {latest['url']}")
    data = get(latest["url"])
    if not data.startswith(b"PK"):
        sys.exit("Lo descargado no es un ZIP")
    with open(dst, "wb") as f:
        f.write(data)
    print(f"{len(data)} bytes")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
