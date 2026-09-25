const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];

const menuToggle = $('.menu-toggle');
const nav = $('.nav');
menuToggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
});
$$('.nav a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

const modal = $('#modal');
const modalBody = $('#modalBody');
const modalData = {
  2018: ['2018 · 시작', '2018년 7월 18일 첫 방송, 8월 유튜브 채널 개설. 팬사이트에서는 이 해를 뽀린걸 방송 역사의 시작점으로 기록합니다.'],
  2019: ['2019 · 커뮤니티', '2019년 6월 팬카페가 개설되고, 7월 18일 방송 1주년을 맞았습니다.'],
  2021: ['2021 · 1000일', '2021년 4월 13일(?) 1000일, 7월 18일 방송 3주년 기록이 공개 자료에 남아 있습니다.'],
  2024: ['2024 · 버추얼', '2024년 1월 7일 2000일. 4월 1일 버추얼 데뷔, 4월 16일 메인 아바타 공개 기록이 있습니다.'],
  2025: ['2025 · 다음 장면', '2025년 7월 18일 방송 7주년, 10월 5일 메인 아바타 V2 공개 기록이 있습니다. 3000일 특별전은 이 사이트 시안의 기념 기준을 별도로 표시합니다.']
};
$$('.timeline-item').forEach(btn => btn.addEventListener('click', () => {
  const d = modalData[btn.dataset.modal];
  modalBody.innerHTML = `<span class="kicker">${d[0].split(' · ')[0]}</span><h2 style="margin:8px 0 14px">${d[0]}</h2><p style="color:#716572">${d[1]}</p>`;
  modal.showModal();
}));
$('.modal-close')?.addEventListener('click', () => modal.close());

$('#shuffleGallery')?.addEventListener('click', () => {
  // 버튼 클릭 시점에 갤러리 카드를 다시 가져옵니다.
  // Supabase/데모에서 나중에 추가된 팬아트도 모두 포함됩니다.
  const galleryCards = $$('.gallery-card');
  galleryCards.forEach((el, i) => {
    el.style.transition = 'transform .25s ease';
    el.style.transform = `rotate(${(Math.random() - .5) * 2.4}deg) translateY(${(Math.random() - .5) * 6}px)`;
  });
});

const sections = $$('main section[id]');
const navLinks = $$('.nav a');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
  });
}, {rootMargin:'-25% 0px -65% 0px'});
sections.forEach(s => observer.observe(s));

/* =========================
   Supabase community layer
   ========================= */
const SUPABASE_URL = window.BBORINGIRL_CONFIG?.supabaseUrl?.trim();
const SUPABASE_KEY = window.BBORINGIRL_CONFIG?.supabaseKey?.trim();
const hasBackend = Boolean(SUPABASE_URL && SUPABASE_KEY && window.supabase);
const sb = hasBackend ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const demoGuestKey = 'bboringirl_guestbook_demo_v2';
const demoArtKey = 'bboringirl_fanart_demo_v2';

const guestList = $('#guestbookList');
const guestStatus = $('#guestbookStatus');
const guestForm = $('#guestbookForm');
const fanartModal = $('#fanartModal');
const fanartForm = $('#fanartForm');
const fanartStatus = $('#artFormStatus');
const artPreview = $('#artPreview');

function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function formatDate(value) {
  try { return new Intl.DateTimeFormat('ko-KR', {year:'numeric', month:'short', day:'numeric'}).format(new Date(value)); }
  catch { return ''; }
}
function setGuestStatus(text) { if (guestStatus) guestStatus.textContent = text; }
function renderGuestbook(rows=[]) {
  if (!guestList) return;
  if (!rows.length) { guestList.innerHTML = '<div class="empty-state">아직 첫 메시지가 없어요.<br>3000일 축하 한마디를 가장 먼저 남겨주세요 ♡</div>'; return; }
  guestList.innerHTML = rows.map(row => `<article class="guestbook-item"><header><b>♡ ${escapeHtml(row.nickname)}</b><time>${formatDate(row.created_at)}</time></header><p>${escapeHtml(row.message)}</p></article>`).join('');
}
function demoGuests() {
  try { return JSON.parse(localStorage.getItem(demoGuestKey) || '[]'); } catch { return []; }
}
function saveDemoGuest(row) {
  const rows = [row, ...demoGuests()].slice(0, 50);
  localStorage.setItem(demoGuestKey, JSON.stringify(rows));
  return rows;
}
async function loadGuestbook() {
  setGuestStatus(hasBackend ? '최신 메시지를 불러오는 중…' : '현재 브라우저에서 데모 저장 중');
  if (!hasBackend) { renderGuestbook(demoGuests()); return; }
  const { data, error } = await sb.from('guestbook').select('id,nickname,message,created_at').eq('status','approved').order('created_at',{ascending:false}).limit(50);
  if (error) { console.error(error); setGuestStatus('방명록 연결을 확인해주세요'); renderGuestbook([]); return; }
  setGuestStatus(`${data.length}개의 메시지`); renderGuestbook(data);
}

guestForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if ($('#website')?.value) return;
  const nickname = $('#guestNickname').value.trim();
  const message = $('#guestMessage').value.trim();
  if (!nickname || !message) return;
  if (message.length > 500) return alert('메시지는 500자 이하로 작성해주세요.');
  const button = guestForm.querySelector('button[type=submit]');
  button.disabled = true; button.textContent = '등록 중…';
  try {
    if (!hasBackend) {
      renderGuestbook(saveDemoGuest({id:crypto.randomUUID?.() || String(Date.now()), nickname, message, created_at:new Date().toISOString()}));
      guestForm.reset(); alert('데모 방명록에 저장되었습니다. Supabase를 연결하면 실제 방문자에게 공유됩니다.');
    } else {
      const { error } = await sb.from('guestbook').insert({nickname, message, status:'approved'});
      if (error) throw error;
      guestForm.reset(); await loadGuestbook(); alert('방명록이 등록되었습니다 ♡');
    }
  } catch (err) {
    console.error(err); alert('등록에 실패했습니다. 잠시 후 다시 시도해주세요.');
  } finally { button.disabled = false; button.textContent = '방명록 등록'; }
});

$('#messageBtn')?.addEventListener('click', () => document.querySelector('#guestbook')?.scrollIntoView({behavior:'smooth'}));
$('#fanartOpenBtn')?.addEventListener('click', () => fanartModal?.showModal());
$('#fanartClose')?.addEventListener('click', () => fanartModal?.close());
$('#artFile')?.addEventListener('change', () => {
  const file = $('#artFile').files?.[0];
  if (!file) return;
  if (file.size > 6 * 1024 * 1024) { alert('이미지는 6MB 이하만 올릴 수 있습니다.'); $('#artFile').value=''; return; }
  const url = URL.createObjectURL(file);
  artPreview.hidden = false;
  artPreview.innerHTML = `<img src="${url}" alt="팬아트 미리보기">`;
});
function demoArts() { try { return JSON.parse(localStorage.getItem(demoArtKey) || '[]'); } catch { return []; } }
function saveDemoArt(row) { const rows=[row,...demoArts()].slice(0,20); localStorage.setItem(demoArtKey,JSON.stringify(rows)); return rows; }
function renderArts(rows=[]) {
  const grid = $('#galleryGrid');
  if (!grid) return;

  // 기본 갤러리 4장은 항상 유지하고, 이전에 렌더링한 동적 팬아트만 새로 교체합니다.
  grid.querySelectorAll('.gallery-card[data-dynamic-gallery="true"]').forEach(el => el.remove());

  if (!rows.length) return;

  const fragment = document.createDocumentFragment();
  rows.forEach(row => {
    const card = document.createElement('figure');
    card.className = 'gallery-card';
    card.dataset.dynamicGallery = 'true';
    card.style.backgroundImage = `url("${String(row.image_url || '').replace(/"/g, '&quot;')}")`;

    const caption = document.createElement('figcaption');
    const title = document.createElement('b');
    title.textContent = row.title || '팬아트';
    const author = document.createElement('span');
    author.textContent = `by ${row.nickname || '익명'}`;
    caption.append(title, author);
    card.appendChild(caption);
    fragment.appendChild(card);
  });
  grid.appendChild(fragment);
}

