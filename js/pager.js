/* 한 화면 구성: [01 블로그] [소개] [02 카드뉴스] 세 화면이 옆으로 나란히 있고, 처음에는 가운데 소개가 보임.
   소개 아래에는 인터뷰 화면이 하나 더 있음(위아래로 넘김)
   - 커서를 화면 왼쪽 15% 안으로 가져가 잠깐(0.4초) 머물면 왼쪽 화면이, 오른쪽 15% 안이면 오른쪽 화면이 밀려 들어옴
   - 소개 화면에서 아래쪽 15% 안에 머물거나 휠을 아래로 굴리면 인터뷰 화면이 아래에서 올라옴.
     인터뷰 화면에서 위쪽 15% 안에 머물거나 휠을 위로 굴리면 소개로 돌아감
   - 단, 블로그·카드뉴스·인터뷰 화면에서는 커서가 흰 칸 안에 있는 동안은 넘어가지 않고, 칸 바깥 여백이나 가장자리 글자로 나가야 넘어감
   - 한 번 넘어간 뒤에는 커서가 가장자리를 벗어났다가 다시 들어와야 다음 화면으로 넘어감 (연달아 두 칸 넘어가지 않게)
   - 인터뷰 화면에서는 위쪽 이름(장시훈 EDITOR)이 사라지고 그 자리에 "소개" 글자가 놓임
   - 가장자리 안내 글자를 눌러도 넘어감. 휴대폰은 글자를 누르거나 카드 고리 바깥을 밀어서 넘김(위로 밀면 인터뷰, 아래로 밀면 소개)
   - 키보드 ← → ↑ ↓ (카드 고리를 고른 상태가 아닐 때), 주소 끝의 #blog · #about · #carousel · #interview 도 알아들음
   - 운영체제의 "동작 줄이기" 설정과 상관없이 움직임 (사이트 주인 요청) */
