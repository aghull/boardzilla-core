import {Piece, GameElement} from './index.js'

import type {
  ElementClass,
  ElementUI,
  ElementAttributes
} from './element.js';

type Sorter<T> = keyof {[K in keyof T]: T[K] extends number | string ? never: K} | ((e: T) => number | string)

import type { Player } from '../player/index.js';

/**
 * A query filter can be one of 3 different forms:
 * - *string*: will match elements with this name
 * - *object*: will match elements whose properties match the provided
 *     properties. For example, `deck.all(Card, {suit: 'H'})` would match all
 *     `Card` elements in `deck` with a `suit` property equal to `"H"`. There are
 *     some special property names allowed here:
 *   - *mine*: true/false whether this element belongs to the player in whose context the query is made
 *   - *empty* true/false whether this element is empty
 *   - *adjacent* true/false whether this element is adjacent by a connection to the
 *       element on which the query method was
 *       called. E.g. `france.other(Country, {adjacent: true})` will match
 *       `Country` elements that are connected to `france` by {@link
 *       Space#connectTo}
 *   - *withinDistance* Similar to adjacent but uses the provided number to
 *       determine if a connection is possible between elements whose cost is
 *       not greater than the provided value
 * - *function*: A function that accept an element as its argument and returns a
 *     boolean indicating whether it is a match, similar to `Array#filter`.
 */
export type ElementFinder<T extends GameElement = any> = (
  ((e: T) => boolean) |
    (ElementAttributes<T> & {mine?: boolean, owner?: T['player'], empty?: boolean, adjacent?: boolean, withinDistance?: number}) |
    string
);

/**
 * Operations that return groups of {@link GameElement| | GameElement's} return
 * this Array-like class.
 */
export default class ElementCollection<T extends GameElement = any> extends Array<T> {

  slice(...a: Parameters<Array<T>['slice']>):ElementCollection<T> {return super.slice(...a) as ElementCollection<T>}
  filter(...a: Parameters<Array<T>['filter']>):ElementCollection<T> {return super.filter(...a) as ElementCollection<T>}

