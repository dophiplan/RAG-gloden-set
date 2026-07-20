# E형 문맥 확인 — RC r2 (원시 15건)

> 채점기 원시 판정이다. 오탐(신형 거절 표현)·전제 실효(신규 문서)를 사람이 분리하라.
> 자동 기각 코드 작성 금지 (P-04). 실질 수치는 확인 후 리포트에 병기.

## RC-E008@G-B1
```
## 🔍 웹뷰어 SDK 연동용 Python 서버 샘플 코드 제공 여부

현재 RemoteCall 공식 문서 및 지식베이스 내에 **웹뷰어 SDK 연동 전용 Python 서버 샘플 코드**는 별도로 제공되고 있지 않습니다.

검색 결과 확인 시, 공식 연동 가이드는 다음 내용을 포함하고 있습니다.

## 📄 제공되는 공식 자료

- **[RemoteCall WebViewer SDK Integration Guide (한국어)](https://files.rsupport.com/ko/remotecall/guides/RemoteCall-WebViewer-SDK-Intergration-Guide-Ko.pdf)**
  - 사용자 인증 API (`POST https://remotecall.io/wv/sdk/secret/verify`) 명세
  - SDK 실행 API (`GET https://remotecall.io/wv/sdk/start`) 파라미터 설명
  - Request/Response 샘플 (HTTP 기준, 언어 무관)
  - Error Code 명세

