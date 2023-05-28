import {bind} from 'helpful-decorators';
import type {IElementRect, ElementCenterType} from './spatial-navigator';

export default class ElementRect implements IElementRect {
  public width: number;
  public height: number;
  public top: number;
  public bottom: number;
  public right: number;
  public left: number;
  public element: Element;
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

    return {x, y, left: x, right: x, top: y, bottom: y};
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
