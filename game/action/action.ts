import Selection from './selection';

import type {
  Argument,
  ResolvedSelection,
  BoardQueryMulti,
  BoardQuerySingle,
  PendingMove,
} from './types';
import type { GameElement, Piece } from '../board/';
import type { Player } from '../player';

/**
 * Actions represent discreet moves players can make. The Action object is responsible for:
 * - providing Selection objects to players to aid in supplying appropriate Arguments
 * - validating player Arguments and returning any Selections needed to complete
 * - accepting player Arguments and altering board state
 */
export default class Action<P extends Player, A extends Argument<P>[]> {
  name?: string;
  prompt: string;
  selections: Selection<P>[] = [];
  moves: ((...args: Argument<P>[]) => void)[] = [];
  condition?: (() => boolean) | boolean;
  message?: string | ((...args: Argument<P>[]) => string);

  constructor({ prompt, condition, message }: {
    prompt: string,
    condition?: (() => boolean) | boolean,
    message?: string | ((...args: Argument<P>[]) => string);
  }) {
    this.prompt = prompt;
    this.condition = condition;
    this.message = message;
  }

  isPossible(): boolean {
    return typeof this.condition === 'function' ? this.condition() : this.condition ?? true;
  }

  // given a set of args, return sub-selections possible trying each possible next arg
  // return undefined if these args are impossible
  getResolvedSelections(...args: Argument<P>[]): PendingMove<P>[] | undefined {
    const selection = this.nextSelection(...args);
    if (!selection) return [];

    const move = {
      action: this.name!,
      args,
      selection
    };

    if (!selection.isPossible()) return;
    if (selection.isUnbounded()) return [move];

    let possibleOptions: Argument<P>[] = [];
    let pruned = false;
    let resolvedSelections: PendingMove<P>[] = [];
    let mayExpand = selection.expand;
    for (const option of selection.options()) {
      const submoves = this.getResolvedSelections(...args, option);
      if (submoves === undefined) {
        pruned = true;
      } else {
        possibleOptions.push(option);
        if (selection.expand && submoves.length === 0) mayExpand = false; // TODO smarter expansion needed when triggered/optional selections are added
        resolvedSelections = resolvedSelections.concat(submoves);
      }
    }
    if (!possibleOptions.length) return undefined;
    if (pruned) selection.overrideOptions(possibleOptions);
    if (!resolvedSelections.length) return [move];
    if (mayExpand) return resolvedSelections;
    if (selection.skipIfOnlyOne && possibleOptions.length === 1) return resolvedSelections;
    return [move];
  }

  /**
   * given a partial arg list, returns a selection object for continuation if one exists.
   */
  nextSelection(...args: Argument<P>[]): ResolvedSelection<P> | undefined {
    const selection = this.selections[args.length];
    if (selection) {
      selection.prompt ??= [...this.selections.slice(0, args.length)].reverse().find(s => s.prompt)?.prompt || this.prompt;
      return selection.resolve(...args);
    }
  }

  /**
   * process this action with supplied args. returns error if any
   */
  process(...args: Argument<P>[]): string | undefined {
    // truncate invalid args - is this needed?
    let error: string | undefined = undefined;
    for (let i = 0; i !== this.selections.length && i !== args.length; i++) {
      error = this.selections[i].validate(args[i], args.slice(0, i) as Argument<P>[]);
      if (error) {
        console.error('invalid arg', args[i], i, error);
        args = args.slice(0, i) as A;
        break;
      }
    }

    const resolvedSelections = this.getResolvedSelections(...args);
    if (!resolvedSelections) {
      console.error('could not resolve this args', this.name, args);
      return error || 'unknown error during action.process';
    }
    if (resolvedSelections.length) {
      return error || 'incomplete action';
    }

    try {
      for (const move of this.moves) move(...args);
    } catch(e) {
      console.error(e);
      return e.message;
    }
  }

  do(move: (...args: A) => void) {
    this.moves.push(move);
    return this;
  }

  chooseFrom<T extends Argument<P>>({ choices, prompt, initial, skipIfOnlyOne, expand }: {
    choices: T[] | Record<string, T> | ((...arg: A) => T[] | Record<string, T>),
    initial?: T | ((...arg: A) => Argument<P>),
    prompt?: string | ((...arg: A) => string)
    skipIfOnlyOne?: boolean,
    expand?: boolean,
  }): Action<P, [...A, T]> {
    this.selections.push(new Selection<P>({ prompt, skipIfOnlyOne, expand, selectFromChoices: { choices, initial } }));
    return this as unknown as Action<P, [...A, T]>;
  }

  enterText({ prompt, regexp, initial }: {
    prompt: string | ((...arg: A) => string),
    regexp?: RegExp,
    initial?: string | ((...a: Argument<P>[]) => string)
  }): Action<P, [...A, string]> {
    this.selections.push(new Selection<P>({ prompt, enterText: { regexp, initial }}));
    return this as unknown as Action<P, [...A, string]>;
  }

  confirm(prompt: string | ((...arg: A) => string)): Action<P, [...A, 'confirm']> {
    this.selections.push(new Selection<P>({ prompt, value: true }));
    return this as unknown as Action<P, [...A, 'confirm']>;
  }

