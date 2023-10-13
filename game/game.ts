import { action } from './action/';
import { escapeArgument } from './action/utils';
import {
  Board,
  Space,
  Piece,
  GameElement
} from './board/';
import {
  GameState,
  PlayerPositionState,
  Message
} from '../types';
import { Action } from './action';
import { ElementClass } from './board/types';
import { Player, PlayerCollection } from './player/';

import random from 'random-seed';

import type Flow from './flow/flow';
import type {
  Move,
  Argument,
  MoveResponse,
  SerializedArg
} from './action/types';
import type { PlayerAttributes } from './player/types';

export default class Game<P extends Player, B extends Board<P>> {
  flow: Flow<P>;
  flowDefinition: (game: typeof this, board: B) => Flow<P>;
  players: PlayerCollection<P> = new PlayerCollection<P>;
  board: B;
  settings: Record<string, any>;
  actions: (game: Game<P, B>, board: B) => Record<string, (p: P) => Action<P, Argument<P>[]>>;
  phase: 'define' | 'new' | 'started' = 'define';
  rseed: string;
  random: () => number;
  messages: Message[] = [];
  godMode = false;
  setupLayout?: (board: B, aspectRatio: number) => void

  /**
   * configuration functions
   */
  defineFlow(flowDefinition: typeof this.flowDefinition) {
    if (this.phase !== 'define') throw Error('cannot call defineFlow once started');
    this.flowDefinition = flowDefinition;
  }

  action(name: string, player: P) {
    if (this.godMode) {
      const action = this.godModeActions()[name];
      if (action) return action;
    }
    return this.inContextOfPlayer(player, () => {
      const action = this.actions(this, this.board)[name];
      if (!action) throw Error(`No such action ${name}`);
      return action(player);
    });
  }

  defineActions(actions: (game: Game<P, B>, board: B) => Record<string, (p: P) => Action<P, Argument<P>[]>>) {
    if (this.phase !== 'define') throw Error('cannot call defineActions once started');
    this.actions = actions;
  }

  defineBoard(
    className: {
      new(...classes: ElementClass<P, GameElement<P>>[]): B;
      isGameElement: boolean;
    },
    classRegistry: ElementClass<P, GameElement<P>>[]
  ): B {
    if (this.phase !== 'define') throw Error('cannot call defineBoard once started');
    this.board = new className(GameElement, Space, Piece, ...classRegistry)
    this.board.game = this;
    return this.board;
  }

  definePlayers(
    className: {new(...a: any[]): P},
  ): PlayerCollection<P> {
    if (this.phase !== 'define') throw Error('cannot call definePlayer once started');
    this.players = new PlayerCollection<P>();
    this.players.game = this;
    this.players.className = className;
    return this.players as PlayerCollection<P>;
  }

  setSettings(settings: Record<string, any>) {
    this.settings = settings;
  }

  setRandomSeed(rseed: string) {
    this.rseed = rseed;
    this.random = random.create(rseed).random;
  }

  godModeActions(): Record<string, Action<P, any>> {
    if (this.phase !== 'started') throw Error('cannot call god mode actions until started');
    return {
      _godMove: action<P>({
        prompt: "Move anything",
      }).move({
        prompt: "To anywhere",
        choosePiece: this.board.all(Piece<P>),
        chooseInto: this.board.all(GameElement<P>)
      }),
      _godEdit: action<P>({
        prompt: "Change anything",
      }).chooseOnBoard({
        prompt: "Select element",
        choices: this.board.all(GameElement)
      }).chooseFrom({
        prompt: "Change what?",
        choices: el => Object.keys(el).filter(a => !['_t', '_ctx', '_eventHandlers', 'mine', 'board', 'game', 'pile', 'mine'].includes(a))
      }).enterText({
        prompt: "Change to",
        initial: (el: GameElement<P>, attr: keyof GameElement<P>) => String(el[attr])
      }).do((el, attr: keyof GameElement<P>, value: any) => {
        if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (parseInt(value).toString() === value) {
          value = parseInt(value);
        }
        if (attr !== 'mine') el[attr] = value
      })
    };
  }

  start() {
    if (this.phase === 'started') throw Error('cannot call start once started');
    if (!this.players.length) {
      throw Error("No players");
    }
    this.phase = 'started';
    this.buildFlow();
    this.flow.reset();
  }

  buildFlow() {
    this.flow = this.flowDefinition(this, this.board);
    this.flow.game = this;
  }

  setState(state: GameState<P>) {
    this.players.fromJSON(state.players);
    this.players.currentPosition = state.currentPlayerPosition;
    this.setSettings(state.settings);
    this.board.fromJSON(state.board);
    this.buildFlow();
    this.phase = 'started';
    this.flow.setBranchFromJSON(state.position);
    this.setRandomSeed(state.rseed);
  }

