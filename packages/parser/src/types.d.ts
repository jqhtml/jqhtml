// Simple jQuery type definitions for MVP
interface JQuery<TElement = HTMLElement> {
  length: number;
  empty(): JQuery<TElement>;
  append(content: any): JQuery<TElement>;
  each(fn: (this: TElement, index: number, element: TElement) => void): JQuery<TElement>;
  data(key: string): any;
  data(key: string, value: any): JQuery<TElement>;
  attr(name: string): string | undefined;
  attr(name: string, value: string | number): JQuery<TElement>;
  addClass(className: string): JQuery<TElement>;
  find(selector: string): JQuery<TElement>;
  trigger(eventName: string, extraParameters?: any): JQuery<TElement>;
  html(): string;
  html(content: string): JQuery<TElement>;
}

interface JQueryStatic {
  (selector: any): JQuery;
  <TElement = HTMLElement>(element: TElement): JQuery<TElement>;
  <TElement = HTMLElement>(elementArray: TElement[]): JQuery<TElement>;
  fn: any;
}

declare const $: JQueryStatic;
declare const jQuery: JQueryStatic;