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
