/* 01 블로그 · 02 카드뉴스의 3D 카드 고리
   - 카드들이 끝없이 이어진 둥근 고리(원통)처럼 둘러서 있고, 모든 카드가 바깥(보는 사람 쪽)을 향해 앞면을 보여 줌
   - 정면에서 살짝 내려다보는 각도. 맨 앞 가운데 카드가 "지금 카드"이고, 커서를 올리면 조금 더 들려 나옴
   - 끌어서 돌림(마우스·손가락). 누른 채 끄는 동안은 손을 따라 돌고, 놓으면 놓는 순간의 속도만큼 계속 돌다가
     점점 느려져 멈춤(돌림판처럼): 세게 휙 돌리면 많이, 살살 놓으면 조금. 멈출 때는 가장 가까운 카드가 정확히 가운데에 섬
   - 처음과 끝이 이어져 있어 계속 돎. 마우스 휠·트랙패드로도 돌림
   - 옆에 보이는 카드를 누르면 그 카드가 가운데로 돌아오고, 가운데 카드를 누르면 글·게시물이 열림(끌었을 때는 열리지 않음)
   - 화면이 넘어오면(js/pager.js) 첫 번째 카드가 가운데로 돌아오고, 넘어오는 동안은 끌기를 받지 않음
   - 키보드: 고리를 고른 뒤 ← → 로 한 장씩, Enter로 열기
   - 블로그 글 카드 색은 앞(최신) 살구 → 가운데 회보라 → 뒤 남색으로 자동으로 칠함
   - 운영체제의 "동작 줄이기" 설정과 상관없이 움직임 (사이트 주인 요청)
   - 카드 수가 늘거나 줄어도 그대로 작동함(고리 크기가 카드 수에 맞춰짐). 블로그 카드는 scripts/update-blog.mjs가 자동으로 채움 */
