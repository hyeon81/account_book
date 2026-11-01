"""Bounded query-only loop. Events contain public progress, never arguments."""
import json
from decimal import Decimal
from time import monotonic
from .chat_json import dumps
from .chat_prompt import chat_prompt
from .model_tools import CONNECTED_TOOLS, model_tools


class ReactLoop:
    def __init__(self, model, executor, *, max_steps=8, max_cost=Decimal("0.50"), clock=monotonic):
        if type(max_steps) is not int or max_steps < 1: raise ValueError("Invalid steps")
        max_cost = Decimal(str(max_cost))
        if not max_cost.is_finite() or max_cost <= 0: raise ValueError("Invalid cost")
        self.model, self.executor = model, executor
        self.max_steps, self.max_cost, self.clock = max_steps, max_cost, clock

    def run(self, question):
        deadline = self.clock() + 20
        messages = [{"role": "system", "content": chat_prompt(self.executor.today)},
                    {"role": "user", "content": question}]
        observations, seen, cost = [], set(), Decimal(0)
        reason, reply = "steps", "여기까지 해봤어요. 확인한 결과를 표로 보여드릴게요."
        for _ in range(self.max_steps):
            if self.clock() >= deadline:
                reason = "time"; break
            if cost >= self.max_cost:
                reason = "cost"; break
            try:
                remaining = deadline - self.clock()
                if remaining <= 0:
                    reason = "time"; break
                response = self.model.call_tools(messages, model_tools(), remaining)
                if not response.cost_usd.is_finite() or response.cost_usd < 0:
                    raise ValueError("Invalid cost")
                cost += response.cost_usd
                message = response.message
                calls = message.get("tool_calls") or []
                if not isinstance(calls, list) or len(calls) > 1: raise ValueError("Invalid calls")
                if self.clock() >= deadline:
                    reason = "time"; break
                if not calls:
                    reply = message.get("content") or "요청을 더 구체적으로 알려주세요."
                    if not isinstance(reply, str): raise ValueError("Invalid content")
                    reason = "complete"; break
                # Do not start another paid/tool operation after a reached budget.
                if cost >= self.max_cost:
                    reason = "cost"; break
                call = calls[0]
                name, raw = call["function"]["name"], call["function"]["arguments"]
                arguments = json.loads(raw) if isinstance(raw, str) else raw
                if not isinstance(arguments, dict): raise ValueError("Invalid arguments")
                signature = (name, dumps(arguments))
                # Canonical key order avoids repeat evasion by property reordering.
                signature = (name, json.dumps(json.loads(signature[1]), sort_keys=True))
                if signature in seen:
                    reason = "repeated_call"; break
                seen.add(signature)
                if name not in CONNECTED_TOOLS: raise ValueError("Unavailable tool")
                call_id = call["id"]
                if not isinstance(call_id, str) or not 1 <= len(call_id) <= 100:
                    raise ValueError("Invalid call id")
                yield "tool", {"name": name}
                if self.clock() >= deadline:
                    reason = "time"; break
                # HTTP adapter receives the remaining request budget as its timeout.
                if hasattr(self.executor.api, "timeout"):
                    self.executor.api.timeout = max(0.001, deadline - self.clock())
                result = self.executor.execute(name, arguments, call_id)
                observations.append({"name": name, "arguments": arguments, "result": result})
                messages.append(message)
                messages.append({"role": "tool", "tool_call_id": call_id, "content": dumps(result)})
            except Exception:
                reason, reply = "error", "조회 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요."
                break
        if reason not in ("complete", "error"):
            reply = "여기까지 해봤어요. 확인한 결과를 표로 보여드릴게요."
        yield "result", {"reply": reply, "observations": observations,
                         "stop_reason": reason, "cost_usd": cost}