async function fetchAllApprovedArts() {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await sb
      .from('fanart')
      .select('id,nickname,title,description,image_path,created_at')
      .eq('status','approved')
      .order('created_at',{ascending:false})
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function loadArts() {
  if (!hasBackend) { renderArts(demoArts()); return; }
  try {
    const data = await fetchAllApprovedArts();
    const rows = data.map(row => ({
      ...row,
      image_url: sb.storage.from('fanart').getPublicUrl(row.image_path).data.publicUrl
    }));
    renderArts(rows);
  } catch (error) {
    console.error(error);
  }
}
fanartForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nickname=$('#artNickname').value.trim(), title=$('#artTitle').value.trim(), description=$('#artDescription').value.trim(), file=$('#artFile').files?.[0];
  if(!nickname||!title||!file) return;
  if(file.size>6*1024*1024) return alert('이미지는 6MB 이하만 올릴 수 있습니다.');
  if(!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return alert('PNG, JPG, WEBP, GIF 이미지만 가능합니다.');
  const button=fanartForm.querySelector('button[type=submit]'); button.disabled=true; button.textContent='업로드 중…'; fanartStatus.textContent='';
  try {
    if(!hasBackend){
      const image_url=URL.createObjectURL(file);
      const demoRow={id:crypto.randomUUID?.()||String(Date.now()),nickname,title,description,image_url,created_at:new Date().toISOString()};
      const savedRows = saveDemoArt(demoRow);
      alert('데모 팬아트가 현재 브라우저에 추가됩니다. Supabase 연결 후에는 운영자 승인 절차를 거칩니다.');
      fanartForm.reset(); artPreview.hidden=true; renderArts(savedRows); fanartModal.close(); return;
    }
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
    const path=`submissions/${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}.${ext}`;
    const {error:uploadError}=await sb.storage.from('fanart').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
    if(uploadError) throw uploadError;
    const {error:rowError}=await sb.from('fanart').insert({nickname,title,description:description||null,image_path:path,status:'pending'});
    if(rowError){ await sb.storage.from('fanart').remove([path]); throw rowError; }
    fanartForm.reset(); artPreview.hidden=true; fanartStatus.textContent=''; alert('팬아트 검수 요청이 접수되었습니다! 운영자 승인 후 갤러리에 공개됩니다 ♡'); fanartModal.close();
  } catch(err){ console.error(err); fanartStatus.textContent='업로드에 실패했습니다. 파일 크기와 Supabase 설정을 확인해주세요.'; }
  finally{button.disabled=false;button.textContent='검수 요청 보내기';}
});

if (!hasBackend) {
  const note=document.createElement('div'); note.className='config-warning'; note.innerHTML='현재 <b>데모 모드</b>입니다. <code>config.js</code>에 Supabase URL/Publishable key를 입력하면 실제 방명록과 팬아트 접수함으로 전환됩니다.';
  document.querySelector('#guestbook .section-head')?.after(note);
}
window.loadGuestbook = loadGuestbook;
window.loadArts = loadArts;
loadGuestbook();
loadArts();

/* =========================================
팬아트 이미지 팝업
========================================= */

