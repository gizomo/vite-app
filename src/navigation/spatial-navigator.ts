import {bind} from 'helpful-decorators';
import ElementRect from './element-rect';

/************/
/* Polyfill */
/************/
const elementMatchesSelector: Function =
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

export type ElementCenterType = {
  x: number;
  y: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

type ElementDistanceCalcType = (rect: IElementRect) => number;

export interface IElementRect {
  width: number;
  height: number;
  top: number;
  bottom: number;
  right: number;
  left: number;
  element: Element;
  center: ElementCenterType;
  nearPlumbLineIsBetter: ElementDistanceCalcType;
  nearHorizonIsBetter: ElementDistanceCalcType;
  nearTargetLeftIsBetter: ElementDistanceCalcType;
  nearTargetTopIsBetter: ElementDistanceCalcType;
  topIsBetter: ElementDistanceCalcType;
  bottomIsBetter: ElementDistanceCalcType;
  leftIsBetter: ElementDistanceCalcType;
  rightIsBetter: ElementDistanceCalcType;
}

type ElementRectGroupsType = Array<IElementRect>;

type GroupPriorityType = {
  group: ElementRectGroupsType;
  distance: ElementDistanceCalcType[];
};

type SectionType = {
  disabled: boolean;
  selector: any;
  defaultElement: HTMLElement;
  lastFocusedElement: HTMLElement;
  enterTo: string;
  leaveFor: string;
  navigableFilter: Function;
};

export type NavigationConfigType = {
  selector: string;
  straightOnly: boolean;
  straightOverlapThreshold: number;
  rememberSource: boolean;
  disabled: boolean;
  defaultElement: string;
  enterTo: string;
  leaveFor: null;
  restrict: Restrict;
  tabIndexIgnoreList: string;
  navigableFilter: Function;
  previous?: {
    target: HTMLElement;
    destination: any;
    reverse: DirectionType;
  };
  id?: string;
};

enum Restrict {
  SELF_ONLY = 'self-only',
  SELF_FIRST = 'self-first',
}

const KeyMapping = {
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
} as const;

const Reverse = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
} as const;

type DirectionType = 'down' | 'left' | 'right' | 'up';

const EVENT_PREFIX = 'sn:';
const ID_POOL_PREFIX = 'section-';

export default class SpatialNavigator {
  public static config: NavigationConfigType = {
    selector: '',
    straightOnly: false,
    straightOverlapThreshold: 0.5,
    rememberSource: false,
    disabled: false,
    defaultElement: '',
    enterTo: '',
    leaveFor: null,
    restrict: Restrict.SELF_FIRST,
    tabIndexIgnoreList: 'a, input, select, textarea, button, iframe, [contentEditable=true]',
    navigableFilter: null,
  };

  private idPool: number = 0;

  private ready: boolean = false;
  private paused: boolean = false;
  private duringFocusChange: boolean = false;

  private sections: Record<string, any> = {};
  private sectionCount: number = 0;

  private defaultSectionId: string = '';
  private lastSectionId: string = '';

