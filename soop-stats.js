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

  const kstDay = date => new Date(date.getTime()+9*3600000).toISOString().slice(0,10);
  function aggregate(samples) {
    const byDay=new Map();
    for(const row of samples){
      const date=new Date(row.sampled_at),n=Number(row.viewers);
      if(!row.sampled_at||Number.isNaN(date.getTime())||row.viewers==null||row.viewers===''||!Number.isFinite(n)||n<0)continue;
      const key=kstDay(date),v=byDay.get(key)||{sum:0,count:0,peak:0};
      v.sum+=n;v.count++;v.peak=Math.max(v.peak,n);byDay.set(key,v);
    }
    return [...byDay].sort(([a],[b])=>a.localeCompare(b)).map(([date,v])=>({date,label:`${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`,peak:v.peak,average:Math.round(v.sum/v.count)}));
  }
  let selectedMonth=(()=>{const day=kstDay(new Date());return {year:Number(day.slice(0,4)),month:Number(day.slice(5,7))};})();
  function monthRange(year,month){return {start:new Date(Date.UTC(year,month-1,1)-9*3600000),end:new Date(Date.UTC(year,month,1)-9*3600000)};}
  async function samplesBetween(start,end){
    const all=[];let offset=0;
    for(;;){
      const {data,error}=await sb.from('soop_viewer_samples').select('viewers,sampled_at')
        .eq('streamer_id',config.soopStreamerId||'bboringirl').gte('sampled_at',start.toISOString()).lt('sampled_at',end.toISOString())
        .order('sampled_at',{ascending:true}).range(offset,offset+499);
      if(error)throw error;
      if(!data?.length)return all;
      all.push(...data);offset+=data.length;
    }
  }
  let loadVersion=0;
  async function loadStats(){
    const version=++loadVersion,{year,month}=selectedMonth;
    if(!sb){setEmpty(peakChart,'Supabase 연결 후 통계가 표시됩니다.');setEmpty(averageChart,'Supabase 연결 후 통계가 표시됩니다.');status.textContent='Supabase 설정을 확인해주세요.';return;}
    try{
      const {start,end}=monthRange(year,month),today=kstDay(new Date());
      const todayStart=new Date(today+'T00:00:00+09:00'),todayEnd=new Date(todayStart.getTime()+86400000);
      const sameMonth=todayStart>=start&&todayStart<end;
      const [samples,todaySamples]=await Promise.all([samplesBetween(start,end),sameMonth?Promise.resolve(null):samplesBetween(todayStart,todayEnd)]);
      if(version!==loadVersion)return;
      const rows=aggregate(samples),todayRow=aggregate(todaySamples??samples).find(r=>r.date===today);
      peakTotal.textContent=todayRow?`${fmt(todayRow.peak)}명`:'-';
      peakTotal.title=`${today} 한국 시간 기준 오늘 최고 시청자 수${todayRow?'':' · 수집 기록 없음'}`;
      averageTotal.textContent=rows.length?`${fmt(Math.round(rows.reduce((sum,r)=>sum+r.average,0)/rows.length))}명`:'-';
      peakNote.textContent=`그래프: ${year}년 ${month}월 날짜별 최고 · 상단 숫자: 오늘(${today}) 최고${todayRow?'':' · 오늘 수집 기록 없음'}`;
      averageNote.textContent=`${year}년 ${month}월의 일자별 평균 시청자 수`;
      drawLineChart(peakChart,rows,'peak','최고 시청자');drawLineChart(averageChart,rows,'average','평균 시청자');
      status.textContent=`한국 시간 기준 · DB 수집 기록${rows.length?'':' · 선택한 달의 기록 없음'} · 마지막 갱신 ${new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'}).format(new Date())}`;
    }catch(error){
      if(version!==loadVersion)return;
      console.error('[SOOP STATS]',error);peakTotal.textContent='-';averageTotal.textContent='-';
      setEmpty(peakChart,'통계 데이터를 불러오지 못했습니다.');setEmpty(averageChart,'통계 데이터를 불러오지 못했습니다.');
      status.textContent='통계 데이터를 불러오지 못했습니다. Supabase 테이블과 정책을 확인해주세요.';
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
