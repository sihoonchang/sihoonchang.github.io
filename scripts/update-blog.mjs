// 네이버 블로그 새 글 → 사이트 01 블로그 칸 자동 반영
// GitHub Actions가 몇 시간마다 이 파일을 실행한다 (.github/workflows/site.yml).
//
// 1) 네이버 블로그 RSS(https://rss.blog.naver.com/4pril7th.xml)를 읽는다.
// 2) data/blog.json에 없는 글을 찾아 추가한다. 이미 있는 글은 건드리지 않는다
//    (사이트 주인이 직접 고친 제목·분류를 지키기 위해서).
// 3) 최신순으로 정렬해 index.html의 블로그 목록(표시 주석 사이)을 다시 만든다.
//    가장 최신 글 하나에만 "새 글" 빨간 점을 붙이고, 나머지는 서랍 안 목록에 넣는다.
//
// 직접 시험할 때: RSS_FILE=내려받은파일.xml node scripts/update-blog.mjs
// 외부 패키지 없이 Node 18 이상에서 돌아간다.

import { readFile, writeFile } from 'node:fs/promises';

const BLOG_ID = '4pril7th';
const RSS_URL = `https://rss.blog.naver.com/${BLOG_ID}.xml`;
const SHOW = 10;                       // 사이트에 보여 줄 최신 글 수 (맨 위 1편 + 서랍 9편)

const root = new URL('..', import.meta.url);
const dataFile = new URL('data/blog.json', root);
const indexFile = new URL('index.html', root);

// ---------- RSS 읽기 ----------
async function loadRss() {
  if (process.env.RSS_FILE) return readFile(process.env.RSS_FILE, 'utf8');
  const res = await fetch(RSS_URL, { headers: { 'user-agent': 'Mozilla/5.0 (portfolio blog sync; +https://sihoonchang.github.io)' } });
  if (!res.ok) throw new Error(`RSS 응답 ${res.status}`);
  return res.text();
}

const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&');

function field(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!m) return '';
  const raw = m[1].trim();
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return (cdata ? cdata[1] : decode(raw)).trim();
}

// 한국 시간 기준 YYYY.MM.DD
function kstDate(str) {
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '.');
}

function parseRss(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const it = m[1];
    const link = field(it, 'link') || field(it, 'guid');
    const id = (link.match(/blog\.naver\.com\/[^/?#]+\/(\d+)/) || link.match(/logNo=(\d+)/) || [])[1];
    if (!id) continue;
    items.push({
      id,
      date: kstDate(field(it, 'pubDate')),
      title: field(it, 'title').replace(/\s+/g, ' '),
      category: field(it, 'category').replace(/\s+/g, ' '),
    });
  }
  return items;
}

// ---------- HTML 만들기 (지금 사이트의 모양과 한 글자도 다르지 않게) ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function itemHtml(p, indent, isNew) {
  const pad = ' '.repeat(indent);
  const url = `https://blog.naver.com/${BLOG_ID}/${p.id}`;
  const badge = isNew ? '<span class="new">새 글</span>' : '';
  const body = p.category
    ? `${pad}  <span><b>${esc(p.title)}</b>${badge}\n${pad}  <p>${esc(p.category)}</p></span>\n`
    : `${pad}  <span><b>${esc(p.title)}</b>${badge}</span>\n`;
  return `${pad}<li><a href="${url}" target="_blank" rel="noopener">\n`
    + `${pad}  <span class="d dot">${esc(p.date)}</span>\n`
    + body
    + `${pad}  <span class="go" aria-hidden="true">↗</span>\n`
    + `${pad}</a></li>\n`;
}

function replaceBetween(html, name, inner) {
  const re = new RegExp(`(<!-- ${name}:start -->\\n)[\\s\\S]*?([ \\t]*<!-- ${name}:end -->)`);
  if (!re.test(html)) throw new Error(`index.html에서 ${name} 표시를 찾지 못함`);
  return html.replace(re, (_, a, b) => a + inner + b);
}

// ---------- 실행 ----------
const data = JSON.parse(await readFile(dataFile, 'utf8'));
const known = new Map(data.posts.map((p) => [p.id, p]));

let added = [];
try {
  const items = parseRss(await loadRss());
  console.log(`RSS에서 글 ${items.length}편을 읽음`);
  for (const it of items) {
    const have = known.get(it.id);
    if (!have) {
      known.set(it.id, it); added.push(it);
    } else if (!have.category && it.category) {
      have.category = it.category;   // 비어 있던 분류만 채움
    }
  }
} catch (err) {
  // 네이버가 잠시 응답하지 않아도 사이트는 지금 목록 그대로 둔다
  console.warn(`RSS를 읽지 못해 이번에는 건너뜀: ${err.message}`);
}

const posts = [...known.values()].sort((a, b) => (b.date.localeCompare(a.date)) || (b.id.localeCompare(a.id, 'en', { numeric: true })));
data.posts = posts;
await writeFile(dataFile, JSON.stringify(data, null, 2) + '\n');

const shown = posts.slice(0, SHOW);
let html = await readFile(indexFile, 'utf8');
html = replaceBetween(html, 'blog:top', shown.slice(0, 1).map((p) => itemHtml(p, 8, true)).join(''));
html = replaceBetween(html, 'blog:more', shown.slice(1).map((p) => itemHtml(p, 14, false)).join(''));
await writeFile(indexFile, html);

console.log(added.length ? `새 글 ${added.length}편 추가: ${added.map((p) => `${p.date} ${p.title}`).join(' / ')}` : '새 글 없음');
