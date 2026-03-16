// Highlight active sidebar link on scroll
const entries = document.querySelectorAll('.api-section, .api-entry[id]');
const sidebarLinks = document.querySelectorAll('.api-sidebar a, .toc-mobile a');

const observer = new IntersectionObserver(
  (intersections) => {
    intersections.forEach((i) => {
      if (i.isIntersecting) {
        const id = i.target.id;
        sidebarLinks.forEach((a) => {
          a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
        });
      }
    });
  },
  { rootMargin: '-10% 0px -80% 0px' }
);

entries.forEach((el) => observer.observe(el));
