import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, TablesInsert, TablesUpdate } from '../../types/database.ts';
import { databaseError, AdminError } from './errors.ts';
import type { ResourceName } from './resources.ts';
import type { Patch, Row } from './validation.ts';
import { markdownAssetIds } from '../media/usage.ts';
export type AdminClient = SupabaseClient<Database>;
export type RelationRow = Record<string, string | number | boolean | null>;
export type Relations = Record<string, RelationRow[]>;
export function parseRow(value: unknown): Row {
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !('updated_at' in value) ||
    typeof value.updated_at !== 'string' ||
    Object.values(value).some(
      (v) => v !== null && !['string', 'number', 'boolean'].includes(typeof v),
    )
  )
    throw new AdminError('network', 'La respuesta no coincide con el contrato de contenido.');
  // All editorial rows are scalar records. Checked once at the generic UI boundary.
  return value as Row;
}
export async function listRecords(
  client: AdminClient,
  table: ResourceName,
  options: { page?: number; search?: string; filter?: string; ascending?: boolean } = {},
) {
  const page = Math.max(0, Math.min(10000, options.page ?? 0));
  const searchColumn =
    table === 'experiences'
      ? 'position'
      : ['technologies', 'tags', 'post_categories'].includes(table)
        ? 'name'
        : table === 'social_links'
          ? 'label'
          : table === 'impact_metrics'
            ? 'label'
            : 'title';
  let query = client
    .from(table)
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: options.ascending ?? false })
    .order('id')
    .range(page * 20, page * 20 + 19);
  if (options.search)
    query = query.ilike(
      searchColumn,
      '%' + options.search.replace(/[\\%_]/g, '').slice(0, 120) + '%',
    );
  if (options.filter === 'featured') query = query.filter('featured', 'eq', true);
  else if (options.filter === 'published')
    query =
      table === 'projects'
        ? query.filter('published', 'eq', true)
        : query.filter('status', 'eq', 'published');
  else if (options.filter === 'draft')
    query =
      table === 'projects'
        ? query.filter('published', 'eq', false)
        : query.filter('status', 'eq', 'draft');
  else if (options.filter === 'archived') query = query.filter('status', 'eq', 'archived');
  const { data, error, count } = await query;
  if (error) throw databaseError(error);
  return { rows: data.map(parseRow), count: count ?? 0 };
}
export async function getRecord(
  client: AdminClient,
  table: ResourceName,
  id?: string,
): Promise<Row | null> {
  let query = client.from(table).select('*');
  if (id) query = query.eq('id', id);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw databaseError(error);
  return data ? parseRow(data) : null;
}
export async function loadRelations(
  client: AdminClient,
  table: ResourceName,
  id: string,
): Promise<Relations> {
  if (table === 'projects') {
    const results = await Promise.all([
      client
        .from('project_features')
        .select('id,title,description,icon,sort_order')
        .eq('project_id', id)
        .order('sort_order'),
      client
        .from('project_metrics')
        .select('id,value,label,description,visible,sort_order')
        .eq('project_id', id)
        .order('sort_order'),
      client
        .from('project_challenges')
        .select('id,title,problem,solution,sort_order')
        .eq('project_id', id)
        .order('sort_order'),
      client
        .from('project_images')
        .select('id,asset_id,alt_text,caption,featured,sort_order')
        .eq('project_id', id)
        .order('sort_order'),
      client
        .from('project_technologies')
        .select('technology_id,sort_order')
        .eq('project_id', id)
        .order('sort_order'),
    ]);
    for (const r of results) if (r.error) throw databaseError(r.error);
    return Object.fromEntries(
      ['features', 'metrics', 'challenges', 'images', 'technologies'].map((k, i) => [
        k,
        results[i]!.data ?? [],
      ]),
    );
  }
  if (table === 'posts') {
    const [cats, tags] = await Promise.all([
      client.from('post_category_relations').select('category_id').eq('post_id', id),
      client.from('post_tags').select('tag_id').eq('post_id', id),
    ]);
    if (cats.error || tags.error) throw databaseError(cats.error ?? tags.error);
    return { categories: cats.data, tags: tags.data };
  }
  if (table === 'experiences') {
    const [highlights, projects, technologies] = await Promise.all([
      client
        .from('experience_highlights')
        .select('id,title,description,sort_order')
        .eq('experience_id', id)
        .order('sort_order'),
      client.from('experience_projects').select('project_id').eq('experience_id', id),
      client.from('experience_technologies').select('technology_id').eq('experience_id', id),
    ]);
    if (highlights.error || projects.error || technologies.error)
      throw databaseError(highlights.error ?? projects.error ?? technologies.error);
    return {
      highlights: highlights.data!,
      projects: projects.data!,
      technologies: technologies.data!,
    };
  }
  return {};
}
export async function verifyPublicMedia(client: AdminClient, patch: Patch, relations: Relations) {
  const ids = new Set<string>();
  for (const [key, value] of Object.entries(patch))
    if (typeof value === 'string') {
      if (key.endsWith('_asset_id')) ids.add(value);
      for (const id of markdownAssetIds(value)) ids.add(id);
    }
  for (const row of relations.images ?? [])
    if (typeof row.asset_id === 'string') ids.add(row.asset_id);
  if (!ids.size) return;
  const result = await client
    .from('media_assets')
    .select('id,visibility')
    .in('id', [...ids]);
  if (
    result.error ||
    result.data.length !== ids.size ||
    result.data.some((a) => a.visibility !== 'public')
  )
    throw new AdminError(
      'validation',
      'Publica los archivos referenciados antes de publicar este contenido.',
    );
}
export async function saveRecord(
  client: AdminClient,
  table: ResourceName,
  id: string,
  expected: string | null,
  patch: Patch,
  relations: Relations = {},
): Promise<Row> {
  if (patch.published || patch.status === 'published' || patch.visible || table === 'site_settings')
    await verifyPublicMedia(client, patch, relations);
  if (table === 'projects' || table === 'posts' || table === 'experiences') {
    const fn =
      table === 'projects' ? 'save_project' : table === 'posts' ? 'save_post' : 'save_experience';
    const { data, error } = await client.rpc(fn, {
      p_id: id,
      p_expected: expected!,
      p_record: patch,
      p_relations: relations as Json,
    });
    if (error) throw databaseError(error);
    return parseRow(data);
  }
  // A resource's form schema restricts these scalar fields; PostgreSQL remains authoritative.
  switch (table) {
    case 'technologies': {
      const query = expected
        ? client
            .from('technologies')
            .update(patch as TablesUpdate<'technologies'>)
            .eq('id', id)
            .eq('updated_at', expected)
        : client.from('technologies').insert({ id, ...patch } as TablesInsert<'technologies'>);
      const { data, error } = await query.select('*').single();
      if (error) throw databaseError(error);
      return parseRow(data);
    }
    case 'specialties': {
      const query = expected
        ? client
            .from('specialties')
            .update(patch as TablesUpdate<'specialties'>)
            .eq('id', id)
            .eq('updated_at', expected)
        : client.from('specialties').insert({ id, ...patch } as TablesInsert<'specialties'>);
      const { data, error } = await query.select('*').single();
      if (error) throw databaseError(error);
      return parseRow(data);
    }
    case 'work_principles': {
      const query = expected
        ? client
            .from('work_principles')
            .update(patch as TablesUpdate<'work_principles'>)
            .eq('id', id)
            .eq('updated_at', expected)
        : client
            .from('work_principles')
            .insert({ id, ...patch } as TablesInsert<'work_principles'>);
      const { data, error } = await query.select('*').single();
      if (error) throw databaseError(error);
      return parseRow(data);
    }
    case 'impact_metrics': {
      const query = expected
        ? client
            .from('impact_metrics')
            .update(patch as TablesUpdate<'impact_metrics'>)
            .eq('id', id)
            .eq('updated_at', expected)
        : client.from('impact_metrics').insert({ id, ...patch } as TablesInsert<'impact_metrics'>);
      const { data, error } = await query.select('*').single();
      if (error) throw databaseError(error);
      return parseRow(data);
    }
    case 'post_categories': {
      const query = expected
        ? client
            .from('post_categories')
            .update(patch as TablesUpdate<'post_categories'>)
            .eq('id', id)
            .eq('updated_at', expected)
        : client
            .from('post_categories')
            .insert({ id, ...patch } as TablesInsert<'post_categories'>);
      const { data, error } = await query.select('*').single();
      if (error) throw databaseError(error);
      return parseRow(data);
    }
    case 'tags': {
      const query = expected
        ? client
            .from('tags')
            .update(patch as TablesUpdate<'tags'>)
            .eq('id', id)
            .eq('updated_at', expected)
        : client.from('tags').insert({ id, ...patch } as TablesInsert<'tags'>);
      const { data, error } = await query.select('*').single();
      if (error) throw databaseError(error);
      return parseRow(data);
    }
    case 'social_links': {
      const query = expected
        ? client
            .from('social_links')
            .update(patch as TablesUpdate<'social_links'>)
            .eq('id', id)
            .eq('updated_at', expected)
        : client.from('social_links').insert({ id, ...patch } as TablesInsert<'social_links'>);
      const { data, error } = await query.select('*').single();
      if (error) throw databaseError(error);
      return parseRow(data);
    }
    case 'site_settings': {
      const query = expected
        ? client
            .from('site_settings')
            .update(patch as TablesUpdate<'site_settings'>)
            .eq('id', id)
            .eq('updated_at', expected)
        : client.from('site_settings').insert({ id, ...patch } as TablesInsert<'site_settings'>);
      const { data, error } = await query.select('*').single();
      if (error) throw databaseError(error);
      return parseRow(data);
    }
    case 'contact_settings': {
      const query = expected
        ? client
            .from('contact_settings')
            .update(patch as TablesUpdate<'contact_settings'>)
            .eq('id', id)
            .eq('updated_at', expected)
        : client
            .from('contact_settings')
            .insert({ id, ...patch } as TablesInsert<'contact_settings'>);
      const { data, error } = await query.select('*').single();
      if (error) throw databaseError(error);
      return parseRow(data);
    }
    case 'documents': {
      const query = expected
        ? client
            .from('documents')
            .update(patch as TablesUpdate<'documents'>)
            .eq('id', id)
            .eq('updated_at', expected)
        : client.from('documents').insert({ id, ...patch } as TablesInsert<'documents'>);
      const { data, error } = await query.select('*').single();
      if (error) throw databaseError(error);
      return parseRow(data);
    }
  }
}
export async function removeRecord(client: AdminClient, table: ResourceName, row: Row) {
  const { error } = await client
    .from(table)
    .delete()
    .eq('id', row.id)
    .eq('updated_at', row.updated_at)
    .select('id')
    .single();
  if (error) throw databaseError(error);
}
export async function choices(
  client: AdminClient,
  table: 'technologies' | 'projects' | 'post_categories' | 'tags',
  search = '',
) {
  const column = table === 'projects' ? 'title' : 'name';
  const { data, error } = await client
    .from(table)
    .select('*')
    .ilike(column, '%' + search.replace(/[\\%_]/g, '').slice(0, 120) + '%')
    .order(column)
    .limit(100);
  if (error) throw databaseError(error);
  return data.map((row) => ({ id: row.id, label: 'title' in row ? row.title : row.name }));
}
