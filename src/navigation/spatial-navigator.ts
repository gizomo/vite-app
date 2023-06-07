import {bind} from 'helpful-decorators';
import ElementRect, {partition} from './element-rect';
import NavSection from './nav-section';
import {exclude, extend, fireEvent, getDirection, isEnter, selectElements} from './utils';

export type ElementCenterType = {
  x: number;
  y: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  readonly width: number;
  readonly height: number;
};

type ElementDistanceCalcType = (rect: IElementRect) => number;

export interface IElementRect {
  width: number;
  height: number;
  top: number;
  bottom: number;
  right: number;
  left: number;
  element: HTMLElement;
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

type GroupPriorityType = {
  group: IElementRect[];
  distanceMeters: ElementDistanceCalcType[];
};

export type ExtendedSelectorType = string | HTMLElement | HTMLCollectionOf<HTMLElement>;

export type LeaveForType = {
  left?: ExtendedSelectorType;
  right?: ExtendedSelectorType;
  top?: ExtendedSelectorType;
  bottom?: ExtendedSelectorType;
};

export interface INavigationConfig {
  selector?: ExtendedSelectorType;
  straightOnly?: boolean; // Only elements in the straight (vertical or horizontal) direction will be navigated
  straightOverlapThreshold?: number; // This threshold is used to determine whether an element is considered in the straight (vertical or horizontal) directions. Valid number is between 0 to 1.0.
  rememberSource?: boolean; // The previously focused element will have higher priority to be chosen as the next candidate
  priority?: 'last-focused' | 'default-element' | ''; // Define which element in this section should be focused first, if the focus comes from another section
  leaveFor?: LeaveForType; // Next element which should be focused on leaving current section. Each direction can inlcude element selector-string / DOMElement or list
  restrict?: Restrict; // 'self-first' implies that elements within the same section will have higher priority to be chosen as the next candidate. 'self-only' implies that elements in the other sections will never be navigated by arrow keys (only by calling focus() manually).
  tabIndexIgnoreList: string;
  navigableFilter: (element: HTMLElement, sectionId?: string) => boolean;
}

export interface INavSection extends INavigationConfig {
  defaultElementSelector?: string;
  lastFocusedElement: HTMLElement;
  previousFocus?: PreviosFocusType;
  isDisabled: () => boolean;
  disable: () => void;
  enable: () => void;
  match: (element: HTMLElement) => boolean;
  makeFocusable: () => void;
  savePreviousFocus: (target: HTMLElement, destination: HTMLElement, reverse: DirectionType) => void;
  isNavigable: (element: HTMLElement, verifySectionSelector?: boolean) => boolean;
  getDefaultElement: () => HTMLElement;
  getLastFocusedElement: () => HTMLElement;
  getPrimaryElement: () => HTMLElement;
  getNavigableElements: () => HTMLElement[];
  gotoLeaveFor: (direction: DirectionType) => boolean | undefined;
  focus: () => boolean;
}

export type PreviosFocusType = {
  target: HTMLElement;
  destination: HTMLElement;
  reverse: DirectionType;
};

export type NavConfigType = Partial<INavSection> & {id?: string};

export enum Restrict {
  SELF_ONLY = 'self-only',
  SELF_FIRST = 'self-first',
  NONE = 'none',
}

const Reverse = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
} as const;

export type DirectionType = 'down' | 'left' | 'right' | 'up';

const ID_POOL_PREFIX = 'section-';

export default class SpatialNavigator {
  public static config: Required<INavigationConfig> = {
    selector: '',
    straightOnly: false,
    straightOverlapThreshold: 0.5,
    rememberSource: false,
    priority: '',
    leaveFor: null,
    restrict: Restrict.SELF_FIRST,
    tabIndexIgnoreList: 'a, input, select, textarea, button, iframe, [contentEditable=true]',
    navigableFilter: null,
  };

  private ready: boolean = false;
  private paused: boolean = false;
  private duringFocusChange: boolean = false;

  private sections: Record<string, INavSection> = {};
  private sectionCount: number = 0;
  private sectionsIdPool: number = 0;
  private defaultSectionId: string = '';
  private lastSectionId: string = '';

  private generateId(): string {
    let id;

    while (true) {
      id = ID_POOL_PREFIX + String(++this.sectionsIdPool);

      if (!this.sections[id]) {
        break;
      }
    }

    return id;
  }

