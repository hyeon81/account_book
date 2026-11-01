"""One fixed HTTP read per supported tool; unsupported contracts fail closed."""
import json
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
from account_book_agent.application.tool_api_error import ToolApiError
from account_book_agent.domain.tools.catalog import OUTPUT_SCHEMAS

ROUTES = {"search_transactions": "/api/transactions",
          "count_frequency": "/api/stats/frequency",
          "compare_periods": "/api/stats/compare"}


class HttpToolApi:
    def __init__(self, base_url, transport=urlopen, timeout=10):
        parsed = urlsplit(base_url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Invalid API base URL")
        if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
            raise ValueError("Use an API origin")
        self.base_url, self.transport, self.timeout = base_url.rstrip("/"), transport, timeout

    def get(self, tool, parameters):
        if tool not in ROUTES: raise ToolApiError()
        request = Request(self.base_url + ROUTES[tool] + "?" + urlencode(parameters), method="GET")
        try:
            with self.transport(request, timeout=self.timeout) as response:
                raw = response.read(1_048_577)
            if len(raw) > 1_048_576: raise ToolApiError()
            data = json.loads(raw, parse_float=Decimal)
            if not isinstance(data, dict): raise ToolApiError("INVALID_API_RESPONSE")
            # The browser API also returns applied filters. Keep only the tool output contract.
            return {key: data[key] for key in OUTPUT_SCHEMAS[tool]["properties"] if key in data}
        except HTTPError as error:
            code = {404: "NOT_FOUND", 422: "INVALID_ARGUMENT"}.get(error.code, "TOOL_UNAVAILABLE")
            raise ToolApiError(code, error.code >= 500 or error.code == 422) from None
        except ValueError:
            raise ToolApiError("INVALID_API_RESPONSE") from None
        except (URLError, OSError):
            raise ToolApiError() from None
