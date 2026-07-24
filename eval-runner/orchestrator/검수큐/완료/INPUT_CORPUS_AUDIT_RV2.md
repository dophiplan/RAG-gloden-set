# INPUT_CORPUS_AUDIT_RV2 — 입력 대기

- 발행: 2026-07-24T14:11:13 · WAITING_INPUT 검사기 (자동)
- 제품: RV2 · 단계: ① 코퍼스 실측

## 무엇을
RV2 코퍼스 — 파일은 있으나 읽을 수 있는 청크 0 (형식 확인 필요)

## 어느 경로에
`data/RV2/corpus/`

## 어떤 형식으로
json([{doc,chunk_id,text}] · {chunks:[…]} export) · md/txt · zip(내부 chunks-*.json)


> 투입된 입력물은 입구 검사(실측/형식 게이트/해시 매니페스트 등록)를 통과해야 RUNNING 전이.
> ("받으면 무조건 실측부터" — 영역 0 원칙의 전 입력물 일반화)