  getState(forPlayer?: number): GameState<P> {
    return {
      players: this.players.map(p => p.toJSON() as PlayerAttributes<P>), // TODO scrub
      currentPlayerPosition: this.players.currentPosition,
      settings: this.settings,
      position: this.flow.branchJSON(!!forPlayer),
      board: this.board.allJSON(forPlayer),
      rseed: this.rseed,
    };
  }

  getPlayerStates(): PlayerPositionState<P>[] {
    return this.players.map(p => ({
      position: p.position,
      state: this.getState(p.position)
    }));
  }

  /**
   * action functions
   */
  play() {
    if (this.phase !== 'started') throw Error('cannot call play until started');
    return this.flow.play();
  }

  // Returns selection for a player, providing any forced args if there's a single action available
  // If only one action and no selection even needed, just returns a confirmation request
  // currentSelection(player: P): MoveResponse<P> {
  //   let move: IncompleteMove<P> = { player, args: [] };
  //   return this.inContextOfPlayer(player, () => {
  //     const actions = this.allowedActions(player);

  //     if (!actions || actions.length === 0) return {move}
  //     if (actions.length === 1) { // only one action to choose, so choose it
  //       const action = this.action(actions[0], player);
  //       let [selection, forcedArgs, error] = action.forceArgs();
  //       if (error) throw Error(`${error} at currentSelection which should not be allowed. allowedActions should not have provided this action`)
  //       // if no selection needed, provide a confirmation prompt (TODO get the final prompt)
  //       if (!selection) selection = new Selection<P>({ prompt: `Please confirm: ${action.prompt}`, click: true }) as ResolvedSelection<P>;
  //       return {
  //         move: {
  //           action: actions[0],
  //           args: forcedArgs || [],
  //           player
  //         },
  //         selection
  //       };
  //     } else {
  //       const actionStep = this.flow.currentFlow();
  //       if (actionStep instanceof ActionStep) {
  //         return {
  //           selection: new Selection<P>({ // selection is between multiple actions, return action choices
  //             prompt: actionStep.prompt || 'Choose action',
  //             selectFromChoices: {
  //               choices: Object.fromEntries(actions.map(a => [a, this.action(a, player).prompt]))
  //             }
  //           }) as ResolvedSelection<P>,
  //           move,
  //         };
  //       }
  //       return {move};
  //     }
  //   });
  // }

  // given a player's move (minimum a selected action), attempts to process
  // it. if not, returns next selection for that player, plus any implied partial
  // moves
  processMove({ player, action, args }: Move<P>): MoveResponse<P> {
    let resolvedSelection, truncatedArgs, error;
    this.messages = [];
    return this.inContextOfPlayer(player, () => {
      if (this.godMode && this.godModeActions()[action]) {
        const godModeAction = this.godModeActions()[action];
        [resolvedSelection, truncatedArgs, error] = godModeAction.process(...args);
      } else {
        [resolvedSelection, truncatedArgs, error] = this.flow.processMove({
          action,
          player: player.position,
          args
        });
      }
      if (resolvedSelection) return {
        selection: resolvedSelection,
        move: {action, player, args: truncatedArgs || []},
        error
      };
      // successful move
      return {
        move: {action, player, args},
      };
    });
  }

  allowedActions(player: P): {prompt?: string, actions?: string[]}  {
    const allowedActions: string[] = this.godMode ? Object.keys(this.godModeActions()) : [];
    if (this.players.currentPosition && player !== this.players.current()) return { actions: allowedActions };
    return this.inContextOfPlayer(player, () => {
      let {prompt, actions} = this.flow.actionNeeded();
      return {
        prompt,
        actions: allowedActions.concat(actions?.filter(a => this.action(a, player).isPossible()) || [])
      };
    });
  }

  contextualizeBoardToPlayer(player?: P) {
    const prev = this.board._ctx.player;
    this.board._ctx.player = player;
    return prev;
  }

  inContextOfPlayer<T>(player: P, fn: () => T): T {
    const prev = this.contextualizeBoardToPlayer(player);
    const results = fn();
    this.contextualizeBoardToPlayer(prev);
    return results;
  }

  message(message: string, ...args: [...Argument<P>[], Record<string, Argument<P>>] | Argument<P>[]) {
    let replacements: Record<string, SerializedArg> = {};
    if (args.length) {
      const lastArg = args[args.length - 1]
      if (typeof lastArg === 'object' && !(lastArg instanceof Array) && !(lastArg instanceof Player) && !(lastArg instanceof GameElement)) {
        replacements = Object.fromEntries(Object.entries(lastArg).map(([k, v]) => (
          [k, escapeArgument(v)]
        )));;
        args = args.slice(0, -1) as Argument<P>[];
      }
    }
    for (let i = 0; i !== args.length; i++) {
      replacements[i + 1] = escapeArgument(args[i] as Argument<P>);
    }

    Object.entries(replacements).forEach(([k, v]) => {
      message = message.replace(new RegExp(`\\$${k}\\b`), v as string);
    })
    this.messages.push({body: message});
  }
}
