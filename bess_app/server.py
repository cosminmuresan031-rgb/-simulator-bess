from __future__ import annotations

import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict
from urllib.parse import unquote

from bess_engine import params_from_dict, parse_rows, run_simulation
from financial_export import generate_financial_summary_xlsx


ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
TEMPLATES = ROOT / "templates"
FINANCIAL_TEMPLATE = TEMPLATES / "financial_summary_template.xlsx"


class ApiError(Exception):
    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


class Handler(BaseHTTPRequestHandler):
    server_version = "BessSimulator/0.1"

    def log_message(self, format: str, *args: Any) -> None:
        return

    def send_json(self, payload: Dict[str, Any], status: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def send_bytes(self, data: bytes, filename: str, content_type: str) -> None:
        safe_name = filename.replace('"', "").replace("\r", "").replace("\n", "")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Content-Disposition", f'attachment; filename="{safe_name}"')
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def send_static(self, path: Path) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(404)
            return
        content = path.read_bytes()
        mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            raise ApiError("Body JSON lipsa.")
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ApiError(f"JSON invalid: {exc}") from exc

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self.send_json({"ok": True, "service": "bess-simulator"})
            return
        route = unquote(self.path.split("?", 1)[0])
        if route == "/":
            route = "/index.html"
        clean = route.lstrip("/")
        path = (STATIC / clean).resolve()
        if STATIC.resolve() not in path.parents and path != STATIC.resolve():
            self.send_error(403)
            return
        self.send_static(path)

    def do_POST(self) -> None:
        try:
            route = self.path.split("?", 1)[0]
            if route == "/api/simulate":
                payload = self.read_json()
                rows = parse_rows(payload.get("rows", []))
                params = params_from_dict(payload.get("params", {}))
                scenarios = payload.get("scenarios") or None
                result = run_simulation(rows, params, scenarios)
                self.send_json(result)
                return
            if route == "/api/export-financial-summary":
                payload = self.read_json()
                summary = payload.get("summary")
                if not isinstance(summary, dict):
                    raise ApiError("Sinteza financiara lipsa.")
                content = generate_financial_summary_xlsx(summary, FINANCIAL_TEMPLATE)
                scenario = str(summary.get("scenarioName") or "scenariu").replace(" ", "_")
                self.send_bytes(
                    content,
                    f"Sinteza_financiara_{scenario}.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
                return
            if route == "/api/export-complete-report":
                payload = self.read_json()
                dashboard = payload.get("dashboard")
                summary = payload.get("financialSummary")
                scenario = payload.get("scenario")
                if not isinstance(dashboard, dict):
                    raise ApiError("Dashboard lipsa.")
                if not isinstance(summary, dict):
                    raise ApiError("Sinteza financiara lipsa.")
                if not isinstance(scenario, dict):
                    raise ApiError("Scenariul selectat lipseste.")

                from report_export import generate_complete_report_xlsx, sanitize_filename_part

                content = generate_complete_report_xlsx(payload)
                project = sanitize_filename_part(payload.get("projectName"), "Proiect_EnergyPilot")
                scenario_name = sanitize_filename_part(dashboard.get("scenarioName") or scenario.get("name"), "scenariu")
                self.send_bytes(
                    content,
                    f"EnergyPilot_Raport_{project}_{scenario_name}.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
                return
            else:
                raise ApiError("Ruta necunoscuta.", 404)
        except ApiError as exc:
            self.send_json({"error": str(exc)}, exc.status)
        except Exception as exc:
            self.send_json({"error": f"Eroare interna: {exc}"}, 500)


def run(host: str | None = None, port: int | None = None) -> None:
    host = host or os.environ.get("HOST", "127.0.0.1")
    port = port or int(os.environ.get("PORT", "8765"))
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"BESS simulator running at http://{host}:{port}")
    httpd.serve_forever()


if __name__ == "__main__":
    run()
