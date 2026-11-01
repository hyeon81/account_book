class FakeLoop:
    def run(self, message):
        if message == "fail":
            yield "result", {"reply": "실패", "stop_reason": "error", "observations": []}
            return
        yield "tool", {"name": "count_frequency", "arguments": {"secret": "hidden"}}
        yield "result", {"reply": "기간을 알려주세요.", "stop_reason": "complete", "observations": []}