  chooseNumber({ min, max, prompt, initial, skipIfOnlyOne, expand }: {
    min?: number | ((...arg: A) => number),
    max?: number | ((...arg: A) => number),
    prompt?: string | ((...arg: A) => string),
    initial?: number | ((...arg: A) => number),
    skipIfOnlyOne?: boolean,
    expand?: boolean,
  }): Action<P, [...A, number]> {
    this.selections.push(new Selection<P>({ prompt, skipIfOnlyOne, expand, selectNumber: { min, max, initial } }));
    return this as unknown as Action<P, [...A, number]>;
  }

  chooseOnBoard<T extends GameElement<P>>({ choices, prompt, skipIfOnlyOne, expand }: {
    choices: BoardQueryMulti<P, T>,
    prompt?: string | ((...arg: A) => string);
    skipIfOnlyOne?: boolean,
    expand?: boolean,
  }): Action<P, [...A, T]>;
  chooseOnBoard<T extends GameElement<P>>({ choices, prompt, min, max, skipIfOnlyOne, expand }: {
    choices: BoardQueryMulti<P, T>,
    prompt?: string | ((...arg: A) => string);
    min?: number | ((...arg: A) => number);
    max?: number | ((...arg: A) => number);
    skipIfOnlyOne?: boolean,
    expand?: boolean,
  }): Action<P, [...A, [T]]>;
  chooseOnBoard<T extends GameElement<P>>({ choices, prompt, min, max, skipIfOnlyOne, expand }: {
    choices: BoardQueryMulti<P, T>,
    prompt?: string | ((...arg: A) => string);
    min?: number | ((...arg: A) => number);
    max?: number | ((...arg: A) => number);
    skipIfOnlyOne?: boolean,
    expand?: boolean,
  }): Action<P, [...A, T | [T]]> {
    this.selections.push(new Selection<P>({ prompt, skipIfOnlyOne, expand, selectOnBoard: { chooseFrom: choices, min, max } }));
    if (min !== undefined || max !== undefined) {
      return this as unknown as Action<P, [...A, [T]]>;
    }
    return this as unknown as Action<P, [...A, T]>;
  }

  move<E extends Piece<P>, I extends GameElement<P>>({ piece, into, prompt }: {
    piece: BoardQuerySingle<P, E>,
    into: BoardQuerySingle<P, I>,
    prompt?: string,
  }): Action<P, A>;
  move<E extends Piece<P>, I extends GameElement<P>>({ choosePiece, into, prompt }: {
    choosePiece: BoardQueryMulti<P, E>,
    into: BoardQuerySingle<P, I>,
    prompt?: string
  }): Action<P, [...A, E]>;
  move<E extends Piece<P>, I extends GameElement<P>>({ piece, chooseInto, prompt, promptInto }: {
    piece: BoardQuerySingle<P, E>,
    chooseInto: BoardQueryMulti<P, I>,
    prompt?: string
    promptInto?: string
  }): Action<P, [...A, I]>;
  move<E extends Piece<P>, I extends GameElement<P>>({ choosePiece, chooseInto, prompt, promptInto }: {
    choosePiece: BoardQueryMulti<P, E>,
    chooseInto: BoardQueryMulti<P, I>,
    prompt?: string
    promptInto?: string
  }): Action<P, [...A, E, I]>;
  move<E extends Piece<P>, I extends GameElement<P>>({ piece, into, choosePiece, chooseInto, prompt, promptInto }: {
    piece?: BoardQuerySingle<P, E>,
    into?: BoardQuerySingle<P, I>,
    choosePiece?: BoardQueryMulti<P, E>,
    chooseInto?: BoardQueryMulti<P, I>,
    prompt?: string
    promptInto?: string
  }): any {
    const numberOfPriorSelections = this.selections.length;
    if (choosePiece) {
      this.selections.push(new Selection<P>({ prompt, selectOnBoard: { chooseFrom: choosePiece } }));
    }
    if (chooseInto) {
      this.selections.push(new Selection<P>({ prompt: promptInto || prompt, selectOnBoard: { chooseFrom: chooseInto } }));
    }
    if (!choosePiece && !chooseInto) {
      this.moves.push(() => (resolve(piece))!.putInto(resolve(into)!));
    }
    if (choosePiece && !chooseInto) {
      this.moves.push((...args: Argument<P>[]) => (args[numberOfPriorSelections] as E)!.putInto(resolve(into)!));
    }
    if (!choosePiece && chooseInto) {
      this.moves.push((...args: Argument<P>[]) => resolve(piece)!.putInto(args[numberOfPriorSelections] as I));
    }
    if (choosePiece && chooseInto) {
      this.moves.push((...args: Argument<P>[]) => (args[numberOfPriorSelections] as E)!.putInto(args[numberOfPriorSelections + 1] as I));
    }
    return this;
  }
}

const resolve = <P extends Player, T extends GameElement<P>>(q: BoardQuerySingle<P, T>, ...args: Argument<P>[]) => {
  if (typeof q === 'string') throw Error("not impl");
  return (typeof q === 'function') ? q(...args) : q;
}
