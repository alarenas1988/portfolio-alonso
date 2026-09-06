import { getBrowserSupabase } from '../../lib/supabase/browser.ts';
import { getPublicConfig } from '../../lib/config/public.ts';
import { createUrlHelpers } from '../../lib/utils/urls.ts';
import { getAuthRedirects, readRecoveryCode } from '../../lib/auth/redirects.ts';
import { resolveAdminAccess } from '../../lib/admin/auth.ts';
import { safeAdminReturn } from '../../lib/admin/routes.ts';
import { el, link, feedback } from '../../lib/admin/dom.ts';
export async function mountAuthPage(root: HTMLElement, recovery: boolean) {
  const config = getPublicConfig(),
    { withBase } = createUrlHelpers(config.siteUrl),
    client = getBrowserSupabase();
  const card = el('section', '', 'cms-auth-card');
  card.append(
    link('AL / PORTFOLIO', withBase('/'), 'cms-eyebrow'),
    el('h1', recovery ? 'Recuperar acceso' : 'Bienvenido de nuevo'),
    el(
      'p',
      recovery
        ? 'Solicita un enlace seguro para restablecer tu contraseña.'
        : 'Inicia sesión para gestionar tu portfolio.',
      'cms-muted',
    ),
  );
  const form = el('form');
  form.noValidate = true;
  const status = el('p', '', 'cms-notice');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const emailLabel = el('label', 'Correo electrónico');
  const email = el('input');
  email.type = 'email';
  email.name = 'email';
  email.autocomplete = 'username';
  email.required = true;
  emailLabel.append(email);
  const passwordLabel = el('label', 'Contraseña');
  const password = el('input');
  password.type = 'password';
  password.name = 'password';
  password.autocomplete = 'current-password';
  password.required = true;
  passwordLabel.append(password);
  const submit = el('button', recovery ? 'Enviar enlace' : 'Iniciar sesión', 'cms-primary');
  submit.type = 'submit';
  form.append(emailLabel);
  if (!recovery) form.append(passwordLabel);
  form.append(submit);
  card.append(
    form,
    status,
    link(
      recovery ? 'Volver a iniciar sesión' : 'Olvidé mi contraseña',
      withBase(recovery ? '/admin/login/' : '/admin/reset-password/'),
      'cms-text-link',
    ),
  );
  root.replaceChildren(card);
  let resetReady = false;
  if (recovery && (location.search || location.hash)) {
    try {
      const site = new URL(config.base, location.origin).href;
      const code = readRecoveryCode(location.href, site);
      history.replaceState(null, '', withBase('/admin/reset-password/'));
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw error;
      const access = await resolveAdminAccess(client);
      if (access.state !== 'owner') throw new Error('Access denied');
      resetReady = true;
      emailLabel.remove();
      passwordLabel.firstChild!.textContent = 'Nueva contraseña';
      password.autocomplete = 'new-password';
      password.minLength = 12;
      form.insertBefore(passwordLabel, submit);
      submit.textContent = 'Guardar nueva contraseña';
      card.querySelector('h1')!.textContent = 'Establece una nueva contraseña';
      feedback(status, 'Usa al menos 12 caracteres. El enlace solo sirve una vez.');
    } catch {
      history.replaceState(null, '', withBase('/admin/reset-password/'));
      await client.auth.signOut({ scope: 'local' });
      feedback(
        status,
        'El enlace no es válido o ya expiró. Solicita uno nuevo desde este navegador.',
        'error',
      );
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void (async () => {
      if (submit.disabled) return;
      if (!form.reportValidity()) return;
      submit.disabled = true;
      feedback(status, 'Comprobando…');
      try {
        if (resetReady) {
          const { error } = await client.auth.updateUser({ password: password.value });
          if (error) throw error;
          password.value = '';
          await client.auth.signOut();
          resetReady = false;
          form.replaceChildren();
          feedback(status, 'Contraseña actualizada. Ya puedes iniciar sesión.');
        } else if (recovery) {
          const site = new URL(config.base, location.origin).href;
          const { error } = await client.auth.resetPasswordForEmail(email.value.trim(), {
            redirectTo: getAuthRedirects(site).recovery,
          });
          if (error) throw error;
          feedback(
            status,
            'Si la cuenta puede recuperar acceso, recibirás un enlace. Ábrelo en este mismo navegador.',
          );
        } else {
          const { error } = await client.auth.signInWithPassword({
            email: email.value.trim(),
            password: password.value,
          });
          password.value = '';
          if (error) throw error;
          const access = await resolveAdminAccess(client);
          if (access.state !== 'owner') {
            await client.auth.signOut({ scope: 'local' });
            throw new Error('Access denied');
          }
          location.replace(
            safeAdminReturn(new URLSearchParams(location.search).get('returnTo'), config.siteUrl),
          );
        }
      } catch {
        feedback(
          status,
          resetReady
            ? 'No se pudo actualizar la contraseña. Solicita un nuevo enlace si expiró.'
            : recovery
              ? 'No se pudo solicitar el enlace. Reintenta en unos minutos.'
              : 'No se pudo iniciar sesión con acceso administrativo. Revisa tus datos e inténtalo nuevamente.',
          'error',
        );
      } finally {
        submit.disabled = false;
      }
    })();
  });
}
