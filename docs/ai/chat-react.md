# 대화 통계 모델 연결

## 1. 모델 포트

agent의 LanguageModel.call_tools는 메시지·기존 도구 JSON Schema·남은 시간을 받고 응답과 USD 추정 비용을 반환한다. 서버의 거래 추출/complete_json 경로는 유지한다. 승인된 LiteLLM 1.106.6을 agent에만 추가한다.

현재 API에 연결된 search_transactions, count_frequency, compare_periods만 모델에 노출한다. 나머지 세 계약은 미구현 API가 준비될 때까지 제외한다. 기존 oneOf 스키마를 바꾸지 않으며 strict:false와 실행기 검증을 사용한다. 병렬 호출과 LiteLLM/제공자 SDK 재시도를 모두 끈다. 비용을 알 수 없으면 실패한다.

참고: [LiteLLM 도구 호출](https://docs.litellm.ai/docs/completion/function_call), [비용](https://docs.litellm.ai/docs/completion/token_usage), [OpenAI 도구 호출](https://developers.openai.com/api/docs/guides/function-calling).

각 단계의 단위 테스트는 모델 대역을 사용한다. 실제 모델 평가는 integration 표식으로 분리한다.

## 2. 제한된 ReAct 조회 루프

AGENT_MAX_STEPS 기본 8, AGENT_MAX_COST_USD 기본 0.50을 사용한다. 요청 시간은 20초이며 새 환경 상한은 만들지 않는다. 도구 없는 응답·단계/비용/시간 한도·같은 이름과 정규화 인자 반복에 종료한다. 한도에서는 완료된 관측값만 남긴다. 비용은 사용량 기반 추정치로, 단일 호출 비용이 상한을 넘을 수 있으나 다음 작업을 시작하지 않는다. 도구 오류도 원래 결과 봉투로 모델에 전달하며 0으로 치환하지 않는다. 모델은 query 읽기 도구만 사용하고 쓰기 확인 상태는 이번 범위에 없다.

## 3. 수치 검증

성공한 관측값의 수치 필드만 설명의 근거로 인정한다. 쉼표·소수·부호를 정규화하고 정확한 Decimal 값으로 대조한다. 검증되지 않은 숫자가 하나라도 있으면 문장 전체를 버리고 원본 표를 유지한다. 서버가 확인한 날짜와 내부 종료 제외 경계를 포함 종료일로 바꾼 날짜만 예외로 인정한다. 메모·사용처에 적힌 숫자는 통계 근거가 아니다. 빈 조회와 실패를 구분하며 일부 도구가 실패하면 성공한 표만 표시한다. 이는 숫자 일치 검사이며 문장 전체의 의미적 진실성을 증명하는 장치는 아니다.
