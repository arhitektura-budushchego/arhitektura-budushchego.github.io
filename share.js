(() => {
  'use strict';
  const status = document.getElementById('copy-status');
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    const field = document.getElementById(button.dataset.copy);
    try { await navigator.clipboard.writeText(field.value); status.textContent = 'Текст скопирован.'; }
    catch { field.focus(); field.select(); status.textContent = 'Выделен текст. Скопируйте его обычной командой устройства.'; }
  }));
  const button = document.getElementById('native-share');
  button.hidden = typeof navigator.share !== 'function';
  button.addEventListener('click', async () => {
    try { await navigator.share({title:'Архитектура будущего',text:'Бесплатная православная концептуальная книга',url:'https://arhitektura-budushchego.github.io/?utm_campaign=organic01&utm_source=reader_share'}); }
    catch(error) { if(error.name !== 'AbortError') status.textContent = 'Поделиться можно копированием ссылки выше.'; }
  });
})();
