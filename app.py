"""Loopback-only, in-memory CSV cleaning workbench (Python 3.11+)."""
import csv
import io
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from import_pipeline import inspect_csv, prepare_import

MAX_BODY = 2_200_000
MAX_TEXT = 1_000_000
MAX_ROWS = 10_000
MAX_CELLS = 200_000
csv.field_size_limit(MAX_TEXT)


def clean_csv(payload):
    if not isinstance(payload, dict):
        raise ValueError("object_required")
    if "schema" in payload:
        return prepare_import(payload)
    text = payload.get("text")
    delimiter = payload.get("delimiter", ",")
    if not isinstance(text, str) or len(text.encode("utf-8")) > MAX_TEXT:
        raise ValueError("text_limit")
    if delimiter not in (",", ";", "\t"):
        raise ValueError("delimiter")
    if "\x00" in text:
        raise ValueError("nul")
    for option in ("trim", "dedup", "safe"):
        if option in payload and type(payload[option]) is not bool:
            raise ValueError("options")
    trim, dedup, safe = (payload.get("trim", True), payload.get("dedup", False), payload.get("safe", True))
    rows, seen = [], set()
    counts = dict(input_rows=0, output_rows=0, empty_removed=0, duplicates_removed=0, protected_cells=0, trimmed_cells=0)
    widths = set()
    cell_count = 0
    try:
        reader = csv.reader(io.StringIO(text.removeprefix("\ufeff"), newline=""), delimiter=delimiter, strict=True)
        for row in reader:
            counts["input_rows"] += 1
            cell_count += len(row)
            if counts["input_rows"] > MAX_ROWS or cell_count > MAX_CELLS:
                raise ValueError("row_limit")
            if trim:
                counts["trimmed_cells"] += sum(value != value.strip() for value in row)
                row = [value.strip() for value in row]
            if not row or all(not value.strip() for value in row):
                counts["empty_removed"] += 1
                continue
            key = tuple(row)
            if dedup and key in seen:
                counts["duplicates_removed"] += 1
                continue
            seen.add(key)
            widths.add(len(row))
            if safe:
                for index, value in enumerate(row):
                    if value.lstrip(" \t\r\n").startswith(("=", "+", "-", "@")) or value.startswith(("\t", "\r", "\n")):
                        row[index] = "'" + value
                        counts["protected_cells"] += 1
            rows.append(row)
    except csv.Error as error:
        raise ValueError("malformed") from error
    output = io.StringIO(newline="")
    csv.writer(output, delimiter=delimiter, lineterminator="\r\n").writerows(rows)
    counts["output_rows"] = len(rows)
    return dict(csv=output.getvalue(), preview=rows[:30], report={**counts, "column_counts": sorted(widths), "ragged_rows": len(widths) > 1, "safe_export": safe, "preview_rows": min(len(rows), 30)})


class Server(ThreadingHTTPServer):
    daemon_threads = True
    processing = threading.BoundedSemaphore(2)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass  # Never log CSV contents, file names or request paths.

    def allowed(self):
        port = self.server.server_address[1]
        expected = {f"127.0.0.1:{port}", f"localhost:{port}"}
        if self.headers.get("Host") not in expected:
            return False
        origin = self.headers.get("Origin")
        return origin is None or origin in {f"http://{host}" for host in expected}

    def respond(self, status, body, content_type="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if not self.allowed():
            return self.respond(403, {"error": "origin"})
        routes = {"/": ("index.html", "text/html; charset=utf-8"), "/src/js/app.js": ("src/js/app.js", "text/javascript; charset=utf-8"), "/src/js/workbench-ui.js": ("src/js/workbench-ui.js", "text/javascript; charset=utf-8"), "/src/css/style.css": ("src/css/style.css", "text/css; charset=utf-8"), "/src/assets/icon.svg": ("src/assets/icon.svg", "image/svg+xml")}
        target = routes.get(urlsplit(self.path).path)
        if not target:
            return self.respond(404, {"error": "not_found"})
        self.respond(200, (Path(__file__).parent / "public" / target[0]).read_bytes(), target[1])

    def do_POST(self):
        if not self.allowed():
            return self.respond(403, {"error": "origin"})
        if self.path not in ("/api/clean", "/api/inspect"):
            return self.respond(404, {"error": "not_found"})
        if self.headers.get("Transfer-Encoding") or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return self.respond(415, {"error": "content_type"})
        try:
            size = int(self.headers.get("Content-Length", "-1"))
        except ValueError:
            size = -1
        if not 0 <= size <= MAX_BODY:
            return self.respond(413, {"error": "body_limit"})
        if not self.server.processing.acquire(blocking=False):
            return self.respond(429, {"error": "busy"})
        try:
            self.connection.settimeout(10)
            raw = self.rfile.read(size)
            if len(raw) != size:
                return self.respond(400, {"error": "json"})
            try:
                payload = json.loads(raw.decode("utf-8"))
                result = inspect_csv(payload) if self.path == "/api/inspect" else clean_csv(payload)
            except (UnicodeDecodeError, json.JSONDecodeError, RecursionError):
                return self.respond(400, {"error": "json"})
            except ValueError as error:
                return self.respond(400, {"error": str(error)})
            self.respond(200, result)
        except TimeoutError:
            self.respond(408, {"error": "timeout"})
        finally:
            self.server.processing.release()


if __name__ == "__main__":
    try:
        port = int(os.environ.get("PORT", "8802"))
        if not 1024 <= port <= 65535:
            raise ValueError()
        server = Server(("127.0.0.1", port), Handler)
    except (ValueError, OSError) as error:
        raise SystemExit(f"Cannot start. Use a free PORT between 1024 and 65535. {error}")
    print(f"CSV Workbench: http://127.0.0.1:{port} — Ctrl+C to stop", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
