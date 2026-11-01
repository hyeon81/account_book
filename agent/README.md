# Account book agent: model-free tools

현재는 라이브러리와 테스트만 제공한다. 실행 서버·모델·채팅 UI는 다음 feature다.
실제 연결 가능한 거래 조회·빈도·비교와 가짜 API 전용 계약을 구분한다.
상세 계약과 구현 이유는 [도구 구현 문서](../docs/ai/chat-tools.md)를 따른다.

저장소 루트에서 테스트:

```powershell
python -m pytest agent/tests
```

전체 Python 테스트는 `python -m pytest`, 문서 검증은
`python scripts/validate_docs.py`다. pytest.ini가 agent/src를 테스트 경로에 포함한다.
패키지를 다른 프로그램에서 사용하려면 `python -m pip install -e agent`로 설치할 수 있다.
새 런타임 의존성과 환경변수는 없다. 실제 .env는 테스트에서 읽지 않는다.

구성 코드가 `HttpToolApi`와 `ToolExecutor`에 API origin·오늘의 현지 날짜·시간대를
주입한다. 실행기의 `mode`는 기본 query이며 요청이나 도구 인자로 받지 않는다.
에이전트는 API 서버 모듈과 DB를 직접 접근하지 않는다.
