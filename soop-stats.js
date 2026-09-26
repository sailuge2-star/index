(() => {
  const config = window.BBORINGIRL_CONFIG || {};
  const hasSupabase = Boolean(window.supabase && config.supabaseUrl && config.supabaseKey);
  const sb = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabaseKey) : null;

  const peakChart = document.getElementById("soopPeakChart");
  const averageChart = document.getElementById("soopAverageChart");
  const peakTotal = document.getElementById("soopPeakTotal");
  const averageTotal = document.getElementById("soopAverageTotal");
  const peakNote = document.getElementById("soopPeakNote");
  const averageNote = document.getElementById("soopAverageNote");
  const status = document.getElementById("soopStatsStatus");
  if (!peakChart || !averageChart) return;

  const fmt = (n) => Number(n || 0).toLocaleString("ko-KR");
  const dayFmt = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" });

  function setEmpty(svg, text) {
    svg.innerHTML = `<text x="360" y="125" text-anchor="middle">${escapeHtml(text)}</text>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[ch]));
  }

  function drawLineChart(svg, rows, valueKey, label) {
    if (!rows.length) {
      setEmpty(svg, "아직 수집된 시청자 데이터가 없습니다.");
      return;
    }

    const W = 720, H = 250;
    const pad = { l: 52, r: 18, t: 18, b: 40 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const values = rows.map(r => Number(r[valueKey]) || 0);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = Math.max(max - min, 1);

    const x = i => pad.l + (rows.length === 1 ? iw / 2 : (i / (rows.length - 1)) * iw);
    const y = v => pad.t + ih - ((v - min) / range) * ih;

    const points = rows.map((r, i) => [x(i), y(Number(r[valueKey]) || 0)]);
    const line = points.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const area = `${line} L ${points[points.length - 1][0].toFixed(1)} ${(pad.t + ih).toFixed(1)} L ${points[0][0].toFixed(1)} ${(pad.t + ih).toFixed(1)} Z`;

    const grid = [0, .25, .5, .75, 1].map(t => {
      const yy = pad.t + ih * (1 - t);
      const val = min + range * t;
      return `<line class="grid" x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}"/>
              <text x="${pad.l-9}" y="${yy+4}" text-anchor="end">${Math.round(val).toLocaleString("ko-KR")}</text>`;
    }).join("");

    const step = rows.length <= 7 ? 1 : Math.ceil(rows.length / 7);
    const labels = rows.map((r, i) => {
      if (i !== 0 && i !== rows.length - 1 && i % step !== 0) return "";
      return `<text x="${x(i)}" y="${H-12}" text-anchor="middle">${escapeHtml(r.label)}</text>`;
    }).join("");

    const dots = points.map((p, i) => {
      const val = Number(rows[i][valueKey]) || 0;
      return `<circle class="dot" cx="${p[0]}" cy="${p[1]}" r="4">
        <title>${escapeHtml(rows[i].label)} · ${fmt(val)}명</title>
      </circle>`;
    }).join("");

    svg.innerHTML = `
      <line class="axis" x1="${pad.l}" y1="${pad.t+ih}" x2="${W-pad.r}" y2="${pad.t+ih}"/>
      ${grid}
      <path class="area" d="${area}"></path>
      <path class="line" d="${line}"></path>
      ${dots}
      ${labels}
      <text x="${W-pad.r}" y="${pad.t+2}" text-anchor="end" class="value">${escapeHtml(label)}</text>
    `;
  }

  function aggregate(samples) {
    const byDay = new Map();
    samples.forEach(row => {
      const date = new Date(row.sampled_at);
      if (Number.isNaN(date.getTime())) return;
      // 캘린더와 동일하게 브라우저의 현지 날짜(KST)를 기준으로 일자를 묶습니다.
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (!byDay.has(key)) byDay.set(key, []);
      const n = Number(row.viewers);
      if (Number.isFinite(n) && n >= 0) byDay.get(key).push(n);
    });

    return [...byDay.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([date, values]) => ({
      date,
      label: dayFmt.format(new Date(`${date}T00:00:00`)),
      peak: Math.max(...values),
      average: Math.round(values.reduce((a,b) => a+b, 0) / values.length)
    }));
  }

  let selectedMonth = (() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  })();

  function monthRange(year, month) {
    // 캘린더와 같은 현지 시간 기준으로 해당 월의 시작/끝을 만듭니다.
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0, 0);
    return { start, end };
  }

  async function loadStats() {
    if (!sb) {
      setEmpty(peakChart, "Supabase 연결 후 통계가 표시됩니다.");
      setEmpty(averageChart, "Supabase 연결 후 통계가 표시됩니다.");
      status.textContent = "Supabase 설정을 확인해주세요.";
      return;
    }

    try {
      const { start, end } = monthRange(selectedMonth.year, selectedMonth.month);

      const { data, error } = await sb
        .from("soop_viewer_samples")
        .select("viewers,sampled_at")
        .eq("streamer_id", config.soopStreamerId || "bboringirl")
        .gte("sampled_at", start.toISOString())
        .lt("sampled_at", end.toISOString())
        .order("sampled_at", { ascending: true })
        .limit(10000);

      if (error) throw error;

      const rows = aggregate(data || []);
      if (!rows.length) {
        setEmpty(peakChart, "아직 수집된 시청자 데이터가 없습니다.");
        setEmpty(averageChart, "아직 수집된 시청자 데이터가 없습니다.");
        peakTotal.textContent = "-";
        averageTotal.textContent = "-";
        peakNote.textContent = "방송 중인 동안 시청자 데이터를 자동으로 수집합니다.";
        averageNote.textContent = "방송 중인 동안 시청자 데이터를 자동으로 수집합니다.";
        status.textContent = `${selectedMonth.year}년 ${selectedMonth.month}월에 수집된 방송 데이터가 없습니다.`;
        return;
      }

      const peak = Math.max(...rows.map(r => r.peak));
      const avg = Math.round(rows.reduce((sum, r) => sum + r.average, 0) / rows.length);

      peakTotal.textContent = `${fmt(peak)}명`;
      averageTotal.textContent = `${fmt(avg)}명`;
      peakNote.textContent = `${selectedMonth.year}년 ${selectedMonth.month}월의 일자별 최고 시청자 수`;
      averageNote.textContent = `${selectedMonth.year}년 ${selectedMonth.month}월의 일자별 평균 시청자 수`;

      drawLineChart(peakChart, rows, "peak", "최고 시청자");
      drawLineChart(averageChart, rows, "average", "평균 시청자");
      status.textContent = `${selectedMonth.year}년 ${selectedMonth.month}월 데이터를 기준으로 표시합니다. 마지막 갱신 ${new Intl.DateTimeFormat("ko-KR", { hour:"2-digit", minute:"2-digit" }).format(new Date())}`;
    } catch (error) {
      console.error("[SOOP STATS]", error);
      setEmpty(peakChart, "통계 데이터를 불러오지 못했습니다.");
      setEmpty(averageChart, "통계 데이터를 불러오지 못했습니다.");
      status.textContent = "통계 데이터를 불러오지 못했습니다. Supabase 테이블과 정책을 확인해주세요.";
    }
  }

  window.addEventListener("soop:live-updated", () => loadStats());
  window.addEventListener("soop:calendar-month-changed", (event) => {
    const year = Number(event.detail?.year);
    const month = Number(event.detail?.month);
    if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
      selectedMonth = { year, month };
      loadStats();
    }
  });
  loadStats();
  setInterval(loadStats, 5 * 60 * 1000);
})();
