// Highlight active nav link based on scroll position
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach((a) => {
          a.classList.toggle('active', a.getAttribute('href') === `/#${id}`);
        });
      }
    });
  },
  { rootMargin: '-20% 0px -70% 0px' }
);

sections.forEach((s) => observer.observe(s));
