"""Safe adapter failure metadata, without provider bodies or secrets."""


class ToolApiError(Exception):
    def __init__(self, code="TOOL_UNAVAILABLE", retryable=False):
        super().__init__(code)
        self.code = code
        self.retryable = retryable
