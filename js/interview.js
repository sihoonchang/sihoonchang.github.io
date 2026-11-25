/* 인터뷰 화면 (소개 아래): 펼쳐지는 영상 띠 + 흐르는 능력·도구 띠
   - 영상 4편이 세로 띠로 나란히 있고, 하나가 넓게 펼쳐져 소리 없이 짧게 반복 재생됨(처음엔 첫 번째)
   - 다른 띠에 커서를 올리면 그 띠가 부드럽게 넓어지며 제목·설명이 떠오름. 펼쳐지는 동안(약 0.65초)은 다음 띠로 바뀌지 않음
     (띠 폭이 바뀌면서 커서 밑의 띠가 저절로 바뀌어 왔다 갔다 하지 않게, 커서가 실제로 움직였을 때만 바꿈)
   - 접힌 띠를 누르면(휴대폰은 톡) 그 띠가 펼쳐지고, 펼쳐진 영상을 누르면 소리와 함께 크게 재생(js/video-modal.js)
   - 띠가 접히면 영상은 바로 감추고(흐린 사진과 겹쳐 보이는 잔상 방지), 글 칸은 펼친 뒤의 폭으로 고정해 움직이는 동안 글자가 출렁이지 않게 함
   - 펼쳐진 영상 위의 ▶ 동그라미가 커서를 살짝 늦게 따라다님
   - 키보드: Tab으로 띠를 고르면 펼쳐지고 Enter로 재생
   - 인터뷰 화면이 아닐 때, 영상 팝업이 떠 있을 때, 창이 가려졌을 때는 미리보기 영상을 멈춤
   - 아래 두 줄(업무 능력·도구)은 서로 반대 방향으로 천천히 흐르고, 커서를 올리면 멈춤. 화면 폭에 맞춰 알약을 이어 붙여 끊김 없이 돎
   - 운영체제의 "동작 줄이기" 설정과 상관없이 움직임 (사이트 주인 요청) */
