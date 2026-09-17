export function getElement<K extends keyof HTMLElementTagNameMap>(id: string, tag: K): HTMLElementTagNameMap[K] {
  const element = document.getElementById(id);
  if (!element || element.tagName.toLowerCase() !== tag) throw new Error(`Expected <${tag}> with id="${id}".`);
  return element as HTMLElementTagNameMap[K];
}

