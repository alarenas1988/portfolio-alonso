const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
const MAX_TILT_X = 2;
const MAX_TILT_Y = 3;

function setupReveals(): void {
  const elements = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  if (!('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  document.documentElement.classList.add('motion-enhanced');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('is-reveal-pending');
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );

  elements.forEach((element) => {
    const delay = Number.parseInt(element.dataset.revealDelay ?? '0', 10);
    element.style.setProperty('--reveal-delay', `${Math.min(Math.max(delay, 0), 300)}ms`);
    if (element.getBoundingClientRect().top <= window.innerHeight * 0.92) {
      element.classList.add('is-visible');
      return;
    }
    element.classList.add('is-reveal-pending');
    observer.observe(element);
  });
}

function setupPointerEffects(): void {
  const elements = document.querySelectorAll<HTMLElement>('[data-tilt], [data-spotlight]');
  elements.forEach((element) => {
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const update = (): void => {
      const bounds = element.getBoundingClientRect();
      const x = Math.min(Math.max((pointerX - bounds.left) / bounds.width, 0), 1);
      const y = Math.min(Math.max((pointerY - bounds.top) / bounds.height, 0), 1);
      element.style.setProperty('--spotlight-x', `${x * 100}%`);
      element.style.setProperty('--spotlight-y', `${y * 100}%`);
      element.style.setProperty('--tilt-x', `${(0.5 - y) * MAX_TILT_X * 2}deg`);
      element.style.setProperty('--tilt-y', `${(x - 0.5) * MAX_TILT_Y * 2}deg`);
      frame = 0;
    };

    element.addEventListener('pointermove', (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(update);
    });
    element.addEventListener('pointerleave', () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      element.style.removeProperty('--tilt-x');
      element.style.removeProperty('--tilt-y');
    });
  });
}

const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
if (!reducedMotion.matches) {
  setupReveals();
  if (window.matchMedia(FINE_POINTER_QUERY).matches) setupPointerEffects();
}