  private getSectionId(element: HTMLElement): string {
    for (const id in this.sections) {
      if (!this.sections[id].isDisabled() && this.sections[id].match(element)) {
        return id;
      }
    }
  }

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
    this.sectionsIdPool = 0;
    this.ready = false;
  }

  public clear(): void {
    this.sections = {};
    this.sectionCount = 0;
    this.defaultSectionId = '';
    this.lastSectionId = '';
    this.duringFocusChange = false;
  }

  public setConfig(config: NavConfigType, sectionId?: string): this {
    for (const key in config) {
      if (SpatialNavigator.config[key] !== undefined) {
        if (sectionId) {
          this.sections[sectionId][key] = config[key];
        } else if (config[key] !== undefined) {
          SpatialNavigator.config[key] = config[key];
        }
      }
    }

    return this;
  }

  public addSection(config: NavConfigType, sectionId?: string): this {
    if (!sectionId) {
      sectionId = 'string' === typeof config.id ? config.id : this.generateId();
    }

    if (this.sections[sectionId]) {
      throw new Error('Section "' + sectionId + '" has already existed!');
    }

    this.sections[sectionId] = new NavSection(this, config, sectionId);
    this.sectionCount++;

    return this;
  }

  public removeSection(id: string): boolean {
    if (!id || typeof id !== 'string') {
      throw new Error('Please assign the "sectionId"!');
    }

    if (this.sections[id]) {
      this.sections[id] = undefined;
      delete this.sections[id];
      // this.sections = extend({}, this.sections);
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
      this.sections[id].disable();
      return true;
    }

    return false;
  }

  public enableSection(id: string): boolean {
    if (this.sections[id]) {
      this.sections[id].enable();
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
   * focus([sectionId], [silent])
   * focus([extSelector], [silent])
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

    const element: HTMLElement = selector ? selectElements(selector)[0] : this.getFocusedElement();

    if (!element) {
      return false;
    }

    const sectionId: string = this.getSectionId(element);

    if (!sectionId) {
      return false;
    }

    if (!fireEvent(element, 'will-move', {direction, sectionId, cause: 'api'})) {
      return false;
    }

    return this.focusNext(direction, element, sectionId);
  }

  public makeFocusable(sectionId?: string): void {
    if (sectionId) {
      if (this.sections[sectionId]) {
        this.sections[sectionId].makeFocusable();
      } else {
        throw new Error('Section "' + sectionId + '" doesn\'t exist!');
      }
    } else {
      for (const id in this.sections) {
        this.sections[id].makeFocusable();
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

  private definePriorities(
    targetRect: IElementRect,
    direction: DirectionType,
    groups: IElementRect[][],
    internalGroups: IElementRect[][],
    straightOnly: boolean = false
  ): GroupPriorityType[] {
    switch (direction) {
      case 'left':
        return [
          {
            group: internalGroups[0].concat(internalGroups[3]).concat(internalGroups[6]),
            distanceMeters: [targetRect.nearPlumbLineIsBetter, targetRect.topIsBetter],
          },
          {
            group: groups[3],
            distanceMeters: [targetRect.nearPlumbLineIsBetter, targetRect.topIsBetter],
          },
          straightOnly
            ? undefined
            : {
                group: groups[0].concat(groups[6]),
                distanceMeters: [
                  targetRect.nearHorizonIsBetter,
                  targetRect.rightIsBetter,
                  targetRect.nearTargetTopIsBetter,
                ],
              },
        ];
      case 'right':
        return [
          {
            group: internalGroups[2].concat(internalGroups[5]).concat(internalGroups[8]),
            distanceMeters: [targetRect.nearPlumbLineIsBetter, targetRect.topIsBetter],
          },
          {
            group: groups[5],
            distanceMeters: [targetRect.nearPlumbLineIsBetter, targetRect.topIsBetter],
          },
          straightOnly
            ? undefined
            : {
                group: groups[2].concat(groups[8]),
                distanceMeters: [
                  targetRect.nearHorizonIsBetter,
                  targetRect.leftIsBetter,
                  targetRect.nearTargetTopIsBetter,
                ],
              },
        ];
      case 'up':
        return [
          {
            group: internalGroups[0].concat(internalGroups[1]).concat(internalGroups[2]),
            distanceMeters: [targetRect.nearHorizonIsBetter, targetRect.leftIsBetter],
          },
          {
            group: groups[1],
            distanceMeters: [targetRect.nearHorizonIsBetter, targetRect.leftIsBetter],
          },
          straightOnly
            ? undefined
            : {
                group: groups[0].concat(groups[2]),
                distanceMeters: [
                  targetRect.nearPlumbLineIsBetter,
                  targetRect.bottomIsBetter,
                  targetRect.nearTargetLeftIsBetter,
                ],
              },
        ];
      case 'down':
        return [
          {
            group: internalGroups[6].concat(internalGroups[7]).concat(internalGroups[8]),
            distanceMeters: [targetRect.nearHorizonIsBetter, targetRect.leftIsBetter],
          },
          {
            group: groups[7],
            distanceMeters: [targetRect.nearHorizonIsBetter, targetRect.leftIsBetter],
          },
          straightOnly
            ? undefined
            : {
                group: groups[6].concat(groups[8]),
                distanceMeters: [
                  targetRect.nearPlumbLineIsBetter,
                  targetRect.topIsBetter,
                  targetRect.nearTargetLeftIsBetter,
                ],
              },
        ];
      default:
        return;
    }
  }

  private prioritize(priorities: GroupPriorityType[]): IElementRect[] {
    let destinationPriority: GroupPriorityType = undefined;

    for (const priority of priorities) {
      if (priority && priority.group.length) {
        destinationPriority = priority;
        break;
      }
    }

    if (!destinationPriority) {
      return;
    }

    destinationPriority.group.sort((a: IElementRect, b: IElementRect) => {
      for (const distanceTo of destinationPriority.distanceMeters) {
        const delta = distanceTo(a) - distanceTo(b);

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
    config: NavConfigType = SpatialNavigator.config
  ): HTMLElement {
    if (!target || !direction || !candidates || !candidates.length) {
      return;
    }

    const targetRect: IElementRect = new ElementRect(target);
    const candidatesRects: IElementRect[] = candidates.map((candidate: HTMLElement) => new ElementRect(candidate));

    const groups: IElementRect[][] = partition(candidatesRects, targetRect, config.straightOverlapThreshold);
    const internalGroups: IElementRect[][] = partition(groups[4], targetRect.center, config.straightOverlapThreshold);

    const destinationGroup: IElementRect[] = this.prioritize(
      this.definePriorities(targetRect, direction, groups, internalGroups, config.straightOnly)
    );

    if (!destinationGroup) {
      return;
    }

    let destination: HTMLElement;

    if (
      config.rememberSource &&
      config.previousFocus &&
      config.previousFocus.destination === target &&
      config.previousFocus.reverse === direction
    ) {
      for (const rect of destinationGroup) {
        if (rect.element === config.previousFocus.target) {
          destination = rect.element;
          break;
        }
      }
    }

    return destination ?? destinationGroup[0].element;
  }

  private getFocusedElement(): HTMLElement {
    if (document.activeElement && document.activeElement !== document.body) {
      return document.activeElement as HTMLElement;
    }
  }

  public focusElement(element: HTMLElement, sectionId: string, direction?: DirectionType): boolean {
    if (!element) {
      return false;
    }

    const focusedElement: HTMLElement = this.getFocusedElement();

    const silentFocus = (): void => {
      if (focusedElement) {
        focusedElement.blur();
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

    if (focusedElement) {
      const unfocusProperties: Record<string, any> = {
        nextElement: element,
        nextSectionId: sectionId,
        direction,
        native: false,
      };

      if (!fireEvent(focusedElement, 'will-unfocus', unfocusProperties)) {
        this.duringFocusChange = false;
        return false;
      }

      focusedElement.blur();
      fireEvent(focusedElement, 'unfocused', unfocusProperties, false);
    }

    const focusProperties: Record<string, any> = {
      previousElement: focusedElement,
      sectionId,
      direction,
      native: false,
    };

    if (!fireEvent(element, 'will-focus', focusProperties)) {
      this.duringFocusChange = false;
      return false;
    }

    element.focus();
    fireEvent(element, 'focused', focusProperties, false);
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

  public focusExtendedSelector(selector: ExtendedSelectorType, direction?: DirectionType): boolean {
    if ('string' === typeof selector && '@' === selector.charAt(0)) {
      return 1 === selector.length ? this.focusSection() : this.focusSection(selector.substring(1));
    } else {
      const element: HTMLElement = selectElements(selector)[0];

      if (element) {
        const sectionId = this.getSectionId(element);

        if (sectionId && this.sections[sectionId].isNavigable(element)) {
          return this.focusElement(element, sectionId, direction);
        }
      }
    }

    return false;
  }

  private focusSection(sectionId?: string): boolean {
    const range: string[] = [];
    const addRange: (id: string) => void = (id: string) => {
      if (id && range.indexOf(id) < 0 && this.sections[id] && !this.sections[id].isDisabled()) {
        range.push(id);
      }
    };

    if (sectionId) {
      addRange(sectionId);
    } else {
      if (this.defaultSectionId) {
        addRange(this.defaultSectionId);
      }

      if (this.lastSectionId) {
        addRange(this.lastSectionId);
      }

      if (this.sectionCount > 0) {
        Object.keys(this.sections).map(addRange);
      }
    }

    for (const id of range) {
      if (this.sections[id].focus()) {
        return true;
      }
    }

    return false;
  }

  private fireNavigatefailed(element: HTMLElement, direction): false {
    fireEvent(element, 'navigate-failed', {direction}, false);
    return false;
  }

  private focusNext(direction: DirectionType, focusedElement: HTMLElement, currentSectionId: string): boolean {
    const extSelector: string = focusedElement.getAttribute('data-sn-' + direction);

    if ('string' === typeof extSelector) {
      if ('' === extSelector || !this.focusExtendedSelector(extSelector, direction)) {
        return this.fireNavigatefailed(focusedElement, direction);
      }

      return true;
    }

    const sectionsNavigableElements: Record<string, HTMLElement[]> = {};
    let allNavigableElements: HTMLElement[] = [];

    for (const id in this.sections) {
      sectionsNavigableElements[id] = this.sections[id].getNavigableElements();
      allNavigableElements = allNavigableElements.concat(sectionsNavigableElements[id]);
    }

    let nextElement: HTMLElement;
    // const config: NavConfigType = extend<NavConfigType>({}, SpatialNavigator.config, this.sections[currentSectionId]);
    const config: NavConfigType = Object.assign({}, SpatialNavigator.config, this.sections[currentSectionId]);

    if (config.restrict === Restrict.SELF_ONLY || config.restrict === Restrict.SELF_FIRST) {
      const currentSectionNavigableElements: HTMLElement[] = sectionsNavigableElements[currentSectionId];

      nextElement = this.navigate(
        focusedElement,
        direction,
        exclude(currentSectionNavigableElements, focusedElement),
        config
      );

      if (!nextElement && config.restrict === Restrict.SELF_FIRST) {
        nextElement = this.navigate(
          focusedElement,
          direction,
          exclude(allNavigableElements, currentSectionNavigableElements),
          config
        );
      }
    } else {
      nextElement = this.navigate(focusedElement, direction, exclude(allNavigableElements, focusedElement), config);
    }

    if (nextElement) {
      this.sections[currentSectionId].savePreviousFocus(focusedElement, nextElement, Reverse[direction]);

      const nextSectionId: string = this.getSectionId(nextElement);

      if (currentSectionId !== nextSectionId) {
        const result: boolean | undefined = this.sections[currentSectionId].gotoLeaveFor(direction);

        if (result) {
          return true;
        } else if (undefined === result) {
          return this.fireNavigatefailed(focusedElement, direction);
        }

        const enterToElement: HTMLElement = this.sections[nextSectionId].getPrimaryElement();

        if (enterToElement) {
          nextElement = enterToElement;
        }
      }

      return this.focusElement(nextElement, nextSectionId, direction);
    } else if (this.sections[currentSectionId].gotoLeaveFor(direction)) {
      return true;
    }

    return this.fireNavigatefailed(focusedElement, direction);
  }

  @bind
  private onKeyDown(event: KeyboardEvent): boolean {
    if (!this.sectionCount || this.paused || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    let focusedElement: HTMLElement;

    const preventDefault: () => false = () => {
      event.preventDefault();
      event.stopPropagation();
      return false;
    };

    const direction: DirectionType = getDirection(event);

    if (!direction) {
      if (isEnter(event)) {
        focusedElement = this.getFocusedElement();

        if (focusedElement && this.getSectionId(focusedElement)) {
          if (!fireEvent(focusedElement, 'enter-down')) {
            return preventDefault();
          }
        }
      }

      return;
    }

    focusedElement = this.getFocusedElement();

    if (!focusedElement) {
      if (this.lastSectionId) {
        focusedElement = this.sections[this.lastSectionId].getLastFocusedElement();
      }

      if (!focusedElement) {
        this.focusSection();
        return preventDefault();
      }
    }

    const sectionId: string = this.getSectionId(focusedElement);

    if (!sectionId) {
      return;
    }

    if (fireEvent(focusedElement, 'will-move', {direction, sectionId, cause: 'keydown'})) {
      this.focusNext(direction, focusedElement, sectionId);
    }

    return preventDefault();
  }

  @bind
  private onKeyUp(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (!this.paused && this.sectionCount && isEnter(event)) {
      const focusedElement: HTMLElement = this.getFocusedElement();

      if (focusedElement && this.getSectionId(focusedElement)) {
        if (!fireEvent(focusedElement, 'enter-up')) {
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

        if (!fireEvent(target as HTMLElement, 'will-focus', {sectionId, native: true})) {
          this.duringFocusChange = true;
          (target as HTMLElement).blur();
          this.duringFocusChange = false;
        } else {
          fireEvent(target as HTMLElement, 'focused', {sectionId, native: true}, false);
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
      if (!fireEvent(target as HTMLElement, 'will-unfocus', {native: true})) {
        this.duringFocusChange = true;
        setTimeout(() => {
          (target as HTMLElement).focus();
          this.duringFocusChange = false;
        });
      } else {
        fireEvent(target as HTMLElement, 'unfocused', {native: true}, false);
      }
    }
  }
}
