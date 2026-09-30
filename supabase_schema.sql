-- 뽀린걸 FAN SITE 보안 수정 적용 SQL
-- Supabase Dashboard > SQL Editor에서 이 파일 전체를 그대로 Run 하세요.
-- 기존 테이블 생성 SQL은 포함하지 않았으며, 이번 변경에 필요한 SQL만 들어 있습니다.

-- 1) 방명록: 익명 작성 즉시 approved 상태로 공개
ALTER TABLE public.guestbook
  ALTER COLUMN status SET DEFAULT 'approved';

-- 기존 hardened 버전의 pending 전용 INSERT 정책을 즉시 공개 방식으로 교체
DROP POLICY IF EXISTS "guestbook_public_insert" ON public.guestbook;
CREATE POLICY "guestbook_public_insert"
ON public.guestbook FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'approved'
  AND char_length(trim(nickname)) BETWEEN 1 AND 30
  AND char_length(trim(message)) BETWEEN 1 AND 500
);

-- 2) 팬아트: 보안 강화 설정 유지
-- 팬아트 DB 행은 pending 상태로만 접수
DROP POLICY IF EXISTS "fanart_public_insert_pending" ON public.fanart;
CREATE POLICY "fanart_public_insert_pending"
ON public.fanart FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND char_length(trim(nickname)) BETWEEN 1 AND 30
  AND char_length(trim(title)) BETWEEN 1 AND 80
  AND (description IS NULL OR char_length(description) <= 300)
);

-- fanart Storage 버킷: 공개 읽기, 최대 6MB, 이미지 MIME만 허용
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fanart', 'fanart', true, 6291456, ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 6291456,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif'];

DROP POLICY IF EXISTS "fanart_storage_public_upload" ON storage.objects;
CREATE POLICY "fanart_storage_public_upload"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'fanart'
  AND name LIKE 'submissions/%'
  AND lower(coalesce(metadata->>'mimetype','')) IN ('image/png','image/jpeg','image/webp','image/gif')
  AND coalesce((metadata->>'size')::bigint, 0) BETWEEN 1 AND 6291456
);
