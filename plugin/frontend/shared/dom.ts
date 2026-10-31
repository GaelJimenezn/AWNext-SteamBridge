export function make(doc: Document, tag: string, text?: string): HTMLElement {
  const element = doc.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}
