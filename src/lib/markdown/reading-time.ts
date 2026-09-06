import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

export function editorialSource(source: string): string {
  // Imported frontmatter is not article content or an executable configuration format.
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
}
export function parseMarkdown(source: string) {
  return unified().use(remarkParse).use(remarkGfm).parse(editorialSource(source));
}
export function readingTime(source: string): number {
  const words: string[] = [];
  visit(parseMarkdown(source), (node) => {
    if (node.type === 'text' || node.type === 'code' || node.type === 'inlineCode')
      words.push(node.value);
  });
  return Math.max(1, Math.ceil((words.join(' ').match(/[\p{L}\p{N}]+/gu)?.length ?? 0) / 220));
}
