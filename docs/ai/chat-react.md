# 대화 통계 모델 연결

## 1. 모델 포트

agent의 LanguageModel.call_tools는 메시지·기존 도구 JSON Schema·남은 시간을 받고 응답과 USD 추정 비용을 반환한다. 서버의 거래 추출/complete_json 경로는 유지한다. 승인된 LiteLLM 1.106.6을 agent에만 추가한다.

현재 API에 연결된 search_transactions, count_frequency, compare_periods만 모델에 노출한다. 나머지 세 계약은 미구현 API가 준비될 때까지 제외한다. 기존 oneOf 스키마를 바꾸지 않으며 strict:false와 실행기 검증을 사용한다. 병렬 호출과 LiteLLM/제공자 SDK 재시도를 모두 끈다. 비용을 알 수 없으면 실패한다.

참고: [LiteLLM 도구 호출](https://docs.litellm.ai/docs/completion/function_call), [비용](https://docs.litellm.ai/docs/completion/token_usage), [OpenAI 도구 호출](https://developers.openai.com/api/docs/guides/function-calling).

각 단계의 단위 테스트는 모델 대역을 사용한다. 실제 모델 평가는 integration 표식으로 분리한다.
