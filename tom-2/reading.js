const reader = document.querySelector('[data-volume-reader]');
const resumeVolume = document.getElementById('resume-volume');
const volumePage = location.pathname.split('/').pop();
if (reader) {
  set('volume2LastPage', volumePage);
  if (location.hash && !location.hash.startsWith('#read-position=')) {
    const section = document.getElementById(location.hash.slice(1));
    if (section) requestAnimationFrame(() => section.scrollIntoView());
  }
}
if (resumeVolume) {
  const target = get('volume2LastPage');
  if (/^(read|introduction|chapter-[1-9])\.html$/.test(target || '')) {
    resumeVolume.href = target;
    resumeVolume.hidden = false;
  }
}
