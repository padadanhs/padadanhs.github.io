/* assets/site.js */
window.PNHS = (() => {
  'use strict';

  // ---------- Shortcuts ----------
  const q  = (s, sc=document) => sc.querySelector(s);
  const qa = (s, sc=document) => Array.from(sc.querySelectorAll(s));
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  // ---------- Fetch helper (tolerant JSON; allows leading HTML comments) ----------
  async function pull(url){
    const r = await fetch(url, { cache: 'no-cache' });
    if(!r.ok) throw new Error('Load failed: ' + url);
    const raw = await r.text();

    const cleaned = raw
      .replace(/^﻿/, '')                  // BOM
      .replace(/<!--[\s\S]*?-->/g, '')    // strip HTML comments
      .trim();

    try{
      return JSON.parse(cleaned);
    }catch(err){
      console.error('JSON parse failed for', url, err);
      throw err;
    }
  }

  // ---------- Footer year ----------
  function mountYear(){
    const y = q('#year');
    if (y) y.textContent = new Date().getFullYear();
  }

  // ---------- HTML escape ----------
  function escHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  // ---------- Carousel (index highlights) ----------
  function mountCarousel(){
    const root = q('#carousel');
    if (!root) return;

    // Guard: prevents double-init if you accidentally include carousel.js too
    if (root.dataset.mounted === '1') return;
    root.dataset.mounted = '1';

    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '0');

    const track = q('#slider-track', root) || q('.slider__track', root);
    const dots  = q('#slider-dots', root)  || q('.slider__dots', root);
    const prev  = q('.slider__btn--prev', root);
    const next  = q('.slider__btn--next', root);

    if (!track) return;

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // NOTE: you said your images are in ROOT /carousel (not /images)
    const fallback = [
      { src: 'carousel/1.jpg', alt: 'Padada NHS campus aerial view' },
      { src: 'carousel/2.jpg', alt: 'Student activities and intramurals' },
      { src: 'carousel/3.jpg', alt: 'Learning spaces and laboratories' }
    ];

    let slides = [];
    let idx = 0;
    let timer = null;

    function setIdx(n, userInitiated=false){
      if (!slides.length) return;
      idx = (n + slides.length) % slides.length;
      track.style.transform = `translateX(${-idx * 100}%)`;

      if (dots){
        qa('.slider__dot', dots).forEach((b, i) => {
          b.setAttribute('aria-current', i === idx ? 'true' : 'false');
        });
      }
      if (userInitiated) restart();
    }

    function stop(){
      if (timer){ clearInterval(timer); timer = null; }
    }
    function start(){
      if (slides.length < 2) return;
      stop();

      if (reduced) track.style.transition = 'none';
      else track.style.transition = '';

      const ms = reduced ? 7500 : 4200;
      timer = setInterval(() => setIdx(idx + 1, false), ms);
    }
    function restart(){ stop(); start(); }

    function wireControls(){
      on(prev, 'click', () => setIdx(idx - 1, true));
      on(next, 'click', () => setIdx(idx + 1, true));

      on(root, 'mouseenter', stop);
      on(root, 'mouseleave', start);
      on(root, 'focusin', stop);
      on(root, 'focusout', start);

      on(root, 'keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); setIdx(idx - 1, true); }
        if (e.key === 'ArrowRight'){ e.preventDefault(); setIdx(idx + 1, true); }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop(); else start();
      });
    }

    function render(){
      track.innerHTML = slides.map((s, i) => {
        const alt = escHtml(s.alt || 'Campus image');
        const eager = (i === 0) ? 'eager' : 'lazy';
        const src = String(s.src || '');
        const srcEnc = encodeURI(src);
        return `
          <div class="slider__slide" role="group" aria-roledescription="slide" aria-label="${i+1} of ${slides.length}">
            <img class="slider__img" src="${srcEnc}" alt="${alt}" loading="${eager}" decoding="async" />
          </div>`;
      }).join('');

      if (dots){
        dots.removeAttribute('aria-hidden');
        dots.innerHTML = slides.map((_, i) =>
          `<button class="slider__dot" type="button" aria-label="Go to slide ${i+1}"></button>`
        ).join('');
        qa('.slider__dot', dots).forEach((b, i) => on(b, 'click', () => setIdx(i, true)));
      }

      if (slides.length < 2){
        if (prev) prev.disabled = true;
        if (next) next.disabled = true;
      }

      setIdx(0, false);
      wireControls();
      start();
    }

    (async () => {
      try{
        // Your intended JSON location
        const data = await pull('data/carousel.json');
        slides = Array.isArray(data) ? data : [];
      }catch(_e){
        slides = [];
      }

      if (!slides.length) slides = fallback;

      slides = slides
        .map(x => ({ src: x.src, alt: x.alt || '', caption: x.caption || '' }))
        .filter(x => x.src);

      render();
    })();
  }

  // ---------- NAV ----------
  function closeAllMenus(){
    qa('.nav__dropdown.open').forEach(dd => dd.classList.remove('open'));
    const burger = q('.nav__toggle');
    const menu   = q('#navmenu');
    if (menu) menu.classList.remove('open');
    if (burger) burger.setAttribute('aria-expanded','false');
  }

  function mountNav(){
    const burger = q('.nav__toggle');
    const menu   = q('#navmenu');

    if (burger && menu && burger.dataset.wired !== '1') {
      burger.dataset.wired = '1';
      on(burger,'click', () => {
        const open = menu.classList.contains('open');
        menu.classList.toggle('open', !open);
        burger.setAttribute('aria-expanded', String(!open));
      });
    }

    qa('.nav__dropdown > .nav__link').forEach(btn => {
      if (btn.dataset.wired === '1') return;
      btn.dataset.wired = '1';

      btn.setAttribute('type','button');
      on(btn,'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const parent = btn.parentElement;

        qa('.nav__dropdown.open').forEach(dd => { if (dd !== parent) dd.classList.remove('open'); });

        const willOpen = !parent.classList.contains('open');
        parent.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });

    qa('.nav__dropdown .nav__panel a').forEach(link => {
      if (link.dataset.wired === '1') return;
      link.dataset.wired = '1';
      on(link,'click', () => closeAllMenus());
    });

    on(document,'click', (e) => {
      if (!e.target.closest('.site-header')) closeAllMenus();
    });

    on(document,'keydown', (e) => {
      if (e.key === 'Escape') closeAllMenus();
    });

    on(window,'resize', () => {
      qa('.nav__dropdown.open').forEach(dd => dd.classList.remove('open'));
      if (menu) menu.classList.remove('open');
      if (burger) burger.setAttribute('aria-expanded','false');
    });
  }

  // ---------- Homepage: latest posts ----------
  function card(p){
    return `<article class="card">
      <img src="${p.cover||'images/post-placeholder.jpg'}" alt="">
      <h3><a href="article.html?id=${encodeURIComponent(p.id)}">${escHtml(p.title)}</a></h3>
      <p class="muted">${escHtml(p.section)} • ${escHtml(p.date)}</p>
      <p>${escHtml(p.teaser||'')}</p>
    </article>`;
  }

  async function mountLatest(){
    const host = q('#latest-posts'); if(!host) return;
    try{
      const posts = await pull('posts/posts.json');
      host.innerHTML = posts.slice(0,6).map(card).join('');
    }catch(_e){
      host.innerHTML = '<p class="muted">No posts yet.</p>';
    }
  }

  // ---------- Blog list + filter ----------
  let ALL_POSTS = [];
  async function mountBlog(){
    const list = q('#post-list'); if(!list) return;
    ALL_POSTS = await pull('posts/posts.json');
    renderPosts(ALL_POSTS);
  }

  function renderPosts(arr){
    const host = q('#post-list');
    if (!host) return;
    host.innerHTML = arr.map(card).join('');
  }

  function filterPosts(){
    const t = (q('#post-filter')?.value||'').toLowerCase();
    const s = q('#post-section')?.value||'';
    const f = ALL_POSTS.filter(p =>
      (!s || p.section===s) &&
      (!t || String(p.title||'').toLowerCase().includes(t) || String(p.body||'').toLowerCase().includes(t))
    );
    renderPosts(f);
  }

  // ---------- Single article ----------
  async function mountArticle(){
    const host = q('#article'); if(!host) return;
    const id = new URLSearchParams(location.search).get('id');
    const posts = await pull('posts/posts.json');
    const p = posts.find(x => x.id===id) || posts[0];

    host.innerHTML = `
      <article>
        <h1>${escHtml(p.title)}</h1>
        <div class="meta">${escHtml(p.section)} • ${escHtml(p.author||'PNHS School Paper')} • ${escHtml(p.date)}</div>
        ${p.cover?`<img src="${escHtml(p.cover)}" alt="">`:''}
        <div>${p.body || ''}</div>
      </article>`;

    document.title = (p.title || 'Article') + ' · PNHS';
  }

  // ---------- Memos ----------
  async function mountMemos(){
    const host = q('#memo-list'); if(!host) return;
    const memos = await pull('data/memos.json');
    host.innerHTML = memos.map(m => `
      <article class="card">
        <h3>${escHtml(m.title)}</h3>
        <p class="muted">${escHtml(m.date)}</p>
        <p>${escHtml(m.summary||'')}</p>
        ${m.file?`<p><a class="btn" href="${escHtml(m.file)}">Open document</a></p>`:''}
      </article>`).join('');
  }

  function filterMemos(){
    const t = (q('#memo-filter')?.value||'').toLowerCase();
    qa('#memo-list .card').forEach(c=>{
      c.classList.toggle('hidden', !c.textContent.toLowerCase().includes(t));
    });
  }

  // ---------- Events ----------
  async function mountEvents(){
    const home = q('#upcoming-events');
    const cal  = q('#calendar-events');
    if(!home && !cal) return;

    const ev = await pull('data/events.json');
    const items = ev.map(e =>
      `<li><strong>${escHtml(e.date)}</strong> — ${escHtml(e.title)} <span class="muted">${escHtml(e.location||'')}</span></li>`
    ).join('');

    if(home) home.innerHTML = items;
    if(cal)  cal.innerHTML  = items;
  }

  // ---------- Search UI helpers ----------
  function ensureSearchUI(){
    const box = q('#site-search');
    if(!box) return { box:null, res:null };

    let res = q('#search-results');
    if(!res){
      const row = box.closest('.search') || box.parentElement;
      res = document.createElement('div');
      res.id = 'search-results';
      res.className = 'card search-results';
      res.setAttribute('role','listbox');
      res.setAttribute('aria-label','Search results');
      res.hidden = true;

      if(row && row.parentElement){
        row.insertAdjacentElement('afterend', res);
      }else{
        document.body.appendChild(res);
      }
    }
    return { box, res };
  }

  function wireSearch(){
    const { box, res } = ensureSearchUI();
    if(!box || box.dataset.wired==='1') return;
    box.dataset.wired = '1';

    on(box, 'keydown', (e) => {
      if(e.key === 'Enter'){ e.preventDefault(); search(); }
      if(e.key === 'Escape'){ if(res){ res.hidden = true; res.innerHTML=''; } box.blur(); }
    });

    on(document, 'click', (e) => {
      const inside = (e.target === box) || (res && res.contains(e.target));
      if(!inside && res){ res.hidden = true; }
    });
  }

  // ---------- Search index ----------
  let SEARCH_INDEX = null;
  async function loadSearchIndex(){
    if (Array.isArray(SEARCH_INDEX)) return SEARCH_INDEX;
    try{
      const idx = await pull('data/search-index.json');
      SEARCH_INDEX = Array.isArray(idx) ? idx : [];
    }catch(_e){
      SEARCH_INDEX = [];
    }
    return SEARCH_INDEX;
  }

  // ---------- Search (posts, memos, and pages) ----------
  async function search(){
    const { box, res } = ensureSearchUI();
    const query = (box?.value||'').trim().toLowerCase();
    if(!query){ if(res){ res.hidden=true; res.innerHTML=''; } return; }
    if(!res) return;

    const terms = query.split(/\s+/).filter(t => t.length >= 2);

    // 1) Pages
    const idx = await loadSearchIndex();
    const pageHits = (Array.isArray(idx) ? idx : [])
      .map(pg => {
        const title = String(pg.title||'');
        const url = String(pg.url||'');
        const keywords = Array.isArray(pg.keywords) ? pg.keywords.join(' ') : String(pg.keywords||'');
        const excerpt = String(pg.excerpt||'');
        const hay = (title + ' ' + keywords + ' ' + excerpt).toLowerCase();

        let score = 0;
        for (const t of terms){
          if (!hay.includes(t)) continue;
          score += 1;
          if (title.toLowerCase().includes(t)) score += 3;
          if (keywords.toLowerCase().includes(t)) score += 1;
        }
        return (score > 0 && url) ? ({ kind:'Page', title, url, excerpt, score }) : null;
      })
      .filter(Boolean)
      .sort((a,b) => b.score - a.score)
      .slice(0, 12);

    // 2) Posts + memos
    const [postsR, memosR] = await Promise.allSettled([
      pull('posts/posts.json'),
      pull('data/memos.json')
    ]);

    const postHits = postsR.status==='fulfilled' && Array.isArray(postsR.value)
      ? postsR.value
          .filter(p => (String(p.title||'') + ' ' + String(p.body||'')).toLowerCase().includes(query))
          .slice(0, 8)
          .map(p => ({ kind:'Article', title:p.title, url:`article.html?id=${encodeURIComponent(p.id)}` }))
      : [];

    const memoHits = memosR.status==='fulfilled' && Array.isArray(memosR.value)
      ? memosR.value
          .filter(m => (String(m.title||'') + ' ' + String(m.summary||'')).toLowerCase().includes(query))
          .slice(0, 8)
          .map(m => ({ kind:'Memo', title:m.title, url:m.file||'schoolmemo.html' }))
      : [];

    const combined = [...pageHits, ...postHits, ...memoHits];

    res.hidden = false;
    res.innerHTML = combined.length
      ? combined.map(x => {
          const tag = `<span class="tag">${escHtml(x.kind)}</span>`;
          const title = `<a href="${escHtml(x.url)}">${escHtml(x.title)}</a>`;
          const sub = x.excerpt ? `<div class="muted" style="margin:.25rem 0 0">${escHtml(x.excerpt)}</div>` : '';
          return `<div style="padding:8px 0; border-bottom:1px solid var(--border)">${tag} ${title}${sub}</div>`;
        }).join('') + `<div style="padding-top:8px" class="muted">Tip: try keywords like “enrollment”, “history”, “teachers”, “memos”.</div>`
      : '<p>No results.</p>';
  }

  // ---------- Org: Department teacher lists ----------
  function mountDeptLists(){
    const cards = qa('.dept-card');
    if(!cards.length) return;

    const expandable = cards.filter(c => c.querySelector('.dept-panel'));
    if(!expandable.length) return;

    function closeCard(c){
      const panel = q('.dept-panel', c);
      if(panel) panel.hidden = true;
      c.classList.remove('open');
      c.setAttribute('aria-expanded','false');
    }
    function openCard(c){
      const panel = q('.dept-panel', c);
      if(panel) panel.hidden = false;
      c.classList.add('open');
      c.setAttribute('aria-expanded','true');
    }
    function closeAll(except=null){
      expandable.forEach(c => { if(c !== except) closeCard(c); });
    }

    expandable.forEach(c => {
      if (c.dataset.wired === '1') return;
      c.dataset.wired = '1';

      c.setAttribute('tabindex','0');
      c.setAttribute('role','button');
      c.setAttribute('aria-expanded','false');

      const panel = q('.dept-panel', c);
      if(panel) panel.hidden = true;

      on(c,'click', (e) => {
        if (e.target.closest('.dept-panel')) return;
        e.preventDefault();
        e.stopPropagation();
        const isOpen = c.classList.contains('open');
        closeAll(c);
        isOpen ? closeCard(c) : openCard(c);
      });

      on(c,'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const isOpen = c.classList.contains('open');
          closeAll(c);
          isOpen ? closeCard(c) : openCard(c);
        }
        if (e.key === 'Escape') closeAll();
      });
    });

    on(document,'click', (e) => {
      if (!e.target.closest('.dept-card')) closeAll();
    });

    on(document,'keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    mountYear();
    mountNav();
    wireSearch();
    mountCarousel();
    mountLatest();
    mountBlog();
    mountArticle();
    mountMemos();
    mountEvents();
    mountDeptLists();
  });

  // Public API
  return { search, filterPosts, filterMemos };
})();
