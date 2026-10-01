# SOOP API · Chat SDK 설정

이 버전은 연결 코드와 후원 효과를 포함합니다. 배포·환경변수 입력·실제 방송 연결 검증은 별도로 필요합니다. SDK는 게임을 플레이하는 사용자의 브라우저가 아니라 별도 Docker 서버의 비공개 브라우저에서 실행됩니다.

## 1. 구성

- Vercel: 기존 팬사이트, 게임, `/api/soop-connect` API 프록시
- 상시 Docker 서버: `soop-relay/` 디렉터리, 공식 Chat SDK를 실행하며 후원 이벤트 수신
- 게임: 약 2초마다 자기 연결의 이벤트를 조회해 효과 실행
- Client Secret과 SOOP 토큰은 방문자에게 반환하지 않습니다.
- 로그인은 SOOP 모바일 앱 > 내 정보 > 인증번호의 6자리 번호를 사용하는 공식 API 방식입니다. Developers에 등록해 둔 `/api/soop-auth/callback` 리다이렉트 URL은 이 방식에서는 사용하지 않습니다. OAuth 리다이렉트 경로를 구현한 버전이 아닙니다.

## 2. Docker 중계 서버

`soop-relay`를 Docker를 계속 실행할 수 있는 서버에 배포합니다. Vercel 함수에 이 디렉터리를 배포해 실행하는 구조가 아닙니다. 하나의 인스턴스만 실행하고 절전·자동 종료를 끕니다. HTTPS 주소가 필요합니다.

필요 환경변수:

| 변수 | 값 |
|---|---|
| SOOP_CLIENT_ID | 승인된 앱의 Client ID |
| SOOP_CLIENT_SECRET | 승인된 앱의 Client Secret |
| SOOP_RELAY_KEY | 임의의 긴 비밀 문자열, 최소 32자 |
| SOOP_STREAMER_ID | bboringirl |
| PORT | 기본 8080 |

로컬에서 컨테이너를 구성하는 경우:

```sh
cd soop-relay
docker build -t bboringirl-soop-relay .
docker run --init --shm-size=1g --env-file /안전한/경로/relay.env -p 8080:8080 bboringirl-soop-relay
```

환경변수 파일은 저장소에 업로드하지 마세요. 서비스 앞단에서 HTTPS를 설정합니다. `/health`는 상태 확인용입니다. 나머지 경로는 공유 비밀키 인증이 필요합니다. 서버는 채팅을 보내거나 사용자 제재를 실행하지 않습니다.

## 3. Vercel 환경변수

프로젝트 Settings > Environment Variables에 추가 후 재배포합니다.

| 변수 | 값 |
|---|---|
| SOOP_RELAY_URL | 위 중계 서버의 HTTPS 주소 (예: https://자신의-서버주소) |
| SOOP_RELAY_KEY | 중계 서버와 동일한 값 |
| SOOP_SESSION_SECRET | RELAY_KEY와 다른 임의의 비밀 문자열, 최소 32자 |
| SOOP_SITE_ORIGIN | https://bboringril.vercel.app |

각 비밀 문자열은 다음 명령을 별도로 실행해 만들 수 있습니다.

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Client Secret은 Vercel의 공개 config.js나 HTML에 넣지 않습니다. 이번 구현에서는 중계 서버 환경변수에만 필요합니다.

## 4. 실제 연결 순서

1. 뽀린걸 SOOP 계정으로 방송을 시작합니다.
2. game.html의 SOOP 연동 팝업을 엽니다.
3. SOOP 모바일 앱 > 내 정보 > 인증번호의 6자리 번호를 입력하고 연결하기를 누릅니다.
4. ‘후원 수신 중’으로 바뀌었는지 확인합니다. 단순 ‘채팅 연결 확인 필요’는 수신 완료가 아닙니다.
5. 게임을 시작합니다. 입력된 개수와 정확히 일치하는 신규 후원이 효과를 발생시킵니다.

공식 SDK는 인증한 계정 본인 방송에 연결합니다. 이 구현은 추가로 방송 ID가 bboringirl인지 확인합니다. 다른 계정이나 방송 종료 상태에서는 연결을 거절합니다. 앱 동의 화면에서 user_stationinfo / broad_access_chatinfo 권한을 허용해야 합니다.

## 5. 기본 효과

| 수량 | 효과 |
|---|---|
| 10 | 최대 체력의 30% 회복 |
| 15 | 최대 체력의 20% 감소, 최소 1 유지 |
| 20 | 7초 무적 |
| 33 | 회복·체력 감소·무적 중 균등 무작위 |
| 40 | 일반 보스 5종 중 1종 추가 소환, 이미 보스전이면 생략 |
| 50 | 가장 가까운 보스 격파 (없으면 생략) |

별풍선·애드벌룬·영상풍선 신규 이벤트를 받습니다. 다시보기·방송국·중계방 후원으로 표시된 이벤트는 제외합니다. 추가 보스는 정규 6보스 진행 횟수와 순서를 바꾸지 않습니다. 보스 삭제 효과는 정규 보스에도 적용되며, 마지막 보스라면 클리어 조건을 충족할 수 있습니다.

효과는 연결한 브라우저에서 실행 중인 게임에만 적용됩니다. 사이트 전체 방문자에게 자동 배포되는 기능은 아닙니다. 게임 시작 전 후원은 게임 효과로 예약하지 않습니다. 일시정지·능력치 선택 중에는 최대 100개를 5분까지 대기시키고, 재시작한 게임에 이전 이벤트를 적용하지 않습니다. 페이지를 새로 열면 과거 후원은 재실행하지 않습니다.

관리자 플레이의 무적·공격력 999는 유지됩니다. 관리자에게 체력 감소 후원은 피해를 주지 않습니다. 후원 무적 시간은 일시정지 동안 줄어들지 않습니다.

## 6. 연결 유지와 제한

- 한 번에 뽀린걸 계정의 연결 하나를 유지합니다. 재연결하면 이전 세션은 종료됩니다.
- 최대 4시간 또는 SOOP 토큰 만료 시점까지 유지합니다. 자동 토큰 갱신은 구현하지 않았습니다. 만료·방송 종료·중계 서버 재시작 시 연결 해제 후 새 인증번호로 재연결합니다.
- 연결 해제는 이 게임의 수신 세션을 종료합니다. SOOP 앱 권한 자체를 철회하는 동작은 아닙니다.
- 현재 연동에서 별도 DB 추가나 기존 game-balance.sql 재실행은 필요하지 않습니다.

## 7. 검증

```sh
node tests/soop-integration.cjs
```

외부 SOOP와 브라우저 연결은 모의 응답으로 검증했습니다. 쿠키 암호화, 비밀값 제외, 동일 출처 요청, 방송 ID 제한, 이벤트 커서, 연결 해제, 회복/감소/무적, 일시정지, 추가 보스 진행 보존을 확인했습니다. 실제 승인 앱 인증·Docker 호스팅·실제 후원 수신은 자격증명과 방송 환경이 없어 아직 검증하지 않았습니다.

공식 문서: https://developers.sooplive.co.kr/docs/chatsdk/oauth
공식 SDK: https://static.sooplive.com/asset/app/chat-sdk/sooplive-chat-sdk.js
