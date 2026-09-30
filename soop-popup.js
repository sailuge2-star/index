(() => {
  'use strict';
  const dialog=document.getElementById('soopConnectDialog');
  if(!dialog) return;
  const inputs=[...dialog.querySelectorAll('[data-default]')];
  document.getElementById('soopResetDefaults').addEventListener('click',()=>{
    inputs.forEach(input=>{input.value=input.dataset.default;});
    document.getElementById('soopPopupFeedback').textContent='후원 개수를 기본값으로 되돌렸습니다.';
  });
  inputs.forEach(input=>input.addEventListener('change',()=>{
    const value=Number(input.value);
    input.value=Number.isFinite(value)&&value>=1?String(Math.min(999999,Math.floor(value))):input.dataset.default;
  }));
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog) return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom) dialog.close();
  });
})();
