(() => {
  const $ = (selector) => document.querySelector(selector);

  const card = $("#soopLiveCard");
  if (!card) return;

  const badge = $("#soopLiveBadge");
  const status = $("#soopLiveStatus");
  const title = $("#soopLiveTitle");
  const viewers = $("#soopLiveViewers");
  const broadNo = $("#soopLiveBroadNo");
  const thumbnail = $("#soopLiveThumbnail");
  const button = $("#soopLiveButton");
  const updated = $("#soopUpdated");
  const message = $("#soopLiveMessage");

  const fallbackThumb = "assets/hero-reference4.jpg";

  function setText(el, value) {
    if (el) el.textContent = value;
  }

  function formatViewers(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `${n.toLocaleString("ko-KR")}명` : "-";
  }

  function render(data) {
    const live = Boolean(data?.isLive);

    badge?.classList.toggle("is-live", live);
    badge?.classList.toggle("is-offline", !live);

    setText(badge, live ? "LIVE 방송 중" : "OFFLINE");
    setText(status, live ? "방송 중" : "방송 종료");
    setText(title, live ? (data.title || "현재 방송 중") : "현재 방송이 없습니다");
    setText(viewers, live ? formatViewers(data.viewers) : "0명");
    setText(broadNo, live ? (data.broadNo || "-") : "-");

    if (thumbnail) {
      thumbnail.src = data.thumbnail || fallbackThumb;
      thumbnail.alt = live
        ? `${data.title || "뽀린걸"} 방송 썸네일`
        : "현재 방송이 없는 상태";
    }

    if (button) {
      button.href = data.url || "https://play.sooplive.com/bboringirl";
      button.textContent = live ? "방송 보러가기 ↗" : "SOOP 채널 보기 ↗";
    }

    setText(
      message,
      live
        ? "현재 SOOP에서 방송 중입니다. 방송 정보는 약 60초마다 자동으로 갱신됩니다."
        : "현재 방송 중이 아닙니다. 방송이 시작되면 상태와 제목, 시청자 수가 자동으로 표시됩니다."
    );

    setText(
      updated,
      `마지막 확인 ${new Intl.DateTimeFormat("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date())}`
    );
  }

  async function loadSoopLive() {
    try {
      const response = await fetch("/api/soop", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "SOOP API 오류");
      }

      render(result.data);
    } catch (error) {
      console.error("[SOOP LIVE]", error);
      setText(badge, "연결 오류");
      badge?.classList.remove("is-live", "is-offline");
      setText(status, "확인 실패");
      setText(title, "SOOP 방송 정보를 불러오지 못했습니다");
      setText(viewers, "-");
      setText(broadNo, "-");
      setText(updated, "잠시 후 자동 재시도");
      setText(message, "SOOP 서버 또는 배포 환경의 일시적인 응답 문제일 수 있습니다.");
    }
  }

  loadSoopLive();
  setInterval(loadSoopLive, 60 * 1000);
})();
