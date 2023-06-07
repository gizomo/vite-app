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

export const EVENT_PREFIX = 'sn:';

export function fireEvent(element: HTMLElement, type: string, detail?: any, cancelable: boolean = true): boolean {
  return element.dispatchEvent(new CustomEvent(EVENT_PREFIX + type, {detail, cancelable}));
}

export const KeyMapping = {
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
} as const;

export function getDirection(event: KeyboardEvent): (typeof KeyMapping)[keyof typeof KeyMapping] {
  if (event.keyCode) {
    return KeyMapping[event.keyCode];
  }

  switch (event.code) {
    case 'ArrowUp':
      return KeyMapping[38];
    case 'ArrowDown':
      return KeyMapping[40];
    case 'ArrowLeft':
      return KeyMapping[37];
    case 'ArrowRight':
      return KeyMapping[39];
    default:
      return;
  }
}

export function isEnter(event: KeyboardEvent): boolean {
  if (event.keyCode) {
    return 13 === event.keyCode;
  }

  return 'Enter' === event.code;
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
