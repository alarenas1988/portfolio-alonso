/** Presentation labels do not change the database's approved state values. */
const labels: Readonly<Record<string, string>> = {
  concept: 'Concepto',
  development: 'En desarrollo',
  production: 'En producción',
  completed: 'Completado',
  maintenance: 'Mantenimiento',
  archived: 'Archivado',
  draft: 'Borrador',
  published: 'Publicado',
  new: 'Nuevo',
  read: 'Leído',
  replied: 'Respondido',
};
export const editorialLabel = (value: string) => labels[value] ?? value;
