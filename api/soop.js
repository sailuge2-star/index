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

function normalizeLiveInfo(liveJson, stationJson) {
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
    ""
  );

  const title =
    channel.TITLE ||
    liveInfo?.broad_title ||
    liveInfo?.title ||
    stationData?.station_title ||
    "현재 방송 중";

  const viewers = numberOrNull(
    liveInfo?.view_cnt ??
    liveInfo?.total_view_cnt ??
    stationData?.view_cnt ??
    stationData?.total_view_cnt
  ) ?? 0;

  const thumbnail =
    liveInfo?.thumbnail ||
    liveInfo?.thumb ||
    (broadNo ? `https://liveimg.sooplive.com/m/${broadNo}` : "");

  return {
    isLive: true,
    streamerId: STREAMER_ID,
    title,
    viewers,
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
    const [stationResult, liveResult] = await Promise.allSettled([
      fetchJson(stationUrl),
      fetchJson(liveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: liveBody
      })
    ]);

    const stationJson = stationResult.status === "fulfilled" ? stationResult.value : null;
    const liveJson = liveResult.status === "fulfilled" ? liveResult.value : null;

    if (!stationJson && !liveJson) {
      throw new Error("SOOP API 응답을 받을 수 없습니다.");
    }

    const data = normalizeLiveInfo(liveJson, stationJson);

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
