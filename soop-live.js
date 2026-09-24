(() => {
  const $ = (selector) => document.querySelector(selector);
  const config = window.BBORINGIRL_CONFIG || {};
  const card = $("#soopLiveCard");
  const scheduleCard = $("#soopScheduleCard");

  const fallbackThumb = "assets/hero-reference4.jpg";

  function setText(el, value) {
    if (el) el.textContent = value;
  }

  function formatViewers(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `${n.toLocaleString("ko-KR")}명` : "-";
  }

  function formatKoreanDate(date) {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Seoul"
    }).format(date);
  }

  function formatCountdown(target) {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return "방송 시간이 되었습니다";

    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}일 ${hours}시간 후`;
    if (hours > 0) return `${hours}시간 ${minutes}분 후`;
    return `${minutes}분 후`;
  }

  function getUpcomingSchedule() {
    const list = Array.isArray(config.soopSchedule) ? config.soopSchedule : [];

    return list
      .map(item => ({
        ...item,
        date: new Date(item?.startAt)
      }))
      .filter(item => Number.isFinite(item.date.getTime()) && item.date.getTime() > Date.now())
      .sort((a, b) => a.date - b.date)[0] || null;
  }

  function renderSchedule() {
    if (!scheduleCard) return;

    const next = getUpcomingSchedule();
    const time = $("#soopNextSchedule");
    const title = $("#soopNextScheduleTitle");
    const countdown = $("#soopNextScheduleCountdown");
    const button = $("#soopScheduleButton");

    if (!next) {
      setText(time, "등록된 예정 방송이 없습니다");
      setText(title, "방송 일정이 확정되면 config.js의 soopSchedule에 추가해주세요.");
      setText(countdown, "일정 미정");
      if (button) button.href = "https://play.sooplive.com/bboringirl";
      return;
    }

    setText(time, formatKoreanDate(next.date));
    setText(title, next.title || "다음 방송");
    setText(countdown, formatCountdown(next.date));

    if (button) {
      button.href = next.url || "https://play.sooplive.com/bboringirl";
    }
  }

  if (card) {
    const badge = $("#soopLiveBadge");
    const status = $("#soopLiveStatus");
    const title = $("#soopLiveTitle");
    const viewers = $("#soopLiveViewers");
    const broadNo = $("#soopLiveBroadNo");
    const thumbnail = $("#soopLiveThumbnail");
    const button = $("#soopLiveButton");
    const updated = $("#soopUpdated");
    const message = $("#soopLiveMessage");

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
          second: "2-digit",
          timeZone: "Asia/Seoul"
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
  }

  renderSchedule();
  setInterval(renderSchedule, 30 * 1000);
})();