(() => {
  const track = document.querySelector('.track');
  if (!track) return;
  const world = document.querySelector('.world');
  const pages = [...track.querySelectorAll(':scope > .page')];
  const ids = pages.map((p) => p.id);
  const downPage = document.querySelector('.page-down');      // 소개 아래 화면(인터뷰)
  const all = downPage ? [...pages, downPage] : pages;
  const names = { blog: '개인 블로그', about: '소개', carousel: '인스타그램 카드뉴스', interview: '인터뷰' };
  const edge = {
    L: document.querySelector('.edge-l'), R: document.querySelector('.edge-r'),
    D: document.querySelector('.edge-b'), U: document.querySelector('.edge-t'),
  };
  const HOME = ids.indexOf('about');
  const EDGE = 0.15, DWELL = 400;
  document.documentElement.classList.add('pager-on');

  // 화면 밖에 있는 카드로 포커스가 가거나 브라우저가 무언가를 보여 주려 할 때, 틀이 스크롤되어 화면이 반쯤 걸치는 것을 막음
  const pager = document.querySelector('.pager');
  const unscroll = () => {
    if (pager && (pager.scrollLeft || pager.scrollTop)) { pager.scrollLeft = 0; pager.scrollTop = 0; }
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    all.forEach((p) => { if (p.scrollLeft || p.scrollTop) { p.scrollLeft = 0; p.scrollTop = 0; } });
  };
  if (pager) pager.addEventListener('scroll', unscroll, { passive: true });
  window.addEventListener('scroll', unscroll, { passive: true });
  all.forEach((p) => p.addEventListener('scroll', unscroll, { passive: true }));

  let index = HOME, down = false;
  const activePage = () => (down ? downPage : pages[index]);
  const fromHash = () => {
    const h = location.hash.slice(1);
    if (downPage && h === downPage.id) return [HOME, true];
    const i = ids.indexOf(h);
    return [i >= 0 ? i : HOME, false];
  };

  function go(i, d = false, instant = false) {
    down = !!(d && downPage);
    index = down ? HOME : Math.max(0, Math.min(pages.length - 1, i));
    const movers = world ? [track, world] : [track];
    if (instant) movers.forEach((m) => { m.style.transition = 'none'; });
    track.style.transform = `translateX(${(-index * 100 / pages.length).toFixed(4)}%)`;
    if (world) world.style.transform = down ? 'translateY(-100%)' : 'translateY(0)';
    if (instant) { void track.offsetWidth; movers.forEach((m) => { m.style.transition = ''; }); }
    const act = activePage();
    all.forEach((p) => {
      const on = p === act;
      p.classList.toggle('is-active', on);
      p.inert = !on;
      p.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    edge.L.hidden = down || index === 0;
    edge.R.hidden = down || index === pages.length - 1;
    if (edge.D) edge.D.hidden = !downPage || down || index !== HOME;
    if (edge.U) edge.U.hidden = !down;
    document.documentElement.classList.toggle('pager-down', down);   // 인터뷰 화면에서는 위쪽 이름을 감추고 그 자리에 "소개"
    if (!edge.L.hidden) edge.L.querySelector('.edge-label').textContent = names[ids[index - 1]];
    if (!edge.R.hidden) edge.R.querySelector('.edge-label').textContent = names[ids[index + 1]];
    const id = act.id;
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* 주소를 못 바꿔도 화면은 그대로 넘어감 */ }
    window.dispatchEvent(new CustomEvent('pager:change', { detail: { id, instant } }));
    unscroll();
  }

  // 방향: L 왼쪽 · R 오른쪽 · D 아래(소개 → 인터뷰) · U 위(인터뷰 → 소개)
  const can = (z) => (z === 'L' ? !down && index > 0
    : z === 'R' ? !down && index < pages.length - 1
    : z === 'D' ? !down && index === HOME && !!downPage
    : z === 'U' ? down : false);
  const move = (z) => {
    if (!can(z)) return;
    if (z === 'L') go(index - 1);
    else if (z === 'R') go(index + 1);
    else go(HOME, z === 'D');
  };

  // 커서가 가장자리 15% 안에 잠깐 머물면 넘어감
  let armed = true, zone = 0, timer = 0, lastAuto = 0;
  const setNear = (z) => Object.entries(edge).forEach(([k, b]) => b && b.classList.toggle('is-near', z === k));
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    // 카드 고리를 끌어 돌리는 중에는 가장자리에 닿아도 화면을 넘기지 않음
    if (document.documentElement.classList.contains('ring-dragging')) { clearTimeout(timer); zone = 0; setNear(0); return; }
    const x = e.clientX / window.innerWidth, y = e.clientY / window.innerHeight;
    let z = 0;
    if (x < EDGE) z = 'L';
    else if (x > 1 - EDGE) z = 'R';
    if (!can(z)) z = 0;
    if (!z && y > 1 - EDGE && can('D')) z = 'D';
    if (!z && y < EDGE && can('U')) z = 'U';
    // 블로그·카드뉴스·인터뷰 화면에서는 커서가 흰 칸 안에 있는 동안 가장자리 쪽이어도 넘어가지 않음.
    // 칸 바깥 여백이나 가장자리 글자 위로 나가야 넘어감
    const stage = activePage().querySelector('.stage3d');
    if (z && stage && !(e.target.closest && e.target.closest('.edge'))) {
      const r = stage.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) z = 0;
    }
    setNear(z);
    if (!z) { armed = true; zone = 0; clearTimeout(timer); return; }
    if (z === zone) return;
    zone = z; clearTimeout(timer);
    if (!armed) return;
    timer = setTimeout(() => {
      if (zone !== z || !armed || !can(z)) return;
      armed = false; lastAuto = performance.now(); move(z);
    }, DWELL);
  });
  // 커서가 창 밖으로 나가면 기다리던 전환을 취소
  document.documentElement.addEventListener('mouseleave', () => { clearTimeout(timer); zone = 0; setNear(0); });

  // 가장자리 안내 글자 누르기 (커서를 가져가는 사이 이미 넘어갔다면, 바로 뒤따르는 클릭으로 한 칸 더 넘어가지 않게)
  Object.values(edge).forEach((b) => b && b.addEventListener('click', () => {
    clearTimeout(timer);
    if (performance.now() - lastAuto < 1500) return;
    armed = false; move(b.dataset.go);
  }));

  // 화면 안의 #blog · #about · #carousel · #interview 링크 (예: 위쪽 이름)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const h = a.getAttribute('href').slice(1);
    const i = ids.indexOf(h);
    const toDown = !!downPage && h === downPage.id;
    if (i < 0 && !toDown) return;
    e.preventDefault(); clearTimeout(timer); armed = false;
    go(toDown ? HOME : i, toDown);
  });
  window.addEventListener('hashchange', () => { const [i, d] = fromHash(); go(i, d); });

  // 휠: 소개에서 아래로 굴리면 인터뷰, 인터뷰에서 위로 굴리면 소개 (카드 고리 위에서는 고리가 돎)
  let wheelSum = 0, wheelAt = 0, wheelLock = 0;
  window.addEventListener('wheel', (e) => {
    if (e.target.closest && e.target.closest('.scene, .vmodal')) return;
    const now = performance.now();
    if (now - wheelAt > 220) wheelSum = 0;
    wheelAt = now;
    if (now < wheelLock || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    wheelSum += e.deltaY;
    const z = wheelSum > 50 ? 'D' : wheelSum < -50 ? 'U' : 0;
    if (z && can(z)) { wheelSum = 0; wheelLock = now + 1300; clearTimeout(timer); armed = false; move(z); }
  }, { passive: true });

  // 키보드
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('.scene, input, textarea')) return;
    if (document.documentElement.classList.contains('vmodal-open')) return;
    const z = { ArrowLeft: 'L', ArrowRight: 'R', ArrowDown: 'D', ArrowUp: 'U' }[e.key];
    if (z && can(z)) { e.preventDefault(); move(z); }
  });

  // 휴대폰: 카드 고리 바깥을 좌우로 밀면 옆 화면, 위로 밀면 인터뷰, 아래로 밀면 소개
  let sx = 0, sy = 0, swipe = false;
  track.parentElement.addEventListener('touchstart', (e) => {
    swipe = !e.target.closest('.scene');   // 카드 고리 칸 안에서 미는 것은 고리 돌리기
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  track.parentElement.addEventListener('touchend', (e) => {
    if (!swipe) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 'R' : 'L');
    else if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.5) move(dy < 0 ? 'D' : 'U');
  }, { passive: true });

  const [i0, d0] = fromHash();
  go(i0, d0, true);
})();
