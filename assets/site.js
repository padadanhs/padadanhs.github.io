'use strict';

/* ==========================================================
   PNHS site.js — clean, single source of truth
   ========================================================== */
const PNHS = (() => {
  // ---------- Shortcuts ----------
  const q  = (s, sc=document) => sc.querySelector(s);
  const qa = (s, sc=document) => [...sc.querySelectorAll(s)];
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  // ---------- Fetch helper ----------
  async function pull(url){
    const r = await fetch(url);
    if(!r.ok) throw new Error('Load failed: '+url);
    return await r.json();
  }

  // ---------- Footer year ----------
  function mountYear(){
    const y = q('#year');
    if (y) y.textContent = new Date().getFullYear();
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

    // Burger toggle (mobile)
    if (burger && menu) {
      on(burger,'click', () => {
        const open = menu.classList.contains('open');
        menu.classList.toggle('open', !open);
        burger.setAttribute('aria-expanded', String(!open));
      });
    }

    // Click-to-open for dropdown buttons (desktop & mobile)
    qa('.nav__dropdown > .nav__link').forEach(btn => {
      btn.setAttribute('type','button'); // make sure it's not a submit
      on(btn,'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const parent = btn.parentElement;

        // close other open dropdowns
        qa('.nav__dropdown.open').forEach(dd => { if (dd !== parent) dd.classList.remove('open'); });

        // toggle current
        const willOpen = !parent.classList.contains('open');
        parent.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });

    // Auto-close dropdowns when a menu link is clicked
    qa('.nav__dropdown .nav__panel a').forEach(link => {
      on(link,'click', () => {
        // Close dropdowns and the mobile menu immediately
        closeAllMenus();
      });
    });

    // Close when clicking outside the header
    on(document,'click', (e) => {
      if (!e.target.closest('.site-header')) closeAllMenus();
    });

    // Close with ESC
    on(document,'keydown', (e) => {
      if (e.key === 'Escape') closeAllMenus();
    });

    // Reset on resize (prevents stuck states)
    on(window,'resize', () => {
      qa('.nav__dropdown.open').forEach(dd => dd.classList.remove('open'));
      if (menu) menu.classList.remove('open');
      if (burger) burger.setAttribute('aria-expanded','false');
    });
  }

  // ---------- Homepage: latest posts ----------
  async function mountLatest(){
    const host = q('#latest-posts'); if(!host) return;
    try{
      const posts = await pull('posts/posts.json');
      host.innerHTML = posts.slice(0,6).map(card).join('');
    }catch(e){
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
  function card(p){
    return `<article class="card">
      <img src="${p.cover||'images/post-placeholder.jpg'}" alt="">
      <h3><a href="article.html?id=${encodeURIComponent(p.id)}">${p.title}</a></h3>
      <p class="muted">${p.section} • ${p.date}</p>
      <p>${p.teaser||''}</p>
    </article>`;
  }
  function renderPosts(arr){ q('#post-list').innerHTML = arr.map(card).join(''); }
  function filterPosts(){
    const t = (q('#post-filter')?.value||'').toLowerCase();
    const s = q('#post-section')?.value||'';
    const f = ALL_POSTS.filter(p =>
      (!s || p.section===s) &&
      (!t || p.title.toLowerCase().includes(t) || p.body.toLowerCase().includes(t))
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
        <h1>${p.title}</h1>
        <div class="meta">${p.section} • ${p.author||'PNHS School Paper'} • ${p.date}</div>
        ${p.cover?`<img src="${p.cover}" alt="">`:''}
        <div>${p.body}</div>
      </article>`;
    document.title = p.title+' · PNHS';
  }

  // ---------- Memos ----------
  async function mountMemos(){
    const host = q('#memo-list'); if(!host) return;
    const memos = await pull('data/memos.json');
    host.innerHTML = memos.map(m => `
      <article class="card">
        <h3>${m.title}</h3>
        <p class="muted">${m.date}</p>
        <p>${m.summary||''}</p>
        ${m.file?`<p><a class="btn" href="${m.file}">Open document</a></p>`:''}
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
    const items = ev.map(e => `<li><strong>${e.date}</strong> — ${e.title} <span class="muted">${e.location||''}</span></li>`).join('');
    if(home) home.innerHTML = items;
    if(cal)  cal.innerHTML  = items;
  }

  // ---------- Search (posts, memos, and pages) ----------
  async function search(){
    const box = q('#site-search');
    const res = q('#search-results');
    const t = (box?.value||'').trim().toLowerCase();
    if(!t){ res.hidden=true; res.innerHTML=''; return; }

    const [posts, memos, pages] = await Promise.allSettled([
      pull('posts/posts.json'),
      pull('data/memos.json'),
      pull('data/pages.json') // optional; include if you have it
    ]);

    const hitPosts = posts.status==='fulfilled'
      ? posts.value.filter(p => (p.title+p.body).toLowerCase().includes(t))
          .map(p => ({kind:'Article', title:p.title, url:`article.html?id=${encodeURIComponent(p.id)}`}))
      : [];

    const hitMemos = memos.status==='fulfilled'
      ? memos.value.filter(m => (m.title+(m.summary||'')).toLowerCase().includes(t))
          .map(m => ({kind:'Memo', title:m.title, url:m.file||'schoolmemo.html'}))
      : [];

    const hitPages = pages.status==='fulfilled'
      ? pages.value.flatMap(pg => {
          const hay = (pg.title + ' ' + (pg.headings||[]).join(' ')).toLowerCase();
          return hay.includes(t) ? [{kind:'Page', title:pg.title, url:pg.url}] : [];
        })
      : [];

    const arr = [...hitPages, ...hitPosts, ...hitMemos];

    res.hidden = false;
    res.innerHTML = arr.length
      ? arr.map(x => `<div><span class="tag">${x.kind}</span> <a href="${x.url}">${x.title}</a></div>`).join('')
      : '<p>No results.</p>';
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    mountYear();
    mountNav();
    mountLatest();
    mountBlog();
    mountArticle();
    mountMemos();
    mountEvents();
  });

  // Public API
  return { search, filterPosts, filterMemos };
})();
// ===== NAV: burger + mobile dropdowns (desktop uses CSS hover) =====
document.addEventListener('DOMContentLoaded', () => {
  const burger = document.querySelector('.nav__toggle');
  const menu   = document.querySelector('#navmenu');

  // Burger (mobile)
  if (burger && menu) {
    burger.addEventListener('click', () => {
      const open = menu.classList.contains('open');
      menu.classList.toggle('open', !open);
      burger.setAttribute('aria-expanded', String(!open));
    });
  }

  // Mobile: tap parent to open its submenu (≤960px only)
  document.querySelectorAll('.nav__dropdown > .nav__link').forEach(btn => {
    btn.setAttribute('type','button');
    btn.addEventListener('click', (e) => {
      if (window.innerWidth <= 960) {
        e.preventDefault();
        const dd = btn.closest('.nav__dropdown');
        // close others
        document.querySelectorAll('.nav__dropdown.open').forEach(x => { if (x !== dd) x.classList.remove('open'); });
        dd.classList.toggle('open');
        btn.setAttribute('aria-expanded', dd.classList.contains('open') ? 'true' : 'false');
      }
    });
  });

  // Click outside to close on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth > 960) return; // desktop handled by CSS hover
    if (!e.target.closest('.site-header')) {
      document.querySelectorAll('.nav__dropdown.open').forEach(d => d.classList.remove('open'));
      if (menu) menu.classList.remove('open');
      if (burger) burger.setAttribute('aria-expanded','false');
    }
  });

  // Reset when resizing up
  window.addEventListener('resize', () => {
    if (window.innerWidth > 960) {
      document.querySelectorAll('.nav__dropdown.open').forEach(d => d.classList.remove('open'));
      if (menu) menu.classList.remove('open');
      if (burger) burger.setAttribute('aria-expanded','false');
    }
  });
});
