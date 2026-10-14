"""Local-only HTTP entry point for browser ledger recommendations."""
import json
from http.server import BaseHTTPRequestHandler



class RecommendationHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args) -> None:
        # No merchant, memo, provider response, or credentials in request logs.
        pass

    def _reply(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self._reply(200, {"status": "ok"})
        else:
            self._reply(404, {"error": "경로를 찾을 수 없어요."})

    def do_POST(self) -> None:
        if self.path not in ("/api/category-recommendation", "/api/transaction-draft"):
            self._reply(404, {"error": "경로를 찾을 수 없어요."})
            return
        origin = self.headers.get("Origin")
        if origin and origin not in self.server.allowed_origins:
            self._reply(403, {"error": "허용되지 않은 요청이에요."})
            return
        if self.headers.get("Content-Type", "").split(";")[0].strip().lower() != "application/json":
            self._reply(415, {"error": "JSON 형식으로 요청해 주세요."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= 200_000 or self.headers.get("Transfer-Encoding"):
            self._reply(413, {"error": "요청 크기를 확인해 주세요."})
            return
        if not self.server.slots.acquire(blocking=False):
            self._reply(503, {"error": "추천 중이에요. 잠시 후 다시 시도해 주세요."})
            return
        try:
            self.connection.settimeout(10)
            raw = self.rfile.read(length)
            payload = json.loads(raw)
            result = (self.server.drafts.prepare(payload) if self.path == "/api/transaction-draft"
                      else self.server.rag.recommend(payload))
            self._reply(200, result)
        except (ValueError, UnicodeDecodeError):
            self._reply(400, {"error": "사용처·메모와 거래 내역을 확인해 주세요."})
        except (TimeoutError, OSError):
            self.close_connection = True
        except Exception:
            self._reply(503, {"error": "지금은 AI 추천을 사용할 수 없어요. 직접 선택해 주세요."})
        finally:
            self.server.slots.release()
