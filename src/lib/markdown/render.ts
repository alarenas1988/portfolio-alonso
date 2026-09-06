import { unified } from 'unified';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Element, Root, RootContent } from 'hast';
import type { AssetMap } from '../media/build-assets.ts';
import { createUrlHelpers } from '../utils/urls.ts';
import { safeExternalUrl } from '../content/presentation.ts';
import { parseMarkdown, readingTime } from './reading-time.ts';
import { headingIds, type TocEntry } from './toc.ts';
import { editorialSchema } from './sanitize.ts';
import { codeFigure } from './code.ts';

export interface RenderedMarkdown {
  html: string;
  toc: TocEntry[];
  readingTime: number;
}
export interface MarkdownOptions {
  assets?: AssetMap;
  siteUrl?: string;
  prefix?: string;
}
function textContent(node: RootContent): string {
  return node.type === 'text'
    ? node.value
    : 'children' in node
      ? node.children.map(textContent).join('')
      : '';
}
/** Shared build/preview contract. No MDX, user components, raw HTML, remote image fetch or DOM. */
export async function renderMarkdown(
  source: string,
  options: MarkdownOptions = {},
): Promise<RenderedMarkdown> {
  const md = parseMarkdown(source);
  const codes: { value: string; lang: string; meta: string }[] = [];
  visit(md, 'code', (node) => {
    codes.push({ value: node.value, lang: node.lang ?? '', meta: node.meta ?? '' });
  });
  const tree = (await unified().use(remarkRehype).run(md)) as Root;
  const toc: TocEntry[] = [],
    id = headingIds(options.prefix);
  const { withBase } = createUrlHelpers(options.siteUrl ?? 'https://example.com/portfolio-alonso/');
  const headings = new Map<string, string>();
  const text = (node: RootContent) => textContent(node);
  visit(tree, 'element', (node) => {
    if (/^h[1-6]$/.test(node.tagName)) {
      if (node.tagName === 'h1') node.tagName = 'h2';
      const label = text(node),
        anchor = id(label);
      node.properties.id = anchor;
      headings.set(
        label
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        `content-${anchor}`,
      );
      if (['h2', 'h3'].includes(node.tagName))
        toc.push({ id: `content-${anchor}`, text: label, depth: Number(node.tagName[1]) });
    }
  });
  visit(tree, 'element', (node) => {
    if (node.tagName === 'a') {
      const href = String(node.properties.href ?? '');
      delete node.properties.href;
      if (/^#[a-z0-9-]+$/.test(href)) {
        const anchor = headings.get(href.slice(1));
        if (anchor) node.properties.href = `#${anchor}`;
      } else if (href.startsWith('/') && !href.startsWith('//')) {
        try {
          node.properties.href = withBase(href);
        } catch {
          /* Unsafe internal path is plain text. */
        }
      } else {
        const external = safeExternalUrl(href);
        if (external) {
          node.properties.href = external;
          node.properties.rel = ['noopener', 'noreferrer'];
          node.properties.target = '_blank';
        }
      }
    }
    if (node.tagName === 'img') {
      const match = /^media:([0-9a-f-]{36})$/.exec(String(node.properties.src));
      const asset = match ? options.assets?.assets[match[1]!] : null;
      if (!asset?.variants.length || !asset.width || !asset.height)
        throw new Error('Markdown image must reference an available public media asset.');
      const safe = (path: string) =>
        /^\/[a-zA-Z0-9/_-]+\.(?:png|avif|webp)$/.test(path) && withBase(path) === path;
      if (!safe(asset.src) || asset.variants.some((variant) => !safe(variant.src)))
        throw new Error('Markdown media must use local build artifacts.');
      node.tagName = 'picture';
      node.properties = {};
      node.children = [
        ...(['avif', 'webp'] as const).map((format): Element => ({
          type: 'element',
          tagName: 'source',
          properties: {
            type: `image/${format}`,
            sizes: '(max-width: 800px) 100vw, 760px',
            srcSet: asset.variants
              .filter((variant) => variant.format === format)
              .map((variant) => `${variant.src} ${variant.width}w`)
              .join(', '),
          },
          children: [],
        })),
        {
          type: 'element',
          tagName: 'img',
          properties: {
            src: asset.src,
            width: asset.width,
            height: asset.height,
            alt: asset.alt,
            loading: 'lazy',
            decoding: 'async',
          },
          children: [],
        },
      ];
      return 'skip';
    }
    if (node.tagName === 'th') node.properties.scope = 'col';
    return undefined;
  });
  // Wrap tables only after transforming their descendants (including links and media).
  visit(tree, 'element', (node, index, parent) => {
    if (node.tagName === 'table' && parent && index !== undefined) {
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['table-scroll'],
          tabIndex: 0,
          role: 'region',
          ariaLabel: 'Tabla, desplazamiento horizontal disponible',
        },
        children: [node],
      };
      return 'skip';
    }
    return undefined;
  });
  const figures = await Promise.all(
    codes.map((code) => codeFigure(code.value, code.lang, code.meta)),
  );
  let codeIndex = 0;
  visit(tree, 'element', (node, index, parent) => {
    if (node.tagName === 'pre' && parent && index !== undefined) {
      parent.children[index] = figures[codeIndex++]!;
      return 'skip';
    }
    return undefined;
  });
  const sanitized = await unified().use(rehypeSanitize, editorialSchema).run(tree);
  const html = unified().use(rehypeStringify).stringify(sanitized);
  return { html, toc: toc.length >= 3 ? toc : [], readingTime: readingTime(source) };
}
