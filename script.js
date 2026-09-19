const memo = document.querySelector('#memo');
const saved = document.querySelector('#saved');
const stored = localStorage.getItem('bboringirl-fan-memo');
if (stored) memo.value = stored;
document.querySelector('#saveMemo').addEventListener('click', () => {
  localStorage.setItem('bboringirl-fan-memo', memo.value.trim());
  saved.textContent = '이 브라우저에 저장했어요 ♥';
});
document.querySelector('#clearMemo').addEventListener('click', () => {
  localStorage.removeItem('bboringirl-fan-memo');
  memo.value = '';
  saved.textContent = '메모를 지웠어요.';
});
document.querySelector('.menu').addEventListener('click', () => {
  const nav = document.querySelector('nav');
  nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
  nav.style.position = 'absolute';
  nav.style.top = '70px';
  nav.style.right = '6vw';
  nav.style.flexDirection = 'column';
  nav.style.padding = '16px';
  nav.style.background = 'white';
  nav.style.border = '1px solid #eadfe2';
  nav.style.borderRadius = '16px';
});
