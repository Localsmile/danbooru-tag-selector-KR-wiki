// ==UserScript==
// @name         Danbooru Tag Selector + KR Wiki
// @namespace    https://github.com/Localsmile/danbooru-tag-selector-KR-wiki
// @version      에로롱 1.1
// @description  태그 선택/복사 + KR 위키 툴팁
// @author       Localsmile(로컬AI)
// @match        https://danbooru.donmai.us/posts/*
// @downloadURL  https://github.com/Localsmile/danbooru-tag-selector-KR-wiki/raw/refs/heads/main/danbooru-tag-selector.user.js
// @updateURL    https://github.com/Localsmile/danbooru-tag-selector-KR-wiki/raw/refs/heads/main/danbooru-tag-selector.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CSV_URL = 'https://raw.githubusercontent.com/Localsmile/danbooru_KR_wiki_tag_search/main/danbooru_tags_classified.csv';
  const LS_KEY = 'dtks_settings';

  const CAT = {
    0: { color: '#6e9fdb', bg: 'rgba(110,159,219,0.12)', border: 'rgba(110,159,219,0.35)' },
    1: { color: '#e87c7c', bg: 'rgba(232,124,124,0.12)', border: 'rgba(232,124,124,0.35)' },
    3: { color: '#c486db', bg: 'rgba(196,134,219,0.12)', border: 'rgba(196,134,219,0.35)' },
    4: { color: '#6eda8a', bg: 'rgba(110,218,138,0.12)', border: 'rgba(110,218,138,0.35)' },
    5: { color: '#d4c76a', bg: 'rgba(212,199,106,0.12)', border: 'rgba(212,199,106,0.35)' },
  };
  const CAT_DEF = { color: '#aaa', bg: 'rgba(170,170,170,0.1)', border: 'rgba(170,170,170,0.3)' };

  const selected = new Set();
  const krMap = new Map();

  let settings = { useSpaces: false, escParens: false };
  function loadSettings() {
    try { Object.assign(settings, JSON.parse(localStorage.getItem(LS_KEY))); } catch {}
  }
  function saveSettings() {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  }
  loadSettings();

  // spaces -> esc 순서. =_= >:( 같은거 건드림
  function formatTag(tag) {
    let t = tag;
    if (settings.useSpaces) t = t.replace(/([a-zA-Z0-9])_|_([a-zA-Z0-9])/g, (m,a,b) => (a||'') + ' ' + (b||''));
    if (settings.escParens) t = t.replace(/\(([^)]*?)\)/g, '\\($1\\)');
    return t;
  }

  const style = document.createElement('style');
  style.textContent = `
    /* 리모컨 자리 */
    #content { margin-left: 110px !important; }
    #content img, #content video, #content canvas {
      max-width: 100% !important; height: auto !important;
    }

    @media (max-width: 768px) {
      #content { margin-left: 0 !important; }
    }

    #tag-list li[class*="tag-type-"] {
      display: flex !important; align-items: center; gap: 6px;
      padding: 8px 12px !important; margin: 4px 0 !important;
      border-radius: 5px;
      user-select: none; -webkit-user-select: none;
      transition: background .12s, outline .12s;
      position: relative;
    }

    #tag-list li[class*="tag-type-"] a {
      text-decoration: none !important;
      position: relative; z-index: 2;
    }
    #tag-list li[class*="tag-type-"] a.search-tag {
      font-size: 15px; font-weight: 500;
      pointer-events: none;
    }
    #tag-list li[class*="tag-type-"] a.wiki-link {
      font-size: 12px; opacity: .85;
      color: #f0a050 !important;
      font-weight: 600;
    }
    #tag-list li[class*="tag-type-"] a.wiki-link:hover {
      opacity: 1; color: #ffb870 !important;
    }
    #tag-list li[class*="tag-type-"] span.post-count {
      font-size: 11px; opacity: .4;
    }

    .dtks-chk {
      flex-shrink: 0; width: 14px; height: 14px;
      border: 1.5px solid rgba(255,255,255,.25); border-radius: 3px;
      cursor: pointer; position: relative; z-index: 2;
      transition: border-color .12s, background .12s;
    }
    @media (max-width: 768px) {
      .dtks-chk { width: 24px; height: 24px; border-radius: 4px; }
    }
    .dtks-chk:hover { border-color: rgba(255,255,255,.5); }
    .dtks-chk.on {
      background: rgba(255,255,255,.8); border-color: rgba(255,255,255,.8);
    }

    #tag-list li[class*="tag-type-"].dtks-on {
      outline: 1.5px solid rgba(255,255,255,.3);
      outline-offset: -1.5px;
    }

    #dtks-tip {
      position: fixed; z-index: 999999; max-width: 280px;
      padding: 8px 12px; border-radius: 6px;
      font-size: 12px; line-height: 1.5;
      pointer-events: none; opacity: 0; transition: opacity .15s;
      box-shadow: 0 2px 12px rgba(0,0,0,.4);
      word-break: keep-all; overflow-wrap: break-word;
    }
    #dtks-tip.on { opacity: 1; }

    #dtks-bar {
      position: fixed; top: 50%; transform: translateY(-50%);
      z-index: 99999;
      display: flex; flex-direction: column; align-items: stretch; gap: 6px;
      background: #16161e; border: 1px solid #333; border-radius: 10px;
      padding: 10px 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,.5);
      font-size: 12px; color: #aaa;
      width: auto;
    }
    #dtks-bar button {
      background: #2a2a3a; color: #ccc; border: 1px solid #444;
      border-radius: 5px; padding: 6px 10px; font-size: 11px;
      cursor: pointer; white-space: nowrap; text-align: center;
      transition: background .12s, color .12s;
    }
    #dtks-bar button:hover { background: #3a3a50; color: #fff; }
    #dtks-bar button:active { background: #4a4a60; }
    #dtks-bar .ok { color: #6eda8a !important; border-color: #6eda8a !important; }
    #dtks-bar .dtks-sep { height: 1px; background: #333; flex-shrink: 0; }
    #dtks-bar label {
      display: flex; align-items: center; gap: 4px;
      cursor: pointer; white-space: nowrap; color: #888;
      font-size: 10px;
    }
    #dtks-bar label:hover { color: #bbb; }
    #dtks-bar input[type="checkbox"] {
      accent-color: #6e9fdb; width: 13px; height: 13px; cursor: pointer;
    }
    #dtks-bar .dtks-cnt {
      color: #6e9fdb; font-weight: 600; font-size: 12px; text-align: center;
    }

    @media (max-width: 768px) {
      #dtks-tip { max-width: 200px; font-size: 11px; }
      #dtks-bar { top: auto; bottom: 8px; left: 8px !important; transform: none;
        flex-direction: row; flex-wrap: wrap; padding: 6px 10px; gap: 6px; }
      #dtks-bar button { padding: 5px 8px; font-size: 11px; }
      #dtks-bar label { font-size: 10px; }
      #dtks-bar .dtks-sep { height: auto; width: 1px; min-height: 20px; }
    }
  `;
  document.head.appendChild(style);

  const tip = document.createElement('div');
  tip.id = 'dtks-tip';
  document.body.appendChild(tip);
  let tipT = null, lpT = null;

  function showTip(li, tag) {
    const d = krMap.get(tag);
    if (!d?.desc) return;
    const c = CAT[d.category] || CAT_DEF;
    tip.textContent = d.desc;
    tip.style.background = '#1a1a2e';
    tip.style.color = c.color;
    tip.style.border = `1px solid ${c.border}`;
    const r = li.getBoundingClientRect();
    let x = r.right + 8, y = r.top;
    if (x + 280 > innerWidth) x = r.left - 288;
    if (y < 4) y = 4;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.classList.add('on');
  }
  function hideTip() { tip.classList.remove('on'); clearTimeout(tipT); }

  const bar = document.createElement('div');
  bar.id = 'dtks-bar';
  bar.innerHTML = `
    <span class="dtks-cnt">0</span>
    <button class="dtks-all">전체 복사</button>
    <button class="dtks-sel">선택 복사</button>
    <button class="dtks-clr">해제</button>
    <div class="dtks-sep"></div>
    <label><input type="checkbox" class="dtks-sp" ${settings.useSpaces ? 'checked' : ''}>밑줄->띄어쓰기</label>
    <label><input type="checkbox" class="dtks-esc" ${settings.escParens ? 'checked' : ''}>괄호 이스케이프</label>
  `;
  document.body.appendChild(bar);

  const cntSpan = bar.querySelector('.dtks-cnt');
  const spChk = bar.querySelector('.dtks-sp');
  const escChk = bar.querySelector('.dtks-esc');

  function updateBar() { cntSpan.textContent = selected.size; }

  spChk.addEventListener('change', () => { settings.useSpaces = spChk.checked; saveSettings(); });
  escChk.addEventListener('change', () => { settings.escParens = escChk.checked; saveSettings(); });

  const flash = (btn, txt) => {
    btn.textContent = 'Copied'; btn.classList.add('ok');
    setTimeout(() => { btn.textContent = txt; btn.classList.remove('ok'); }, 1200);
  };

  bar.querySelector('.dtks-all').onclick = e => {
    e.stopPropagation();
    const tags = [...document.querySelectorAll('#tag-list li[class*="tag-type-"] a.search-tag')]
      .map(a => formatTag(a.textContent.trim().replaceAll(' ', '_')));
    if (!tags.length) return;
    GM_setClipboard(tags.join(', '), 'text');
    flash(e.target, '전체 복사');
  };

  bar.querySelector('.dtks-sel').onclick = e => {
    e.stopPropagation();
    if (!selected.size) return;
    const tags = [...document.querySelectorAll('#tag-list li[class*="tag-type-"] a.search-tag')]
      .map(a => a.textContent.trim().replaceAll(' ', '_'))
      .filter(t => selected.has(t)).map(formatTag);
    GM_setClipboard(tags.join(', '), 'text');
    flash(e.target, '선택 복사');
  };

  bar.querySelector('.dtks-clr').onclick = e => {
    e.stopPropagation();
    selected.clear();
    document.querySelectorAll('.dtks-on').forEach(el => el.classList.remove('dtks-on'));
    document.querySelectorAll('.dtks-chk.on').forEach(el => el.classList.remove('on'));
    updateBar();
  };

  function parseLine(line) {
    const p = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { q && line[i+1] === '"' ? (cur += '"', i++) : (q = !q); }
      else if (c === ',' && !q) { p.push(cur); cur = ''; }
      else cur += c;
    }
    p.push(cur);
    return p;
  }

  function clean(s) {
    if (!s) return '';
    return s.replace(/^\[.*?\]\s*/, '').replace(/\s*키워드:.*$/, '').replace(/\.\s*$/, '').trim();
  }

  function catOf(li) {
    for (const n of [0,1,3,4,5]) if (li.classList.contains('tag-type-'+n)) return n;
    return -1;
  }

  function styleTags() {
    document.querySelectorAll('#tag-list li[class*="tag-type-"]').forEach(li => {
      const c = CAT[catOf(li)] || CAT_DEF;
      li.style.background = c.bg;
      li.style.borderLeft = `3px solid ${c.color}`;
      const a = li.querySelector('a.search-tag');
      if (a) a.style.color = c.color;
    });
  }

  function bindEvents() {
    document.querySelectorAll('#tag-list li[class*="tag-type-"]').forEach(li => {
      const a = li.querySelector('a.search-tag');
      if (!a) return;
      const tag = a.textContent.trim().replaceAll(' ', '_');

      const chk = document.createElement('span');
      chk.className = 'dtks-chk';
      li.insertBefore(chk, li.firstChild);

      const toggle = () => {
        if (selected.has(tag)) {
          selected.delete(tag); li.classList.remove('dtks-on'); chk.classList.remove('on');
        } else {
          selected.add(tag); li.classList.add('dtks-on'); chk.classList.add('on');
        }
        updateBar();
      };

      chk.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggle(); });

      li.addEventListener('click', e => {
        if (e.target.closest('a.wiki-link')) return; // ? 링크만 패스스루
        if (e.target.classList.contains('dtks-chk')) return;
        e.preventDefault(); e.stopPropagation();
        toggle();
      });

      li.addEventListener('mouseenter', () => { tipT = setTimeout(() => showTip(li, tag), 300); });
      li.addEventListener('mouseleave', hideTip);

      // long press = tooltip on mobile
      li.addEventListener('touchstart', e => {
        lpT = setTimeout(() => { showTip(li, tag); setTimeout(hideTip, 2000); }, 500);
      }, { passive: true });
      li.addEventListener('touchend', () => clearTimeout(lpT));
      li.addEventListener('touchmove', () => { clearTimeout(lpT); hideTip(); });
    });
  }

  function loadCSV() {
    GM_xmlhttpRequest({
      method: 'GET', url: CSV_URL,
      onload(res) {
        if (res.status !== 200) return;
        for (const line of res.responseText.split('\n')) {
          if (!line.trim()) continue;
          const p = parseLine(line.trim());
          if (p.length < 4) continue;
          const tag = p[0].trim(), cat = +p[1], desc = clean(p[3].trim());
          if (tag && desc) krMap.set(tag, { category: cat, desc });
        }
      },
    });
  }

  function posBar() {
    const sb = document.getElementById('sidebar');
    if (!sb) { bar.style.left = '16px'; return; }
    const r = sb.getBoundingClientRect();
    bar.style.left = (r.right + 6) + 'px';
  }
  posBar();
  window.addEventListener('resize', posBar);
  window.addEventListener('scroll', posBar);

  styleTags();
  bindEvents();
  loadCSV();
})();
