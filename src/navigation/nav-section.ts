import type {
  DirectionType,
  ExtendedSelectorType,
  INavSection,
  LeaveForType,
  NavConfigType,
  PreviosFocusType,
} from './spatial-navigator';
import SpatialNavigator, {Restrict} from './spatial-navigator';
import {elementMatchesSelector, selectElements} from './utils';

export default class NavSection implements INavSection {
  private id: string;
  private disabled: boolean = false;

  public defaultElementSelector?: string = '';
  public lastFocusedElement: HTMLElement = undefined;
  public previousFocus?: PreviosFocusType = undefined;
  public selector?: string = '';
  public straightOnly?: boolean = false;
  public straightOverlapThreshold?: number = undefined;
  public rememberSource?: boolean = false;
  public enterTo?: '' | 'last-focused' | 'default-element' = '';
  public leaveFor?: LeaveForType = null;
  public restrict?: Restrict = Restrict.SELF_FIRST;
  public tabIndexIgnoreList: string = 'a, input, select, textarea, button, iframe, [contentEditable=true]';
  public navigableFilter: (element: HTMLElement, sectionId?: string) => boolean = null;

  constructor(config: Omit<NavConfigType, 'lastFocusedElement' | 'previousFocus'>, id?: string) {
    this.setConfig(config);

    if (id) {
      this.id = id;
    } else if (config.id) {
      this.id = config.id;
    }
  }

  public setConfig(config: NavConfigType): void {
    for (const key in config) {
      if (SpatialNavigator.config[key] !== undefined) {
        this[key] = config[key];
      }
    }
  }

  public disable(): void {
    this.disabled = true;
  }

  public enable(): void {
    this.disabled = false;
  }

  public isDisabled(): boolean {
    return this.disabled;
  }

  public savePreviousFocus(target: HTMLElement, destination: HTMLElement, reverse: DirectionType): void {
    this.previousFocus = {target, destination, reverse};
  }

  public makeFocusable(): void {
    const ignoredTabsList: string = this.getIgnoredTabsList();
    selectElements(this.selector).forEach((element: HTMLElement) => {
      if (!this.matchSelector(element, ignoredTabsList) && !element.getAttribute('tabindex')) {
        element.setAttribute('tabindex', '-1');
      }
    });
  }

  public match(element: HTMLElement): boolean {
    return this.matchSelector(element, this.selector);
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

  private getIgnoredTabsList(): string {
    return this.tabIndexIgnoreList !== undefined ? this.tabIndexIgnoreList : SpatialNavigator.config.tabIndexIgnoreList;
  }

  /**************/
  /* NavMethods */
  /**************/
  public isNavigable(element: HTMLElement, verifySectionSelector?: boolean): boolean {
    if (!element || this.isDisabled()) {
      return false;
    }

    if ((element.offsetWidth <= 0 && element.offsetHeight <= 0) || element.hasAttribute('disabled')) {
      return false;
    }

    if (verifySectionSelector && !this.match(element)) {
      return false;
    }

    if ('function' === typeof this.navigableFilter) {
      if (this.navigableFilter(element) === false) {
        return false;
      }
    } else if ('function' === typeof SpatialNavigator.config.navigableFilter) {
      if (SpatialNavigator.config.navigableFilter(element) === false) {
        return false;
      }
    }

    return true;
  }

  public getSectionDefaultElement(): HTMLElement {
    if (this.defaultElementSelector) {
      return selectElements(this.defaultElementSelector)?.find((element: HTMLElement) =>
        this.isNavigable(element, true)
      );
    }
  }

  public getSectionNavigableElements(): HTMLElement[] {
    if (this.selector) {
      return selectElements(this.selector)?.filter((element: HTMLElement) => this.isNavigable(element));
    }
  }

  public getSectionLastFocusedElement(): HTMLElement {
    if (this.isNavigable(this.lastFocusedElement, true)) {
      return this.lastFocusedElement;
    }
  }

  public getleaveForAt(direction: DirectionType): ExtendedSelectorType {
    if (this.leaveFor && this.leaveFor[direction] !== undefined) {
      return this.leaveFor[direction];
    }
  }
}
