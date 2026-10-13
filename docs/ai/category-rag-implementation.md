# RAG 카테고리 추천 구현

## 요구사항 원문

[이슈 #5: 카테고리 고르기 by AI](https://github.com/hyeon81/account_book/issues/5)의 사용자 설명:

> 사용자가 어떤 지출 내역을 혹은 수입 내역을 입력하면,
> RAG 내역들을 바탕으로 카테고리를 분류하는 그런 기능.
> 일반적으로는 사용자가 입력하고, AI 버튼이 잇어서 AI 버튼을 누르면 AI가 결정해준다

## 구현 계획과 범위

1. 거래 입력·수정 폼의 카테고리 영역에 명시적인 AI 추천 버튼을 추가한다.
2. 같은 유형의 카테고리 정의와 현재 브라우저에서 확정한 최근 거래 100건을 검색 자료로 만든다.
3. 같은 임베딩 모델로 자료와 질의를 벡터화하고 코사인 유사도 상위 5개를 검색한다.
4. 검색 근거와 허용 카테고리만 모델에 전달해 구조화된 추천을 생성한다.
5. 서버와 UI가 카테고리·유형·근거 ID를 검증한다. 결과는 수정 가능한 입력에만 적용하고 저장은 사용자 버튼으로 확정한다.
6. 모호함·키 누락·통신 장애·입력 변경 중 응답을 테스트하고 수동 입력을 유지한다.

구현은 로컬 단일 사용자용이다. 기존 거래 저장은 브라우저 `localStorage`를 사용한다. API는 거래를 저장하지 않으며 요청마다 현재 사례를 임베딩한다. 이전 요청의 자료나 벡터를 보관하지 않아 거래 수정·삭제는 다음 요청에 반영된다. 다른 브라우저의 내역을 공유하거나 사용자를 인증하는 서비스는 포함하지 않는다.

## 실행

Docker Desktop 실행 후 루트에서 `docker compose up --build`를 사용한다. UI는 `http://localhost:8080`, API는 Docker 내부에서만 연결된다. 개발 환경은 `docker compose -f docker-compose.dev.yml up --build`와 `http://localhost:5173`을 사용한다.

OpenAI 키는 서버 프로세스의 `OPENAI_API_KEY` 환경변수로 전달한다. 브라우저에는 키를 넣지 않는다. 키가 없으면 AI 추천이 사용 불가로 표시되고 직접 선택·저장은 계속 가능하다. 실제 `.env` 파일을 읽거나 이미지에 포함할 필요가 없다. Compose가 기본 `.env`를 로드하지 않게 실행하려면 빈 파일을 지정한다.

```powershell
New-Item -ItemType File -Force "$env:TEMP/account-book-empty-env" | Out-Null
docker compose --env-file "$env:TEMP/account-book-empty-env" up --build
```

키는 셸에 안전한 방식으로 미리 주입하고 저장소에 기록하지 않는다. 모델은 `OPENAI_EMBEDDING_MODEL`(기본 `text-embedding-3-small`)과 `OPENAI_CATEGORY_MODEL`(기본 `gpt-4.1-mini`)로 변경할 수 있다. 생성 모델은 Responses API의 Structured Outputs를 지원해야 한다. 모델 접근 권한과 실제 호출 비용은 사용하는 OpenAI 프로젝트에 따른다.

Python 서버는 표준 라이브러리로 구현했다. 소스는 `server/src/account_book_server`, 테스트는 `server/tests/account_book_server`에 있고 외부 런타임 의존성은 없다. Docker는 패키지를 Python 설치 경로로 복사해 실행한다. 로컬 테스트는 루트 `pytest.ini`의 소스 경로 설정을 사용한다. 별도 패키지 설치가 필요한 환경에서는 `server/pyproject.toml`을 사용한다. 기존 설계의 FastAPI·Pydantic·LiteLLM·DB·별도 에이전트 서비스는 후속 범위다.

## 추천 API

`POST /api/category-recommendation`은 JSON을 받는다. 금액과 날짜는 전송하지 않는다. `history`는 브라우저에서 확정한 거래의 현재 스냅샷이며, 추천 자체는 사례로 저장하지 않는다. 수정 폼의 현재 거래는 사례에서 제외한다.

```json
{
  "type": "expense",
  "merchant": "달빛커피",
  "memo": "라떼",
  "history": [
    {"id": "saved-1", "type": "expense", "category_id": "cafe", "merchant": "달빛커피", "memo": "아메리카노"}
  ]
}
```

```json
{
  "status": "recommended",
  "category_id": "cafe",
  "reason": "저장된 커피 거래를 참고했어요.",
  "evidence_ids": ["transaction:saved-1"],
  "requires_confirmation": true,
  "evidence": [
    {"id": "transaction:saved-1", "category_id": "cafe", "source": "transaction", "text": "거래처: 달빛커피\n메모: 아메리카노"}
  ]
}
```

`recommended`는 검증된 추천, `needs_clarification`은 근거 부족·모호함, `unavailable`은 공급자 장애나 잘못된 출력이다. 뒤의 두 상태는 `category_id: null`이며 현재 수동 선택을 덮어쓰지 않는다. 추천 근거 ID는 `category:<id>`와 `transaction:<id>`를 사용한다. 코사인 유사도 0.25 미만 자료는 제외하고 최대 5개를 생성 입력으로 전달한다. 이 임계값은 정확도 확률이 아니며 실제 사용자 자료로 조정할 수 있다.

입력은 사용처 500자, 메모 1,000자, 거래 ID 100자, 사례 100건, 요청 본문 200KB로 제한한다. API는 같은 유형과 현재 허용 카테고리만 검색한다. 잘못된 입력은 400, 요청 크기는 413, JSON 이외는 415, 허용되지 않은 Origin은 403, 동시 처리 초과는 503으로 응답한다. 기본 허용 Origin은 localhost와 127.0.0.1의 8080·5173이다. 다른 로컬 미리보기 주소는 서버의 `CATEGORY_ALLOWED_ORIGINS`에 쉼표로 나눠 지정한다.

## 자료 처리와 검증

AI 버튼을 누를 때 사용처·메모와 같은 유형의 확정 분류 사례를 OpenAI 임베딩 API로 전송한다. 검색된 근거만 Responses API로 전달하며 `store: false`를 지정한다. 공급자의 데이터 처리 정책 전체가 이 값 하나로 결정되는 것은 아니다. 서버는 본문과 공급자 오류 내용을 로그에 남기지 않고 응답 캐시도 금지한다.

입력 변경·수동 카테고리 선택·대화상자 닫기·카드 초안 적용은 진행 중 응답을 취소하거나 무효화한다. 모델 입력 속 명령은 데이터로 취급하도록 지시하고, 반환된 카테고리와 인용 근거는 코드에서 다시 검사한다.

```bash
pytest
python scripts/validate_docs.py
cd ui
npm test
npm run lint
npm run build
```

자동 테스트는 가짜 공급자로 실제 검색 계산과 HTTP·OpenAI 요청 형식을 검증한다. 실제 키를 사용하는 외부 호출은 별도로 확인해야 한다. [임베딩 공식 문서](https://developers.openai.com/api/docs/guides/embeddings), [구조화 출력 공식 문서](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)를 기반으로 구현했다.
