const STREAMER_ID = "bboringirl";
const LIVE_API = "https://live.sooplive.co.kr/afreeca/player_live_api.php";
const STATION_STATUS_API = "https://st.sooplive.co.kr/api/get_station_status.php";

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BboringirlFanSite/1.0)",
      "Accept": "application/json,text/plain,*/*",
      "Referer": "https://play.sooplive.com/",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`SOOP upstream HTTP ${response.status}`);
  return response.json();
}


const MAIN_BROAD_LIST_API =
  "https://live.sooplive.com/api/main_broad_list_api.php";

async function fetchMainBroadInfo(streamerId) {
  // SOOP의 라이브 목록 API가 실제 사이트 사이드바에서 사용하는
  // `total_view_cnt` 값을 가져오도록 보조 조회합니다.
  // 1페이지에 없는 경우를 대비해 상위 10페이지까지 병렬 조회합니다.
  const pageNumbers = Array.from({ length: 10 }, (_, index) => index + 1);

  const results = await Promise.allSettled(
    pageNumbers.map((pageNo) => {
      const url = new URL(MAIN_BROAD_LIST_API);
      url.searchParams.set("selectType", "action");
      url.searchParams.set("selectValue", "all");
      url.searchParams.set("orderType", "view_cnt");
      url.searchParams.set("pageNo", String(pageNo));
      url.searchParams.set("lang", "ko_KR");
      return fetchJson(url.toString());
    })
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;

    const rows = Array.isArray(result.value?.broad)
      ? result.value.broad
      : [];

    const match = rows.find(
      (row) => String(row?.user_id || "").toLowerCase() === String(streamerId).toLowerCase()
    );

    if (match) return match;
  }

  return null;
}

function normalizeLiveInfo(liveJson, stationJson, mainBroadInfo = null) {
  const channel = liveJson?.CHANNEL || {};
  const stationData = stationJson?.data || stationJson?.DATA || stationJson || {};
  const liveList =
    stationData?.liveBroadInfo ||
    stationData?.live_broad_info ||
    stationData?.liveBroad ||
    stationData?.live_broad ||
    [];

  const liveInfo = Array.isArray(liveList) ? (liveList[0] || null) : liveList;
  const result = Number(channel.RESULT);

  const isLive =
    result === 1 ||
    Boolean(liveInfo && (
      liveInfo.broad_no ||
      liveInfo.broadNo ||
      liveInfo.view_cnt !== undefined ||
      liveInfo.broad_title
    )) ||
    Boolean(mainBroadInfo && (
      mainBroadInfo.broad_no ||
      mainBroadInfo.broadNo ||
      mainBroadInfo.broad_title ||
      mainBroadInfo.total_view_cnt !== undefined
    ));

  if (!isLive) {
    return {
      isLive: false,
      streamerId: STREAMER_ID,
      title: "",
      viewers: 0,
      thumbnail: "",
      broadNo: "",
      url: `https://play.sooplive.com/${STREAMER_ID}`
    };
  }

  const broadNo = String(
    channel.BNO ||
    channel.broad_no ||
    liveInfo?.broad_no ||
    liveInfo?.broadNo ||
    mainBroadInfo?.broad_no ||
    mainBroadInfo?.broadNo ||
    ""
  );

  const title =
    channel.TITLE ||
    liveInfo?.broad_title ||
    liveInfo?.title ||
    mainBroadInfo?.broad_title ||
    mainBroadInfo?.title ||
    stationData?.station_title ||
    "현재 방송 중";

  // 중요: player_live_api.php의 `total_view_cnt`는 이 응답에서는
  // 방송 누적/집계성 숫자로 들어올 수 있으므로 현재 동시 시청자 수로 사용하지 않습니다.
  // 현재 방송 화면에서 사용하는 실시간 시청자 수는 `current_view_cnt`를 우선합니다.
  // 모바일 분량 필드가 별도로 제공되는 경우에는 PC + 모바일을 합산합니다.
  const currentPcViewers = numberOrNull(
    liveInfo?.current_view_cnt ??
    liveInfo?.currentViewCnt ??
    stationData?.current_view_cnt ??
    stationData?.currentViewCnt ??
    channel.current_view_cnt ??
    channel.currentViewCnt
  );

  const mobileViewers = numberOrNull(
    liveInfo?.mobile_view_cnt ??
    liveInfo?.mobileViewCnt ??
    liveInfo?.mobile_viewers ??
    liveInfo?.mobileViewers ??
    stationData?.mobile_view_cnt ??
    stationData?.mobileViewCnt ??
    stationData?.mobile_viewers ??
    stationData?.mobileViewers ??
    channel.mobile_view_cnt ??
    channel.mobileViewCnt
  );

  // 현재 동시 시청자 필드가 없으면 잘못된 누적/집계 숫자를 대신 표시하지 않습니다.
  // 현재 동시 시청자 수는 SOOP 라이브 목록 API의 `total_view_cnt`를
  // 최우선으로 사용합니다. 이 API는 SOOP 사이트의 라이브 목록/사이드바에서도
  // 해당 필드를 현재 방송 시청자 수로 사용합니다.
  const mainListViewers = numberOrNull(mainBroadInfo?.total_view_cnt);

  const viewers =
    mainListViewers !== null
      ? mainListViewers
      : (
          currentPcViewers !== null
            ? currentPcViewers + (mobileViewers ?? 0)
            : null
        );

  const thumbnail =
    liveInfo?.thumbnail ||
    liveInfo?.thumb ||
    (broadNo ? `https://liveimg.sooplive.com/m/${broadNo}` : "");

  return {
    isLive: true,
    streamerId: STREAMER_ID,
    title,
    viewers,
    viewerSource:
      mainListViewers !== null
        ? "main_broad_list.total_view_cnt"
        : (
            currentPcViewers !== null
              ? (mobileViewers !== null ? "current_view_cnt+mobile_view_cnt" : "current_view_cnt")
              : "unavailable"
          ),
    thumbnail,
    broadNo,
    url: broadNo
      ? `https://play.sooplive.com/${STREAMER_ID}/${broadNo}`
      : `https://play.sooplive.com/${STREAMER_ID}`
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: false, error: "Method Not Allowed" }));
  }

  try {
    const stationUrl = `${STATION_STATUS_API}?szBjId=${encodeURIComponent(STREAMER_ID)}`;
    const liveUrl = LIVE_API;
    const liveBody = new URLSearchParams({
      bid: STREAMER_ID,
      from_api: "0",
      mode: "landing",
      player_type: "html5",
      stream_type: "common",
      type: "live",
      bno: "",
      pwd: ""
    }).toString();

    // 두 공개 조회를 병렬로 호출합니다.
    const [stationResult, liveResult, mainListResult] = await Promise.allSettled([
      fetchJson(stationUrl),
      fetchJson(liveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: liveBody
      }),
      fetchMainBroadInfo(STREAMER_ID)
    ]);

    const stationJson = stationResult.status === "fulfilled" ? stationResult.value : null;
    const liveJson = liveResult.status === "fulfilled" ? liveResult.value : null;
    const mainBroadInfo = mainListResult.status === "fulfilled"
      ? mainListResult.value
      : null;

    if (!stationJson && !liveJson && !mainBroadInfo) {
      throw new Error("SOOP API 응답을 받을 수 없습니다.");
    }

    const data = normalizeLiveInfo(liveJson, stationJson, mainBroadInfo);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.end(JSON.stringify({ ok: true, data }));
  } catch (error) {
    console.error("[SOOP API]", error);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({
      ok: false,
      error: "SOOP 방송 정보를 가져오지 못했습니다."
    }));
  }
};
