import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { gameStore } from './index.js';
import Game from './game/Game.js';
import Setup from './setup/Setup.js';
import Queue from './queue.js';

import type { GameState } from '../interface.js';
import type Player from '../player/player.js';
import type { SetupComponentProps } from './index.js';

export type User = {
  id: string;
  name: string;
  avatar: string;
  playerDetails?: {
    color: string;
    position: number;
    ready: boolean;
    settings?: any;
    sessionURL?: string;
  };
};

type UsersEvent = {
  type: "users";
  users: User[];
};

type UserOnlineEvent = {
  type: "userOnline";
  id: string;
  online: boolean;
};

export type GameSettings = Record<string, any>

// an update to the setup state
export type SettingsUpdateEvent = {
  type: "settingsUpdate";
  settings: GameSettings;
  seatCount: number;
}

export type GameUpdateEvent = {
  type: "gameUpdate";
  state: GameState<Player> | GameState<Player>[];
  position: number;
  currentPlayers: number[];
}

export type GameFinishedEvent = {
  type: "gameFinished";
  state: GameState<Player> | GameState<Player>[];
  position: number;
  winners: number[];
}

// indicates the disposition of a message that was processed
export type MessageProcessedEvent = {
  type: "messageProcessed";
  id: string;
  error?: string;
}

export type SeatOperation = {
  type: 'seat';
  position: number;
  userID: string;
  color: string;
  name: string;
  settings?: any;
}

export type UnseatOperation = {
  type: 'unseat';
  userID: string;
}

export type UpdateOperation = {
  type: 'update';
  userID: string;
  color?: string;
  name?: string;
  ready?: boolean;
  settings?: any;
}

type PlayerOperation = SeatOperation | UnseatOperation | UpdateOperation

export type UpdatePlayersMessage = {
  type: "updatePlayers";
  id: string;
  operations: PlayerOperation[];
}

export type UpdateSettingsMessage = {
  type: "updateSettings";
  id: string;
  settings: GameSettings;
  seatCount: number
}

// used to actually start the game
export type StartMessage = {
  id: string;
  type: 'start';
}

// used to tell the top that you're ready to recv events
export type ReadyMessage = {
  type: 'ready';
}

export type SwitchPlayerMessage = {
  type: "switchPlayer";
  index: number;
}

export default ({ minPlayers, maxPlayers, defaultPlayers, setupComponents }: {
  minPlayers: number,
  maxPlayers: number,
  defaultPlayers: number,
  setupComponents: Record<string, (p: SetupComponentProps) => JSX.Element>
}) => {
  const [gameManager, updateState, setUserOnline, announcementIndex] = gameStore(s => [s.gameManager, s.updateState, s.setUserOnline, s.announcementIndex]);
  const [settings, setSettings] = useState<GameSettings>();
  const [seatCount, setSeatCount] = useState(defaultPlayers);
  const [users, setUsers] = useState<User[]>([]);
  const [readySent, setReadySent] = useState<boolean>(false);
  const players = useMemo(() => users.filter(u => !!u.playerDetails), [users]);

  const moveCallbacks = useMemo<((e: string) => void)[]>(() => [], []);

  const catchError = useCallback((error: string) => {
    if (!error) return
    console.error(error);
  }, []);

  const queue = useMemo(() => new Queue(1) /* speed */, []);

  useEffect(() => {
    if (gameManager.announcements[announcementIndex]) {
      queue.pause();
    } else if (queue.paused) {
      setTimeout(() => queue.resume(), 500);
    }
  }, [queue, gameManager, announcementIndex])

  const listener = useCallback((event: MessageEvent<
    UsersEvent |
    UserOnlineEvent |
    SettingsUpdateEvent |
    GameUpdateEvent |
    GameFinishedEvent |
    MessageProcessedEvent
  >) => {
    const data = event.data;
    switch(data.type) {
    case 'settingsUpdate':
      setSettings(data.settings);
      setSeatCount(data.seatCount);
      break;
    case 'users':
      setUsers(data.users);
      break;
    case 'userOnline':
      setUserOnline(data.id, data.online)
      break;
    case 'gameUpdate':
    case 'gameFinished':
      {
        if (data.state instanceof Array) {
          const states = data.state;
          let delay = data.state[0].sequence === gameManager.sequence + 1;

          for (let i = 0; i !== states.length; i++) {
            const state = states[i];
            queue.schedule(() => updateState({...data, state}, i !== states.length - 1), delay);
            delay = true;
          }
        } else {
          let delay = data.state.sequence === gameManager.sequence + 1;
          queue.schedule(() => updateState(data as typeof data & {state: typeof data.state}), delay); // TS needs help here...
        }
      }
      break;
    case 'messageProcessed':
      if (data.error) {
        catchError(data.error);
        const move = moveCallbacks[parseInt(data.id)];
        if (move) move(data.error);
      }
      delete moveCallbacks[parseInt(data.id)];
      break;
    }
  }, [setUserOnline, moveCallbacks, gameManager, queue, updateState, catchError]);

  useEffect(() => {
    window.addEventListener('message', listener, false)
    const message: ReadyMessage = {type: "ready"};
    if (!readySent) {
      window.top!.postMessage(message, "*");
      setReadySent(true);
    }
    return () => window.removeEventListener('message', listener)
  }, [readySent, listener]);

  const updateSettings = useCallback((update: {settings?: GameSettings, seatCount?: number}) => {
    if (update.settings) setSettings(update.settings);
    if (update.seatCount) setSeatCount(update.seatCount);
    const message: UpdateSettingsMessage = {
      type: "updateSettings",
      id: 'settings',
      settings: update.settings ?? settings ?? {},
      seatCount: update.seatCount ?? seatCount
    };
    window.top!.postMessage(message, "*");
  }, [seatCount, settings]);

  const updatePlayers = useCallback((operations: UpdatePlayersMessage['operations']) => {
    const message: UpdatePlayersMessage = {
      type: 'updatePlayers',
      id: 'updatePlayers',
      operations
    }
    window.top!.postMessage(message, "*");
  }, [])

  return (
    <>
      {gameManager.phase === 'new' && settings &&
        <Setup
          users={users}
          minPlayers={minPlayers}
          maxPlayers={maxPlayers}
          setupComponents={setupComponents}
          players={players}
          settings={settings}
          seatCount={seatCount}
          onUpdatePlayers={updatePlayers}
          onUpdateSettings={updateSettings}
        />
      }
      {(gameManager.phase === 'started' || gameManager.phase === 'finished') && <Game/>}
    </>
  );
}
