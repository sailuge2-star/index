# 뽀린걸 FAN SITE — ADMIN 대시보드 버전

## 이번 버전
- 첫 접속 시 `게스트` / `ADMIN` 입장 선택
- ADMIN은 Supabase Auth 이메일/비밀번호로 로그인
- `public.admin_users`에 등록된 사용자만 관리자 권한 인정
- 관리자 페이지에서 방명록 숨김/공개/삭제
- 관리자 페이지에서 팬아트 승인/반려/삭제
- 관리자 통계(방명록, 승인 대기 팬아트, 승인 팬아트)
- SOOP 방송 일정은 SOOP 캘린더에서 자동 조회하며 관리자 페이지에서는 원본 일정 링크 제공
- 기존 SOOP LIVE / SOOP 캘린더 / Supabase 방명록 / 팬아트 기능 유지

## Supabase 설정
1. Supabase Dashboard > Authentication > Users에서 관리자 이메일/비밀번호 계정을 생성합니다.
2. `supabase_schema.sql` 전체를 SQL Editor에서 실행합니다. 이미 기존 스키마를 실행했다면 파일의 ADMIN AUTH 부분도 실행하세요.
3. 생성된 사용자의 UUID를 `public.admin_users`에 등록합니다. 예:

```sql
insert into public.admin_users(user_id)
select id from auth.users where email = 'admin@example.com'
on conflict (user_id) do nothing;
```

4. `config.js`에는 Project URL과 Publishable key만 넣습니다. 비밀번호나 service_role/secret key는 넣지 않습니다.

## 동작
- 게스트: 로그인 없이 사이트 이용
- ADMIN: Supabase Auth 로그인 → `admin_users` 권한 확인 → 관리자 페이지 표시
- 로그아웃하면 다시 입장 선택 화면으로 돌아갑니다.

## 관리자 기능
- 방명록: 숨김/공개/삭제
- 팬아트: 승인/반려/삭제
- 팬아트 삭제 시 DB 행과 Storage 파일을 함께 삭제 시도

## 주의
`config.js`에 이메일 목록만 넣어 관리자 권한을 판별하는 방식은 사용하지 않습니다. 실제 관리자 권한은 Supabase의 `admin_users` + RLS 정책으로 보호합니다.
