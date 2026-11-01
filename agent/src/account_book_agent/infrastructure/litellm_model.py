"""LiteLLM is imported at composition time, never in domain or unit tests."""
from decimal import Decimal
from account_book_agent.application.model_reply import ModelReply


class LiteLlmModel:
    def __init__(self, model="gpt-4.1-mini", *, completion=None, cost=None):
        if completion is None or cost is None:
            import litellm
            completion = completion or litellm.completion
            cost = cost or litellm.completion_cost
        self.model, self.completion, self.cost = model, completion, cost

    def call_tools(self, messages, tools, timeout):
        response = self.completion(
            model=self.model, messages=messages, tools=tools, tool_choice="auto",
            parallel_tool_calls=False, num_retries=0, max_retries=0, timeout=timeout,
        )
        cost = Decimal(str(self.cost(completion_response=response)))
        if not cost.is_finite() or cost < 0:
            raise ValueError("Missing model cost")
        message = response.choices[0].message.model_dump(exclude_none=True)
        if message.get("role") != "assistant":
            raise ValueError("Invalid model role")
        return ModelReply(message, cost)
