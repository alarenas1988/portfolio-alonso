document.querySelectorAll<HTMLElement>('[data-content-filters]').forEach((control) => {
  const list = document.getElementById(control.dataset.target ?? '');
  const select = control.querySelector('select');
  if (!list || !select) return;
  const items = [...list.querySelectorAll<HTMLElement>('[data-filter-values]')];
  control.hidden = false;
  select.addEventListener('change', () => {
    let visible = 0;
    for (const item of items) {
      item.hidden =
        !!select.value && !(item.dataset.filterValues ?? '').split(' ').includes(select.value);
      if (!item.hidden) visible++;
    }
    const status = control.querySelector('[data-filter-status]');
    if (status) status.textContent = `${visible} ${visible === 1 ? 'resultado' : 'resultados'}`;
  });
});
