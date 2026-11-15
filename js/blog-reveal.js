/* 블로그 글 목록 펼치기 (서랍)
   - "블로그 전체 보기" 버튼에 마우스를 올리면 숨은 글 목록이 버튼 밑에서 2초 동안 스르륵 미끄러져 나옴.
     움직임 자체는 CSS 전환(transition)이 맡고, 스크립트는 높이 숫자만 정해 줌
   - 커서가 흰 칸 안에 있는 동안은 닫히지 않음. 칸 밖으로 나가면 천천히 밀려 들어감
   - 마우스가 없는 기기와 스크립트가 꺼진 환경에서는 목록이 처음부터 펼쳐져 있음
   - 운영체제의 '동작 줄이기' 설정이 켜져 있어도 이 서랍은 그대로 움직이게 함(사이트 주인의 선택) */
(() => {
  const panel = document.querySelector('.posts-panel');
  if (!panel || !document.documentElement.classList.contains('reveal-js')) return;
  const btn = panel.querySelector('.reveal .cta');
  const box = panel.querySelector('.more-posts');
  const inner = panel.querySelector('.more-inner');
  let open = false;

  // 칸 높이(h)와 글 목록 위치를 함께 정함. 목록은 칸 아래 끝에 붙어서 같이 내려옴
  const place = (h, full) => {
    box.style.height = h + 'px';
    inner.style.transform = `translateY(${h - full}px)`;
  };

  // 움직임 없이 즉시 그 자리에 고정
  const freeze = (fn) => {
    panel.classList.add('no-anim');
    fn();
    void box.offsetHeight;          // 브라우저가 고정된 위치를 먼저 그리게 함
    panel.classList.remove('no-anim');
  };

  function settle() {
    panel.classList.remove('is-moving');
    if (open) freeze(() => { box.style.height = 'auto'; inner.style.transform = 'translateY(0)'; });
  }

  function go(next) {
    if (next === open) return;
    open = next;
    const full = inner.scrollHeight;
    const from = box.getBoundingClientRect().height;
    const to = open ? full : 0;
    freeze(() => place(from, full));          // 지금 위치에서 출발
    panel.classList.toggle('is-open', open);
    if (Math.abs(to - from) < 1) { place(to, full); settle(); return; }
    panel.classList.add('is-moving');
    requestAnimationFrame(() => requestAnimationFrame(() => place(to, full)));  // CSS 전환으로 천천히 이동
  }

  box.addEventListener('transitionend', (e) => {
    if (e.target === box && e.propertyName === 'height') settle();
  });
  btn.addEventListener('pointerenter', () => go(true));
  panel.addEventListener('pointerleave', () => go(false));
  panel.addEventListener('focusin', (e) => { if (e.target.closest('.reveal')) go(true); });
  panel.addEventListener('focusout', (e) => { if (!panel.contains(e.relatedTarget)) go(false); });
})();
