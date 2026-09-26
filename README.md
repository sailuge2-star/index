# 뽀린걸 FAN SITE — ADMIN 대시보드 최신 버전

## 포함 기능
- 첫 접속 시 게스트 / ADMIN 입장 선택
- ADMIN은 Supabase Authentication 이메일/비밀번호로 로그인
- `public.admin_users`에 등록된 사용자만 관리자 권한 인정
- 관리자 페이지에서 방명록 숨김/공개/삭제
- 관리자 페이지에서 팬아트 승인/반려/삭제
- 관리자 통계
- SOOP LIVE / SOOP 캘린더 / 방명록 / 팬아트 기능 유지

## 1. config.js 설정
`config.js`에는 Supabase Project URL과 Publishable key를 넣습니다. 현재 ZIP에는 다음 관리자 이메일이 예시로 설정되어 있습니다.

```js
window.BBORINGIRL_CONFIG = {
  supabaseUrl: "https://vuwcpbzpzaqimkuyhmwg.supabase.co",
  supabaseKey: "sb_publishable_aGEE_yh1dJSeApTUoOF_7g_HX79CDnv",
  adminEmails: [
    "pukha@naver.com"
  ],
  soopStreamerId: "bboringirl"
};
```

`adminEmails`는 브라우저에 노출되는 참고용 목록이며 실제 권한은 `admin_users` + RLS가 결정합니다. 관리자 비밀번호와 service_role/secret key는 절대 `config.js`에 넣지 않습니다.

## 2. Supabase Authentication 관리자 계정 생성
Supabase Dashboard → **Authentication → Users → Add user / Create user**에서 관리자 이메일과 비밀번호를 생성합니다. 가능하면 생성 시 **Auto Confirm User** 옵션을 사용하세요.

예:
- 이메일: `pukha@naver.com`
- 비밀번호: Supabase에서 사용할 관리자 비밀번호

사용자를 만들면 Supabase가 `auth.users`에 계정을 자동으로 생성합니다. `auth.users` 테이블을 직접 만들면 안 됩니다.

## 3. 데이터베이스 / RLS 설정
Supabase **SQL Editor**에서 `supabase_schema.sql` 전체를 실행합니다.

이 파일은 기존 정책이 있는 경우 해당 정책을 먼저 삭제하고 다시 만드는 방식으로 작성되어 있어, 이전 버전에서 이미 일부 스키마를 실행한 경우에도 재실행할 수 있습니다.

`fanart` Storage bucket은 별도로 만들고 **Public**을 켜야 합니다.

## 4. 관리자 권한 등록
Authentication에서 계정을 만든 뒤 SQL Editor에서 실행합니다. 이메일은 실제 관리자 계정과 동일해야 합니다.

```sql
insert into public.admin_users(user_id)
select id
from auth.users
where email = 'pukha@naver.com'
on conflict (user_id) do nothing;
```

확인:

```sql
select a.user_id, u.email
from public.admin_users a
join auth.users u on u.id = a.user_id;
```

결과에 관리자 이메일이 나오면 관리자 등록이 완료된 것입니다.

## 5. 사이트에서 로그인
첫 화면 → **ADMIN으로 입장** → Supabase Authentication에서 만든 이메일/비밀번호 입력.

로그인 성공 후 `admin_users`에 현재 사용자의 UUID가 있는지 확인하고 관리자 대시보드를 표시합니다.

## 문제 해결
- `Invalid login credentials`: Authentication → Users에 계정이 존재하는지, 이메일/비밀번호가 맞는지 확인하세요.
- `관리자 권한이 없는 계정입니다`: `admin_users`에 해당 Auth 사용자의 UUID를 등록하세요.
- `Supabase 설정이 필요합니다`: 배포된 `config.js`가 최신 파일인지 확인하세요.
- 방명록/팬아트가 관리자 화면에서 안 보임: `supabase_schema.sql`의 관리자 RLS 정책을 실행했는지 확인하세요.

## 보안
- Publishable/anon key는 브라우저에 넣을 수 있지만 service_role/secret key는 넣으면 안 됩니다.
- 관리자 비밀번호는 Supabase Authentication에서만 관리합니다.
- 실제 관리자 권한은 `admin_users`와 RLS 정책으로 보호합니다.


