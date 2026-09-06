import type { Database } from './database.ts';

// Presentation DTOs deliberately list fields; new DB columns are never published automatically.
export interface PublicSnapshotRows {
  settings: Pick<
    Database['public']['Tables']['site_settings']['Row'],
    | 'id'
    | 'site_name'
    | 'brand_short'
    | 'professional_title'
    | 'hero_title'
    | 'hero_subtitle'
    | 'hero_description'
    | 'availability_enabled'
    | 'availability_text'
    | 'location_public'
    | 'cv_url'
    | 'default_seo_title'
    | 'default_seo_description'
    | 'default_og_image'
    | 'default_og_image_asset_id'
    | 'about_summary_markdown'
    | 'about_profile_markdown'
    | 'working_method_markdown'
    | 'about_image_asset_id'
    | 'canonical_base'
    | 'robots_policy'
    | 'timezone'
  >;
  contact: Pick<
    Database['public']['Tables']['contact_settings']['Row'],
    | 'id'
    | 'email'
    | 'whatsapp_number'
    | 'whatsapp_default_message'
    | 'cta_title'
    | 'cta_description'
    | 'form_enabled'
    | 'cv_enabled'
    | 'email_visible'
    | 'whatsapp_visible'
    | 'whatsapp_cta_label'
  >;
  social_links: Pick<
    Database['public']['Tables']['social_links']['Row'],
    'id' | 'platform' | 'label' | 'url' | 'icon' | 'sort_order' | 'visible'
  >;
  projects: Pick<
    Database['public']['Tables']['projects']['Row'],
    | 'id'
    | 'title'
    | 'slug'
    | 'subtitle'
    | 'summary'
    | 'problem'
    | 'objective'
    | 'solution'
    | 'architecture'
    | 'challenges'
    | 'learnings'
    | 'role'
    | 'year'
    | 'status'
    | 'featured_image_url'
    | 'cover_image_url'
    | 'github_url'
    | 'demo_url'
    | 'documentation_url'
    | 'featured'
    | 'published'
    | 'seo_title'
    | 'seo_description'
    | 'og_image_url'
    | 'published_at'
    | 'canonical_url'
    | 'robots_policy'
    | 'before_markdown'
    | 'after_markdown'
    | 'sort_order'
    | 'featured_image_asset_id'
    | 'cover_image_asset_id'
    | 'og_image_asset_id'
  >;
  project_features: Pick<
    Database['public']['Tables']['project_features']['Row'],
    'id' | 'project_id' | 'title' | 'description' | 'icon' | 'sort_order'
  >;
  project_images: Pick<
    Database['public']['Tables']['project_images']['Row'],
    | 'id'
    | 'project_id'
    | 'asset_id'
    | 'public_url'
    | 'alt_text'
    | 'caption'
    | 'sort_order'
    | 'featured'
  >;
  project_metrics: Pick<
    Database['public']['Tables']['project_metrics']['Row'],
    'id' | 'project_id' | 'value' | 'label' | 'description' | 'sort_order' | 'visible'
  >;
  project_challenges: Pick<
    Database['public']['Tables']['project_challenges']['Row'],
    'id' | 'project_id' | 'title' | 'problem' | 'solution' | 'sort_order'
  >;
  project_technologies: Pick<
    Database['public']['Tables']['project_technologies']['Row'],
    'project_id' | 'technology_id' | 'sort_order'
  >;
  posts: Pick<
    Database['public']['Tables']['posts']['Row'],
    | 'id'
    | 'title'
    | 'slug'
    | 'excerpt'
    | 'content_markdown'
    | 'featured_image_url'
    | 'status'
    | 'featured'
    | 'reading_time'
    | 'seo_title'
    | 'seo_description'
    | 'og_image_url'
    | 'published_at'
    | 'canonical_url'
    | 'robots_policy'
    | 'popular_rank'
    | 'featured_image_asset_id'
    | 'og_image_asset_id'
  >;
  categories: Pick<
    Database['public']['Tables']['post_categories']['Row'],
    'id' | 'name' | 'slug' | 'description' | 'sort_order' | 'visible'
  >;
  post_category_relations: Pick<
    Database['public']['Tables']['post_category_relations']['Row'],
    'post_id' | 'category_id'
  >;
  tags: Pick<Database['public']['Tables']['tags']['Row'], 'id' | 'name' | 'slug'>;
  post_tags: Pick<Database['public']['Tables']['post_tags']['Row'], 'post_id' | 'tag_id'>;
  experiences: Pick<
    Database['public']['Tables']['experiences']['Row'],
    | 'id'
    | 'position'
    | 'organization'
    | 'organization_url'
    | 'start_date'
    | 'end_date'
    | 'current'
    | 'summary'
    | 'description_markdown'
    | 'visible'
    | 'sort_order'
  >;
  experience_highlights: Pick<
    Database['public']['Tables']['experience_highlights']['Row'],
    'id' | 'experience_id' | 'title' | 'description' | 'sort_order'
  >;
  experience_projects: Pick<
    Database['public']['Tables']['experience_projects']['Row'],
    'experience_id' | 'project_id'
  >;
  experience_technologies: Pick<
    Database['public']['Tables']['experience_technologies']['Row'],
    'experience_id' | 'technology_id'
  >;
  technologies: Pick<
    Database['public']['Tables']['technologies']['Row'],
    | 'id'
    | 'name'
    | 'slug'
    | 'category'
    | 'description'
    | 'icon'
    | 'official_url'
    | 'featured'
    | 'visible'
    | 'sort_order'
  >;
  specialties: Pick<
    Database['public']['Tables']['specialties']['Row'],
    'id' | 'title' | 'slug' | 'description' | 'icon' | 'sort_order' | 'visible'
  >;
  principles: Pick<
    Database['public']['Tables']['work_principles']['Row'],
    'id' | 'number' | 'title' | 'description' | 'sort_order' | 'visible'
  >;
  impact_metrics: Pick<
    Database['public']['Tables']['impact_metrics']['Row'],
    'id' | 'value' | 'label' | 'description' | 'sort_order' | 'visible'
  >;
  media_assets: Pick<
    Database['public']['Tables']['media_assets']['Row'],
    | 'id'
    | 'public_url'
    | 'filename'
    | 'mime_type'
    | 'file_size'
    | 'width'
    | 'height'
    | 'alt_text'
    | 'caption'
    | 'category'
    | 'visibility'
  >;
  media_references: Pick<
    Database['public']['Tables']['media_references']['Row'],
    'asset_id' | 'entity_type' | 'entity_id' | 'field'
  >;
  documents: Pick<
    Database['public']['Tables']['documents']['Row'],
    'id' | 'type' | 'title' | 'asset_id' | 'public_url' | 'active'
  >;
}

export type PublicSnapshot = Readonly<
  {
    schema_version: 1;
    generated_at: string;
    settings: PublicSnapshotRows['settings'] | null;
    contact: PublicSnapshotRows['contact'] | null;
  } & {
    readonly [
      K in Exclude<keyof PublicSnapshotRows, 'settings' | 'contact'>
    ]: readonly PublicSnapshotRows[K][];
  }
>;
