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

$('#messageBtn')?.addEventListener('click', () => {
  const msg = prompt('뽀린걸에게 남길 축하 한마디를 적어주세요!');
  if (msg?.trim()) {
    alert(`메시지 초안이 저장되었습니다 ✨\n\n“${msg.trim()}”\n\n실서비스에서는 이 영역을 DB/게시판과 연결하면 됩니다.`);
  }
});

const gallery = $$('.gallery-card');
$('#shuffleGallery')?.addEventListener('click', () => {
  gallery.forEach((el, i) => {
    el.style.transform = `rotate(${(Math.random() - .5) * 1.6}deg)`;
    el.style.transition = 'transform .25s ease';
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
