import { deserializeArg } from './action/utils.js';

import type { ElementJSON } from './board/element.js';
import type Board from './board/board.js';
import type { default as Game, PlayerAttributes, Message, SerializedMove } from './game.js';
import type Player from './player/player.js';
import type { FlowBranchJSON } from './flow/flow.js';
import type { SetupFunction } from './index.js';
import type { SerializedArg } from './action/utils.js';

export type SetupState<P extends Player> = {
  players: (PlayerAttributes<P> & Record<string, any>)[],
  settings: Record<string, any>
}

export type GameState<P extends Player> = {
  players: PlayerAttributes<P>[],
  settings: Record<string, any>
  position: FlowBranchJSON[],
  board: ElementJSON[],
  sequence: number,
  rseed: string,
}

type GameStartedState<P extends Player> = Omit<GameState<P>, 'currentPlayerPosition'> & {
  phase: 'started',
  currentPlayers: number[]
}

type GameFinishedState<P extends Player> = Omit<GameState<P>, 'currentPlayerPosition'> & {
  phase: 'finished',
  winners: number[]
}

export type PlayerPositionState<P extends Player> = {
  position: number
  state: GameState<P> // Game state, scrubbed
}

export type GameUpdate<P extends Player> = {
  game: GameStartedState<P> | GameFinishedState<P>
  players: PlayerPositionState<P>[]
  messages: Message[]
}

export type GameInterface<P extends Player> = {
  initialState: (state: SetupState<P>, rseed: string) => GameUpdate<P>
  processMove: (
    previousState: GameState<P>,
    move: {
      position: number
      data: SerializedMove
    },
    trackMovement?: boolean
  ) => GameUpdate<P>
  getPlayerState: (
    state: GameState<P>,
    position: number
  ) => GameState<P>
}


export const createInteface = (setup: SetupFunction<Player, Board<Player>>): GameInterface<Player> => {
  if (globalThis.window) globalThis.console.debug = () => {};

  return {
    initialState: (state: SetupState<Player>): GameUpdate<Player> => {
      const game = setup(state);
      if (game.phase !== 'finished') game.play();
      return game.getUpdate();
    },
    processMove: (
      previousState: GameStartedState<Player>,
      move: {
        position: number,
        data: SerializedMove | SerializedMove[]
      },
    ): GameUpdate<Player> => {
      //console.time('processMove');
      let cachedGame: Game<Player, Board<Player>> | undefined = undefined;
      // @ts-ignore
      if (globalThis.window && window.board && window.lastGame > new Date() - 10 && window.json === JSON.stringify(previousState)) cachedGame = window.board._ctx.game;
      const game = cachedGame || setup(previousState, {trackMovement: true});
      game.players.setCurrent(previousState.currentPlayers),
      //console.timeLog('processMove', cachedGame ? 'restore cached game' : 'setup');
      game.messages = [];
      if (!(move.data instanceof Array)) move.data = [move.data];

      let error = undefined;
      for (let i = 0; i !== move.data.length; i++) {
        error = game.processMove({
          player: game.players.atPosition(move.position)!,
          name: move.data[i].name,
          args: Object.fromEntries(Object.entries(move.data[i].args).map(([k, v]) => [k, deserializeArg(v as SerializedArg, game)]))
        });
        if (error) {
          throw Error(`Unable to process move: ${error}`);
        }
        //console.timeLog('processMove', 'process');
        if (game.phase !== 'finished') game.play();
        //console.timeLog('processMove', 'play');
      }

      game.sequence += 1;
      const update = game.getUpdate();
      //console.timeLog('processMove', 'update');

      // @ts-ignore
      if (globalThis.window) window.board = game.board;
      // @ts-ignore
      if (globalThis.window) { window.json = JSON.stringify(update.game); window.lastGame = new Date() }
      //console.timeEnd('processMove');
      return update;
    },
    getPlayerState: (state: GameStartedState<Player> | GameFinishedState<Player>, position: number): GameStartedState<Player> | GameFinishedState<Player> => {
      if (!position) throw Error('getPlayerState without position');
      const game = setup(state);
      if (state.phase === 'started') {
        return {
          players: game.players.map(p => p.toJSON() as PlayerAttributes<Player>), // TODO scrub
          settings: game.settings,
          position: game.flow.branchJSON(true),
          board: game.board.allJSON(position),
          rseed: game.rseed,
          sequence: game.sequence,
          phase: state.phase,
          currentPlayers: state.currentPlayers
        }
      }
      return {
        players: game.players.map(p => p.toJSON() as PlayerAttributes<Player>), // TODO scrub
        settings: game.settings,
        position: game.flow.branchJSON(true),
        board: game.board.allJSON(position),
        rseed: game.rseed,
        sequence: game.sequence,
        phase: 'finished',
        winners: game.winner.map(p => p.position)
      }
    }
  };
}
