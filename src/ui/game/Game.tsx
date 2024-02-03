import React, { useState, useRef, useEffect, useCallback, useMemo, CSSProperties } from 'react';
import { gameStore } from '../index.js';

import Element from './components/Element.js';
import PlayerControls from './components/PlayerControls.js';
import InfoOverlay from './components/InfoOverlay.js';
import Debug from './components/Debug.js';
import { click } from '../assets/index.js';
import { GameElement } from '../../board/index.js'
import classnames from 'classnames';

import type { ActionLayout } from '../../board/board.js'
import type { UIMove } from '../index.js';
import type { Argument } from '../../action/action.js';
import type { Player } from '../../player/index.js';
import type { Box } from '../../board/element.js';
import AnnouncementOverlay from './components/AnnouncementOverlay.js';

export default () => {
  const [game, position, pendingMoves, move, step, otherPlayerAction, announcementIndex, dismissAnnouncement, selectMove, boardSelections, selected, setSelected, setBoardSize, dragElement, setDragElement, setCurrentDrop, boardJSON] =
    gameStore(s => [s.game, s.position, s.pendingMoves, s.move, s.step, s.otherPlayerAction, s.announcementIndex, s.dismissAnnouncement, s.selectMove, s.boardSelections, s.selected, s.setSelected, s.setBoardSize, s.dragElement, s.setDragElement, s.setCurrentDrop, s.boardJSON]);
  const clickAudio = useRef<HTMLAudioElement>(null);
  const [disambiguateElement, setDisambiguateElement] = useState<{ element: GameElement<Player>, moves: UIMove[] }>();
  const [mode, setMode] = useState<'game' | 'info' | 'debug'>('game');
  const announcement = useMemo(() => game.announcements[announcementIndex], [game.announcements, announcementIndex]);

  if (!position) return null;
  const player = game.players.atPosition(position);
  if (!player) return null;

  const submitMove = useCallback((pendingMove?: UIMove, args?: Record<string, Argument<Player>>) => {
    clickAudio.current?.play();
    setDisambiguateElement(undefined);
    setSelected([]);
    setDragElement(undefined);
    setCurrentDrop(undefined);
    selectMove(pendingMove, args);
  }, [selectMove, setSelected, setDragElement, setCurrentDrop]);

  const onSelectElement = useCallback((moves: UIMove[], element: GameElement<Player>) => {
    clickAudio.current?.play();
    setDisambiguateElement(undefined);

    if (moves.length === 0) return;
    if (moves.length > 1) { // multiple moves are associated with this element (attached by getBoardSelections)
      setSelected([element]);
      return setDisambiguateElement({ element, moves });
    }

    const move = moves[0];
    const selection = move.selections[0]; // simple one-selection UIMove created by getBoardSelections
    if (!move.requireExplicitSubmit) {
      submitMove(move, {[selection.name]: element});
      return;
    }
    selectMove(move);

    const newSelected = selection.isMulti() ? (
      selected.includes(element) ?
        selected.filter(s => s !== element) :
        selected.concat([element])
    ) : (
      selected[0] === element ? [] : [element]
    );
    setSelected(newSelected);
  }, [selected, setSelected, selectMove, submitMove]);

  const onSelectPlacement = useCallback(({ column, row }: { column: number, row: number }) => {
    if (pendingMoves) submitMove(pendingMoves[0], {__placement__: [column, row]});
  }, [pendingMoves, submitMove]);

  const {style, name, moves} = useMemo(() => {
    // find the best layout for the current moves, going in this order:
    // - the last selected, visible game element as part of the current move(s) that hasn't been disabled via layoutAction.noAnchor
    // - a supplied layoutAction for the only current move
    // - a supplied layoutStep belonging to the step to which the current move(s) belong
    let layout: ActionLayout | undefined = undefined;
    let name: string = '';
    let moves = pendingMoves || [];
    let style: CSSProperties = { };

    if (!layout && disambiguateElement?.element) {
      layout = { element: disambiguateElement.element, position: 'beside', gap: 2 };
      moves = disambiguateElement.moves;
      name = 'disambiguate-board-selection';
    }

    if (!layout && selected.length === 1) {
      const clickMoves = boardSelections[selected[0].branch()]?.clickMoves;
      if (clickMoves?.length === 1 && !clickMoves[0].selections[0].isMulti()) {
        layout = { element: selected[0], position: 'beside', gap: 2 };
        name = 'action:' + moves[0].name;
        moves = clickMoves;
      }
    }

    // anchor to last element in arg list
    if (!layout && move && !pendingMoves?.[0].selections[0].isBoardChoice()) {
      const element = Object.entries(move.args).reverse().find(([name, el]) => (
        !game.board._ui.stepLayouts["action:" + move.name]?.noAnchor?.includes(name) && el instanceof GameElement
      ));
      if (element && (element[1] as GameElement)._ui?.computedStyle) {
        layout = { element: element[1] as GameElement, position: 'beside', gap: 2 };
        name = 'action:' + element[0];
      }
    }

    if (!layout && pendingMoves?.length) {
      const moves = pendingMoves.filter(m => move || m.name.slice(0, 4) !== '_god'); // no display for these normally

      if (moves.length === 1) {
        // skip non-board moves if board elements already selected (cant this be more specific? just moves that could apply?)
        if (!selected.length || moves[0].selections.some(s => s.type !== 'board')) {
          const actionLayout = game.board._ui.stepLayouts["action:" + moves[0].name];
          if (actionLayout?.element?._ui?.computedStyle) {
            layout = actionLayout;
            name = 'action:' + moves[0].name;
          }
        }
      }
    }

    if (!layout && otherPlayerAction) {
      const actionLayout = game.board._ui.stepLayouts["action:" + otherPlayerAction];
      if (actionLayout?.element?._ui?.computedStyle) {
        layout = actionLayout;
        name = 'action:' + otherPlayerAction;
      }
    }

    if (!layout && step) {
      name = 'step:' + step;
      layout = game.board._ui.stepLayouts[name];
    }

    if (!layout) {
      name = 'step:*';
      layout = game.board._ui.stepLayouts[name];
    }

    if (layout) {
      const box: Box = layout.element.relativeTransformToBoard();

      if (layout.position === 'beside' || layout.position === 'stack') {
        if (box.left > 100 - box.left - box.width) {
          style.right = `clamp(0%, calc(${100 - box.left - (layout.position === 'beside' ? 0 : box.width)}% + ${layout.position === 'beside' ? layout.gap : 0}vw), 100%)`;
          style.left = undefined;
        } else {
          style.left = `clamp(0%, calc(${box.left + (layout.position === 'beside' ? box.width : 0)}% + ${layout.position === 'beside' ? layout.gap : 0}vw), 100%)`;
        }

        if (box.top > 100 - box.top - box.height) {
          style.bottom = `clamp(0%, calc(${100 - box.top - (layout.position === 'beside' ? box.height : 0)}% + ${layout.position === 'beside' ? 0 : layout.gap}vw), 100%)`;
          style.top = undefined;
        } else {
          style.top = `clamp(0%, calc(${box.top + (layout.position === 'beside' ? 0: box.height)}% + ${layout.position === 'beside' ? 0 : layout.gap}vw), 100%)`;
        }
      } else {
        // inset
        if (layout.right !== undefined) {
          style.right = 100 + ((layout.right * box.width / 100) - box.left - box.width) + '%';
        } else if (layout.center !== undefined) {
          style.left ??= ((layout.center - 50) * box.width / 100) + box.left + '%';
          style.right = 100 + ((50 - layout.center) * box.width / 100) - box.left - box.width + '%';
          style.margin = '0 auto';
        } else {
          style.left ??= ((layout.left ?? 0) * box.width / 100) + box.left + '%';
        }

        if (layout.bottom !== undefined) {
          style.bottom = 100 + ((layout.bottom * box.height / 100) - box.top - box.height) + '%';
        } else {
          style.top = ((layout.top ?? 0) * box.height / 100) + box.top + '%';
        }
      }

      if (layout.width !== undefined) style.maxWidth = (layout.width * box.width / 100) + '%';
      if (layout.height !== undefined) style.maxHeight = (layout.height * box.height / 100) + '%';
    } else {
      style = {left: 0, top: 0};
    }

    return {style, name, moves};
  }, [selected, pendingMoves, boardSelections, move, disambiguateElement, otherPlayerAction, step, game.board._ui.stepLayouts]);

  const domRef = useCallback((node: HTMLDivElement) => {
    if (!node) return;
    const callback: MutationCallback = deletions => {
      deletions.forEach(m => m.removedNodes.forEach((d: HTMLElement) => {
        if (d.classList.contains('player-controls') && !d.classList.contains('fade-out')) {
          const fadeOut = d.cloneNode(true);
          (fadeOut as HTMLElement).classList.add('fade-out');
          node.appendChild(fadeOut);
          setTimeout(() => node.removeChild(fadeOut), 500);
        }
      }));
    };

    const observer = new MutationObserver(callback);
    observer.observe(node, { childList: true });
  }, []);

  useEffect(() => {
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape') {
        if (mode === 'game') submitMove();
      }
    };
    window.addEventListener('keydown', keydownHandler);
    return () => window.removeEventListener('keydown', keydownHandler);
  }, [submitMove, mode]);

  useEffect(() => {
    window.addEventListener('resize', setBoardSize);
    return () => window.removeEventListener('resize', setBoardSize);
  }, [setBoardSize]);

  useEffect(() => {
    window.document.documentElement.style.setProperty('font-size', 'min(4vw / var(--aspect-ratio), 4vh)');
    window.document.documentElement.style.setProperty('--aspect-ratio', String(game.board._ui.boardSize.aspectRatio))
    return () => {
      window.document.documentElement.style.removeProperty('font-size');
      window.document.documentElement.style.removeProperty('--aspect-ratio');
    }
  }, [game.board._ui.boardSize]);

  if (!boardJSON.length) return null;

  console.debug('Showing game with pending moves:' +
    (pendingMoves?.map(m => (
      `\n⮕ ${typeof m === 'string' ? m :
        `${m.name}({${
          Object.entries(m.args || {}).map(([k, v]) => `${k}: ${v}`).join(', ')
        }}) ? ${m.selections?.length ? m.selections[0].toString() : 'no choices'}`
      }`
    )).join('') || ' none')
  );

  return (
    <div
      id="game"
      ref={domRef}
      data-board-size={game.board._ui.boardSize?.name}
      data-step={step}
      className={classnames(
        globalThis.navigator?.userAgent.match(/Mobi/) ? 'mobile' : 'desktop', {
          'browser-chrome': globalThis.navigator?.userAgent.indexOf('Chrome') > -1,
          'browser-safari': globalThis.navigator?.userAgent.indexOf('Safari') > -1,
          'browser-edge': globalThis.navigator?.userAgent.indexOf('Edge') > -1,
          'browser-firefox': globalThis.navigator?.userAgent.indexOf('Firefox') > -1,
        }
      )}
      style={{ ['--aspect-ratio' as string]: game.board._ui.boardSize.aspectRatio }}
    >
      <audio ref={clickAudio} src={click} id="click"/>
      <div id="background" className="full-page-cover" />
      <div id="play-area" style={{width: '100%', height: '100%'}} className={dragElement ? "in-drag-movement" : ""}>
        {mode !== 'debug' && (
          <Element
            element={game.board}
            json={boardJSON[0]}
            mode={announcement ? 'info' : mode}
            onSelectElement={onSelectElement}
            onSelectPlacement={onSelectPlacement}
          />
        )}
      </div>

      {mode === 'game' && !announcement && (moves.length || !game.players.currentPosition.includes(position)) && (
        <PlayerControls
          name={name}
          style={style}
          moves={moves}
          onSubmit={submitMove}
        />
      )}

      {game.godMode && mode === 'game' && !announcement && <div className="god-mode-enabled">God mode enabled</div>}

      {mode !== 'info' && (
        <div id="corner-controls">
          <div id="info-toggle">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 112 112" onClick={() => setMode('info')}>
              <path
                style={{stroke:'black', fill: 'white', strokeWidth: 8}}
                d="M 53.102,4 C 25.983,4 4,25.983 4,53.102 c 0,27.119 21.983,49.103 49.102,49.103 27.119,0 49.101,-21.984 49.101,-49.103 C 102.203,25.983 80.221,4 53.102,4 Z"
              />
              <path
                fill="black"
                d="m 53.102,34.322 c -5.048,0 -9.141,-4.092 -9.141,-9.142 0,-5.049 4.092,-9.141 9.141,-9.141 5.05,0 9.142,4.092 9.142,9.141 -10e-4,5.05 -4.093,9.142 -9.142,9.142 z"
              />
              <path
                fill="black"
                d="m 61.669,82.139 c 0,4.402 -3.806,7.969 -8.5,7.969 -4.694,0 -8.5,-3.567 -8.5,-7.969 V 45.577 c 0,-4.401 3.806,-7.969 8.5,-7.969 4.694,0 8.5,3.568 8.5,7.969 z"
              />
            </svg>
          </div>
          <div id="debug-toggle">
            <svg
              viewBox="-40 -40 574.04362 578.11265"
              xmlns="http://www.w3.org/2000/svg"
              onClick={() => setMode(mode === 'debug' ? 'game' : 'debug')}
            >
              <path
                style={{fill: 'white', stroke: 'black', strokeWidth:80, paintOrder:'stroke markers fill'}}
                d="m 352.48196,213.31221 c 0,78.32378 -63.49396,141.81774 -141.81774,141.81775 -78.32378,0 -141.817754,-63.49397 -141.817754,-141.81775 10e-7,-78.32378 63.493974,-141.817751 141.817754,-141.817749 78.32378,6e-6 141.81774,63.493969 141.81774,141.817749 z M 490.31895,451.24231 378.93053,344.196 c 29.8,-36.3 42.26947,-82.8 42.26947,-133.4 0,-116.3 -94.3,-210.6 -210.6,-210.6 -116.3,0 -210.6,94.3 -210.6,210.6 0,116.3 94.3,210.6 210.6,210.6 50.8,0 88.51578,-8.22736 124.91578,-38.22736 l 112.27685,111.38842 c 12.9,11.8 32.10737,-6.46106 36.30737,-10.66106 8.4,-8.3 14.61895,-24.35369 6.21895,-32.65369 z"/>
            </svg>
          </div>
        </div>
      )}

      {mode === 'game' && announcement && <AnnouncementOverlay announcement={announcement} onDismiss={dismissAnnouncement}/>}
      {mode === 'info' && <InfoOverlay setMode={setMode}/>}
      {mode === 'debug' && <Debug/>}
    </div>
  );
}
