/************/
/* Polyfill */
/************/
export const elementMatchesSelector: Function =
  Element.prototype.matches ||
  // @ts-ignore
  Element.prototype.matchesSelector ||
  // @ts-ignore
  Element.prototype.mozMatchesSelector ||
  // @ts-ignore
  Element.prototype.webkitMatchesSelector ||
  // @ts-ignore
  Element.prototype.msMatchesSelector ||
  // @ts-ignore
  Element.prototype.oMatchesSelector ||
  function (selector) {
    var matchedNodes = (this.parentNode || this.document).querySelectorAll(selector);
    return [].slice.call(matchedNodes).indexOf(this) >= 0;
  };

export function selectElements(selector: string | HTMLElement | HTMLCollectionOf<HTMLElement>): HTMLElement[] {
  try {
    if (selector) {
      if ('string' === typeof selector) {
        return [].slice.call(document.querySelectorAll(selector));
      } else if ('object' === typeof selector && undefined !== selector['length']) {
        return [].slice.call(selector);
      } else if ('object' === typeof selector && 1 === selector['nodeType']) {
        return [selector as HTMLElement];
      }
    }
  } catch (err: any) {
    console.error(err);
  }
}

export function extend<C extends Record<number | string | symbol, any>>(
  out?: Record<number | string | symbol, any>,
  ...args: C[]
): C {
  out = out || {};

  for (var i = 1; i < args.length; i++) {
    if (!args[i]) {
      continue;
    }

    for (var key in args[i]) {
      if (args[i].hasOwnProperty(key) && args[i][key] !== undefined) {
        out[key] = args[i][key];
      }
    }
  }

  return out;
}

export function exclude<T>(items: T[], excluded: T | T[]): T[] {
  if (!Array.isArray(excluded)) {
    excluded = [excluded];
  }

  for (let i: number = 0, index: number; i < excluded.length; i++) {
    index = items.indexOf(excluded[i]);

    if (index >= 0) {
      items.splice(index, 1);
    }
  }

  return items;
}
