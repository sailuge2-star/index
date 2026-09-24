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
  soopStreamerId: "bboringirl"
};
