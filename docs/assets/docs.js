(function initDocsNavigation() {
  const sidebar = document.querySelector('.sidebar');
  const toggle = document.querySelector('.menu-toggle');
  const links = Array.from(document.querySelectorAll('.sidebar nav a'));
  const sections = links
    .map((link) => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) {
        return null;
      }
      const id = href.replace('#', '');
      const section = document.getElementById(id);
      return section ? { link, section } : null;
    })
    .filter(Boolean);

  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    links.forEach((link) => {
      link.addEventListener('click', () => {
        sidebar.classList.remove('open');
      });
    });
  }

  function setActiveLink() {
    const offset = 120;
    let current = sections[0];

    for (const entry of sections) {
      if (entry.section.getBoundingClientRect().top <= offset) {
        current = entry;
      }
    }

    links.forEach((link) => link.classList.remove('active'));
    if (current) {
      current.link.classList.add('active');
    }
  }

  window.addEventListener('scroll', setActiveLink, { passive: true });
  setActiveLink();

  if (typeof hljs !== 'undefined') {
    hljs.highlightAll();
  }
})();
