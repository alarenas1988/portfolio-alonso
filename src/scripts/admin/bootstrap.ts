import { getBrowserSupabase } from '../../lib/supabase/browser.ts';
import { getPublicConfig } from '../../lib/config/public.ts';
import { createUrlHelpers } from '../../lib/utils/urls.ts';
import { resolveAdminAccess } from '../../lib/admin/auth.ts';
import { safeAdminReturn } from '../../lib/admin/routes.ts';
import { el, button, link } from '../../lib/admin/dom.ts';
const root = document.querySelector<HTMLElement>('[data-admin-route]');
if (root) void start(root);
async function start(root: HTMLElement) {
  const route = root.dataset.adminRoute!;
  if (route === 'login' || route === 'reset-password') {
    const { mountAuthPage } = await import('./auth-pages.ts');
    await mountAuthPage(root, route === 'reset-password');
    return;
  }
  const client = getBrowserSupabase(),
    config = getPublicConfig(),
    { withBase } = createUrlHelpers(config.siteUrl);
  const gate = root.querySelector<HTMLElement>('[data-admin-gate]')!,
    content = root.querySelector<HTMLElement>('[data-admin-module]')!;
  const userLabel = document.querySelector<HTMLElement>('[data-session-label]')!,
    logout = document.querySelector<HTMLButtonElement>('[data-logout]')!;
  let mounted = false,
    checking = false,
    ownerId = '',
    signedOut = false;
  const sidebar = document.querySelector<HTMLElement>('#cms-sidebar')!,
    menu = document.querySelector<HTMLButtonElement>('[data-nav-open]')!,
    backdrop = document.querySelector<HTMLButtonElement>('[data-nav-backdrop]')!;
  function closeMenu() {
    document.body.classList.remove('cms-nav-open');
    document.body.style.overflow = '';
    backdrop.hidden = true;
    menu.setAttribute('aria-expanded', 'false');
    sidebar.removeAttribute('role');
    sidebar.removeAttribute('aria-modal');
    menu.focus();
  }
  menu.addEventListener('click', () => {
    document.body.classList.add('cms-nav-open');
    document.body.style.overflow = 'hidden';
    backdrop.hidden = false;
    menu.setAttribute('aria-expanded', 'true');
    sidebar.setAttribute('role', 'dialog');
    sidebar.setAttribute('aria-modal', 'true');
    sidebar.querySelector<HTMLElement>('a')?.focus();
  });
  backdrop.addEventListener('click', closeMenu);
  document.querySelector('[data-nav-close]')?.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (event) => {
    if (!document.body.classList.contains('cms-nav-open')) return;
    if (event.key === 'Escape') closeMenu();
    if (event.key === 'Tab') {
      const nodes = [...sidebar.querySelectorAll<HTMLElement>('a,button')].filter(
          (n) => n.offsetParent !== null,
        ),
        first = nodes[0]!,
        last = nodes.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  logout.addEventListener('click', () => {
    void (async () => {
      signedOut = true;
      window.dispatchEvent(new Event('admin-dispose'));
      content.replaceChildren();
      content.hidden = true;
      logout.disabled = true;
      await client.auth.signOut({ scope: 'local' });
      location.replace(withBase('/admin/login/'));
    })();
  });
  async function check() {
    if (checking || signedOut) return;
    checking = true;
    const access = await resolveAdminAccess(client);
    checking = false;
    if (access.state === 'owner') {
      if (ownerId && ownerId !== access.owner.id) {
        content.replaceChildren();
        location.reload();
        return;
      }
      ownerId = access.owner.id;
      userLabel.textContent = access.owner.displayName;
      logout.disabled = false;
      gate.hidden = true;
      content.hidden = false;
      if (!mounted) {
        mounted = true;
        try {
          const { mountModule } = await import('./modules.ts');
          await mountModule(content, route, client);
        } catch {
          mounted = false;
          content.replaceChildren(
            el('p', 'No se pudo cargar este módulo.'),
            button('Reintentar', () => {
              void check();
            }),
          );
        }
      }
      return;
    }
    content.hidden = true;
    gate.hidden = false;
    userLabel.textContent = 'Sesión no disponible';
    if (access.state === 'anonymous' && !mounted) {
      const target = safeAdminReturn(location.pathname + location.search, config.siteUrl);
      location.replace(withBase('/admin/login/') + '?returnTo=' + encodeURIComponent(target));
      return;
    }
    gate.replaceChildren(
      el(
        'h2',
        access.state === 'denied'
          ? 'Acceso no autorizado'
          : access.state === 'error'
            ? 'No se pudo comprobar la sesión'
            : 'Tu sesión expiró',
      ),
      el(
        'p',
        mounted
          ? 'Tus cambios se conservan en esta pestaña. Vuelve a iniciar sesión y luego reintenta.'
          : 'Esta cuenta no tiene acceso administrativo.',
      ),
      button('Reintentar', () => {
        void check();
      }),
      link('Iniciar sesión', withBase('/admin/login/')),
    );
    if (mounted) {
      const authLink = gate.querySelector('a')!;
      authLink.target = '_blank';
      authLink.rel = 'noopener noreferrer';
      authLink.textContent = 'Iniciar sesión en otra pestaña';
    }
    if (access.state === 'denied') {
      window.dispatchEvent(new Event('admin-dispose'));
      content.replaceChildren();
      mounted = false;
    }
  }
  client.auth.onAuthStateChange(() => {
    setTimeout(() => {
      void check();
    }, 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      content.hidden = true;
      void check();
    }
  });
  await check();
}
