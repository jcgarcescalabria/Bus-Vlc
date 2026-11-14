#!/usr/bin/env python3
"""Convierte el GTFS oficial de la EMT de València en un JSON pequeño por parada.

Uso: python3 tools/gtfs_to_stops.py <gtfs.zip | carpeta> <carpeta_salida>

Salida: <salida>/stops/<id>.json con este formato:
  {
    "id": "2158", "name": "...", "version": "13-11-2026",
    "from": "20261106", "to": "20261209",
    "g": [["6", "Hospital La Fe", [342, 354, ...]], ...],   # línea, destino, minutos desde las 00:00
    "d": {"20261114": [0, 3], ...}                           # grupos de "g" que circulan cada día
  }
Los minutos pueden pasar de 1440 (servicios después de medianoche, como en GTFS).
Además escribe:
  <salida>/index.json   versión y número de paradas
  <salida>/search.json  índice para el buscador de los ajustes:
    {"version": ..., "stops": [["2158", "nombre", ["6"], 39.44549, -0.37355], ...],
     "lines": {"6": [["Torrefiel", ["1234", "2158", ...]], ...]}}   # paradas en orden de recorrido
"""
import csv
import io
import json
import os
import sys
import zipfile
from collections import defaultdict
from datetime import date, timedelta


def open_gtfs(src):
    if os.path.isdir(src):
        return lambda name: open(os.path.join(src, name), encoding="utf-8-sig", newline="")
    z = zipfile.ZipFile(src)
    return lambda name: io.TextIOWrapper(z.open(name), encoding="utf-8-sig", newline="")


def rows(opener, name):
    try:
        with opener(name) as f:
            yield from csv.DictReader(f)
    except (KeyError, FileNotFoundError):
        return


def parse_date(s):
    return date(int(s[:4]), int(s[4:6]), int(s[6:8]))


def minutes(hms):
    h, m, *_ = hms.strip().split(":")
    return int(h) * 60 + int(m)


def service_dates(opener):
    """service_id -> conjunto de fechas (YYYYMMDD) en que circula."""
    out = defaultdict(set)
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for r in rows(opener, "calendar.txt"):
        d, end = parse_date(r["start_date"]), parse_date(r["end_date"])
        week = [r[k] == "1" for k in days]
        while d <= end:
            if week[d.weekday()]:
                out[r["service_id"]].add(d.strftime("%Y%m%d"))
            d += timedelta(days=1)
    for r in rows(opener, "calendar_dates.txt"):
        if r["exception_type"] == "1":
            out[r["service_id"]].add(r["date"])
        elif r["exception_type"] == "2":
            out[r["service_id"]].discard(r["date"])
    return out


def main(src, dst):
    op = open_gtfs(src)
    feed = next(rows(op, "feed_info.txt"), {})
    routes = {r["route_id"]: r["route_short_name"] or r["route_id"] for r in rows(op, "routes.txt")}
    trips = {
        r["trip_id"]: (routes.get(r["route_id"], r["route_id"]), (r.get("trip_headsign") or "").strip(), r["service_id"])
        for r in rows(op, "trips.txt")
    }
    stop_rows = list(rows(op, "stops.txt"))
    stops = {r["stop_id"]: r["stop_name"].strip() for r in stop_rows}
    coords = {}
    for r in stop_rows:
        try:
            coords[r["stop_id"]] = (round(float(r["stop_lat"]), 5), round(float(r["stop_lon"]), 5))
        except (KeyError, ValueError):
            pass
    svc = service_dates(op)

    # Última parada de cada viaje: ahí el bus termina, no se puede subir.
    last_seq = {}
    times = []
    for r in rows(op, "stop_times.txt"):
        t = r["departure_time"] or r["arrival_time"]
        if not t:
            continue
        seq = int(r["stop_sequence"])
        if seq > last_seq.get(r["trip_id"], -1):
            last_seq[r["trip_id"]] = seq
        times.append((r["trip_id"], r["stop_id"], seq, minutes(t)))

    # parada -> (línea, destino, servicio) -> minutos
    by_stop = defaultdict(lambda: defaultdict(list))
    for trip_id, stop_id, seq, m in times:
        if trip_id not in trips or seq == last_seq[trip_id]:
            continue
        line, dest, service = trips[trip_id]
        by_stop[stop_id][(line, dest, service)].append(m)

    all_dates = sorted({d for ds in svc.values() for d in ds})
    out_dir = os.path.join(dst, "stops")
    os.makedirs(out_dir, exist_ok=True)
    written = 0
    for stop_id, groups in by_stop.items():
        keys = sorted(groups, key=lambda k: (len(k[0]), k[0], k[1], k[2]))
        g = [[line, dest, sorted(set(groups[(line, dest, service)]))] for line, dest, service in keys]
        d = {}
        for day in all_dates:
            active = [i for i, k in enumerate(keys) if day in svc.get(k[2], ())]
            if active:
                d[day] = active
        data = {
            "id": stop_id,
            "name": stops.get(stop_id, ""),
            "version": feed.get("feed_version", ""),
            "from": all_dates[0] if all_dates else "",
            "to": all_dates[-1] if all_dates else "",
            "g": g,
            "d": d,
        }
        with open(os.path.join(out_dir, f"{stop_id}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        written += 1

    # Buscador: líneas de cada parada y recorrido de cada línea (el viaje más largo
    # de cada línea y destino, con sus paradas en orden).
    trip_stops = defaultdict(list)
    for trip_id, stop_id, seq, _ in times:
        trip_stops[trip_id].append((seq, stop_id))
    longest = {}
    for trip_id, seqs in trip_stops.items():
        if trip_id not in trips:
            continue
        line, dest, _ = trips[trip_id]
        if len(seqs) > len(longest.get((line, dest), [])):
            longest[(line, dest)] = [sid for _, sid in sorted(seqs)]
    lines_by_stop = defaultdict(set)
    for stop_id, groups in by_stop.items():
        for line, _, _ in groups:
            lines_by_stop[stop_id].add(line)
    line_key = lambda l: (not l[:1].isdigit(), int("".join(c for c in l if c.isdigit()) or 0), l)
    search = {
        "version": feed.get("feed_version", ""),
        "stops": [
            [sid, stops.get(sid, ""), sorted(lines_by_stop[sid], key=line_key), *coords.get(sid, (None, None))]
            for sid in sorted(by_stop, key=lambda x: int(x) if x.isdigit() else 0)
        ],
        "lines": {},
    }
    for (line, dest), seq in sorted(longest.items(), key=lambda kv: (line_key(kv[0][0]), kv[0][1])):
        search["lines"].setdefault(line, []).append([dest, seq[:-1] if len(seq) > 1 else seq])
    with open(os.path.join(dst, "search.json"), "w", encoding="utf-8") as f:
        json.dump(search, f, ensure_ascii=False, separators=(",", ":"))

    with open(os.path.join(dst, "index.json"), "w", encoding="utf-8") as f:
        json.dump(
            {"version": feed.get("feed_version", ""), "from": all_dates[0] if all_dates else "",
             "to": all_dates[-1] if all_dates else "", "stops": written},
            f, ensure_ascii=False,
        )
    print(f"{written} paradas · versión {feed.get('feed_version', '?')} · {all_dates[0]}–{all_dates[-1]}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
