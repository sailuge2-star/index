/*
 * Supabase 연결 설정
 *
 * 1. Supabase 프로젝트를 만든 뒤
 * 2. Project Settings > API에서 Project URL과 Publishable key(구 anon key)를 확인하고
 * 3. 아래 두 값을 입력하세요.
 *
 * Publishable/anon key만 브라우저에 넣으세요.
 * service_role / secret key는 절대 넣으면 안 됩니다.
 */
window.BBORINGIRL_CONFIG = {
  supabaseUrl: "https://vuwcpbzpzaqimkuyhmwg.supabase.co",
  supabaseKey: "sb_publishable_aGEE_yh1dJSeApTUoOF_7g_HX79CDnv",

  // SOOP 공개 방송 상태 조회에 사용할 스트리머 ID
  soopStreamerId: "bboringirl",

  // 방송 일정
  // ISO 8601 형식(KST)을 사용하세요. 예: "2026-10-03T20:00:00+09:00"
  // 여러 일정을 넣을 수 있으며, 현재 시각 이후의 가장 가까운 일정이 자동으로 표시됩니다.
  soopSchedule: [
    // { startAt: "2026-10-03T20:00:00+09:00", title: "3000일 기념 방송" }
  ]
};