document.addEventListener('DOMContentLoaded', () => {

    const modal = document.getElementById('artModal');
    const modalImage = document.getElementById('artModalImage');
    const closeButton = document.getElementById('artModalClose');

    // 팝업 HTML이 없는 경우
    if (!modal || !modalImage || !closeButton) {
        console.error('팬아트 팝업 HTML을 찾을 수 없습니다.');
        return;
    }

    // 팬아트 클릭
    document.addEventListener('click', (event) => {

        const card = event.target.closest('.gallery-card');

        if (!card) return;

        const backgroundImage =
            window.getComputedStyle(card).backgroundImage;

        console.log('클릭한 카드:', card);
        console.log('배경 이미지:', backgroundImage);

        // background-image에서 URL 추출
        const match = backgroundImage.match(
            /url\(["']?(.*?)["']?\)/
        );

        if (!match || !match[1]) {
            console.error('이미지 URL을 찾을 수 없습니다.');
            return;
        }

        const imageUrl = match[1];

        modalImage.src = imageUrl;

        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');

        document.body.style.overflow = 'hidden';
    });


    // X 버튼
    closeButton.addEventListener('click', closeArtModal);


    // 어두운 배경 클릭
    modal.addEventListener('click', (event) => {

        if (event.target === modal) {
            closeArtModal();
        }

    });


    // ESC 키
    document.addEventListener('keydown', (event) => {

        if (
            event.key === 'Escape' &&
            modal.classList.contains('is-open')
        ) {
            closeArtModal();
        }

    });


    function closeArtModal() {

        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');

        document.body.style.overflow = '';

        setTimeout(() => {
            modalImage.src = '';
        }, 250);
    }

});
// 승인된 새 팬아트가 추가되면 페이지를 새로고침하지 않아도 갤러리에 반영합니다.
setInterval(() => {
  if (document.visibilityState === 'visible') loadArts();
}, 60000);

/* =========================================
   Guest BGM playlist
   ========================================= */
(() => {
  const player = $('#bgmPlayer');
  const audio = $('#bgmAudio');
  const playBtn = $('#bgmPlayBtn');
  const volume = $('#bgmVolume');
  const progress = $('#bgmProgress');
  const currentTimeEl = $('#bgmCurrentTime');
  const durationEl = $('#bgmDuration');
  const titleEl = $('#bgmTrackTitle');
  const metaEl = $('#bgmTrackMeta');
  if (!player || !audio) return;

  let playlist = [];
  let currentIndex = 0;
  let guestMode = false;
  let loading = false;
  let seeking = false;
  const volumeKey = 'bboringirl_bgm_volume';

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60);
    const secs = String(total % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const savedVolume = Number(localStorage.getItem(volumeKey));
  audio.volume = Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1 ? savedVolume : 0.35;
  if (volume) volume.value = String(audio.volume);

  function updateProgress() {
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
    if (durationEl) durationEl.textContent = formatTime(duration);
    if (progress && !seeking) {
      progress.max = String(duration || 0);
      progress.value = String(Math.min(current, duration || 0));
    }
  }

  function updateUi() {
    const track = playlist[currentIndex];
    if (!track) {
      titleEl.textContent = '재생할 음악이 없습니다';
      metaEl.textContent = '0 / 0';
      playBtn.textContent = '▶';
      playBtn.disabled = true;
      updateProgress();
      return;
    }
    titleEl.textContent = track.title || 'BGM';
    metaEl.textContent = `${currentIndex + 1} / ${playlist.length}`;
    playBtn.textContent = audio.paused ? '▶' : 'Ⅱ';
    playBtn.disabled = false;
    updateProgress();
  }

  function setTrack(index, autoplay=false) {
    if (!playlist.length) { updateUi(); return; }
    currentIndex = (index + playlist.length) % playlist.length;
    audio.src = playlist[currentIndex].url;
    audio.load();
    if (progress) { progress.max = '0'; progress.value = '0'; }
    if (currentTimeEl) currentTimeEl.textContent = '0:00';
    if (durationEl) durationEl.textContent = '0:00';
    updateUi();
    if (autoplay && guestMode) audio.play().catch(() => {});
  }

  async function loadBgmPlaylist() {
    if (!hasBackend || loading) return;
    loading = true;
    try {
      const { data, error } = await sb.from('bgm_tracks')
        .select('id,title,storage_path,sort_order,created_at')
        .eq('enabled', true)
        .order('sort_order', {ascending:true})
        .order('created_at', {ascending:true});
      if (error) throw error;
      const next = (data || []).map(row => ({
        ...row,
        url: sb.storage.from('bgm').getPublicUrl(row.storage_path).data.publicUrl
      }));
      const previousId = playlist[currentIndex]?.id;
      playlist = next;
      const found = playlist.findIndex(item => item.id === previousId);
      currentIndex = found >= 0 ? found : 0;
      if (playlist.length) {
        if (!audio.src || !playlist[currentIndex] || !audio.src.includes(encodeURIComponent(playlist[currentIndex].storage_path))) {
          setTrack(currentIndex, false);
        } else {
          updateUi();
        }
      } else {
        audio.pause(); audio.removeAttribute('src'); audio.load(); updateUi();
      }
      player.hidden = !guestMode || !playlist.length;
    } catch (error) {
      console.error('BGM playlist load failed', error);
      playlist = [];
      audio.pause();
      player.hidden = true;
      updateUi();
    } finally {
      loading = false;
    }
  }

  async function enterGuestBgm() {
    guestMode = true;
    await loadBgmPlaylist();
    if (!playlist.length) return;
    player.hidden = false;
    if (!audio.src) setTrack(0, false);
    audio.play().then(updateUi).catch(() => {
      // 브라우저 자동재생 정책으로 실패하면 플레이 버튼으로 시작할 수 있습니다.
      updateUi();
    });
  }

  function leaveGuestBgm() {
    guestMode = false;
    audio.pause();
    player.hidden = true;
    updateUi();
  }

  playBtn?.addEventListener('click', () => {
    if (!playlist.length) return;
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  });
  audio.addEventListener('ended', () => setTrack(currentIndex + 1, true));
  audio.addEventListener('play', updateUi);
  audio.addEventListener('pause', updateUi);
  audio.addEventListener('loadedmetadata', updateProgress);
  audio.addEventListener('durationchange', updateProgress);
  audio.addEventListener('timeupdate', updateProgress);
  progress?.addEventListener('pointerdown', () => { seeking = true; });
  progress?.addEventListener('pointerup', () => { seeking = false; });
  progress?.addEventListener('input', () => {
    if (!Number.isFinite(audio.duration)) return;
    audio.currentTime = Number(progress.value);
    if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
  });
  volume?.addEventListener('input', () => {
    audio.volume = Number(volume.value);
    localStorage.setItem(volumeKey, String(audio.volume));
  });

  window.loadBgmPlaylist = loadBgmPlaylist;
  window.enterGuestBgm = enterGuestBgm;
  window.leaveGuestBgm = leaveGuestBgm;
  loadBgmPlaylist();
})();