(() => {
  const root = document.getElementById('interview');
  if (!root) return;
  const list = root.querySelector('.iv-strips');
  const strips = [...root.querySelectorAll('.iv-strip')];
  if (!list || !strips.length) return;
  const html = document.documentElement;

  let open = Math.max(0, strips.findIndex((s) => s.classList.contains('is-open')));
  let active = location.hash === '#' + root.id;
  let settleUntil = 0;

  // 미리보기 영상: 펼쳐진 띠 하나만, 화면이 보일 때만 재생
  const sync = () => strips.forEach((s, k) => {
    const v = s.querySelector('video');
    if (!v) return;
    const play = k === open && active && !document.hidden && !html.classList.contains('vmodal-open');
    if (play) {
      if (!v.getAttribute('src')) v.src = v.dataset.src;
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      if (!v.paused) v.pause();
      // 접힌 띠: 영상은 바로 감추고 처음으로 되감음(다시 펼치면 처음부터, 재생이 시작된 뒤에야 보임 → 잔상 없음)
      if (k !== open) { s.classList.remove('is-live'); if (v.currentTime) { try { v.currentTime = 0; } catch (err) { /* 무시 */ } } }
    }
  });
  strips.forEach((s) => {
    const v = s.querySelector('video');
    if (v) v.addEventListener('playing', () => { if (s.classList.contains('is-open')) s.classList.add('is-live'); });
  });

  const setOpen = (i) => {
    if (i === open) return;
    open = i;
    strips.forEach((s, k) => s.classList.toggle('is-open', k === i));
    settleUntil = performance.now() + 650;
    sync();
  };

  // 커서: 실제로 움직였을 때, 잠깐(0.11초) 머문 띠를 펼침
  let lastX = -1, lastY = -1, pending = -1, hoverTimer = 0;
  list.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (e.clientX === lastX && e.clientY === lastY) return;
    lastX = e.clientX; lastY = e.clientY;
    const s = e.target.closest('.iv-strip');
    const i = strips.indexOf(s);
    if (i < 0 || i === open) { clearTimeout(hoverTimer); pending = -1; return; }
    if (i === pending) return;
    pending = i; clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function fire() {
      const wait = settleUntil - performance.now();
      if (wait > 0) { hoverTimer = setTimeout(fire, wait); return; }
      pending = -1;
      // 펼쳐지는 사이 커서 밑의 띠가 바뀌었으면 펼치지 않음(커서를 다시 움직이면 그때 판단)
      const under = document.elementFromPoint(lastX, lastY);
      if (under && under.closest('.iv-strip') === strips[i]) setOpen(i);
    }, 110);
  });
  list.addEventListener('pointerleave', () => { clearTimeout(hoverTimer); pending = -1; });

  // 접힌 띠를 누르면 펼치기만 함(영상 팝업은 열지 않음)
  list.addEventListener('click', (e) => {
    const i = strips.indexOf(e.target.closest('.iv-strip'));
    if (i < 0 || i === open) return;
    e.preventDefault(); e.stopPropagation();
    setOpen(i);
  }, true);

  // 키보드로 고르면 펼침 (마우스로 누를 때는 위 클릭에서 처리)
  strips.forEach((s, k) => s.addEventListener('focusin', (e) => {
    if (k !== open && e.target.matches(':focus-visible')) setOpen(k);
  }));

  // ▶ 동그라미가 커서를 살짝 늦게 따라다님 (CSS transition이 부드럽게 이어 줌)
  strips.forEach((s) => {
    const m = s.querySelector('.iv-media');
    const dot = m && m.querySelector('.iv-play');
    if (!dot) return;
    m.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !s.classList.contains('is-open')) return;
      const r = m.getBoundingClientRect();
      dot.style.translate = `${(e.clientX - r.left - r.width / 2).toFixed(1)}px ${(e.clientY - r.top - r.height / 2).toFixed(1)}px`;
    });
    m.addEventListener('pointerleave', () => { dot.style.translate = ''; });
  });

  window.addEventListener('pager:change', (e) => { active = e.detail.id === root.id; sync(); });
  document.addEventListener('visibilitychange', sync);
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ['class'] });

  // 흐르는 능력·도구 띠: 화면 폭을 넘을 만큼 알약을 이어 붙이고, 한 묶음 폭만큼 돌면 처음과 똑같아지게
  const runs = [...root.querySelectorAll('.iv-run')];
  const fill = (run) => {
    run.querySelectorAll('[data-clone]').forEach((n) => n.remove());
    const items = [...run.children];
    const gap = parseFloat(getComputedStyle(run).columnGap) || 0;
    const w = run.scrollWidth + gap;                       // 알약 한 묶음 폭
    if (w < 40) return;
    const need = run.parentElement.clientWidth + w;
    for (let total = w; total < need; total += w) {
      items.forEach((n) => { const c = n.cloneNode(true); c.setAttribute('data-clone', ''); c.setAttribute('aria-hidden', 'true'); run.appendChild(c); });
    }
    run.style.setProperty('--w', `${w.toFixed(1)}px`);
    run.style.setProperty('--dur', `${(w / 26).toFixed(1)}s`);   // 초당 약 26px
  };
  const fillAll = () => runs.forEach(fill);
  fillAll();

  // 펼친 띠의 글 칸 폭을 미리 재어 고정: 띠가 넓어지거나 좁아지는 동안 글자가 다시 줄바꿈되며 출렁이지 않게
  // (모든 띠의 펼친 폭이 같으므로 펼쳐진 띠 하나로 재면 됨. 화면 크기가 바뀌면 움직임이 끝난 뒤 다시 잼)
  const measure = () => {
    const s = strips[open];
    const m = s && s.querySelector('.iv-media');
    if (!m) return;
    const w = Math.floor(s.clientWidth - m.offsetWidth);
    if (w > 100) list.style.setProperty('--info-w', `${w}px`);
  };
  measure();
  let mt = 0;
  const measureLater = (ms) => { clearTimeout(mt); mt = setTimeout(measure, ms); };
  window.addEventListener('resize', () => measureLater(1000));
  list.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'flex-grow' || (e.propertyName === 'width' && e.target.classList.contains('iv-media'))) measureLater(30);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fillAll, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fillAll);

  sync();
})();
