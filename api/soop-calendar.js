const STREAMER_ID = "bboringirl";
const CALENDAR_API = "https://api-channel.sooplive.co.kr/v1.1/channel";

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BboringirlFanSite/1.0)",
      "Accept": "application/json,text/plain,*/*",
      "Referer": "https://play.sooplive.com/"
    }
  });
  if (!response.ok) throw new Error(`SOOP calendar HTTP ${response.status}`);
  return response.json();
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthStart(year, month) {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

function normalizeDate(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const digits = raw.replace(/\D/g, "");
  if (/^\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  const match = raw.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (match) {
    return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
  }
  return raw.slice(0, 10);
}

function normalizeTime(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const ampm = raw.match(/^(오전|오후)\s*(\d{1,2})(?::(\d{2}))?/);
  if (ampm) {
    let hour = Number(ampm[2]);
    const minute = Number(ampm[3] || 0);
    if (ampm[1] === "오후" && hour < 12) hour += 12;
    if (ampm[1] === "오전" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  return match ? `${String(match[1]).padStart(2, "0")}:${match[2]}` : raw;
}

function normalizeEvent(event) {
  const date = normalizeDate(event?.eventDate || event?.date || event?.startDate);
  const time = normalizeTime(event?.eventTime || event?.time || event?.startTime);
  if (!date) return null;
  return {
    id: String(event?.id || event?.eventId || `${date}-${time}-${event?.title || "event"}`),
    date,
    time,
    title: event?.title || "제목 없음",
    type: event?.calendarTypeName || event?.typeName || "일정"
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
    const now = new Date();
    const year = Number(req.query?.year) || now.getFullYear();
    const month = Number(req.query?.month) || now.getMonth() + 1;
    if (month < 1 || month > 12 || year < 2000 || year > 2100) {
      throw new Error("잘못된 달력 범위입니다.");
    }

    const first = monthStart(year, month);
    const gridStart = startOfWeek(first);
    const last = new Date(year, month, 0, 0, 0, 0, 0);
    const gridEnd = new Date(startOfWeek(last));
    gridEnd.setDate(gridEnd.getDate() + 6);

    const weekStarts = [];
    for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 7)) {
      weekStarts.push(new Date(cursor));
    }

    const results = await Promise.allSettled(
      weekStarts.map((week) => {
        const params = new URLSearchParams({
          view: "week",
          year: String(week.getFullYear()),
          month: String(week.getMonth() + 1),
          day: String(week.getDate()),
          userId: STREAMER_ID
        });
        return fetchJson(`${CALENDAR_API}/${encodeURIComponent(STREAMER_ID)}/calendar?${params}`);
      })
    );

    const events = [];
    let successCount = 0;
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      successCount += 1;
      const days = Array.isArray(result.value?.days) ? result.value.days : [];
      for (const day of days) {
        const dayEvents = Array.isArray(day?.events) ? day.events : [];
        for (const rawEvent of dayEvents) {
          const event = normalizeEvent(rawEvent);
          if (event) events.push(event);
        }
      }
    }

    const unique = Array.from(new Map(events.map((event) => [event.id, event])).values())
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    return res.end(JSON.stringify({
      ok: true,
      data: {
        streamerId: STREAMER_ID,
        year,
        month,
        events: unique,
        source: "SOOP channel calendar",
        weeksLoaded: successCount,
        weeksRequested: weekStarts.length
      }
    }));
  } catch (error) {
    console.error("[SOOP CALENDAR]", error);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({
      ok: false,
      error: "SOOP 방송 일정을 가져오지 못했습니다."
    }));
  }
};