  /**
   * As {@link GameElement#all}, but finds all elements within this collection
   * and its contained elements recursively.
   * @category Queries
   *
   * @param {class} className - Optionally provide a class as the first argument
   * as a class filter. This will only match elements which are instances of the
   * provided class
   *
   * @param finders - All other parameters are filters. See {@link
   * ElementFinder} for more information.
   *
   * @returns An {@link ElementCollection} of as many matching elements as can be
   * found. The collection is typed to `ElementCollection<className>` if one was
   * provided.
   */
  all<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  all(className: ElementFinder, ...finders: ElementFinder[]): ElementCollection<GameElement>;
  all<F extends GameElement>(className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement> {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {}, className, ...finders);
    }
    return this._finder(className, {}, ...finders);
  }

  /** @internal */
  _finder<F extends GameElement>(
    className: ElementClass<F>,
    options: {limit?: number, order?: 'asc' | 'desc'},
    ...finders: ElementFinder<F>[]
  ): ElementCollection<F> {
    const fns: ((e: F) => boolean)[] = finders.map(finder => {
      if (typeof finder === 'object') {
        const attrs = finder;
        return el => Object.entries(attrs).every(([k1, v1]) => (
          (k1 === 'empty' ? el.isEmpty() : el[k1 as keyof typeof el]) === v1
        ))
      }
      if (typeof finder === 'string') {
        const name = finder;
        return el => el.name === name;
      }
      return finder;
    })
    const coll = new ElementCollection<F>();

    const finderFn = (el: T, order: 'asc' | 'desc') => {
      if (el instanceof className && fns.every(fn => fn(el as unknown as F))) {
        if (order === 'asc') {
          coll.push(el as unknown as F);
        } else {
          coll.unshift(el as unknown as F);
        }
      }
      if (options.limit !== undefined) {
        coll.push(...el._t.children._finder(className, {limit: options.limit - coll.length, order: options.order}, ...finders));
      } else {
        coll.push(...el._t.children._finder(className, {}, ...finders));
      }
    };

    if (options.order === 'desc') {
      for (let e = this.length - 1; e >= 0; e--) {
        const el = this[e];
        if (options.limit !== undefined && coll.length >= options.limit) break;
        finderFn(el, 'desc');
      }
    } else {
      for (const el of this) {
        if (options.limit !== undefined && coll.length >= options.limit) break;
        finderFn(el, 'asc');
      }
    }

    return coll;
  }

  /**
   * As {@link GameElement#first}, except finds the first element within this
   * collection and its contained elements recursively that matches the
   * arguments provided. See {@link GameElement#all} for parameter details.
   * @category Queries
   * @returns A matching element, if found
   */
  first<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  first(className: ElementFinder, ...finders: ElementFinder[]): GameElement | undefined;
  first<F extends GameElement>(className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): F | GameElement | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {limit: 1}, className, ...finders)[0];
    }
    return this._finder(className, {limit: 1}, ...finders)[0];
  }

  /**
   * As {@link GameElement#firstN}, except finds the first `n` elements within
   * this collection and its contained elements recursively that match the
   * arguments provided. See {@link all} for parameter details.
   * @category Queries
   * @param n - number of matches
   *
   * @returns An {@link ElementCollection} of as many matching elements as can be
   * found, up to `n`. The collection is typed to `ElementCollection<className>`
   * if one was provided.
   */
  firstN<F extends GameElement>(n: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  firstN(n: number, className: ElementFinder, ...finders: ElementFinder[]): ElementCollection<GameElement>;
  firstN<F extends GameElement>(n: number, className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {limit: n}, className, ...finders);
    }
    return this._finder(className, {limit: n}, ...finders);
  }

  /**
   * As {@link GameElement#last}, expect finds the last element within this
   * collection and its contained elements recursively that matches the
   * arguments provided. See {@link all} for parameter details.
   * @category Queries
   * @returns A matching element, if found
   */
  last<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  last(className: ElementFinder, ...finders: ElementFinder[]): GameElement | undefined;
  last<F extends GameElement>(className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): F | GameElement | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {limit: 1, order: 'desc'}, className, ...finders)[0];
    }
    return this._finder(className, {limit: 1, order: 'desc'}, ...finders)[0];
  }

  /**
   * As {@link GameElement#lastN}, expect finds the last n elements within this
   * collection and its contained elements recursively that match the arguments
   * provided. See {@link all} for parameter details.
   * @category Queries
   * @param n - number of matches
   *
   * @returns An {@link ElementCollection} of as many matching elements as can be
   * found, up to `n`. The collection is typed to `ElementCollection<className>`
   * if one was provided.
   */
  lastN<F extends GameElement>(n: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  lastN(n: number, className: ElementFinder, ...finders: ElementFinder[]): ElementCollection<GameElement>;
  lastN<F extends GameElement>(n: number, className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {limit: n, order: 'desc'}, className, ...finders);
    }
    return this._finder(className, {limit: n, order: 'desc'}, ...finders);
  }

  /**
   * Alias for {@link first}
   * @category Queries
   */
  top<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  top(className: ElementFinder, ...finders: ElementFinder[]): GameElement | undefined;
  top<F extends GameElement>(className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): F | GameElement | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {limit: 1}, className, ...finders)[0];
    }
    return this._finder(className, {limit: 1}, ...finders)[0];
  }

  /**
   * Alias for {@link firstN}
   * @category Queries
   */
  topN<F extends GameElement>(n: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  topN(n: number, className: ElementFinder, ...finders: ElementFinder[]): ElementCollection<GameElement>;
  topN<F extends GameElement>(n: number, className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {limit: n}, className, ...finders);
    }
    return this._finder(className, {limit: n}, ...finders);
  }

  /**
   * Alias for {@link last}
   * @category Queries
   */
  bottom<F extends GameElement>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  bottom(className: ElementFinder, ...finders: ElementFinder[]): GameElement | undefined;
  bottom<F extends GameElement>(className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): F | GameElement | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {limit: 1, order: 'desc'}, className, ...finders)[0];
    }
    return this._finder(className, {limit: 1, order: 'desc'}, ...finders)[0];
  }

  /**
   * Alias for {@link lastN}
   * @category Queries
   */
  bottomN<F extends GameElement>(n: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  bottomN(n: number, className: ElementFinder, ...finders: ElementFinder[]): ElementCollection<GameElement>;
  bottomN<F extends GameElement>(n: number, className: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._finder<GameElement>(GameElement, {limit: n, order: 'desc'}, className, ...finders);
    }
    return this._finder(className, {limit: n, order: 'desc'}, ...finders);
  }

  /**
   * Show these elements to all players
   * @category Visibility
   */
  showToAll() {
    for (const el of this) {
      delete(el._visible);
    }
  }

  /**
   * Show these elements only to the given player
   * @category Visibility
   */
  showOnlyTo(player: Player | number) {
    if (typeof player !== 'number') player = player.position;
    for (const el of this) {
      el._visible = {
        default: false,
        except: [player]
      };
    }
  }

  /**
   * Show these elements to the given players without changing it's visibility to
   * any other players.
   * @category Visibility
   */
  showTo(...player: Player[] | number[]) {
    if (typeof player[0] !== 'number') player = (player as Player[]).map(p => p.position);
    for (const el of this) {
      if (el._visible === undefined) continue;
      if (el._visible.default) {
        if (!el._visible.except) continue;
        el._visible.except = el._visible.except.filter(i => !(player as number[]).includes(i));
      } else {
        el._visible.except = Array.from(new Set([...(el._visible.except instanceof Array ? el._visible.except : []), ...(player as number[])]))
      }
    }
  }

  /**
   * Hide these elements only to the given player
   * @category Visibility
   */
  hideFromAll() {
    for (const el of this) {
      el._visible = {default: false};
    }
  }

  /**
   * Hide these elements from the given players without changing it's visibility to
   * any other players.
   * @category Visibility
   */
  hideFrom(...player: Player[] | number[]) {
    if (typeof player[0] !== 'number') player = (player as Player[]).map(p => p.position);
    for (const el of this) {
      if (el._visible?.default === false && !el._visible.except) continue;
      if (el._visible === undefined || el._visible.default === true) {
        el._visible = {
          default: true,
          except: Array.from(new Set([...(el._visible?.except instanceof Array ? el._visible.except : []), ...(player as number[])]))
        };
      } else {
        if (!el._visible.except) continue;
        el._visible.except = el._visible.except.filter(i => !(player as number[]).includes(i));
      }
    }
  }

  /**
   * Sorts this collection by some {@link Sorter}.
   * @category Structure
   */
  sortBy<E extends T>(key: Sorter<E> | (Sorter<E>)[], direction?: "asc" | "desc") {
    const rank = (e: E, k: Sorter<E>) => typeof k === 'function' ? k(e) : e[k]
    const [up, down] = direction === 'desc' ? [-1, 1] : [1, -1];
    return this.sort((a, b) => {
      const keys = key instanceof Array ? key : [key];
      for (const k of keys) {
        const r1 = rank(a as E, k);
        const r2 = rank(b as E, k);
        if (r1 > r2) return up;
        if (r1 < r2) return down;
      }
      return 0;
    });
  }

  /**
   * Returns a copy of this collection sorted by some {@link Sorter}.
   * @category Structure
   */
  sortedBy(key: Sorter<T> | (Sorter<T>)[], direction: "asc" | "desc" = "asc") {
    return (this.slice(0, this.length) as this).sortBy(key, direction);
  }

  /**
   * Returns the sum of all elements in this collection measured by a provided key
   * @category Queries
   *
   * @example
   * deck.create(Card, '2', { pips: 2 });
   * deck.create(Card, '3', { pips: 3 });
   * deck.all(Card).sum('pips'); // => 5
   */
  sum(key: ((e: T) => number) | (keyof {[K in keyof T]: T[K] extends number ? never: K})) {
    return this.reduce((sum, n) => sum + (typeof key === 'function' ? key(n) : n[key] as unknown as number), 0);
  }

  /**
   * Returns the element in this collection with the highest value of the
   * provided key(s).
   * @category Queries
   *
   * @param attributes - any number of {@link Sorter | Sorter's} used for
   * comparing. If multiple are provided, subsequent ones are used to break ties
   * on earlier ones.
   *
   * @example
   * army.create(Soldier, 'a', { strength: 2, initiative: 3 });
   * army.create(Soldier, 'b', { strength: 3, initiative: 1 });
   * army.create(Soldier, 'c', { strength: 3, initiative: 2 });
   * army.all(Solider).withHighest('strength', 'initiative'); // => Soldier 'c'
   */
  withHighest(...attributes: Sorter<T>[]): T | undefined {
    return this.sortedBy(attributes, 'desc')[0];
  }

  /**
   * Returns the element in this collection with the lowest value of the
   * provided key(s).
   * @category Queries
   *
   * @param attributes - any number of {@link Sorter | Sorter's} used for
   * comparing. If multiple are provided, subsequent ones are used to break ties
   * on earlier ones.
   *
   * @example
   * army.create(Soldier, 'a', { strength: 2, initiative: 3 });
   * army.create(Soldier, 'b', { strength: 3, initiative: 1 });
   * army.create(Soldier, 'c', { strength: 2, initiative: 2 });
   * army.all(Solider).withLowest('strength', 'initiative'); // => Soldier 'c'
   */
  withLowest(...attributes: Sorter<T>[]): T | undefined {
    return this.sortedBy(attributes, 'asc')[0];
  }

  max<K extends keyof T>(key: K): T[K] | undefined {
    const el = this.sortedBy(key, 'desc')[0]
    return el && el[key];
  }

  min<K extends keyof T>(key: K): T[K] | undefined {
    const el = this.sortedBy(key, 'asc')[0]
    return el && el[key];
  }

  areAllEqual(key: keyof T): boolean {
    if (this.length === 0) return true;
    return this.every(el => el[key] === this[0][key]);
  }

  remove() {
    for (const el of this) {
      if (!(el instanceof Piece)) throw Error('cannot move Space');
      el.remove();
    }
  }

  putInto(to: GameElement, options?: {position?: number, fromTop?: number, fromBottom?: number}) {
    if (to._ctx.trackMovement && this.some(el => el._t.was && el._t.was !== el.branch())) {
      to.game.addDelay();
    }
    for (const el of this) {
      if (!(el instanceof Piece)) throw Error('cannot move Space');
      el.putInto(to, options);
    }
  }

  // UI
  layout(
    applyTo: T['_ui']['layouts'][number]['applyTo'],
    attributes: Partial<GameElement['_ui']['layouts'][number]['attributes']>
  ) {
    for (const el of this) el.layout(applyTo, attributes);
  }

  appearance(appearance: ElementUI<T>['appearance']) {
    for (const el of this) el.appearance(appearance);
  }
}
