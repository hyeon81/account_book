"""Ledger HTTP adapter used alongside existing AI routes."""
import json
from urllib.parse import parse_qsl, unquote, urlsplit

from account_book_server.domain.ledger_error import LedgerError
from account_book_server.domain.transaction import invalid

ERROR_STATUS = {"VALIDATION_ERROR": 422, "TRANSACTION_NOT_FOUND": 404, "IMPORT_CONFLICT": 409}


class TransactionHandler:
    def _ledger_error(self, status, code, message):
        self._reply(status, {"error": {"code": code, "message": message}})

    def _ledger_body(self):
        if self.headers.get("Content-Type", "").split(";")[0].strip().lower() != "application/json":
            self._ledger_error(415, "UNSUPPORTED_MEDIA_TYPE", "JSON 형식으로 요청해 주세요.")
            return None
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= 200_000 or self.headers.get("Transfer-Encoding"):
            self._ledger_error(413, "REQUEST_TOO_LARGE", "요청 크기를 확인해 주세요.")
            return None
        self.connection.settimeout(10)
        raw = self.rfile.read(length)
        if len(raw) != length:
            invalid("요청 본문을 확인해 주세요.")
        payload = json.loads(raw)
        if payload is None:
            invalid("요청 본문을 확인해 주세요.")
        return payload

    def _ledger_route(self, method):
        parts = urlsplit(self.path)
        path = parts.path
        if path not in ("/api/categories", "/api/transactions", "/api/transactions/import") \
                and not path.startswith("/api/transactions/"):
            return False
        origin = self.headers.get("Origin")
        if origin and origin not in self.server.allowed_origins:
            self._ledger_error(403, "FORBIDDEN_ORIGIN", "허용되지 않은 요청이에요.")
            return True
        try:
            pairs = parse_qsl(parts.query, keep_blank_values=True, strict_parsing=True)
            if len(dict(pairs)) != len(pairs):
                invalid("조회 조건은 한 번씩만 입력해 주세요.")
            query = dict(pairs)
            ledger = self.server.ledger
            if method == "GET" and path == "/api/categories":
                if query:
                    invalid()
                self._reply(200, ledger.categories())
            elif method == "GET" and path == "/api/transactions":
                self._reply(200, ledger.list(query))
            elif method == "POST" and path in ("/api/transactions", "/api/transactions/import"):
                if query:
                    invalid()
                payload = self._ledger_body()
                if payload is None:
                    return True
                result = ledger.import_items(payload) if path.endswith("/import") else ledger.create(payload)
                self._reply(200 if path.endswith("/import") else 201, result)
            elif method in ("PATCH", "DELETE") and path.startswith("/api/transactions/") and not path.endswith("/import"):
                if query:
                    invalid()
                transaction_id = unquote(path[len("/api/transactions/"):])
                if method == "PATCH":
                    payload = self._ledger_body()
                    if payload is not None:
                        self._reply(200, ledger.update(transaction_id, payload))
                else:
                    if self.headers.get("Transfer-Encoding") or self.headers.get("Content-Length", "0") != "0":
                        invalid("삭제 요청에는 본문을 보내지 마세요.")
                    ledger.delete(transaction_id)
                    self.send_response(204)
                    self.send_header("Content-Length", "0")
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("Connection", "close")
                    self.end_headers()
                    self.close_connection = True
            else:
                self._ledger_error(404, "NOT_FOUND", "경로를 찾을 수 없어요.")
        except LedgerError as error:
            self._ledger_error(ERROR_STATUS[error.code], error.code, str(error))
        except (ValueError, UnicodeDecodeError):
            self._ledger_error(422, "VALIDATION_ERROR", "요청 형식을 확인해 주세요.")
        except (TimeoutError, OSError):
            self._ledger_error(503, "LEDGER_UNAVAILABLE", "거래 저장소에 연결하지 못했습니다. 다시 시도해 주세요.")
        except Exception:
            self._ledger_error(503, "LEDGER_UNAVAILABLE", "거래 저장소를 사용할 수 없습니다. 다시 시도해 주세요.")
        return True
