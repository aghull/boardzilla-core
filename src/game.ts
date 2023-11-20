import { action } from './action/index.js';
import { escapeArgument } from './action/utils.js';
import {
  Board,
  Space,
  Piece,
  GameElement
} from './board/index.js';
import { Action, Selection } from './action/index.js';
import { Player, PlayerCollection } from './player/index.js';
import Flow from './flow/flow.js';

import random from 'random-seed';

import type { ElementClass } from './board/element.js';
import type { FlowDefinition } from './flow/flow.js';
import type { PlayerPositionState, GameUpdate } from './interface.js';
import type { SerializedArg } from './action/utils.js';
import type { Argument } from './action/action.js';
import type { ResolvedSelection } from './action/selection.js';

// find all non-method non-internal attr's
export type PlayerAttributes<T extends Player> = {
  [
    K in keyof InstanceType<{new(...args: any[]): T}>
      as InstanceType<{new(...args: any[]): T}>[K] extends (...args: unknown[]) => unknown ? never : (K extends '_players' ? never : K)
  ]: InstanceType<{new(...args: any[]): T}>[K]
}

// a Move is a request from a particular Player to perform a certain Action with supplied args
export type Move<P extends Player> = {
  player: P,
  action: string,
  args: Record<string, Argument<P>>
};

export type PendingMove<P extends Player> = {
  action: string,
  prompt?: string,
  args: Record<string, Argument<P>>,
  selections: ResolvedSelection<P>[],
};

export type SerializedMove = {
  action: string,
  args: Record<string, SerializedArg>
}

export type Message = {
  position?: number
  body: string
}

export default class Game<P extends Player, B extends Board<P>> {
  flow: Flow<P>;
  flowDefinition: () => FlowDefinition<P>;
  players: PlayerCollection<P> = new PlayerCollection<P>;
  board: B;
  settings: Record<string, any>;
  actions: Record<string, (player: P) => Action<P, Record<string, Argument<P>>>>;
  phase: 'new' | 'started' | 'finished' = 'new';
  rseed: string;
  random: () => number;
  messages: Message[] = [];
  godMode = false;
  winner: P[] = [];

  constructor(playerClass: {new(...a: any[]): P}, boardClass: ElementClass<P, B>, elementClasses: ElementClass<P, GameElement<P>>[] = []) {
    this.board = new boardClass({ game: this, classRegistry: [GameElement, Space, Piece, ...elementClasses]})
    this.players = new PlayerCollection<P>();
    this.players.className = playerClass;
    this.players.game = this;
  }

  /**
   * configuration functions
   */
  defineFlow(flowDefinition: typeof this.flowDefinition) {
    if (this.phase !== 'new') throw Error('cannot call defineFlow once started');
    this.flowDefinition = flowDefinition;
  }

  defineActions(actions: Record<string, (player: P) => Action<P, Record<string, Argument<P>>>>) {
    if (this.phase !== 'new') throw Error('cannot call defineActions once started');
    this.actions = actions;
  }

  setSettings(settings: Record<string, any>) {
    this.settings = settings;
  }

  setRandomSeed(rseed: string) {
    this.rseed = rseed;
    this.random = random.create(rseed).random;
  }

  /**
   * flow functions
   */
  start() {
    if (this.phase === 'started') throw Error('cannot call start once started');
    if (!this.players.length) {
      throw Error("No players");
    }
    this.phase = 'started';
    this.buildFlow();
    this.flow.reset();
  }

  finish(winner?: P | P[]) {
    this.phase = 'finished';
    if (winner) this.winner = winner instanceof Array ? winner : [winner];
  }

  buildFlow() {
    const flow = this.flowDefinition();
    this.flow = new Flow({ do: flow });
    this.flow.game = this;
  }

  getPlayerStates(): PlayerPositionState<P>[] {
    return this.players.map(p => ({
      position: p.position,
      state: {
        players: this.players.map(p => p.toJSON() as PlayerAttributes<P>), // TODO scrub
        settings: this.settings,
        position: this.flow.branchJSON(true),
        board: this.board.allJSON(p.position),
        rseed: this.rseed,
      }
    }));
  }

