import type Game from './game';
import type { Player } from './player/';
import type { Board } from './board/';
import type { SerializedMove } from './action/types';
import type {
  SetupState,
  GameState,
  GameUpdate,
} from '../types';

export type SetupFunction<P extends Player, B extends Board> = (state: SetupState | GameState<P>, start: boolean) => Game<P, B>

export type GameInterface<P extends Player> = {
  initialState: (state: SetupState) => GameUpdate<P>,
  processMove: (
    previousState: GameState<P>,
    move: {
      position: number
      data: SerializedMove
    }
  ) => GameUpdate<P>
}
