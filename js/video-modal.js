/* 인터뷰 영상 팝업
   - data-video가 달린 썸네일이나 버튼을 누르면 화면 위에 영상 재생기가 떠서 바로 재생됨
   - ✕, 바깥 어두운 곳, Esc 키로 닫히고, 닫으면 영상이 멈춤
   - "파일로 열기"는 일반 다운로드 링크라 이 스크립트와 상관없음 */
(() => {
  const modal = document.querySelector('.vmodal');
  if (!modal) return;
  const video = modal.querySelector('video');
  const closeBtn = modal.querySelector('.vmodal-close');
  let lastFocus = null, hideTimer = 0;

  function open(src, poster) {
    clearTimeout(hideTimer);
    lastFocus = document.activeElement;
    if (poster) video.poster = poster;
    video.src = src;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('show'));
    document.documentElement.classList.add('vmodal-open');
    closeBtn.focus();
    const p = video.play();
    if (p && p.catch) p.catch(() => {});       // 자동 재생이 막히면 재생 버튼을 누르면 됨
  }

  function close() {
    if (modal.hidden) return;
    modal.classList.remove('show');
    video.pause();
    document.documentElement.classList.remove('vmodal-open');
    hideTimer = setTimeout(() => {
      modal.hidden = true;
      video.removeAttribute('src'); video.load();
    }, 250);
    if (lastFocus) lastFocus.focus();
  }

  document.querySelectorAll('[data-video]').forEach((el) =>
    el.addEventListener('click', () => open(el.dataset.video, el.dataset.poster)));
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