(() => {
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod = (a, m) => ((a % m) + m) % m;

  // 블로그 글 카드 색
  const G = [[238, 165, 122], [158, 130, 145], [37, 55, 142]];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const ramp = (t) => (t < 0.5 ? mix(G[0], G[1], t * 2) : mix(G[1], G[2], (t - 0.5) * 2));
  document.querySelectorAll('.stack').forEach((stack) => {
    const posts = [...stack.querySelectorAll('.post3d')];
    posts.forEach((el, i) => {
      const c = ramp(posts.length > 1 ? i / (posts.length - 1) : 0);
      const hi = mix(c, [255, 255, 255], 0.38);
      const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
      el.style.setProperty('--c', `rgb(${c})`);
      el.style.setProperty('--c-hi', `rgb(${hi})`);
      el.style.setProperty('--c-ink', lum > 0.6 ? '#151515' : '#FFFFFF');
    });
  });

  document.querySelectorAll('.stage3d').forEach((stageEl) => {
    const scene = stageEl.querySelector('.scene');
    const stack = stageEl.querySelector('.stack');
    if (!scene || !stack) return;          // 카드 고리가 없는 흰 칸(인터뷰 화면)은 건너뜀
    const cards = [...stack.querySelectorAll('.c3')].map((el) => ({ el, lift: 0 }));
    const n = cards.length;
    if (!n) return;

    // 카드 뒷면(고리 뒤쪽에서 보이는 면)을 붙임
    cards.forEach((c) => {
      const back = document.createElement('span');
      back.className = 'back'; back.setAttribute('aria-hidden', 'true');
      c.el.appendChild(back);
      c.el.tabIndex = -1;
      c.el.draggable = false;
      c.el.querySelectorAll('img').forEach((im) => { im.draggable = false; });
    });

    const STEP_DEG = 360 / n;               // 카드 한 장 사이의 각도
    let f = 0;                               // 화면에 그려지는 고리 위치(카드 단위, 부드럽게 따라감)
    let pos = 0;                             // 고리가 가야 할 위치
    let vel = 0;                             // 손을 놓은 뒤 관성으로 도는 속도(카드/ms)
    let coasting = false, lockUntil = 0, visible = true, wheelAt = 0;
    let front = 0;                           // 지금 가운데 카드 번호
    let overEl = null;                       // 커서가 올라가 있는 카드

    const goTo = (i) => {                    // 카드 i를 가장 가까운 쪽으로 돌려 가운데에
      const cur = Math.round(pos);
      let d = mod(i - mod(cur, n), n); if (d > n / 2) d -= n;
      pos = cur + d; vel = 0; coasting = false;
    };
    const stepPx = () => stack.offsetWidth * 0.9;   // 이만큼 끌면 카드 한 장만큼 돎

    // 끌어서 돌리기 (마우스·손가락 공통)
    //  - 누른 채 끌면 고리가 손을 따라 돎 (오른쪽으로 끌면 고리 앞면도 오른쪽으로 → 왼쪽 카드가 가운데로)
    //  - 놓는 순간의 속도만큼 계속 돌다가 점점 느려져 멈춤(돌림판처럼). 세게 휙 돌리면 많이, 살살 놓으면 조금
    //  - 멈출 때는 가장 가까운 카드가 정확히 가운데에 섬
    // 카드 열기는 "멈춰 있는 고리에서, 누른 자리에서 움직이지 않고 뗐을 때"만.
    //  - 누르는 순간 고리의 모든 카드에서 링크 주소를 잠시 떼어 둠 → 끌다가 놓아도 브라우저·미리보기 화면 어느 쪽도 링크를 열 수 없음
    //  - 위 조건을 통과한 "가운데 카드 누르기"일 때만 손을 떼는 순간 주소를 되돌려 평소처럼 열리게 함
    //  - 그 밖에는 손을 뗀 뒤 클릭이 다 지나간 다음에 주소를 되돌림
    let drag = null, moved = false, clickOk = false, clickOkAt = 0, dragEndAt = 0;
    const SLOP = 3;                          // 이보다 조금이라도 더 움직이면 "끌기"로 봄(px)
    let locked = false, unlockTimer = 0;
    const lockLinks = () => {
      clearTimeout(unlockTimer);
      if (locked) return;
      locked = true;
      cards.forEach(({ el }) => { if (el.hasAttribute('href')) { el.dataset.href = el.getAttribute('href'); el.removeAttribute('href'); } });
    };
    const unlockNow = () => {
      clearTimeout(unlockTimer);
      if (!locked) return;
      locked = false;
      cards.forEach(({ el }) => { if (el.dataset.href != null) { el.setAttribute('href', el.dataset.href); delete el.dataset.href; } });
    };
    const unlockLater = () => { clearTimeout(unlockTimer); unlockTimer = setTimeout(unlockNow, 250); };
    // 손을 떼면(고리 밖에서 떼도) 잠시 뒤 주소를 되돌림. 가운데 카드 누르기는 아래 release에서 먼저 바로 되돌려 둠
    window.addEventListener('pointerup', () => { if (locked) unlockLater(); });
    window.addEventListener('pointercancel', () => { if (locked) unlockLater(); });
    const samples = [];                      // 최근 0.1초 동안의 손 위치(속도 계산용)
    scene.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      lockLinks();
      if (performance.now() < lockUntil) return;
      // 돌고 있는(또는 아직 자리를 잡는 중인) 고리를 잡으면 보이는 그 자리에서 멈춤. 이때 누른 것은 카드 열기로 치지 않음
      const atRest = !coasting && Math.abs(pos - f) < 0.03;
      pos = f;
      const card = e.target.closest && e.target.closest('.c3');
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, p: pos, rest: atRest, card, far: 0 };
      clickOk = false;
      moved = false; vel = 0; coasting = false;
      samples.length = 0; samples.push([e.clientX, performance.now()]);
    });
    scene.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = e.clientX - drag.x;
      drag.far = Math.max(drag.far, Math.hypot(d, e.clientY - drag.y));
      if (!moved && drag.far > SLOP) {
        moved = true;
        try { scene.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
        document.documentElement.classList.add('ring-dragging');
      }
      if (!moved) return;
      pos = drag.p - d / stepPx();
      const now = performance.now();
      samples.push([e.clientX, now]);
      while (samples.length > 2 && now - samples[0][1] > 100) samples.shift();
    });
    const release = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      // 열어도 되는 클릭: 멈춰 있던 고리에서, 거의 움직이지 않고, 누른 카드 위에서 뗐을 때
      if (e && e.type === 'pointerup' && !moved && drag.rest && drag.far <= SLOP && drag.card) {
        const up = document.elementFromPoint(e.clientX, e.clientY);
        if (up && up.closest('.c3') === drag.card) {
          clickOk = true; clickOkAt = performance.now();
          if (drag.card === cards[front].el) unlockNow();   // 가운데 카드: 바로 뒤따르는 클릭으로 열리게
        }
      }
      if (moved && samples.length > 1) {
        const [x0, t0] = samples[0], [x1, t1] = samples[samples.length - 1];
        const dt = Math.max(1, t1 - t0);
        // 마지막으로 움직인 뒤 잠깐 멈췄다 놓았으면 관성 없음
        vel = performance.now() - t1 > 80 ? 0 : -((x1 - x0) / dt) / stepPx();
        vel = Math.max(-0.05, Math.min(0.05, vel));   // 아무리 세게 돌려도 두 바퀴 남짓까지만
      }
      coasting = true;                     // 놓으면 (속도가 없어도) 가장 가까운 카드에 맞춰 멈춤
      if (moved) dragEndAt = performance.now();
      drag = null;
      document.documentElement.classList.remove('ring-dragging');
    };
    scene.addEventListener('pointerup', release);
    scene.addEventListener('pointercancel', release);
    // 손가락은 처음 닿은 카드가 붙잡고 있다가 고리로 넘겨받는데, 그때 카드에서 나는 신호는 무시
    scene.addEventListener('lostpointercapture', (e) => { if (e.target === scene) release(e); });
    scene.addEventListener('dragstart', (e) => e.preventDefault());

    // 커서가 가운데 카드 위에 있으면 조금 더 들려 나오고 "글 읽기" 표시
    scene.addEventListener('pointerover', (e) => { overEl = (e.target.closest && e.target.closest('.c3')) || null; });
    scene.addEventListener('pointerleave', () => { overEl = null; });

    // 마우스 휠·트랙패드로 돌리기 (같은 관성)
    scene.addEventListener('wheel', (e) => {
      if (performance.now() < lockUntil) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault();
      pos += d / 240; vel = 0; coasting = true; wheelAt = performance.now();
    }, { passive: false });

    // 이 고리가 있는 화면으로 넘어오면(js/pager.js) 첫 번째 카드가 가운데로, 넘어오는 동안은 끌기를 받지 않음
    const page = stageEl.closest('.page');
    window.addEventListener('pager:change', (e) => {
      if (!page || e.detail.id !== page.id) return;
      pos = f = vel = 0; coasting = false; drag = null;
      lockUntil = performance.now() + (e.detail.instant ? 0 : 1250);
    });

    // 누르기: 가운데 카드는 열림, 옆 카드는 가운데로 돌아옴. 페이지 전체에서 가장 먼저 클릭을 받아 판단
    window.addEventListener('click', (e) => {
      if (!(e.target instanceof Node) || !scene.contains(e.target)) return;
      const ok = (clickOk && performance.now() - clickOkAt < 800) || (e.detail === 0 && !drag && !locked && performance.now() - dragEndAt > 800);   // detail 0: 키보드·보조기기 클릭
      clickOk = false; moved = false;
      if (!ok) { e.preventDefault(); e.stopImmediatePropagation(); return; }   // 끌었거나, 돌던 고리를 잡아 세웠거나, 누른 채 움직였으면 열지 않음
      const a = e.target.closest('.c3');
      if (!a) return;
      const i = cards.findIndex((c) => c.el === a);
      if (i >= 0 && i !== front) { e.preventDefault(); e.stopImmediatePropagation(); goTo(i); }
    }, true);

    // 키보드
    scene.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { pos = Math.round(pos) + 1; vel = 0; e.preventDefault(); }
      if (e.key === 'ArrowLeft') { pos = Math.round(pos) - 1; vel = 0; e.preventDefault(); }
      if (e.key === 'Enter') { clickOk = true; clickOkAt = performance.now(); cards[front].el.click(); }
    });

    // 화면 밖에 있을 때는 계산을 쉼
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { rootMargin: '200px' }).observe(stageEl);
    }

    function frame() {
      requestAnimationFrame(frame);
      if (!visible && !(page && page.classList.contains('is-active'))) return;   // 지금 보이는 화면의 고리는 늘 움직임
      const cw = stack.offsetWidth, ch = stack.offsetHeight;
      // 고리 반지름: 카드들이 살짝 틈을 두고 한 바퀴를 채우도록 (카드가 적어도 너무 작은 고리가 되지 않게)
      const R = Math.max(cw * 0.95, (n * cw * 1.14) / (2 * Math.PI));
      // 관성: 놓은 뒤에는 속도만큼 계속 돌다가 마찰로 점점 느려짐. 충분히 느려지면 가장 가까운 카드에 맞춰 멈춤
      const now = performance.now();
      const dt = Math.min(48, now - (frame.t || now)); frame.t = now;
      if (!drag && coasting) {
        if (Math.abs(vel) > 0.0006) {
          pos += vel * dt;
          vel *= Math.pow(0.955, dt / 16.7);
        } else if (now - wheelAt > 160) {  // 휠은 굴리기를 멈춘 뒤에 맞춤
          vel = 0; coasting = false;
          pos = Math.round(pos);           // 가장 가까운 카드로
        }
      }
      // 화면의 고리는 목표 위치를 부드럽게 따라감 (지금의 자연스러운 움직임 그대로)
      f += (pos - f) * (drag ? 0.25 : 0.12);
      front = mod(Math.round(f), n);
      const live = overEl === cards[front].el && !drag && !coasting && performance.now() >= lockUntil;

      // 고리 전체: 고리 중심을 화면 안쪽으로 밀어 맨 앞 카드가 제 크기로 보이게, 살짝 내려다보는 각도
      stack.style.transform = `translateY(${(-ch * 0.04).toFixed(1)}px) translateZ(${(-R).toFixed(1)}px) rotateX(-7deg) rotateY(${(-f * STEP_DEG).toFixed(3)}deg)`;

      cards.forEach((c, i) => {
        const s = mod(i - f + n / 2, n) - n / 2;   // 이 카드가 가운데에서 몇 장 떨어져 있는지 (-n/2 ~ n/2)
        const isFront = i === front && Math.abs(s) < 0.5;
        c.lift = lerp(c.lift, isFront ? (live ? 1 : 0.45) : 0, 0.2);
        const out = R + 40 * c.lift;              // 가운데 카드는 앞으로 조금 들려 나옴
        c.el.style.transform = `rotateY(${(i * STEP_DEG).toFixed(3)}deg) translateZ(${out.toFixed(1)}px) translateY(${(-14 * c.lift).toFixed(1)}px)`;
        // 앞쪽은 또렷하게, 옆으로 돌아갈수록 살짝 흐리게. 뒤쪽 반은 카드 뒷면이 은은하게
        const a = Math.abs(s) / (n / 2);         // 0(가운데) ~ 1(맨 뒤)
        // (투명도를 카드 전체에 주면 브라우저가 카드를 납작하게 만들어 뒷면에 앞면이 거울처럼 비치므로, 앞면·뒷면에 따로 줌)
        c.el.style.setProperty('--o', (1 - a * 0.55).toFixed(3));
        c.el.style.pointerEvents = Math.abs(s * STEP_DEG) < 80 ? 'auto' : 'none';
        c.el.classList.toggle('on', isFront && live);
      });
    }
    requestAnimationFrame(frame);
  });
})();
