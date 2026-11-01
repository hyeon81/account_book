"""Public ledger failure with a stable transport-independent code."""


class LedgerError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
