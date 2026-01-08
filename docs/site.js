const body = document.body;
const toggles = Array.from(document.querySelectorAll('[data-lang-toggle]'));
const storageKey = 'corgphish_lang';

const setLang = (lang) => {
  const next = lang === 'en' ? 'en' : 'ru';
  body.dataset.lang = next;
  toggles.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.langToggle === next);
  });
  try {
    localStorage.setItem(storageKey, next);
  } catch (error) {
    // ignore storage errors
  }
};

toggles.forEach((btn) => {
  btn.addEventListener('click', () => setLang(btn.dataset.langToggle));
});

try {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    setLang(saved);
  } else {
    setLang(body.dataset.lang || 'ru');
  }
} catch (error) {
  setLang(body.dataset.lang || 'ru');
}

const revealNodes = Array.from(document.querySelectorAll('[data-reveal]'));
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );
  revealNodes.forEach((node, index) => {
    node.style.transitionDelay = `${Math.min(index * 0.06, 0.3)}s`;
    observer.observe(node);
  });
} else {
  revealNodes.forEach((node) => node.classList.add('is-visible'));
}
