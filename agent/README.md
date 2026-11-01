# Account book agent: query tools and ReAct

모델 없는 도구와 LiteLLM 기반 query 서버를 제공한다. POST /chat은 SSE이며 내부 포트는 8001이다.
실제 연결 가능한 거래 조회·빈도·비교와 가짜 API 전용 계약을 구분한다.
상세 계약과 구현 이유는 [도구 구현 문서](../docs/ai/chat-tools.md)를 따른다.

저장소 루트에서 테스트:

```powershell
python -m pytest agent/tests
```

전체 Python 테스트는 `python -m pytest`, 문서 검증은
`python scripts/validate_docs.py`다. pytest.ini가 agent/src를 테스트 경로에 포함한다.
패키지를 다른 프로그램에서 사용하려면 `python -m pip install -e agent`로 설치할 수 있다.
승인된 LiteLLM만 직접 의존성으로 추가했다. 실제 .env는 테스트에서 읽지 않는다.

실행은 저장소 루트의 `docker compose up --build`를 사용한다. agent에는 API_BASE_URL,
OPENAI_API_KEY, AGENT_MODEL, AGENT_MAX_STEPS, AGENT_MAX_COST_USD가 주입된다.
UI의 AGENT_BASE_URL은 Compose에서 내부 agent 주소로 설정한다. 로컬 라이브러리 실행은
`python -m account_book_agent.bootstrap`이다. 상세 중단·오류 계약은
[모델 구현](../docs/ai/chat-react.md)과 [API 계약](../docs/api-contract.md)을 따른다.

구성 코드가 `HttpToolApi`와 `ToolExecutor`에 API origin·오늘의 현지 날짜·시간대를
주입한다. 실행기의 `mode`는 기본 query이며 요청이나 도구 인자로 받지 않는다.
에이전트는 API 서버 모듈과 DB를 직접 접근하지 않는다.