  public init(): void {
    if (!this.ready) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('focus', this.onFocus, true);
      window.addEventListener('blur', this.onBlur, true);
      this.ready = true;
    }
  }

  public uninit(): void {
    window.removeEventListener('blur', this.onBlur, true);
    window.removeEventListener('focus', this.onFocus, true);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('keydown', this.onKeyDown);
    this.clear();
    this.idPool = 0;
    this.ready = false;
  }

  public clear(): void {
    this.sections = {};
    this.sectionCount = 0;
    this.defaultSectionId = '';
    this.lastSectionId = '';
    this.duringFocusChange = false;
  }

  public setConfig(config: Partial<NavigationConfigType>, sectionId?: string): void {
    for (const key in config) {
      if (SpatialNavigator.config[key] !== undefined) {
        if (sectionId) {
          this.sections[sectionId][key] = config[key];
        } else if (config[key] !== undefined) {
          SpatialNavigator.config[key] = config[key];
        }
      }
    }

    if (sectionId) {
      //TODO возможно это лишнее
      // this.sections[sectionId] = this.extend({}, this.sections[sectionId]);
    }
  }

  public addSection(config: Partial<NavigationConfigType>, sectionId?: string): string {
    if (!sectionId) {
      sectionId = 'string' === typeof config.id ? config.id : this.generateId();
    }

    if (this.sections[sectionId]) {
      throw new Error('Section "' + sectionId + '" has already existed!');
    }

    this.sections[sectionId] = {};
    this.sectionCount++;

    this.setConfig(config, sectionId);

    return sectionId;
  }

  public removeSection(id: string): boolean {
    if (!id || typeof id !== 'string') {
      throw new Error('Please assign the "sectionId"!');
    }

    if (this.sections[id]) {
      this.sections[id] = undefined;
      this.sections = this.extend({}, this.sections);
      this.sectionCount--;

      if (this.lastSectionId === id) {
        this.lastSectionId = '';
      }

      return true;
    }

    return false;
  }

  public disableSection(id: string): boolean {
    if (this.sections[id]) {
      this.sections[id].disabled = true;
      return true;
    }

    return false;
  }

  public enableSection(id: string): boolean {
    if (this.sections[id]) {
      this.sections[id].disabled = false;
      return true;
    }

    return false;
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

  /**
   * focus([silent])
   * focus(<sectionId>, [silent])
   * focus(<extSelector>, [silent])
   *
   * @param firstArg?: string | boolean
   * @param secondArg?: boolean
   * @returns boolean
   */
  public focus(firstArg?: string | boolean, secondArg?: boolean): boolean {
    let result = false;

    if (undefined === secondArg && 'boolean' === typeof firstArg) {
      secondArg = firstArg;
      firstArg = undefined;
    }

    const autoPause: boolean = !this.paused && secondArg;

    if (autoPause) {
      this.pause();
    }

    if (!firstArg) {
      result = this.focusSection();
    } else if ('string' === typeof firstArg) {
      if (this.sections[firstArg]) {
        result = this.focusSection(firstArg);
      } else {
        result = this.focusExtendedSelector(firstArg);
      }
    }

    if (autoPause) {
      this.resume();
    }

    return result;
  }

  public move(direction: DirectionType, selector?: string): boolean {
    direction = direction.toLowerCase() as DirectionType;

    if (!Reverse[direction]) {
      return false;
    }

    const element: HTMLElement = selector ? this.parseSelector(selector)[0] : this.getCurrentFocusedElement();

    if (!element) {
      return false;
    }

    const sectionId: string = this.getSectionId(element);

    if (!sectionId) {
      return false;
    }

    if (!this.fireEvent(element, 'will-move', {direction, sectionId, cause: 'api'})) {
      return false;
    }

    return this.focusNext(direction, element, sectionId);
  }

  public makeFocusable(sectionId?: string): void {
    const doMakeFocusable: (section: any) => void = section => {
      const tabIndexIgnoreList: string =
        section.tabIndexIgnoreList !== undefined
          ? section.tabIndexIgnoreList
          : SpatialNavigator.config.tabIndexIgnoreList;
      this.parseSelector(section.selector).forEach((element: HTMLElement) => {
        if (!this.matchSelector(element, tabIndexIgnoreList) && !element.getAttribute('tabindex')) {
          element.setAttribute('tabindex', '-1');
        }
      });
    };

    if (sectionId) {
      if (this.sections[sectionId]) {
        doMakeFocusable(this.sections[sectionId]);
      } else {
        throw new Error('Section "' + sectionId + '" doesn\'t exist!');
      }
    } else {
      for (const id in this.sections) {
        doMakeFocusable(this.sections[id]);
      }
    }
  }

  public setDefaultSection(id: string): void {
    if (!id) {
      this.defaultSectionId = '';
    } else if (!this.sections[id]) {
      throw new Error('Section "' + id + '" doesn\'t exist!');
    } else {
      this.defaultSectionId = id;
    }
  }

  private getRect(element: HTMLElement): IElementRect {
    return new ElementRect(element);
  }

  private partition(
    rects: ElementRectGroupsType,
    targetRect: IElementRect,
    straightOverlapThreshold: number
  ): ElementRectGroupsType[] {
    const groups: ElementRectGroupsType[] = [[], [], [], [], [], [], [], [], []];

    rects.forEach((rect: IElementRect) => {
      let x: number, y: number, groupId: number;

      if (rect.center.x < targetRect.left) {
        x = 0;
      } else if (rect.center.x <= targetRect.right) {
        x = 1;
      } else {
        x = 2;
      }

      if (rect.center.y < targetRect.top) {
        y = 0;
      } else if (rect.center.y <= targetRect.bottom) {
        y = 1;
      } else {
        y = 2;
      }

      groupId = y * 3 + x;
      groups[groupId].push(rect);

      if ([0, 2, 6, 8].indexOf(groupId) !== -1) {
        var threshold = straightOverlapThreshold;

        if (rect.left <= targetRect.right - targetRect.width * threshold) {
          if (groupId === 2) {
            groups[1].push(rect);
          } else if (groupId === 8) {
            groups[7].push(rect);
          }
        }

        if (rect.right >= targetRect.left + targetRect.width * threshold) {
          if (groupId === 0) {
            groups[1].push(rect);
          } else if (groupId === 6) {
            groups[7].push(rect);
          }
        }

        if (rect.top <= targetRect.bottom - targetRect.height * threshold) {
          if (groupId === 6) {
            groups[3].push(rect);
          } else if (groupId === 8) {
            groups[5].push(rect);
          }
        }

        if (rect.bottom >= targetRect.top + targetRect.height * threshold) {
          if (groupId === 0) {
            groups[3].push(rect);
          } else if (groupId === 2) {
            groups[5].push(rect);
          }
        }
      }
    });

    return groups;
  }

  private prioritize(priorities: GroupPriorityType[]): any {
    let destinationPriority = null;

    for (const priority of priorities) {
      if (priority.group.length) {
      }
    }

    for (let i = 0; i < priorities.length; i++) {
      if (priorities[i].group.length) {
        destinationPriority = priorities[i];
        break;
      }
    }

    if (!destinationPriority) {
      return null;
    }

    var destDistance = destinationPriority.distance;

    destinationPriority.group.sort(function (a, b) {
      for (var i = 0; i < destDistance.length; i++) {
        var distance = destDistance[i];
        var delta = distance(a) - distance(b);
        if (delta) {
          return delta;
        }
      }
      return 0;
    });

    return destinationPriority.group;
  }

  private navigate(
    target: HTMLElement,
    direction: DirectionType,
    candidates: HTMLElement[],
    config: NavigationConfigType
  ): HTMLElement {
    if (!target || !direction || !candidates || !candidates.length) {
      return;
    }

    const targetRect: IElementRect = this.getRect(target);

    if (!targetRect) {
      return;
    }

    const candidateRects: IElementRect[] = [];

    candidates.forEach((candidate: HTMLElement) => {
      const rect: IElementRect = this.getRect(candidate);

      if (rect) {
        candidateRects.push(rect);
      }
    });

    if (!candidateRects.length) {
      return;
    }

    var groups = this.partition(candidateRects, targetRect, config.straightOverlapThreshold);

    //TODO возможно здесь ошибка
    // var internalGroups = this.partition(groups[4], targetRect.center, config.straightOverlapThreshold);
    var internalGroups = this.partition(groups[4], targetRect, config.straightOverlapThreshold);

    let priorities: GroupPriorityType[];

    switch (direction) {
      case 'left':
        priorities = [
          {
            group: internalGroups[0].concat(internalGroups[3]).concat(internalGroups[6]),
            distance: [targetRect.nearPlumbLineIsBetter, targetRect.topIsBetter],
          },
          {
            group: groups[3],
            distance: [targetRect.nearPlumbLineIsBetter, targetRect.topIsBetter],
          },
          {
            group: groups[0].concat(groups[6]),
            distance: [targetRect.nearHorizonIsBetter, targetRect.rightIsBetter, targetRect.nearTargetTopIsBetter],
          },
        ];
        break;
      case 'right':
        priorities = [
          {
            group: internalGroups[2].concat(internalGroups[5]).concat(internalGroups[8]),
            distance: [targetRect.nearPlumbLineIsBetter, targetRect.topIsBetter],
          },
          {
            group: groups[5],
            distance: [targetRect.nearPlumbLineIsBetter, targetRect.topIsBetter],
          },
          {
            group: groups[2].concat(groups[8]),
            distance: [targetRect.nearHorizonIsBetter, targetRect.leftIsBetter, targetRect.nearTargetTopIsBetter],
          },
        ];
        break;
      case 'up':
        priorities = [
          {
            group: internalGroups[0].concat(internalGroups[1]).concat(internalGroups[2]),
            distance: [targetRect.nearHorizonIsBetter, targetRect.leftIsBetter],
          },
          {
            group: groups[1],
            distance: [targetRect.nearHorizonIsBetter, targetRect.leftIsBetter],
          },
          {
            group: groups[0].concat(groups[2]),
            distance: [targetRect.nearPlumbLineIsBetter, targetRect.bottomIsBetter, targetRect.nearTargetLeftIsBetter],
          },
        ];
        break;
      case 'down':
        priorities = [
          {
            group: internalGroups[6].concat(internalGroups[7]).concat(internalGroups[8]),
            distance: [targetRect.nearHorizonIsBetter, targetRect.leftIsBetter],
          },
          {
            group: groups[7],
            distance: [targetRect.nearHorizonIsBetter, targetRect.leftIsBetter],
          },
          {
            group: groups[6].concat(groups[8]),
            distance: [targetRect.nearPlumbLineIsBetter, targetRect.topIsBetter, targetRect.nearTargetLeftIsBetter],
          },
        ];
        break;
      default:
        return null;
    }

    if (config.straightOnly) {
      priorities.pop();
    }

    const destGroup = this.prioritize(priorities);

    if (!destGroup) {
      return;
    }

    let destination;

    if (
      config.rememberSource &&
      config.previous &&
      config.previous.destination === target &&
      config.previous.reverse === direction
    ) {
      for (var j = 0; j < destGroup.length; j++) {
        if (destGroup[j].element === config.previous.target) {
          destination = destGroup[j].element;
          break;
        }
      }
    }

    if (!destination) {
      destination = destGroup[0].element;
    }

    return destination;
  }

  private generateId(): string {
    let id;

    while (true) {
      id = ID_POOL_PREFIX + String(++this.idPool);

      if (!this.sections[id]) {
        break;
      }
    }

    return id;
  }

  private parseSelector(selector: string | HTMLElement | HTMLCollectionOf<HTMLElement>): HTMLElement[] {
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

  private matchSelector(element: HTMLElement, selector: any): boolean {
    if ('string' === typeof selector) {
      return elementMatchesSelector.call(element, selector);
    } else if ('object' === typeof selector && selector.length) {
      return selector.indexOf(element) >= 0;
    } else if ('object' === typeof selector && 1 === selector.nodeType) {
      return element === selector;
    }

    return false;
  }

  private getCurrentFocusedElement(): HTMLElement {
    if (document.activeElement && document.activeElement !== document.body) {
      return document.activeElement as HTMLElement;
    }
  }

  private extend<C extends Record<number | string | symbol, any>>(
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

  private exclude(elements: HTMLElement[], excluded: HTMLElement | HTMLElement[]): HTMLElement[] {
    if (!Array.isArray(excluded)) {
      excluded = [excluded];
    }

    for (let i: number = 0, index: number; i < excluded.length; i++) {
      index = elements.indexOf(excluded[i]);

      if (index >= 0) {
        elements.splice(index, 1);
      }
    }

    return elements;
  }

  private isNavigable(element: HTMLElement, sectionId: string, verifySectionSelector?: boolean): boolean {
    if (!element || !sectionId || !this.sections[sectionId] || this.sections[sectionId].disabled) {
      return false;
    }

    if ((element.offsetWidth <= 0 && element.offsetHeight <= 0) || element.hasAttribute('disabled')) {
      return false;
    }

    if (verifySectionSelector && !this.matchSelector(element, this.sections[sectionId].selector)) {
      return false;
    }

    if ('function' === typeof this.sections[sectionId].navigableFilter) {
      if (this.sections[sectionId].navigableFilter(element, sectionId) === false) {
        return false;
      }
    } else if ('function' === typeof SpatialNavigator.config.navigableFilter) {
      if (SpatialNavigator.config.navigableFilter(element, sectionId) === false) {
        return false;
      }
    }

    return true;
  }

  private getSectionId(element: HTMLElement): string {
    for (const id in this.sections) {
      if (!this.sections[id].disabled && this.matchSelector(element, this.sections[id].selector)) {
        return id;
      }
    }
  }

  private getSectionNavigableElements(sectionId: string): HTMLElement[] {
    return this.parseSelector(this.sections[sectionId].selector)?.filter((element: HTMLElement) =>
      this.isNavigable(element, sectionId)
    );
  }

  private getSectionDefaultElement(sectionId): HTMLElement {
    return this.parseSelector(this.sections[sectionId].defaultElement)?.find((element: HTMLElement) =>
      this.isNavigable(element, sectionId, true)
    );
  }

  private getSectionLastFocusedElement(sectionId: string): HTMLElement {
    const lastFocusedElement: HTMLElement = this.sections[sectionId].lastFocusedElement;

    if (this.isNavigable(lastFocusedElement, sectionId, true)) {
      return lastFocusedElement;
    }
  }

  private fireEvent(element: HTMLElement, type: string, detail?: any, cancelable: boolean = true): boolean {
    return element.dispatchEvent(new CustomEvent(EVENT_PREFIX + type, {detail, cancelable}));
  }

  private focusElement(element: HTMLElement, sectionId: string, direction?: DirectionType): boolean {
    if (!element) {
      return false;
    }

    const currentFocusedElement: HTMLElement = this.getCurrentFocusedElement();

    const silentFocus = (): void => {
      if (currentFocusedElement) {
        currentFocusedElement.blur();
      }

      element.focus();
      this.focusChanged(element, sectionId);
    };

    if (this.duringFocusChange) {
      silentFocus();
      return true;
    }

    this.duringFocusChange = true;

    if (this.paused) {
      silentFocus();
      this.duringFocusChange = false;
      return true;
    }

    if (currentFocusedElement) {
      const unfocusProperties: Record<string, any> = {
        nextElement: element,
        nextSectionId: sectionId,
        direction,
        native: false,
      };

      if (!this.fireEvent(currentFocusedElement, 'will-unfocus', unfocusProperties)) {
        this.duringFocusChange = false;
        return false;
      }

      currentFocusedElement.blur();
      this.fireEvent(currentFocusedElement, 'unfocused', unfocusProperties, false);
    }

    const focusProperties: Record<string, any> = {
      previousElement: currentFocusedElement,
      sectionId,
      direction,
      native: false,
    };

    if (!this.fireEvent(element, 'will-focus', focusProperties)) {
      this.duringFocusChange = false;
      return false;
    }

    element.focus();
    this.fireEvent(element, 'focused', focusProperties, false);
    this.duringFocusChange = false;
    this.focusChanged(element, sectionId);

    return true;
  }

  private focusChanged(element: HTMLElement, sectionId?: string): void {
    if (!sectionId) {
      sectionId = this.getSectionId(element);
    }

    if (sectionId) {
      this.sections[sectionId].lastFocusedElement = element;
      this.lastSectionId = sectionId;
    }
  }

  private focusExtendedSelector(selector: string, direction?: DirectionType): boolean {
    if ('@' === selector.charAt(0)) {
      return 1 === selector.length ? this.focusSection() : this.focusSection(selector.substring(1));
    } else {
      const next: HTMLElement = this.parseSelector(selector)[0];

      if (next) {
        const nextSectionId = this.getSectionId(next);

        if (this.isNavigable(next, nextSectionId)) {
          return this.focusElement(next, nextSectionId, direction);
        }
      }
    }

    return false;
  }

  private focusSection(sectionId?: string): boolean {
    const range: string[] = [];
    const addRange: (id: string) => void = (id: string) => {
      if (id && range.indexOf(id) < 0 && this.sections[id] && !this.sections[id].disabled) {
        range.push(id);
      }
    };

    if (sectionId) {
      addRange(sectionId);
    } else {
      addRange(this.defaultSectionId);
      addRange(this.lastSectionId);
      Object.keys(this.sections).map(addRange);
    }

    for (const id of range) {
      let next: HTMLElement;

      if ('last-focused' === this.sections[id].enterTo) {
        next =
          this.getSectionLastFocusedElement(id) ||
          this.getSectionDefaultElement(id) ||
          this.getSectionNavigableElements(id)[0];
      } else {
        next =
          this.getSectionDefaultElement(id) ||
          this.getSectionLastFocusedElement(id) ||
          this.getSectionNavigableElements(id)[0];
      }

      if (next) {
        return this.focusElement(next, id);
      }
    }

    return false;
  }

  private fireNavigatefailed(element: HTMLElement, direction): false {
    this.fireEvent(element, 'navigate-failed', {direction}, false);
    return false;
  }

  private gotoLeaveFor(sectionId: string, direction: DirectionType): boolean | undefined {
    if (this.sections[sectionId].leaveFor && this.sections[sectionId].leaveFor[direction] !== undefined) {
      const next: string = this.sections[sectionId].leaveFor[direction];

      if ('string' === typeof next) {
        if ('' === next) {
          return;
        }

        return this.focusExtendedSelector(next, direction);
      }
    }

    return false;
  }

  private focusNext(direction: DirectionType, currentFocusedElement: HTMLElement, currentSectionId: string): boolean {
    const extSelector: string = currentFocusedElement.getAttribute('data-sn-' + direction);

    if ('string' === typeof extSelector) {
      if ('' === extSelector || !this.focusExtendedSelector(extSelector, direction)) {
        return this.fireNavigatefailed(currentFocusedElement, direction);
      }

      return true;
    }

    const sectionNavigableElements: Record<string, HTMLElement[]> = {};
    let allNavigableElements: HTMLElement[] = [];

    for (const id in this.sections) {
      sectionNavigableElements[id] = this.getSectionNavigableElements(id);
      allNavigableElements = allNavigableElements.concat(sectionNavigableElements[id]);
    }

    const config: NavigationConfigType = this.extend<NavigationConfigType>(
      {},
      SpatialNavigator.config,
      this.sections[currentSectionId]
    );
    let next: HTMLElement;

    if (config.restrict === Restrict.SELF_ONLY || config.restrict === Restrict.SELF_FIRST) {
      const currentSectionNavigableElements: HTMLElement[] = sectionNavigableElements[currentSectionId];

      next = this.navigate(
        currentFocusedElement,
        direction,
        this.exclude(currentSectionNavigableElements, currentFocusedElement),
        config
      );

      if (!next && config.restrict === Restrict.SELF_FIRST) {
        next = this.navigate(
          currentFocusedElement,
          direction,
          this.exclude(allNavigableElements, currentSectionNavigableElements),
          config
        );
      }
    } else {
      next = this.navigate(
        currentFocusedElement,
        direction,
        this.exclude(allNavigableElements, currentFocusedElement),
        config
      );
    }

    if (next) {
      this.sections[currentSectionId].previous = {
        target: currentFocusedElement,
        destination: next,
        reverse: Reverse[direction],
      };

      const nextSectionId: string = this.getSectionId(next);

      if (currentSectionId != nextSectionId) {
        const result: boolean | undefined = this.gotoLeaveFor(currentSectionId, direction);

        if (result) {
          return true;
        } else if (undefined === result) {
          return this.fireNavigatefailed(currentFocusedElement, direction);
        }

        let enterToElement: HTMLElement;

        switch (this.sections[nextSectionId].enterTo) {
          case 'last-focused':
            enterToElement =
              this.getSectionLastFocusedElement(nextSectionId) || this.getSectionDefaultElement(nextSectionId);
            break;
          case 'default-element':
            enterToElement = this.getSectionDefaultElement(nextSectionId);
            break;
        }

        if (enterToElement) {
          next = enterToElement;
        }
      }

      return this.focusElement(next, nextSectionId, direction);
    } else if (this.gotoLeaveFor(currentSectionId, direction)) {
      return true;
    }

    return this.fireNavigatefailed(currentFocusedElement, direction);
  }

  private getDirection(event: KeyboardEvent): DirectionType {
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

  private isEnter(event: KeyboardEvent): boolean {
    if (event.keyCode) {
      return 13 === event.keyCode;
    }

    return 'Enter' === event.code;
  }

  @bind
  private onKeyDown(event: KeyboardEvent): boolean {
    if (!this.sectionCount || this.paused || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    let currentFocusedElement: HTMLElement;

    const preventDefault: () => false = () => {
      event.preventDefault();
      event.stopPropagation();
      return false;
    };

    const direction = this.getDirection(event);

    if (!direction) {
      if (this.isEnter(event)) {
        currentFocusedElement = this.getCurrentFocusedElement();

        if (currentFocusedElement && this.getSectionId(currentFocusedElement)) {
          if (!this.fireEvent(currentFocusedElement, 'enter-down')) {
            return preventDefault();
          }
        }
      }

      return;
    }

    currentFocusedElement = this.getCurrentFocusedElement();

    if (!currentFocusedElement) {
      if (this.lastSectionId) {
        currentFocusedElement = this.getSectionLastFocusedElement(this.lastSectionId);
      }

      if (!currentFocusedElement) {
        this.focusSection();
        return preventDefault();
      }
    }

    const sectionId: string = this.getSectionId(currentFocusedElement);

    if (!sectionId) {
      return;
    }

    if (this.fireEvent(currentFocusedElement, 'will-move', {direction, sectionId, cause: 'keydown'})) {
      this.focusNext(direction, currentFocusedElement, sectionId);
    }

    return preventDefault();
  }

  @bind
  private onKeyUp(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (!this.paused && this.sectionCount && this.isEnter(event)) {
      const currentFocusedElement = this.getCurrentFocusedElement();

      if (currentFocusedElement && this.getSectionId(currentFocusedElement)) {
        if (!this.fireEvent(currentFocusedElement, 'enter-up')) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    }
  }

  @bind
  private onFocus({target}: FocusEvent) {
    if (target !== window && target !== document && this.sectionCount && !this.duringFocusChange) {
      const sectionId: string = this.getSectionId(target as HTMLElement);

      if (sectionId) {
        if (this.paused) {
          this.focusChanged(target as HTMLElement, sectionId);
          return;
        }

        if (!this.fireEvent(target as HTMLElement, 'will-focus', {sectionId, native: true})) {
          this.duringFocusChange = true;
          (target as HTMLElement).blur();
          this.duringFocusChange = false;
        } else {
          this.fireEvent(target as HTMLElement, 'focused', {sectionId, native: true}, false);
          this.focusChanged(target as HTMLElement, sectionId);
        }
      }
    }
  }

  @bind
  private onBlur({target}: FocusEvent) {
    if (
      target !== window &&
      target !== document &&
      !this.paused &&
      this.sectionCount &&
      !this.duringFocusChange &&
      this.getSectionId(target as HTMLElement)
    ) {
      if (!this.fireEvent(target as HTMLElement, 'will-unfocus', {native: true})) {
        this.duringFocusChange = true;
        setTimeout(() => {
          (target as HTMLElement).focus();
          this.duringFocusChange = false;
        });
      } else {
        this.fireEvent(target as HTMLElement, 'unfocused', {native: true}, false);
      }
    }
  }
}
