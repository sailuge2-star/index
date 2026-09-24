# 뽀린걸 3000일 FAN SITE

정적 HTML/CSS/JS로 만든 팬사이트 프로토타입입니다.

## 포함 파일
- `index.html` — 반응형 단일 페이지
- `styles.css` — 핑크/보라 계열 UI, 모바일 대응
- `script.js` — 모바일 메뉴, 연혁 모달, 축하 메시지 데모, 갤러리 인터랙션
- `assets/hero-reference.jpg` — 사용자가 제공한 시안에서 상단 내비게이션을 제외해 만든 히어로 이미지

## 조사 메모
- 공개 자료에서 뽀린걸은 SOOP에서 소통/게임 중심으로 활동하는 버추얼 크리에이터로 소개됩니다.
- 공개 자료상 첫 방송일은 `2018-07-18`, 팬덤명은 `뽀글이 / 뽀글스`, 주요 콘텐츠에는 소통·VRChat·배틀그라운드·종합 게임이 기재되어 있습니다.
- 방송 연혁에는 `2021-04-13 방송 1000일`, `2024-01-07 방송 2000일` 등이 기록되어 있습니다.
- 사용자가 제공한 디자인 시안에는 `2017.03.05 → 2025.06.02` 및 `3000일`이 표시되어 있습니다. 이 값은 공개 자료의 첫 방송일과 계산상 일치하지 않으므로, 사이트에서는 '제공 시안 기준'으로 별도 표기했습니다.
- 실제 배포 전에는 공식 SOOP/YouTube/팬카페 URL을 운영자 정보에 맞게 입력하고, 팬아트 게시 동의/저작권 정책을 추가하는 것을 권장합니다.

## 참고 링크
- SOOP 뽀린걸 채널: https://play.sooplive.com/bboringirl/284297162
- 공개 프로필/연혁 참고: https://www.namu.moe/w/%EB%BD%80%EB%A6%B0%EA%B1%B8

## 배포
정적 사이트이므로 GitHub Pages, Cloudflare Pages, Netlify, Vercel 등의 정적 호스팅에 그대로 올릴 수 있습니다.

## 2단계: 팬아트 · 방명록

이번 버전에는 두 가지 운영 기능이 추가되었습니다.

### 방명록
- 방문자가 닉네임 + 최대 500자 메시지를 등록
- Supabase 연결 시 실제 DB에 저장
- 승인된 메시지만 읽기
- 브라우저 데모 모드에서도 UI 테스트 가능
- 기본적인 honeypot 스팸 방지 필드 포함

### 팬아트 접수
- PNG/JPG/WEBP/GIF
- 최대 6MB
- 닉네임 / 제목 / 설명 입력
- Supabase Storage `fanart` 버킷에 업로드
- DB에는 `pending` 상태로 접수
- 운영자가 Supabase에서 `approved`로 바꾸면 갤러리에 노출

### 실제 연결 방법
1. Supabase에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase_schema.sql` 전체를 실행합니다.
3. Storage에서 `fanart`라는 버킷을 만들고 Public을 켭니다.
4. `config.js`에 Project URL과 Publishable key(구 anon key)를 입력합니다.
5. 사이트를 배포합니다.

프런트엔드에는 publishable/anon key만 사용하고 service_role/secret key는 넣지 않습니다. Supabase 공식 문서도 브라우저에서는 RLS를 켠 상태에서 publishable key를 사용하고 service-role/secret key는 서버에만 보관하도록 안내합니다.

### 운영자 승인
팬아트가 들어오면 Supabase Table Editor의 `fanart` 테이블에서 해당 행의 `status`를 `pending` → `approved`로 변경하면 됩니다. 반대로 문제 있는 작품은 `rejected`로 둘 수 있습니다.

방명록은 현재 바로 공개되는 구조입니다. 방명록까지 사전 검수 방식으로 운영하려면 `supabase_schema.sql`의 `guestbook_public_insert` 정책을 `status = 'hidden'`으로 바꾸고, 운영자가 승인할 때 `approved`로 변경하는 방식으로 전환할 수 있습니다.


## 3단계: SOOP LIVE 연동

이 버전에는 `bboringirl` SOOP 채널의 현재 방송 상태를 보여주는 서버리스 API가 포함되어 있습니다.

표시 항목:
- 방송 중 / 오프라인
- 현재 방송 제목
- 실시간 시청자 수
- 방송 번호
- 현재 방송 썸네일
- 방송 보러가기 링크

구조:
```text
브라우저
  ↓
/api/soop
  ↓
SOOP 공개 방송 상태 API
  ↓
사이트의 SOOP LIVE 카드
```

중요:
- 브라우저에서 SOOP 내부 API를 직접 호출하지 않고 Vercel의 `/api/soop.js`가 중계합니다.
- 현재 구현은 SOOP의 공개 웹 API를 이용한 비공식 연동입니다. SOOP의 공식 개발자 페이지에서 일반 공개 REST API 문서가 명확하게 제공되는 형태는 확인되지 않았으므로, SOOP 측 API 변경 시 수정이 필요할 수 있습니다.
- 현재 갱신 주기는 60초입니다.
- `config.js`의 `soopStreamerId`는 공개 식별자이므로 비밀값이 아닙니다.
