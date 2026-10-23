(() => {
  'use strict';
  const resources = ['r001','r002','r003','r004','r007','r013','r014','r015','r016','r017'];
  const channels = ['site','article01','vk_post01','tg_post01','ok_post01','yt_video01','rutube_video01','email','catalog'];
  const sources = new Set(['reader_share','own_yt_video01','own_rutube_video01',
    ...resources.flatMap(r => channels.map(c => r + '_' + c))]);
  const campaigns = new Set(['pilot01','organic01','test01']);
  function cleanQuery(search) {
    const q = new URLSearchParams(search);
    const campaign = q.get('utm_campaign'), source = q.get('utm_source');
    if (!campaigns.has(campaign) || !sources.has(source) ||
        q.getAll('utm_campaign').length !== 1 || q.getAll('utm_source').length !== 1) return '';
    return '?' + new URLSearchParams({utm_campaign:campaign, utm_source:source}).toString();
  }

  const base = new URL('.', document.currentScript.src);
  async function init() {
    let config;
    try {
      const r = await fetch(new URL('config.json', base), {credentials: 'omit', cache: 'no-cache'});
      if (!r.ok) return;
      config = await r.json();
    } catch { return; }
    if (config.enabled !== true || !/^[a-z0-9][a-z0-9-]*$/.test(config.siteCode) ||
        location.hostname !== config.productionHost) return;
    const origin = 'https://' + config.siteCode + '.goatcounter.com';
    // The service never needs cookies for collection or public counts.
    // Owner may set this local flag manually; no identifier is created for readers.
    let excluded = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
    try { excluded = excluded || localStorage.getItem('skipgc') === 't'; } catch {}
    if (!excluded) {
      window.goatcounter = {no_onload: true, no_events: true};
      const tracker = document.createElement('script');
      tracker.async = true; tracker.src = 'https://gc.zgo.at/count.js';
      tracker.referrerPolicy = 'no-referrer';
      tracker.setAttribute('data-goatcounter', origin + '/count');
      tracker.onload = () => {
        const gc = window.goatcounter;
        if (!gc || typeof gc.count !== 'function') return;
        // Keep only public placement codes. Full query strings and screen width never leave.
        // No sessions or campaign persistence between pages.
        const original = gc.get_data;
        gc.get_data = vars => { const data = original(vars); const q = cleanQuery(location.search); if (q) data.q = q; else delete data.q; delete data.s; return data; };
        let referrer = '';
        try {
          const ref = new URL(document.referrer);
          if (ref.origin !== location.origin) referrer = ref.origin;
        } catch {}
        const count = () => gc.count({path: location.pathname === '/index.html' ? '/' : location.pathname,
          title: document.title, referrer, no_session: true});
        if (document.prerendering) document.addEventListener('prerenderingchange', count, {once: true});
        else count();
      };
      document.head.append(tracker);
    }
    const footer = document.querySelector('footer');
    if (!footer) return;
    const section = document.createElement('section'); section.className = 'visitor-stats';
    section.setAttribute('aria-label', 'Статистика просмотров страниц');
    const heading = document.createElement('h2'); heading.textContent = 'Просмотры страниц';
    const grid = document.createElement('div'); grid.className = 'visitor-stats-grid';
    const cells = ['Сегодня', 'За текущий месяц', 'За всё время'].map(label => {
      const cell = document.createElement('div'), caption = document.createElement('span'), number = document.createElement('strong');
      caption.textContent = label; number.textContent = '—'; cell.append(caption, number); grid.append(cell); return number;
    });
    const note = document.createElement('p');
    note.textContent = 'Учтённые открытия страниц, включая повторные. Периоды — по UTC (новый день в 03:00 по Москве). Данные могут задерживаться до 4 часов. ';
    const link = document.createElement('a'); link.href = 'privacy.html'; link.textContent = 'О статистике'; note.append(link);
    const status = document.createElement('p'); status.textContent = 'Загрузка статистики…';
    section.append(heading, grid, note, status); footer.append(section);
    let generation = 0;
    async function refresh() {
      const current = ++generation;
      const today = new Date().toISOString().slice(0, 10);
      const month = today.slice(0, 7) + '-01';
      // No relative "month": GoatCounter interprets it as the last 30 days.
      const starts = [today, month, null];
      cells.forEach(cell => { cell.textContent = '—'; });
      const results = await Promise.allSettled(starts.map(async start => {
        const url = new URL('/counter/TOTAL.json', origin);
        if (start) url.searchParams.set('start', start);
        const r = await fetch(url, {credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000)});
        if (!r.ok) throw new Error('unavailable');
        const body = await r.json();
        const value = String(body.count);
        if (!/^(?:\d+|\d{1,3}(?:[ ,.\u00a0\u202f'’]\d{3})+)$/.test(value)) throw new Error('invalid count');
        const n = Number(value.replace(/\D/g, ''));
        if (!Number.isSafeInteger(n)) throw new Error('invalid count');
        return new Intl.NumberFormat('ru-RU').format(n);
      }));
      if (current !== generation) return;
      // A response started before UTC midnight must not be labelled "today" afterwards.
      if (today !== new Date().toISOString().slice(0, 10)) { refresh(); return; }
      results.forEach((r, i) => { if (r.status === 'fulfilled') cells[i].textContent = r.value; });
      status.textContent = results.some(r => r.status === 'rejected') ? 'Часть статистики временно недоступна.' : 'Данные получены из GoatCounter.';
    }
    refresh().catch(() => { status.textContent = 'Статистика временно недоступна.'; });
    // Keep long-open tabs and UTC month/day boundaries correct; never add tracking hits here.
    setInterval(() => refresh().catch(() => {}), 15 * 60000);
  }
  init().catch(() => {});
})();
