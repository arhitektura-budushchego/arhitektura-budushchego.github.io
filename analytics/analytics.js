(() => {
  'use strict';
  let sources = new Set(), campaigns = new Set();
  const campaignCode = /^(?:c[0-9]{3}|pilot[0-9]{2}|organic[0-9]{2}|test[0-9]{2}|bloggers[0-9]{2})$/;
  const sourceCode = /^(?:p[0-9]{3}|r[0-9]{3}_(?:site|article[0-9]{2}|vk_post[0-9]{2}|tg_post[0-9]{2}|ok_post[0-9]{2}|yt_video[0-9]{2}|rutube_video[0-9]{2}|email|catalog|review[0-9]{2})|reader_share|own_yt_video[0-9]{2}|own_rutube_video[0-9]{2})$/;
  function setAttribution(data) {
    if (!data || data.version !== 1 || Object.keys(data).sort().join(',') !== 'campaigns,sources,version') return;
    const valid = (list, limit, pattern) => Array.isArray(list) && list.length <= limit &&
      list.every(code => typeof code === 'string' && pattern.test(code)) && new Set(list).size === list.length;
    if (!valid(data.campaigns, 100, campaignCode) || !valid(data.sources, 2000, sourceCode)) return;
    campaigns = new Set(data.campaigns); sources = new Set(data.sources);
  }
  function cleanQuery(search) {
    const q = new URLSearchParams(search);
    const campaign = q.get('utm_campaign'), source = q.get('utm_source');
    if (!campaigns.has(campaign) || !sources.has(source) ||
        q.getAll('utm_campaign').length !== 1 || q.getAll('utm_source').length !== 1) return '';
    return '?' + new URLSearchParams({utm_campaign:campaign, utm_source:source}).toString();
  }

  const base = new URL('.', document.currentScript.src);
  async function fetchWithTimeout(url, options, timeout, read) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {...options, signal: controller.signal});
      if (!response.ok) throw new Error('unavailable');
      return await read(response);
    } finally {
      clearTimeout(timer);
    }
  }

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
    // Configuration contains public placement codes only, never contacts or visitor IDs.
    // Failure disables attribution, not the page or ordinary pageview counting.
    try {
      const body = await fetchWithTimeout(new URL('attribution.json', base), {
        credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache'
      }, 5000, response => response.text());
      if (body.length <= 131072) setAttribution(JSON.parse(body));
    } catch { /* Empty allowlists: no query parameters are sent. */ }

    // The service never needs cookies for collection or public counts.
    // Owner may set this local flag manually; no identifier is created for readers.
    let excluded = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
    try { excluded = excluded || localStorage.getItem('skipgc') === 't'; } catch {}
    if (!excluded) {
      window.goatcounter = {no_onload: true, no_events: true};
      const tracker = document.createElement('script');
      tracker.async = true; tracker.src = new URL('goatcounter-count.js', base).href;
      tracker.referrerPolicy = 'no-referrer';
      tracker.setAttribute('data-goatcounter', origin + '/count');
      tracker.onload = () => {
        const gc = window.goatcounter;
        if (!gc || typeof gc.count !== 'function') return;
        // Keep only public placement codes. Full query strings never leave.
        // Sessions are enabled in GoatCounter; campaign attribution is not persisted between pages.
        const original = gc.get_data;
        gc.get_data = vars => { const data = original(vars); const q = cleanQuery(location.search); if (q) data.q = q; else delete data.q; return data; };
        let referrer = '';
        try {
          const ref = new URL(document.referrer);
          if (ref.origin !== location.origin) referrer = ref.origin;
        } catch {}
        const count = () => gc.count({path: location.pathname === '/index.html' ? '/' : location.pathname,
          title: document.title, referrer});
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
    const link = document.createElement('a'); link.href = new URL('../privacy.html', base).href; link.textContent = 'О статистике'; note.append(link);
    const status = document.createElement('p'); status.textContent = 'Загрузка статистики…';
    section.append(heading, grid, note, status); footer.append(section);
    let generation = 0;
    let snapshot;

    async function refresh() {
      const current = ++generation;
      try {
        const data = await fetchWithTimeout(new URL('totals.json', base), {
          credentials: 'omit', cache: 'no-cache'
        }, 10000, response => response.json());
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data.day) ||
            !Number.isFinite(Date.parse(data.fetchedAt)) ||
            ![data.today, data.month, data.total].every(n => Number.isSafeInteger(n) && n >= 0)) {
          throw new Error('invalid totals');
        }
        if (current !== generation) return;
        snapshot = data;
      } catch {
        if (current !== generation) return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const numbers = snapshot ? [
        snapshot.day === today ? snapshot.today : null,
        snapshot.day.slice(0, 7) === today.slice(0, 7) ? snapshot.month : null,
        snapshot.total
      ] : [null, null, null];
      const format = new Intl.NumberFormat('ru-RU');
      numbers.forEach((number, index) => {
        cells[index].textContent = number === null ? '—' : format.format(number);
      });
      status.textContent = snapshot
        ? 'Данные GoatCounter получены ' + new Intl.DateTimeFormat('ru-RU', {
            dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow'
          }).format(new Date(snapshot.fetchedAt)) + ' (МСК).'
        : 'Статистика временно недоступна.';
    }
    refresh().catch(() => { status.textContent = 'Статистика временно недоступна.'; });
    // Keep long-open tabs and UTC month/day boundaries correct; never add tracking hits here.
    setInterval(() => refresh().catch(() => {}), 15 * 60000);
  }
  init().catch(() => {});
})();
