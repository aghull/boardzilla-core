import React, { useState } from 'react';
import { gameStore } from '../';

import Board from './components/Board';
import PlayerControls from './components/PlayerControls';
import Debug from './components/Debug';
//import '../styles/main.scss';
import '../styles/game.scss';

// import TestA from './Test';
// import TestB from './TestB';

import type { GameElement } from '../../game/board'
import type { Move } from '../../game/action/types';
import type { Player } from '../../game/player';

export default () => {
  const [game, updateBoard, player, move, setMove, autoplay, selection, setSelection, selected, setSelected, hilites] = gameStore(s => [s.game, s.updateBoard, s.player, s.move, s.setMove, s.autoplay, s.selection, s.setSelection, s.selected, s.setSelected, s.hilites]);
  const [error, setError] = useState<string>();

  if (!game || !player) return null;

  let clickables: GameElement[] = [];

  console.log("RENDER MAIN", move, selection);

  if (selection?.type === 'board') clickables = selection.boardChoices;

  const submitMove = (move?: Move<Player>) => {
    console.log("processAction", move);
    if (!move) {
      setMove({ player, args: [] });
      return updateBoard();
    }
    if (selection?.type === 'board' && (selection.min !== undefined || selection.max !== undefined)) move.args.push(selected);

    const {move: newMove, selection: newSelection, error} = game.processMove(move);
    console.log('response', newMove, newSelection, error);
    setSelected([]);

    if (newSelection) {
      setError(error);
      setSelection(newSelection);
      setMove(newMove);
    } else {
      setMove(undefined);
      setError("");
      setSelection(undefined);
      if (autoplay) game.play();
      updateBoard();
    }
  };

  const onSelectElement = (element: GameElement) => {
    const newSelected = selected.includes(element) ?
          selected.filter(s => s !== element) :
          selected.concat([element]);
    if (selection?.type === 'board' && move?.action) {
      setSelected(newSelected)
      if (selection?.min === undefined &&
          selection?.max === undefined &&
          newSelected.length === 1) {
        submitMove({
          action: move.action,
          args: [...move.args, newSelected[0]],
          player,
        })
      }
    }
  }

  return (
    <div>
      <Board
        clickables={clickables}
        hilites={hilites}
        selected={selected}
        onSelectElement={onSelectElement}
      />
      <PlayerControls
        move={move}
        error={error}
        selection={selection}
        onSubmit={submitMove}
      />
      <Debug/>
    </div>
  );
}
