(() => {
  const grid = document.getElementById("soopCalendarGrid");
  const title = document.getElementById("soopCalendarTitle");
  const status = document.getElementById("soopCalendarStatus");
  const prev = document.getElementById("soopCalendarPrev");
  const next = document.getElementById("soopCalendarNext");
  const todayButton = document.getElementById("soopCalendarToday");
  if (!grid || !title) return;

  const formatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });
  const dayFormatter = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" });
  let cursor = new Date();
  cursor.setDate(1);
  let events = [];
  let loading = false;

  const pad = (n) => String(n).padStart(2, "0");
  const key = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[ch]));

  function monthDays(year, month) {
    const first = new Date(year, month, 1);
    const startDay = (first.getDay() + 6) % 7; // Monday = 0
    const last = new Date(year, month + 1, 0);
    const count = last.getDate();
    const cells = [];
    for (let i = 0; i < startDay; i += 1) cells.push(null);
    for (let day = 1; day <= count; day += 1) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function formatEventTime(event) {
    if (!event.time) return "시간 미정";
    const match = String(event.time).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return event.time;
    const hour = Number(match[1]);
    const minute = match[2];
    const ampm = hour < 12 ? "오전" : "오후";
    const h = hour % 12 || 12;
    return `${ampm} ${h}:${minute}`;
  }

  function render() {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    title.textContent = formatter.format(cursor);
    grid.innerHTML = "";

    const todayKey = key(new Date());
    const cells = monthDays(year, month);
    const byDate = new Map();
    events.forEach((event) => {
      if (!byDate.has(event.date)) byDate.set(event.date, []);
      byDate.get(event.date).push(event);
    });

    cells.forEach((date, index) => {
      const cell = document.createElement("div");
      cell.className = "soop-calendar-day";
      if (!date) {
        cell.classList.add("is-empty");
        grid.appendChild(cell);
        return;
      }

      const dateKey = key(date);
      if (dateKey === todayKey) cell.classList.add("is-today");
      if (date.getDay() === 0) cell.classList.add("is-sunday");
      if (date.getDay() === 6) cell.classList.add("is-saturday");

      const dayEvents = byDate.get(dateKey) || [];
      dayEvents.sort((a, b) => String(a.time).localeCompare(String(b.time)));

      const header = document.createElement("div");
      header.className = "soop-calendar-day-head";
      header.innerHTML = `<span>${date.getDate()}</span>${dateKey === todayKey ? '<em>오늘</em>' : ''}`;
      cell.appendChild(header);

      const eventList = document.createElement("div");
      eventList.className = "soop-calendar-events";
      if (!dayEvents.length) {
        eventList.innerHTML = '<span class="soop-calendar-empty">일정 없음</span>';
      } else {
        dayEvents.forEach((event) => {
          const item = document.createElement("a");
          item.className = "soop-calendar-event";
          item.href = `https://play.sooplive.com/bboringirl`;
          item.target = "_blank";
          item.rel = "noreferrer";
          item.title = `${dayFormatter.format(date)} ${formatEventTime(event)} · ${event.title}`;
          item.innerHTML = `
            <span class="soop-event-type">${escapeHtml(event.type || "일정")}</span>
            <strong>${escapeHtml(formatEventTime(event))}</strong>
            <b>${escapeHtml(event.title)}</b>
          `;
          eventList.appendChild(item);
        });
      }
      cell.appendChild(eventList);
      grid.appendChild(cell);
    });
  }

  async function load(monthDate = cursor) {
    if (loading) return;
    loading = true;
    status.textContent = "SOOP 캘린더 일정을 확인하는 중…";
    try {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;
      const response = await fetch(`/api/soop-calendar?year=${year}&month=${month}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "SOOP 일정 API 오류");
      events = Array.isArray(result.data?.events) ? result.data.events : [];
      render();
      status.textContent = events.length
        ? `SOOP 캘린더에서 ${events.length}개의 일정을 불러왔습니다. 약 2분마다 자동 갱신됩니다.`
        : "이 달에는 SOOP 캘린더에 등록된 일정이 없습니다. 일정이 등록되면 자동으로 표시됩니다.";
    } catch (error) {
      console.error("[SOOP CALENDAR]", error);
      events = [];
      render();
      status.textContent = "SOOP 캘린더 일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
    } finally {
      loading = false;
    }
  }

  prev?.addEventListener("click", () => {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    load();
  });
  next?.addEventListener("click", () => {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    load();
  });
  todayButton?.addEventListener("click", () => {
    const now = new Date();
    cursor = new Date(now.getFullYear(), now.getMonth(), 1);
    load();
  });

  load();
  setInterval(() => load(cursor), 2 * 60 * 1000);
})();
