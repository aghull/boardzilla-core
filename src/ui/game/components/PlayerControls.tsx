import React, { useCallback, useMemo } from 'react';
import { gameStore } from '../../index.js';
import { deserializeArg } from '../../../action/utils.js';
import Selection from './Selection.js';

import type { Player } from '../../../player/index.js';
import type { GameElement } from '../../../board/index.js';
import type { PendingMove } from '../../../game.js';
import type { Argument } from '../../../action/action.js';
import type { SerializedArg } from '../../../action/utils.js';
import type { ResolvedSelection } from '../../../action/selection.js';

const PlayerControls = ({onSubmit, disambiguateElement}: {
  onSubmit: (move?: PendingMove<Player>, value?: Argument<Player>) => void,
  disambiguateElement?: { element: GameElement<Player>, moves: PendingMove<Player>[] }; // element selected has multiple moves
}) => {
  const [game, position, move, selected, step, moves, prompt] = gameStore(s => [s.game, s.position, s.move, s.selected, s.step, s.pendingMoves, s.prompt]);
  console.log('render PlayerControls', moves, move);

  const onSubmitForm = useCallback((e: React.FormEvent<HTMLFormElement>, pendingMove: PendingMove<Player>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form) throw Error("No form in submit");
    let arg: Argument<Player> | undefined = undefined;
    if (pendingMove.selection?.type === 'board' && pendingMove.selection.isMulti()) {
      arg = selected;
    } else if (pendingMove.selection?.type === 'board' && disambiguateElement) {
      arg = selected[0];
    } else if (pendingMove.selection?.type === 'button') {
      arg = pendingMove.selection.value;
    } else {
      const value = new FormData(form, (e.nativeEvent as SubmitEvent).submitter).get(pendingMove.selection.name)?.toString();
      if (value) {
        arg = value;
        if (pendingMove.selection?.type === 'number') arg = parseInt(arg.toString());
        if (pendingMove.selection?.type === 'choices') arg = deserializeArg(arg as SerializedArg, game);
      }
    }
    onSubmit(pendingMove, arg);
  }, [onSubmit, game, selected, disambiguateElement])

  const controls = useMemo(() => {
    const layouts: Record<string, {moves: PendingMove<Player>[], style: React.CSSProperties}> = {};
    const messages: (PendingMove<Player> | string)[] = moves || [];

    if (!position || !game.players.currentPosition.includes(position)) messages.push('out-of-turn');

    if (disambiguateElement) {
      const elementPosition = disambiguateElement.element.relativeTransformToBoard();
      const style: React.CSSProperties = {};
      if (elementPosition.left > 100 - elementPosition.left - elementPosition.width) {
        style.right = `calc(${100 - elementPosition.left}% + 1rem)`;
      } else {
        style.left = `calc(${elementPosition.left + elementPosition.width}% + 1rem)`;
      }
      style.top = `${elementPosition.top}%`;
      layouts['disambiguate-board-selection'] = { moves: disambiguateElement.moves, style };
    } else {
      for (const pendingMove of messages) {
        if (!move && typeof pendingMove === 'object' && pendingMove.action.slice(0, 4) === '_god') continue; // don't need to display these as top-level choices
        let layoutName = "";
        const actionLayout = typeof pendingMove === 'object' ? "action:" + pendingMove.action : undefined;
        const stepLayout = 'step:' + (typeof pendingMove === 'string' ? pendingMove : step);
        if (actionLayout && game.board._ui.stepLayouts[actionLayout]) {
          layoutName = actionLayout;
        } else if (stepLayout && game.board._ui.stepLayouts[stepLayout]) {
          layoutName = stepLayout;
        }

        if (layoutName) {
          const existing = layouts[layoutName];
          if (existing) {
            if (typeof pendingMove === 'object') existing.moves.push(pendingMove);
          } else {
            let style: React.CSSProperties = { left: 0, top: 0 };
            const layout = game.board._ui.stepLayouts[layoutName];
            const position = (typeof layout.element === 'function' ? layout.element() : layout.element)._ui.computedStyle;
            if (position) style = {
              left: layout.left !== undefined ? (layout.left * position.width / 100) + position.left + '%' : undefined,
              top: layout.top !== undefined ? (layout.top * position.height / 100) + position.top + '%' : undefined,
              right: layout.right !== undefined ? 100 + ((layout.right * position.width / 100) - position.left - position.width) + '%' : undefined,
              bottom: layout.bottom !== undefined ? 100 + ((layout.bottom * position.height / 100) - position.top - position.height) + '%' : undefined,
              width: layout.width !== undefined ? (layout.width * position.width / 100) + '%' : undefined,
              height: layout.height !== undefined ? (layout.height * position.height / 100) + '%' : undefined,
            }
            layouts[layoutName] = {moves: typeof pendingMove === 'object' ? [pendingMove] : [], style};
          }
        } else {
          layouts['_default'] = {moves: typeof pendingMove === 'object' ? [pendingMove] : [], style: {left: 0, top: 0}};
        }
      }
    }
    return layouts;
  }, [game, moves, move, position, disambiguateElement, step]); // TODO check this works: game.players.currentPosition so the out of turn can move?

  if (!position) return null;

  return Object.entries(controls).map(([layoutName, {moves, style}]) => {
    const boardPrompts = moves.map(m => m.selection.type === 'board' ? m.selection.prompt : undefined).filter(p => p);
    const boardPrompt = new Set(boardPrompts).size === 1 ? boardPrompts[0] : prompt;
    const boardID = boardPrompt ? moves.find(m => m.selection.prompt === boardPrompt)?.action : '';

    return (
      <div key={layoutName} className={`player-controls ${layoutName.replace(":", "-")}`} style={style}>
        {layoutName === 'step:out-of-turn' && (
          `${game.players.current().map(p => p.name).join(' ,')} is taking their turn`
        )}
        {boardPrompt && <div id={boardID} className="prompt">{boardPrompt}</div>}
        {moves.map(pendingMove => (
          <form key={pendingMove.action + pendingMove.selection.prompt} id={pendingMove.action} onSubmit={e => onSubmitForm(e, pendingMove)}>
            <div>
              <Selection selection={pendingMove.selection}/>
              {pendingMove.selection.clientContext?.followups?.map((s: ResolvedSelection<Player>) => <Selection selection={s}/>)}

              {pendingMove.selection.type === 'board' && layoutName === 'disambiguate-board-selection' && (
                <button type="submit">{pendingMove.selection.prompt}</button>
              )}

              {pendingMove.selection.type === 'board' &&
                (pendingMove.selection.isMulti()) &&
                (selected.length >= (pendingMove.selection.min ?? 1) && selected.length <= (pendingMove.selection.max ?? Infinity)) && (
                  <button type="submit">Done</button>
                )
              }
            </div>
          </form>
        ))}

        {(move || layoutName === 'disambiguate-board-selection') && (
          <>
            <button onClick={() => onSubmit()}>Cancel</button>
          </>
        )}
      </div>
    )
  });
};

export default PlayerControls;
