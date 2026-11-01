"""Small SSE boundary: validate before streaming, never expose model internals."""
from http.server import BaseHTTPRequestHandler
import json
from uuid import uuid4
from account_book_agent.application.chat_json import dumps
from account_book_agent.application.validated_answer import validated_answer


class ChatHandler(BaseHTTPRequestHandler):
    loop_factory = None

    def log_message(self, *args):
        pass  # Neither prompts nor provider failures enter HTTP access logs.

    def do_GET(self):
        if self.path != "/health": return self.reject(404, "NOT_FOUND")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def reject(self, status, code):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(dumps({"code": code, "request_id": self.request_id}).encode())

    def handle_one_request(self):
        self.request_id = str(uuid4())
        self.connection.settimeout(25)
        return super().handle_one_request()

    def do_POST(self):
        if self.path != "/chat": return self.reject(404, "NOT_FOUND")
        # Requests arrive through the UI proxy; reject cross-origin browser writes.
        origin = self.headers.get("Origin")
        if origin and origin not in {"http://localhost:8080", "http://127.0.0.1:8080",
                                     "http://localhost:5173", "http://127.0.0.1:5173"}:
            return self.reject(403, "FORBIDDEN_ORIGIN")
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            return self.reject(415, "UNSUPPORTED_MEDIA_TYPE")
        try:
            if self.headers.get("Transfer-Encoding"): raise ValueError()
            lengths = self.headers.get_all("Content-Length", [])
            if len(lengths) != 1: raise ValueError()
            size = int(lengths[0])
            if not 0 < size <= 20_000: return self.reject(413, "PAYLOAD_TOO_LARGE")
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict) or set(body) != {"message"}: raise ValueError()
            message = body["message"]
            if not isinstance(message, str) or not 1 <= len(message.strip()) <= 4000:
                raise ValueError()
        except (ValueError, UnicodeError, OSError):
            return self.reject(422, "INVALID_REQUEST")
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("X-Request-ID", self.request_id)
        self.end_headers()
        try:
            for event, data in self.loop_factory().run(message.strip()):
                if event == "tool": self.emit("tool", {"name": data["name"]})
                elif event == "result":
                    if data["stop_reason"] == "error":
                        self.emit("error", {"code": "AGENT_UNAVAILABLE", "message": "조회하지 못했어요.",
                                            "request_id": self.request_id})
                    if data["observations"] or data["stop_reason"] != "error":
                        self.emit("message", validated_answer(data))
            self.emit("done", None)
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            return
        except Exception:
            try:
                self.emit("error", {"code": "AGENT_UNAVAILABLE", "message": "조회하지 못했어요.",
                                    "request_id": self.request_id})
                self.emit("done", None)
            except OSError:
                pass

    def emit(self, event, data):
        self.wfile.write((f"event: {event}\ndata: {dumps(data)}\n\n").encode("utf-8"))
        self.wfile.flush()
