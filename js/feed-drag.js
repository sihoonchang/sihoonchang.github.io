/* 가로로 넘기는 줄(카드뉴스 .feed, 인터뷰 .interviews): 마우스로 누른 채 좌우로 끌어서 넘기기
   - 끄는 동안 칸들이 손을 따라 움직이고, 놓으면 끌던 속도만큼 미끄러지다 가장 가까운 칸에 맞춰 멈춤
   - 끌었을 때는 링크·영상 재생이 열리지 않고, 그냥 누르면 평소처럼 열림
   - 터치 기기는 원래의 손가락 넘기기를 그대로 씀 */
(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll('.feed, .interviews').forEach(setup);

function setup(feed) {
  feed.classList.add('can-drag');

  let down = false, dragging = false, moved = false;
  let startX = 0, startLeft = 0, lastX = 0, lastT = 0, vel = 0, raf = 0, unlockTimer = 0;

  // 끄는 동안에는 카드의 링크 주소를 잠시 떼어 두어, 손을 놓아도 어떤 방식으로든 링크가 열리지 않게 함
  const lockLinks = () => {
    clearTimeout(unlockTimer);
    feed.querySelectorAll('a[href]').forEach((a) => { a.dataset.href = a.getAttribute('href'); a.removeAttribute('href'); });
  };
  const unlockLinks = () => {
    clearTimeout(unlockTimer);
    // 손을 놓은 직후의 클릭이 다 지나간 뒤에 링크를 되돌림
    unlockTimer = setTimeout(() => {
      feed.querySelectorAll('a[data-href]').forEach((a) => { a.setAttribute('href', a.dataset.href); delete a.dataset.href; });
      moved = false;
    }, 120);
  };

  const maxLeft = () => feed.scrollWidth - feed.clientWidth;
  // 각 카드가 줄의 왼쪽 끝에 맞춰지는 위치들
  const stops = () => {
    const base = feed.getBoundingClientRect().left - feed.scrollLeft;
    const max = maxLeft();
    // 각 카드 시작점 + 맨 끝 위치(마지막 카드가 다 보이는 곳)
    return [...feed.children].map((li) => li.getBoundingClientRect().left - base)
      .filter((x) => x < max - 4).concat(max);
  };

  // 놓은 뒤 목표 위치까지 부드럽게 감속하며 미끄러짐
  function glide(to) {
    cancelAnimationFrame(raf);
    const from = feed.scrollLeft, dist = to - from;
    const dur = Math.min(900, 380 + Math.abs(dist) * 0.5);
    const t0 = performance.now();
    feed.classList.add('dragging');
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      feed.scrollLeft = from + dist * (1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(step);
      else { raf = 0; feed.classList.remove('dragging'); }
    };
    raf = requestAnimationFrame(step);
  }

  feed.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    cancelAnimationFrame(raf); raf = 0;
    down = true; dragging = false; moved = false;
    startX = lastX = e.clientX; startLeft = feed.scrollLeft;
    lastT = performance.now(); vel = 0;
  });

  feed.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!dragging && Math.abs(dx) > 5) {
      dragging = moved = true;
      lockLinks();
      feed.setPointerCapture(e.pointerId);
      feed.classList.add('dragging', 'grabbing');
    }
    if (!dragging) return;
    e.preventDefault();
    feed.scrollLeft = startLeft - dx;
    const now = performance.now();
    vel = 0.75 * vel + 0.25 * ((e.clientX - lastX) / Math.max(1, now - lastT));   // px/ms
    lastX = e.clientX; lastT = now;
  });

  const release = () => {
    if (!down) return;
    down = false;
    if (!dragging) return;
    dragging = false;
    feed.classList.remove('grabbing');
    unlockLinks();
    if (performance.now() - lastT > 80) vel = 0;           // 멈췄다 놓으면 관성 없음
    const projected = feed.scrollLeft - vel * 320;          // 끌던 속도만큼 더 미끄러질 위치
    const best = stops().reduce((a, b) => (Math.abs(b - projected) < Math.abs(a - projected) ? b : a));
    glide(Math.max(0, Math.min(maxLeft(), best)));
  };
  feed.addEventListener('pointerup', release);
  feed.addEventListener('pointercancel', release);
  feed.addEventListener('lostpointercapture', release);

  // 한 번 더 막기: 끌어서 넘긴 직후의 클릭은 페이지 전체에서 가장 먼저 가로채 없앰
  window.addEventListener('click', (e) => {
    if (moved && feed.contains(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  feed.addEventListener('dragstart', (e) => e.preventDefault());
}
})();