  getUpdate(): GameUpdate<P> {
    if (this.phase === 'started') {
      return {
        game: {
          players: this.players.map(p => p.toJSON() as PlayerAttributes<P>), // TODO scrub
          settings: this.settings,
          position: this.flow.branchJSON(),
          board: this.board.allJSON(),
          rseed: this.rseed,
          currentPlayers: this.players.currentPosition,
          phase: this.phase
        },
        players: this.getPlayerStates(),
        messages: this.messages,
      }
    }
    if (this.phase === 'finished') {
      return {
        game: {
          players: this.players.map(p => p.toJSON() as PlayerAttributes<P>), // TODO scrub
          settings: this.settings,
          position: this.flow.branchJSON(),
          board: this.board.allJSON(),
          rseed: this.rseed,
          winners: this.winner.map(p => p.position),
          phase: this.phase
        },
        players: this.getPlayerStates(),
        messages: this.messages,
      }
    }
    throw Error('unable to initialize game');
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

  trackMovement(track=true) {
    this.board._ctx.trackMovement = track;
  }

  /**
   * action functions
   */
  action(name: string, player: P): Action<P, any> & {name: string} {
    if (this.godMode) {
      const godModeAction = this.godModeActions()[name];
      if (godModeAction) {
        godModeAction.name = name;
        return godModeAction as Action<P, any> & {name: string};
      }
    }
    return this.inContextOfPlayer(player, () => {
      const playerAction = this.actions[name](player);
      if (!playerAction) throw Error(`No such action ${name}`);
      playerAction.name = name;
      return playerAction as Action<P, any> & {name: string};
    });
  }

  godModeActions(): Record<string, Action<P, any>> {
    if (this.phase !== 'started') throw Error('cannot call god mode actions until started');
    return {
      _godMove: action<P>({
        prompt: "Move",
      }).move(
        'piece', this.board.all(Piece<P>),
        'into', this.board.all(GameElement<P>)
      ),
      _godEdit: action<P>({
        prompt: "Change",
      })
        .chooseOnBoard('element', this.board.all(GameElement))
        .chooseFrom<'property', string>(
          'property',
          el => Object.keys(el).filter(a => !['_t', '_ctx', '_ui', '_eventHandlers', '_visible', 'mine', 'board', 'game', 'pile', 'mine'].includes(a)),
          { prompt: "Change property" }
        ).enterText('value', {
          prompt: ({ property }) => `Change ${property}`,
          initial: ({ element, property }) => String(element[property as keyof GameElement<P>])
        }).do(({ element, property, value }) => {
          let v: any = value
          if (value === 'true') {
            v = true;
          } else if (value === 'false') {
            v = false;
          } else if (parseInt(value).toString() === value) {
            v = parseInt(value);
          }
          const prop = property as keyof GameElement<P>;
          if (prop !== 'mine') element[prop] = v
      })
    };
  }

  play() {
    if (this.phase !== 'started') throw Error('cannot call play until started');
    this.flow.play();
  }

  // given a player's move (minimum a selected action), attempts to process
  // it. if not, returns next selection for that player, plus any implied partial
  // moves
  processMove({ player, action, args }: Move<P>): string | undefined {
    let error: string | undefined;
    return this.inContextOfPlayer(player, () => {
      if (this.godMode && this.godModeActions()[action]) {
        const godModeAction = this.godModeActions()[action];
        error = godModeAction._process(args);
      } else {
        error = this.flow.processMove({
          action,
          player: player.position,
          args
        });
      }
      if (error) return error;
      // successful move
    });
  }

  allowedActions(player: P): {step?: string, prompt?: string, skipIfOnlyOne: boolean, expand: boolean, actions: string[]} {
    const allowedActions: string[] = this.godMode ? Object.keys(this.godModeActions()) : [];
    if (!player.isCurrent()) return {
      actions: allowedActions,
      skipIfOnlyOne: true,
      expand: true,
    };
    const actionStep = this.flow.actionNeeded(player);
    if (actionStep) {
      return {
        step: actionStep.step,
        prompt: actionStep.prompt,
        skipIfOnlyOne: actionStep.skipIfOnlyOne,
        expand: actionStep.expand,
        actions: allowedActions.concat(actionStep.actions?.filter(a => this.action(a, player).isPossible()) || [])
      }
    }
    return {
      skipIfOnlyOne: true,
      expand: true,
      actions: []
    };
  }

  getResolvedSelections(player: P, action?: string, args?: Record<string, Argument<P>>): {step?: string, prompt?: string, moves: PendingMove<P>[]} | undefined {
    const allowedActions = this.allowedActions(player);
    if (!allowedActions.actions.length) return;
    const { step, prompt, actions, skipIfOnlyOne, expand } = allowedActions;
    if (!action) {
      let possibleActions: string[] = [];
      let resolvedSelections: PendingMove<P>[] = [];
      for (const action of actions) {
        const playerAction = this.action(action, player);
        let submoves = playerAction._getResolvedSelections({});
        if (submoves !== undefined) {
          possibleActions.push(action);
          if (expand && submoves.length === 0) {
            submoves = [{
              action,
              prompt,
              args: {},
              selections: [
                new Selection<P>('__action__', { prompt: playerAction.prompt, value: action }).resolve({})
              ]
            }];
          }
          resolvedSelections = resolvedSelections.concat(submoves);
        }
      }
      if (!possibleActions.length) return undefined;
      if (skipIfOnlyOne && possibleActions.length === 1) return { step, prompt, moves: resolvedSelections};
      if (expand && resolvedSelections.length) return { step, prompt, moves: resolvedSelections};
      return {
        step,
        prompt,
        moves: [{
          action: '/',
          prompt,
          args: {},
          selections: [
            new Selection<P>('__action__', { prompt, selectFromChoices: { choices: actions }}).resolve({})
          ]
        }]
      };

    } else {
      const moves = this.action(action, player)?._getResolvedSelections(args || {});
      if (moves) return { step, prompt, moves };
    }
  }

  message(message: string, args?: Record<string, Argument<P>>) {
    Object.entries(args || {}).forEach(([k, v]) => {
      message = message.replace(new RegExp(`\\{\\{${k}\\}\\}`), escapeArgument(v));
    })
    this.messages.push({body: message});
  }
}