## 게스트 로그아웃
게스트로 입장하면 우측 상단에 `게스트 관리` 메뉴가 표시됩니다. 메뉴의 `게스트 로그아웃`을 누르면 현재 게스트 입장 상태를 sessionStorage에서 제거하고 최초 입장 화면으로 돌아갑니다. 게스트는 Supabase Auth 계정이 아니므로 서버 로그아웃은 수행하지 않습니다.

## BGM 플레이리스트

관리자 페이지에서 음악 파일을 업로드하면 `bgm_tracks`와 Storage `bgm` 버킷에 저장되고, `enabled=true`인 곡만 게스트 페이지의 BGM 플레이리스트에 표시됩니다.

### Supabase 설정

`supabase_schema.sql`을 기존 프로젝트에서 다시 실행하세요. 이 파일에는 BGM 테이블, 공개 읽기 RLS, 관리자 업로드/수정/삭제 RLS, `bgm` Storage 버킷 정책이 포함되어 있습니다. 기존 정책은 `drop policy if exists` 방식으로 재실행할 수 있습니다.

### 관리자 사용법

1. 관리자 계정으로 로그인합니다.
2. 관리자 대시보드의 **배경음악 관리**에서 곡 제목과 음악 파일을 선택합니다.
3. **음악 추가**를 누릅니다.
4. 목록에서 ▲/▼로 순서를 바꿉니다.
5. **공개/숨김**으로 게스트 재생 여부를 바꿉니다.
6. 삭제하면 DB 레코드와 Storage 파일을 함께 삭제합니다.

지원 형식: MP3, OGG, WAV, M4A, AAC / 파일당 20MB 이하.

### 게스트 재생

게스트로 입장하면 활성화된 BGM 플레이리스트를 불러와 첫 곡부터 반복 재생합니다. 곡이 끝나면 다음 곡으로 자동 이동하며, 오른쪽 아래 플레이어에서 재생/일시정지, 다음 곡, 볼륨을 조절할 수 있습니다. 브라우저 자동재생 정책 때문에 재생이 차단되면 플레이 버튼을 눌러 시작할 수 있습니다.


## SOOP 시청자 통계 추가 설정

캘린더 아래에 `최고 시청자 수`와 `평균 시청자 수` 그래프가 표시됩니다.
Supabase SQL Editor에서 `supabase_schema.sql`의 `SOOP VIEWER STATISTICS / BROWSER COLLECTION` 섹션을 실행하면
`soop_viewer_samples` 테이블과 RLS 정책이 생성됩니다.

### 방문자가 사이트를 열어 둔 동안 자동 수집

Vercel Cron은 사용하지 않습니다. 방문자가 팬사이트를 열어 두면 `soop-live.js`가 `/api/soop`에서 방송 상태를 확인하고,
방송 중이면 현재 시청자 수를 1분 단위로 Supabase에 저장합니다. 사이트가 닫히면 해당 브라우저의 수집도 멈춥니다.
여러 방문자가 동시에 수집해도 같은 방송의 같은 분은 DB unique index로 중복을 줄입니다.

```text
방문자가 팬사이트 접속
      ↓
/api/soop → SOOP 현재 방송/시청자 확인
      ↓
방송 중이면 해당 분의 시청자 수 저장
      ↓
soop_viewer_samples
      ↓
캘린더에서 선택한 월의 최고/평균 그래프에 반영
```

방송이 꺼져 있으면 샘플을 저장하지 않습니다.

### Supabase 정책 주의사항

이 방식은 브라우저의 publishable/anon key로 INSERT하므로 `SUPABASE_SERVICE_ROLE_KEY`나 `CRON_SECRET`이 필요하지 않습니다.
대신 브라우저 사용자가 임의의 시청자 수를 INSERT하는 것을 완전히 차단할 수는 없습니다.
사이트 방문자가 실제 방송 정보를 확인하며 수집하는 것을 우선한 방식입니다.

### 통계 기간

통계는 현재 선택된 캘린더 월을 기준으로 표시됩니다. 캘린더에서 이전 달/다음 달로 이동하면 해당 월의 그래프로 자동 변경됩니다.

