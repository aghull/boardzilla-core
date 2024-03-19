import FixedGrid from "./fixed-grid.js";
import { times } from '../utils.js';

import type Game from './game.js';

export default class SquareGrid<G extends Game> extends FixedGrid<G> {
  diagonalDistance?: number;

  _adjacentGridPositionsTo(column: number, row: number): [number, number, number?][] {
    const positions: [number, number, number?][] = [];
    if (column > 1) {
      positions.push([column - 1, row]);
      if (this.diagonalDistance !== undefined) {
        positions.push([column - 1, row - 1, this.diagonalDistance]);
        positions.push([column - 1, row + 1, this.diagonalDistance]);
      }
    }
    if (column < this.columns) {
      positions.push([column + 1, row]);
      if (this.diagonalDistance !== undefined) {
        positions.push([column + 1, row - 1, this.diagonalDistance]);
        positions.push([column + 1, row + 1, this.diagonalDistance]);
      }
    }
    positions.push([column, row - 1]);
    positions.push([column, row + 1]);
    return positions;
  }

  _gridPositions(): [number, number][] {
    const positions: [number, number][] = [];
    times(this.rows, row => times(this.columns, col => positions.push([col, row])));
    return positions;
  }
}
