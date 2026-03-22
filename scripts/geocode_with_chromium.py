#!/usr/bin/env python3
"""
Geocodifica direcciones desde un CSV usando Chromium + Google Maps.

Uso basico:
  python scripts/geocode_with_chromium.py \
    --input "C:\\ruta\\CLIENTES.csv" \
    --output "C:\\ruta\\CLIENTES_geocoded.csv"

Requisitos:
  pip install playwright
  python -m playwright install chromium
"""

from __future__ import annotations

import argparse
import csv
import random
import re
import sys
import time
from pathlib import Path
from typing import Iterable
from urllib.parse import quote_plus

from playwright.sync_api import Browser, Page, TimeoutError, sync_playwright


URL_PATTERNS = [
    re.compile(r"@(-?\d+\.\d+),(-?\d+\.\d+)"),
    re.compile(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)"),
]

COOKIE_BUTTON_TEXTS = (
    "Aceptar todo",
    "Acepto",
    "Aceptar",
    "I agree",
    "Accept all",
    "Accept",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Completa lat/lng faltantes usando Chromium.")
    parser.add_argument("--input", required=True, help="CSV origen")
    parser.add_argument("--output", required=True, help="CSV destino")
    parser.add_argument("--headful", action="store_true", help="Abre Chromium visible")
    parser.add_argument("--delay-seconds", type=float, default=2.5, help="Espera base entre consultas")
    parser.add_argument("--save-every", type=int, default=25, help="Guardar avance cada N cambios")
    parser.add_argument("--limit", type=int, default=0, help="Procesar solo N filas faltantes")
    parser.add_argument("--start-index", type=int, default=0, help="Saltear las primeras N filas faltantes")
    parser.add_argument(
        "--city-default",
        default="Cordoba, Cordoba, Argentina",
        help="Ciudad a usar si la columna ciudad viene vacia",
    )
    return parser.parse_args()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, str]], fieldnames: Iterable[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def needs_geocoding(row: dict[str, str]) -> bool:
    lat = (row.get("lat") or "").strip()
    lng = (row.get("lng") or "").strip()
    return not lat or not lng


def build_query(row: dict[str, str], city_default: str) -> str:
    direccion = (row.get("direccion") or "").strip()
    ciudad = (row.get("ciudad") or "").strip() or city_default
    nombre = (row.get("nombre_cliente") or "").strip()

    if direccion and ciudad:
        return f"{direccion}, {ciudad}"
    if direccion:
        return f"{direccion}, {city_default}"
    if nombre and ciudad:
        return f"{nombre}, {ciudad}"
    if nombre:
        return f"{nombre}, {city_default}"
    return city_default


def extract_coords_from_url(url: str) -> tuple[str, str] | None:
    for pattern in URL_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1), match.group(2)
    return None


def coords_look_reasonable(lat: str, lng: str) -> bool:
    try:
        lat_value = float(lat)
        lng_value = float(lng)
    except ValueError:
        return False

    return -40.5 <= lat_value <= -20.0 and -75.0 <= lng_value <= -50.0


def maybe_accept_cookies(page: Page) -> None:
    for text in COOKIE_BUTTON_TEXTS:
        try:
            button = page.get_by_role("button", name=text)
            if button.count():
                button.first.click(timeout=1500)
                page.wait_for_timeout(500)
                return
        except Exception:
            continue


def geocode_query(page: Page, query: str) -> tuple[str, str] | None:
    search_url = f"https://www.google.com/maps/search/{quote_plus(query)}"
    page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
    maybe_accept_cookies(page)

    for _ in range(12):
        coords = extract_coords_from_url(page.url)
        if coords and coords_look_reasonable(*coords):
            return coords
        page.wait_for_timeout(1000)

    content = page.content()
    if "recaptcha" in content.lower() or "unusual traffic" in content.lower():
        raise RuntimeError("Google Maps devolvio captcha o bloqueo temporal.")

    coords = extract_coords_from_url(page.url)
    if coords:
        return coords
    return None


def launch_browser(headful: bool) -> Browser:
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(headless=not headful, slow_mo=150 if headful else 0)
    browser._playwright = playwright  # type: ignore[attr-defined]
    return browser


def close_browser(browser: Browser) -> None:
    playwright = getattr(browser, "_playwright", None)
    browser.close()
    if playwright:
        playwright.stop()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        print(f"No existe el archivo: {input_path}", file=sys.stderr)
        return 1

    rows = read_csv(input_path)
    if not rows:
        print("El CSV no tiene filas.", file=sys.stderr)
        return 1

    fieldnames = list(rows[0].keys())
    missing_indices = [index for index, row in enumerate(rows) if needs_geocoding(row)]

    if args.start_index:
        missing_indices = missing_indices[args.start_index :]
    if args.limit > 0:
        missing_indices = missing_indices[: args.limit]

    if not missing_indices:
        print("No hay filas con lat/lng faltantes.")
        write_csv(output_path, rows, fieldnames)
        return 0

    print(f"Filas totales: {len(rows)}")
    print(f"Filas a geocodificar: {len(missing_indices)}")

    browser = launch_browser(args.headful)
    context = browser.new_context(locale="es-AR")
    page = context.new_page()

    updated = 0
    failed = 0

    try:
        for processed, row_index in enumerate(missing_indices, start=1):
            row = rows[row_index]
            query = build_query(row, args.city_default)
            cliente = (row.get("cliente_id") or "").strip() or f"fila {row_index + 2}"

            try:
                coords = geocode_query(page, query)
                if coords and coords_look_reasonable(*coords):
                    row["lat"], row["lng"] = coords
                    updated += 1
                    print(f"[{processed}/{len(missing_indices)}] OK {cliente}: {coords[0]}, {coords[1]}")
                else:
                    failed += 1
                    print(f"[{processed}/{len(missing_indices)}] SIN_RESULTADO {cliente}: {query}")
            except TimeoutError:
                failed += 1
                print(f"[{processed}/{len(missing_indices)}] TIMEOUT {cliente}: {query}")
            except Exception as exc:
                failed += 1
                print(f"[{processed}/{len(missing_indices)}] ERROR {cliente}: {exc}")

            if updated > 0 and updated % args.save_every == 0:
                write_csv(output_path, rows, fieldnames)
                print(f"Guardado parcial: {output_path}")

            time.sleep(max(0.5, args.delay_seconds + random.uniform(0.2, 0.8)))
    finally:
        context.close()
        close_browser(browser)

    write_csv(output_path, rows, fieldnames)
    print(f"Listo. Actualizados: {updated}. Fallidos: {failed}. Salida: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