- **[바이브 코딩 가이드 블로그](https://www.remotecall.com/kr/blog/how-to-add-remote-support-vibe-coding/)**
  - 프론트엔드(HTML/JS) 연동 예시 중심

## 💡 Python 서버 구현 참고 사항

공식 샘플 코드는 없으나, 연동 가이드에 수록된 **HTTP API 명세**를 기반으로 Python(`requests`, `fastapi`, `flask` 등)에서 직접 구현이 가능합니다.

핵심 흐
```

## RC-E012@G-B1
```
## 📷 영상 지원의 저조도 보정 및 야간 촬영 모드

현재 RemoteCall 영상 지원 기능에서는 **저조도 보정(low-light correction)이나 야간 촬영 모드(night mode)는 지원되지 않습니다.**

다만, 어두운 환경에서 촬영 시 아래 기능을 활용하실 수 있습니다.

- **플래시 On/Off**: 고객 단말기(Android/iOS)의 칸era 플래시를 켜고 끌 수 있는 기능을 제공합니다. 단말기에 플래시 기능이 없는 경우는 지원되지 않습니다.

## 📋 관련 참고 자료

- [RemoteCall SaaS 에이전트 매뉴얼 - 영상지원](https://files.rsupport.com/kr/remotecall/documents/user-guides/RemoteCall-Mobile-support-Android-guide-ko.pdf)
- [RemoteCall SaaS Agent Manual - Visual Support](https://files.rsupport.com/kr/remotecall/documents/whitepapers/RemoteCall-Usage-Tips-2022.pdf)

추가로 저조도 환경 지원이나 관련 기능에 대한 문의가 필요하시면 RSUPPORT 기술 지원팀에 요청해 주시기 바랍니다.
```

## RC-E015@G-B1
```
공식 문서에는 **`host`**와 **`viewer`** 두 가지만 정의되어 있으며, **`both`** 같은 제3의 값은 없습니다.

## 📋 `sss` 파라미터 명세

WebViewer SDK 실행 API (`GET /wv/sdk/start`)의 `sss`(화면 공유 타입) 파라미터는 다음 두 값만 받습니다.

| 값 | 설명 |
|---|---|
| `host` | **기본값**. 고객(호스트)의 화면을 공유받는 일반적인 원격 지원 방식입니다. |
| `viewer` | 상담원(뷰어)의 화면을 고객에게 보여주는 방식입니다. 단, 그룹 설정에서 **‘상담원 화면 공유’ 기능이 활성화**되어 있어야 하며, 비활성화 상태라면 `viewer`로 설정필도 `host`로 강제 변경됩니다. |

## 🔗 참고 자료

- [RemoteCall WebViewer SDK Integration Guide (한국어 PDF)](https://files.rsupport.com/ko/remotecall/guides/RemoteCall-WebViewer-SDK-Intergration-Guide-Ko.pdf)
```

## RC-E019@G-B1
```
## 📌 리모트콜 API 프로토콜 현황

지식베이스의 공식 연동 가이드를 확인한 결과, **리모트콜 API는 HTTP 기반 REST API(JSON)로 제공**되고 있으며, **gRPC 프로토콜 지원에 대한 언급은 없습니다.**

WebViewer SDK 연동 가이드에 따른 API 예시는 다음과 같습니다.

- **엔드포인트**: `https://remotecall.io`
- **인증 방식**: `POST /wv/sdk/secret/verify`
- **헤더 예시**:
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer SecretKey`

## 💡 요약

현재 공개된 공식 문서에서는 리모트콜 API를 **gRPC가 아닌 REST(HTTP/JSON) 방식**으로 연동하도록 안내하고 있습니다. gRPC 지원 여부를 추가로 확인하시려면 리모트콜 영업/기술 지원팀에 직접 문의하시는 것을 권장드립니다.
```

## RC-E021@G-B1
```
Rsupport의 **Enterprise 요금제**는 서비스에 따라 최소 구매 수량 조건이 다릅니다. 아래에서 주요 서비스별 조건을 확인하실 수 있습니다.

---

## 📌 RemoteCall Enterprise

RemoteCall의 Enterprise 요금제는 **온라인에서 1개 ID(라이선스)부터 구매**하실 수 있습니다.

- 온라인 표시 가격은 **1개 ID의 1개월 무약정 구매 기준**입니다.
- 2개 이상의 계정을 구매하시거나 연간 결제를 희망하시는 경우, 별도 문의를 통해 안내를 받으실 수 있습니다.
- Enterprise 라이선스 1개로 **최대 5개 세션**까지 동시 접속(다중 연결)이 가능합니다.

🔗 [RemoteCall 요금제 안내](https://www.remotecall.com/kr/pricing/saas/)
🔗 [RemoteCall 구매 및 FAQ](https://www.remotecall.com/kr/purchase/pricing/)

---

## 📌 RemoteMeeting Enterprise

RemoteMeeting의 Enterprise 요금제는 **100개 ID부터 구매**가 가능합니다.

- 100 ID / 200 ID / 300 ID / 500 ID 등 규모별 패키지 중에서 선택할 수 있습니다.
- ID 수량이 많을수록 추가 할인 혜택이 제공됩니다.
- 모든 ID에 회의 개설(호스트) 권한이 부여됩니다.

🔗 [RemoteMeeting 요금제 안내](https://www.remotemeeting.com/ko/?p=14)

---

💡 **요약**

| 서비스 | 최
```

## RC-E023@G-B1
```
## 📦 npm 패키지 배포 현황

현재 자료를 확인한 결과, **RemoteCall 웹뷰어 SDK는 npm 패키지 형태로 공식 배포되지 않고 있습니다.**

## 🔌 제공되는 연동 방식

웹뷰어 SDK는 대신 다음과 같은 방식으로 기존 웹 애플리케이션에 연동할 수 있습니다.

- **REST API 호출**: `SecretKey`와 `userId`를 이용해 인증 API(`https://remotecall.io/wv/sdk/secret/verify`)를 호출하고, 발급받은 토큰으로 웹뷰어 실행 URL(`https://remotecall.io/wv/sdk/start`)을 호출하는 방식입니다.
- **HTML 태그 삽입**: `<a>` 태그나 `<script>`를 이용해 웹뷰어 실행 URL을 버튼 또는 링크로 삽입할 수 있습니다.

> 예시) 정적 URL 설정
> ```html
> <a href="https://remotecall.io/wv/sdk/start?sdkLoginAccessToken=...&requestId=..." target="_blank">원격 지원</a>
> ```

## 📋 적용 절차 요약

1. **SDK Key 발급**: 파트너 어드민 > 고객관리 > 라이선스 정보 > ‘웹뷰어 SDK’ 옵션을 **사용**으로 변경
2. **코드 적용**: 발급받은 `SecretKey`와 `userId`를 API 요청에 포함하여 토큰을 획득 후, 웹뷰어 실행 URL 호출
3. **브랜드 커스터마이징**: 대기 화면 로고 및 문구 등 맞춤 설정 가능

## 📄 참고 자료

- [리모트콜 SaaS 7.6.4 업
```

## RC-E024@G-B1
```
SDK 인증으로 발급되는 **sdkLoginAccessToken의 유효 시간은 5분(300초)**입니다.

## 📌 토큰 유효 시간 확인 방법
[RemoteCall WebViewer SDK 연동 가이드](https://files.rsupport.com/ko/remotecall/guides/RemoteCall-WebViewer-SDK-Intergration-Guide-Ko.pdf)의 응답 예시에 포함된 JWT 토큰을 디코딩하면 다음과 같습니다.

```json
{
  "exp": 1751863282,
  "userId": "000000007ff6c47e01801c0ee3490034",
  "iat": 1751862982
}
```

- `iat`(발급 시각): 1751862982
- `exp`(만료 시각): 1751863282
- **차이: 300초 → 5분**

따라서 sdkLoginAccessToken은 발급 시점으로부터 **5분간 유효**하며, 만료 후에는 재발급이 필요합니다.

## 🔗 참고 문서
- [RemoteCall-WebViewer-SDK-Intergration-Guide-Ko.pdf](https://files.rsupport.com/ko/remotecall/guides/RemoteCall-WebViewer-SDK-Intergration-Guide-Ko.pdf)
- [리모트콜 웹뷰어 SDK 연동 블로그 가이드](https://www.remotecall.com/kr/blog/how-to-add-remote-support-vibe-coding/)
```

## RC-E004@G-B2-2
```
검색 결과를 확인한 결과, 현재 자료에서는 **커스텀 역할을 새로 생성하는 기능은 지원하지 않는 것**으로 나타납니다.

## 📌 관리자 권한 구조

RemoteCall(리모트콜)의 관리자 페이지는 아래 **3개의 고정된 권한**으로 구성되어 있습니다.

| 권한 | 설명 |
|------|------|
| **회사관리자** | 최상위 관리자. 그룹관리자 권한 외에 접속페이지 설정, 회사옵션 설정, 통계 조회 가능 |
| **그룹관리자** | 상담원 역할을 할 수 있고 사내 그룹의 실무관리자 |
| **일반사용자** | 상담원 |

> 회사관리자, 그룹관리자 및 일반사용자의 권한을 분리하여 세 권한 모두 관리페이지에 접근이 가능합니다. 그러나 각 권한별로 조회할 수 있는 메뉴는 한정됩니다.

## ⚙️ 개별 기능 설정은 가능

역할 자체를 커스텀으로 새로 만드는 기능은 없으나, **그룹별·상담사별로 기능 사용 여부를 개별 설정**할 수는 있습니다.  
예를 들어 관리자 페이지에서 그룹 옵션을 먼저 설정한 뒤, 각 상담사 ID별로 체크박스를 통해 세부 기능을 on/off 할 수 있습니다.

## 💡 요약

- **커스텀 역할(새로운 관리자 등급) 생성**: ❌ 지원되지 않음
- **기존 3단계 권한 내 세부 기능 개별 설정**: ✅ 가능

더욱 유연한 권한 관리가 필요하시다면 알서포트 영업/지원팀에 별도 문의를 권장드립니다.
```

## RC-E011@G-B2-2
```
## ⏱️ 상담 세션 자동 종료(타임아웃) 설정

검색 결과를 바탕으로 설명드리면, **RemoteCall에는 "에이전트 자동 로그아웃" 기능**이 있어 상담원이 일정 시간 동안 프로그램을 사용하지 않으면 자동으로 로그아웃되도록 설정할 수 있습니다. 다만 **원격지원(상담) 세션이 연결된 상태에서 일정 시간 유휴 시 세션 자체를 자동으로 종료**하는 별도의 타임아웃 기능에 대해서는 확인된 자료가 없습니다.

---

### 📌 에이전트 자동 로그아웃 (상담원 대기 세션 타임아웃)

관리자(어드민) 화면에서 그룹의 보안설정을 통해 적용할 수 있습니다.

| 항목 | 설명 |
|------|------|
| **에이전트 자동 로그아웃 제어** | Agent 자동 로그아웃 옵션을 일괄 적용하기 위한 설정입니다. "사용안함" 또는 "전체사용"으로 지정할 수 있습니다. |
| **에이전트 자동 로그아웃 시간** | 1분, 3분, 5분, 10분, 15분, 30분, 60분 중 선택할 수 있습니다. |

- 상담원이 설정된 시간 동안 원격지원 프로그램(에이전트)을 사용하지 않으면 **자동으로 에이전트에서 로그아웃**됩니다.
- 이 설정은 **[RemoteCall 7.0] Products Specification** 문서의 "보안설정" 항목에 명시되어 있습니다.

---

### 🔒 추가 보안 기능: 뷰어 잠금

원격지원 중 상담원이 설정된 시간 동안 뷰어를 사용하지 않을 경우, **뷰어의 모든 기능을 잠그는** 기능도 제공됩니다. 다른 사람이 뷰어를 컨트롤하지 못하도록 차단할 수 있습니다.

---

### ⚠️ 참고 사항
```

## RC-E003@G-B3
```
네, **개인정보 처리방침에 회원(이용자) 데이터를 해외로 이전(국외 이전)한다는 규정이 명시되어 있습니다.**

## 📋 개인정보 처리방침 내 국외 이전 규정

RSUPPORT(알서포트) 서비스의 개인정보 처리방침 목차에 **「개인정보의 국외 이전」**이 별도 항목으로 포함되어 있으며, 다음과 같은 내용이 규정되어 있습니다.

- **목적**: 서비스 이행을 위해 필요한 경우 국외 기업의 시스템 및 서비스를 이용하여 이용자의 개인정보를 처리합니다.
- **거부 방법**: 개인정보 국외이전을 원치 않으실 경우, 관련 서비스의 **계약 철회 혹은 회원탈퇴**를 통해 국외 이전을 거부하실 수 있습니다.

## 🌍 주요 국외 위탁업체 및 이전 내용

| 업무 위탁 업체 | 이용 목적 | 이전 항목 | 이전 국가 | 이용 기간 |
|---|---|---|---|---|
| **Amazon Web Services, Inc.** | 클라우드 서비스 운영 등 | 서비스 이용 중 수집되는 개인정보 및 로그정보 | 일본, 미국, 호주, 독일 | 서비스 가입기간 또는 위탁계약 종료시까지 |
| **Oracle Cloud Infrastructure** | 클라우드 서비스 운영 등 | 서비스 이용 중 수집되는 개인정보 및 로그정보 | 일본 | 서비스 가입기간 또는 위탁계약 종료시까지 |
| **Google LLC** | Google API를 통한 앱 오류 정보 수집 및 관리 | 이용자의 장치에서 생성된 식별 정보 | 미국 | 서비스 가입기간 또는 위탁계약 종료시까지 |

※ 이전 방법은 **서비스 제공 과정 중 정보통신망을 통해 
```

## RC-E004@G-B3
```
## 📋 SLA 위반 시 크레딧 보상 조항

네, 알서포트 서비스의 SLA(서비스 수준 협약)에는 월별 가동률을 달성하지 못할 경우 **요금을 감액(환급)해 주는 보상 조항**이 명시되어 있습니다.

다만 “며칠분”을 깎아준다는 식의 **고정 일수 감면은 아니고**, 해당 월 서비스 이용료를 기준으로 **비율(%)로 요금을 감액하거나 환급**하는 방식입니다.

### 보상 기준(월별 가동시간비율 기준)

| 월별 가동률 | 요금 감액(환급) 비율 | 비고 |
|---|---|---|
| 99.0% 이상 ~ 99.5% 미만 | **10%** | 해당 월 서비스 이용료를 기준으로 감액 청구 또는 당 월 청구 분 익월 말일까지 환급 |
| 95.0% 이상 ~ 99.0% 미만 | **30%** | 동일 |
| 95.0% 미만 | **50%** | 동일 |

### 신청 방법 및 유의사항
- 보상 절차는 **발생일 기준 30일 이내**에 알서포트가 별도 제공하는 방법에 따라 접수 및 신청을 완료해야 합니다.
- 정기점검·업데이트·긴급 보안 점검, 외부 통신망 불시 장애, 천재지변 등 불가항력으로 인한 downtime은 가동률 측정에서 **제외**됩니다.

### 관련 문서
- [AI 회의록 SLA](https://files.rsupport.com/ko/airepoto/others/RSUPPORT-SLA-AIrepoto-25011.pdf)
- [RemoteCall SLA](https://files.rsupport.com/kr/remotecall/documents/others/RemoteCall-SLA-ASP-180423
```

## RC-E007@G-B4
```
현재까지 리모트콜 공지사항(서비스 업데이트 공지 포함)에서는 **AI 자동 상담 요약 기능의 출시가 안낸 적은 없습니다.**

대신, 관련 블로그 및 본문 자료에서는 향후 출시될 ‘리모트콜 8.0’에 **실시간 음성 인식·자동 요약·지식 기반 해결방안 추천 등 AI 기반 기능**이 탑재될 예정임을 언급하고 있습니다.

## 🔗 참고 링크
- [리모트콜 공지사항 목록](https://www.remotecall.com/kr/support/notices/)
- [리모트콜, 글로벌 ACX 초월 대상 수상 — ‘리모트콜 8.0’ AI 기능 언급](https://www.remotecall.com/kr/blog/remotecall-wins-2025-global-acx-innovation-award/)
- [리모트콜 AI 어시스턴트 소개](https://www.remotecall.com/kr/products/ai-assistant/)
```

## RC-E004@G-B6
```
## 📋 리모트콜 웹사이트의 경쟁사 비교 콘텐츠 현황

**리모트콜 웹사이트(remotecall.com)에는 경쟁사 실명을 기재한 기능 비교표는 게시되어 있지 않습니다.**

다만, 아래와 같은 형태의 비교 콘텐츠는 확인할 수 있습니다.

### 🔍 확인된 리모트콜 웹사이트 콘텐츠
- **초성만 표기한 비교 블로그 글 존재**
  - 리모트콜 공식 블로그에 「리모트콜과 국내 저가 원격지원 제품 중 **E사**를 비교」한 글이 있습니다.
  - 해당 글에서는 지연 시간(latency), 네트워크 사용량 등을 비교하고 있으나, 경쟁사를 "E사"로 초성 처리하여 실명을 공개하지 않았습니다.
  - [리모트콜 블로그 – 저가 제품과의 차이점](https://www.remotecall.com/kr/blog/difference-from-low/)

### 📌 참고: 동일 회사의 다른 제품 웹사이트에서는 실명 비교 존재
- 알서포트의 **리모트뷰(RemoteView)** 웹사이트(content.rview.com)에는 **팀뷰어, 애니데스크, 구글 원격 데스크톱(Chrome 원격 데스크톱)** 등의 실명을 넣은 비교 콘텐츠가 게시되어 있습니다.
  - 예: 「묻지 마세요 – 팀뷰어 vs 구글원격」 , 「2026년 원격제어 프로그램 추천: 팀뷰어, 애니데스크 등 10종 비교」
  - 이는 리모트콜이 아닌 **리모트뷰** 제품의 웹사이트 콘텐츠임을 구분해야 합니다.

### 💡 요약
| 구분 | 실명 공개 여부 | 제품/사이트 |
|------|--------------|-------------|
| 리모트콜 | ❌ 없음 (초
```

## RC-E008@G-B6
```
## 📌 리모트콜 상담사 1인당 라이선스 및 세션 상한 안내

리모트콜 공식 웹사이트의 [SaaS 요금제 FAQ](https://www.remotecall.com/kr/pricing/saas/) 페이지에 상담사 1인당 라이선스 사용 기준과 세션 상한이 명시되어 있습니다.

### 핵심 내용

- **1인당 라이선스**: 1명의 상담사가 사용할 수 있는 라이선스는 **1개(1 ID)**입니다.
- **동시 지원 세션 상한**: 라이선스 유형에 따라 1인이 동시에 지원할 수 있는 세션 수가 다릅니다.
  - **Professional 라이선스**: 최대 **3세션**까지 다중 연결 가능
  - **Enterprise 라이선스**: 최대 **5세션**까지 다중 연결 가능
- **2인 이상 사용 시**: 상담원 2인 이상이 리모트콜을 이용하고자 하는 경우에는 **라이선스를 추가 구매**해야 합니다.

### 관리자 설정 옵션 참고

제품 스펙 문서에 따른 관리자 그룹 옵션에서는 **사용자별 최대 세션 수**를 1~10 범위로 설정할 수 있도록 되어 있으나([RemoteCall 7.0] Products Specification_v1.7.xlsx), 이는 그룹 옵션의 설정 범위이며 실제 상용 라이선스에서는 위의 Professional 3세션 / Enterprise 5세션 기준이 적용됩니다.

### 참고 링크

- [리모트콜 SaaS 요금제 및 FAQ](https://www.remotecall.com/kr/pricing/saas/)
- [리모트콜 제품 핸드북(PDF)](https://files.rsupport.com/k
```

## RC-E009@G-B6
```
📌 **리모트콜 고객사례에서 도입 기업의 연간 유지보수 계약 금액이 원 단위로 공개된 경우는 없습니다.**

검색 결과, 리모트콜의 공식 고객사례(성공 사례) 및 블로그, 제품 안내 자료에서는 개별 기업의 **구체적인 연간 유지보수 계약 금액(원 단위)**이 공개되어 있지 않습니다.

## 🔍 확인된 내용 요약

- **S은행 유지보수 사례**: 유지보수를 통해 안정성·신뢰성·효율성을 창출했다는 내용은 소개되나, 계약 금액은 공개되지 않았습니다.
- **유지보수 비용 산정 안내**: "도입하신 라이선스 수량과 시스템 규모, 기술 지원 레벨(SLA)에 따라 상이하며, 상세 견적은 영업 대표를 통해 확인하실 수 있습니다"라고 안납니다.
- **비용 절감 효과 일부 언급**: 일부 사례에서 "고객지원비용이 80% 감소했다"는 성과는 소개되었으나, 구체적인 원 단위 금액은 제시되지 않았습니다.
- **제품 가격 정보**: 온라인 스토어에서 월간 라이선스 가격(예: Professional 170,000원, Enterprise 190,000원 등)은 확인할 수 있으나, 이는 고객사례의 연간 유지보수 계약 금액과는 다른 정보입니다.

## 🔗 참고 링크

- [리모트콜 고객사례 목록](https://www.remotecall.com/kr/use-cases/success-stories/)
- [S은행 유지보수 사례](https://www.remotecall.com/kr/blog/remotecall-maintenance-sbank-case-study/)
- [도입 문의 페이지](https://www.remotecall.com
```
