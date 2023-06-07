import {bind} from 'helpful-decorators';
import type {IElementRect, ElementCenterType} from './spatial-navigator';

export default class ElementRect implements IElementRect {
  public width: number;
  public height: number;
  public top: number;
  public bottom: number;
  public right: number;
  public left: number;
  public element: HTMLElement;
  public center: ElementCenterType;

  constructor(element: HTMLElement) {
    this.element = element;

    const {width, height, top, bottom, left, right}: DOMRect = element.getBoundingClientRect();

    this.width = width;
    this.height = height;
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;
    this.center = this.getCenter(width, height, left, top);
  }

  private getCenter(width: number, height: number, left: number, top: number): ElementCenterType {
    const x: number = left + Math.floor(width / 2);
    const y: number = top + Math.floor(height / 2);

    return {x, y, left: x, right: x, top: y, bottom: y, width: 0, height: 0};
  }

  @bind
  public nearPlumbLineIsBetter({center, right, left}: IElementRect): number {
    const d: number = center.x < this.center.x ? this.center.x - right : left - this.center.x;
    return d < 0 ? 0 : d;
  }

  @bind
  public nearHorizonIsBetter({center, bottom, top}: IElementRect): number {
    const d: number = center.y < this.center.y ? this.center.y - bottom : top - this.center.y;
    return d < 0 ? 0 : d;
  }

  @bind
  public nearTargetLeftIsBetter({center, right, left}: IElementRect): number {
    const d: number = center.x < this.center.x ? this.left - right : left - this.left;
    return d < 0 ? 0 : d;
  }

  @bind
  public nearTargetTopIsBetter({center, bottom, top}: IElementRect): number {
    const d: number = center.y < this.center.y ? this.top - bottom : top - this.top;
    return d < 0 ? 0 : d;
  }

  @bind
  public topIsBetter({top}: IElementRect): number {
    return top;
  }

  @bind
  public bottomIsBetter({bottom}: IElementRect): number {
    return -1 * bottom;
  }

  @bind
  public leftIsBetter({left}: IElementRect): number {
    return left;
  }

  @bind
  public rightIsBetter({right}: IElementRect): number {
    return -1 * right;
  }
}

/**
 * Given a set of {@link IElementRect} array, divide them into 9 groups with
 * respect to the position of targetRect. Rects centered inside targetRect
 * are grouped as 4th group; straight left as 3rd group; straight right as
 * 5th group; ..... and so on. See below for the corresponding group number:
 *
 * ```
 *  |---|---|---|
 *  | 0 | 1 | 2 |
 *  |---|---|---|
 *  | 3 | 4 | 5 |
 *  |---|---|---|
 *  | 6 | 7 | 8 |
 *  |---|---|---|
 * ```
 *
 * @param {Array.<IElementRect>} rects to be divided.
 * @param {IElementRect} targetRect reference position for groups.
 *
 * @return {Array.Array.<IElementRect>} 9-cells matrix, where rects are categorized into these 9 cells by their group number.
 */
export function partition(
  rects: IElementRect[],
  {width, height, top, bottom, left, right}: IElementRect | ElementCenterType,
  threshold: number = 0.5
): IElementRect[][] {
  const groups: IElementRect[][] = [[], [], [], [], [], [], [], [], []];

  rects.forEach((rect: IElementRect) => {
    const x: number = rect.center.x < left ? 0 : rect.center.x <= right ? 1 : 2;
    const y: number = rect.center.y < top ? 0 : rect.center.y <= bottom ? 1 : 2;
    const groupId: number = y * 3 + x;

    // add to group by element center
    groups[groupId].push(rect);

    // add to additional groups for elements at angled groups
    if ([0, 2, 6, 8].indexOf(groupId) !== -1) {
      if (rect.left <= right - width * threshold) {
        if (groupId === 2) {
          groups[1].push(rect);
        } else if (groupId === 8) {
          groups[7].push(rect);
        }
      }

      if (rect.right >= left + width * threshold) {
        if (groupId === 0) {
          groups[1].push(rect);
        } else if (groupId === 6) {
          groups[7].push(rect);
        }
      }

      if (rect.top <= bottom - height * threshold) {
        if (groupId === 6) {
          groups[3].push(rect);
        } else if (groupId === 8) {
          groups[5].push(rect);
        }
      }

      if (rect.bottom >= top + height * threshold) {
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
