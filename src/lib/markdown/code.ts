import { codeToTokens, bundledLanguages } from 'shiki';
import type { Element, ElementContent } from 'hast';

export async function codeFigure(source: string, language: string, meta: string): Promise<Element> {
  const lang = Object.hasOwn(bundledLanguages, language)
    ? (language as keyof typeof bundledLanguages)
    : 'text';
  const { tokens } = await codeToTokens(source, { lang, theme: 'github-dark' });
  const filename = /(?:^|\s)filename="([^"\r\n]{1,120})"(?:\s|$)/.exec(meta)?.[1];
  const numbered = /(?:^|\s)lines(?:\s|$)/.test(meta);
  const children: ElementContent[] = tokens.flatMap((line, index) => {
    const nodes: ElementContent[] = line.map((token) => {
      const color = token.color?.toUpperCase();
      const className =
        color === '#F97583' || color === '#B392F0'
          ? 'syntax-keyword'
          : color === '#9ECBFF' || color === '#79B8FF'
            ? 'syntax-string'
            : color === '#6A737D'
              ? 'syntax-comment'
              : null;
      return {
        type: 'element',
        tagName: 'span',
        properties: className ? { className: [className] } : {},
        children: [{ type: 'text', value: token.content }],
      };
    });
    return [
      {
        type: 'element',
        tagName: 'span',
        properties: { className: ['code-line'] },
        children: nodes,
      },
      ...(index < tokens.length - 1 ? [{ type: 'text' as const, value: '\n' }] : []),
    ];
  });
  return {
    type: 'element',
    tagName: 'figure',
    properties: { className: ['code-block'] },
    children: [
      {
        type: 'element',
        tagName: 'figcaption',
        properties: {},
        children: [
          {
            type: 'text',
            value: filename ? `${language || 'texto'} / ${filename}` : language || 'texto',
          },
        ],
      },
      {
        type: 'element',
        tagName: 'pre',
        properties: { tabIndex: 0, role: 'region', ariaLabel: 'Bloque de código' },
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: numbered ? { className: ['numbered'] } : {},
            children,
          },
        ],
      },
    ],
  };
}
