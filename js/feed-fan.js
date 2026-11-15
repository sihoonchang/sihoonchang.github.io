/* 작업 소개의 카드뉴스 카드(부채꼴)를 아래 "02 인스타그램 카드뉴스" 칸에서 자동으로 만들기
   - 아래 칸(.feed)에 게시물을 추가하면, 그 첫 장 썸네일이 같은 순서로 부채꼴에 들어감
   - 부채꼴에는 앞에서부터 최대 5장까지 보이고, 라벨의 편수는 아래 칸의 게시물 수를 셈
   - 그래서 카드뉴스를 추가할 때는 아래 칸만 고치면 됨 */
(() => {
  const fan = document.querySelector('.fan');
  const feed = document.querySelector('.feed');
  if (!fan || !feed) return;

  const MAX = 5;
  const covers = [...feed.querySelectorAll('.cover img')];
  const n = Math.min(covers.length, MAX);
  if (n === 0) return;

  // 장 수에 따라 펼치는 간격(카드 폭 대비 %)과 기울기를 정함. 4장일 때 -62%, -21%, 21%, 62%
  const spread = n <= 4 ? 124 : 132;
  const step = n > 1 ? spread / (n - 1) : 0;

  fan.textContent = '';
  covers.slice(0, n).forEach((src, i) => {
    const k = i - (n - 1) / 2;
    const img = document.createElement('img');
    img.src = src.getAttribute('src');
    img.alt = '';
    img.width = 864; img.height = 1080;
    img.draggable = false;
    img.style.setProperty('--x', (k * step).toFixed(1) + '%');
    img.style.setProperty('--r', (k * 6).toFixed(1) + 'deg');
    img.style.zIndex = String(n - i);          // 첫 번째가 맨 앞
    fan.appendChild(img);
  });

  const label = document.querySelector('.card.tall .tag > span:last-child');
  if (label) label.textContent = `인스타그램 카드뉴스 · ${feed.children.length}편`;
})();
