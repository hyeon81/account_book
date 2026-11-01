"""HTTP adapter for deterministic statistics; no model or summary endpoint."""
from urllib.parse import parse_qsl, urlsplit

from account_book_server.domain.ledger_error import LedgerError
from account_book_server.domain.transaction import invalid


class StatisticsHandler:
    def _statistics_route(self):
        parts = urlsplit(self.path)
        if parts.path not in ("/api/stats/frequency", "/api/stats/compare"):
            return False
        origin = self.headers.get("Origin")
        if origin and origin not in self.server.allowed_origins:
            self._ledger_error(403, "FORBIDDEN_ORIGIN", "허용되지 않은 요청이에요.")
            return True
        try:
            pairs = parse_qsl(parts.query, keep_blank_values=True, strict_parsing=True)
            if len(dict(pairs)) != len(pairs):
                invalid("조회 조건은 한 번씩만 입력해 주세요.")
            use_case = self.server.statistics
            result = (use_case.frequency(dict(pairs)) if parts.path.endswith("/frequency")
                      else use_case.compare(dict(pairs)))
            self._reply(200, result)
        except LedgerError as error:
            self._ledger_error(422, error.code, str(error))
        except (ValueError, UnicodeDecodeError):
            self._ledger_error(422, "VALIDATION_ERROR", "조회 조건을 확인해 주세요.")
        except Exception:
            self._ledger_error(503, "LEDGER_UNAVAILABLE", "거래 저장소를 사용할 수 없습니다. 다시 시도해 주세요.")
        return True
