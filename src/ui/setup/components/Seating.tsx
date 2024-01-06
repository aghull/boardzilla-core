import React, { useState } from 'react';
import { gameStore } from '../../index.js';

import { times } from '../../../index.js';
import * as ReactColor from 'react-color';
const { GithubPicker } = ReactColor;

import type { User, UnseatOperation, UpdateOperation, UpdatePlayersMessage } from '../../Main.js';

const colors = [
  '#d50000', '#00695c', '#304ffe', '#ff6f00', '#7c4dff',
  '#ffa825', '#f2d330', '#43a047', '#004d40', '#795a4f',
  '#00838f', '#408074', '#448aff', '#1a237e', '#ff4081',
  '#bf360c', '#4a148c', '#aa00ff', '#455a64', '#600020'];

const Seating = ({ users, players, maxPlayers, onUpdatePlayers, onUpdateSelfPlayer }: {
  users: User[],
  players: User[],
  minPlayers: number,
  maxPlayers: number,
  onUpdatePlayers: (operations: UpdatePlayersMessage['operations']) => void,
  onUpdateSelfPlayer: ({ color, name }: { color: string, name: string }) => void,
}) => {
  const [userID, host] = gameStore(s => [s.userID, s.host]);

  const [pickingColor, setPickingColor] = useState<string>();

  const rename = (id: string) => {
    const user = users.find(u => u.id === id);
    updateName(id, prompt("Please enter a name", user?.name)!);
  }

  const seatPlayer = (position: number, userID: string) => {
    const user = users.find(u => u.id === userID);
    const unseats = players.filter(p => p.id === userID && p.playerDetails?.position !== position || p.id !== userID && p.playerDetails?.position === position);
    const usedColors = players.filter(p => p.id !== userID && p.playerDetails?.position !== position).map(p => p.playerDetails?.color);
    const color = colors.find(c => !usedColors.includes(c))!;

    const operations: UpdatePlayersMessage['operations'] = unseats.map(u => (
      {type: 'unseat', userID: u.id} as UnseatOperation
    ));
    if (userID === "reserve") {
      operations.push({
        type: "reserve",
        position,
        color,
        name: "Reserved",
        settings: {}
      });
    } else if (user) {
      operations.push({
        type: "seat",
        position,
        userID,
        color,
        name: user.name,
        settings: {}
      });
    }
    onUpdatePlayers(operations);
  }

  const updateColor = (userID: string, color: string) => {
    setPickingColor(undefined);
    if (host) {
      const operation: UpdateOperation = {
        type: "update",
        userID,
        color,
      };
      onUpdatePlayers([operation]);
    } else {
      onUpdateSelfPlayer({ color, name: players.find(p => p.id === userID)!.name });
    }
  }

  const updateName = (userID: string, name: string) => {
    setPickingColor(undefined);
    if (host) {
      const operation: UpdateOperation = {
        type: "update",
        userID,
        name,
      };
      onUpdatePlayers([operation]);
    } else {
      if (!players.find(p => p.id === userID)!.playerDetails) return
      onUpdateSelfPlayer({ name, color: players.find(p => p.id === userID)!.playerDetails!.color });
    }
  }

  return (
    <div id="seating">
      <div id="seats">
        {times(maxPlayers, position => {
          const player = players.find(p => p.playerDetails?.position === position);
          return (
            <div className="seat" key={position}>
              <select
                onDragOver={e => {e.preventDefault(); e.dataTransfer.dropEffect = "move";}}
                onDrop={e => seatPlayer(position, e.dataTransfer.getData('user'))}
                value={player?.id || ""}
                onChange={e => seatPlayer(position, e.target.value)}
                style={{backgroundColor: player?.playerDetails?.color }}
              >
                <option key="" value="">&lt; open seat &gt;</option>
                <option key="reserve" value="reserve">&lt; reserve seat &gt;</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <img className="avatar" draggable="false" src={player?.avatar}/>
              {player && (host || player.id === userID) && (
                <>
                  <div
                    className="rename"
                    onClick={() => rename(player.id)}
                  >
                                        <svg
                      className="svg-icon"
                      style={{ width: "1em", height: "1em", verticalAlign: "middle" }}
                      viewBox="0 0 24 24">
                        <path d="M1 22C1 21.4477 1.44772 21 2 21H22C22.5523 21 23 21.4477 23 22C23 22.5523 22.5523 23 22 23H2C1.44772 23 1 22.5523 1 22Z" fill="#0F0F0F"/>
                        <path fillRule="evenodd" clipRule="evenodd" d="M18.3056 1.87868C17.1341 0.707107 15.2346 0.707107 14.063 1.87868L3.38904 12.5526C2.9856 12.9561 2.70557 13.4662 2.5818 14.0232L2.04903 16.4206C1.73147 17.8496 3.00627 19.1244 4.43526 18.8069L6.83272 18.2741C7.38969 18.1503 7.89981 17.8703 8.30325 17.4669L18.9772 6.79289C20.1488 5.62132 20.1488 3.72183 18.9772 2.55025L18.3056 1.87868ZM15.4772 3.29289C15.8677 2.90237 16.5009 2.90237 16.8914 3.29289L17.563 3.96447C17.9535 4.35499 17.9535 4.98816 17.563 5.37868L15.6414 7.30026L13.5556 5.21448L15.4772 3.29289ZM12.1414 6.62869L4.80325 13.9669C4.66877 14.1013 4.57543 14.2714 4.53417 14.457L4.0014 16.8545L6.39886 16.3217C6.58452 16.2805 6.75456 16.1871 6.88904 16.0526L14.2272 8.71448L12.1414 6.62869Z" fill="#0F0F0F"/>
                    </svg>
                  </div>
                  <div
                    className="palette"
                    onClick={() => setPickingColor(picking => picking === player.id ? undefined : player.id)}
                  >
                    <svg
                      className="svg-icon"
                      style={{ width: "1em", height: "1em", verticalAlign: "middle" }}
                      viewBox="0 0 316.249 288.333"
                    >
                      <path
                        fill="none"
                        stroke="#000"
                        strokeLinecap="butt"
                        strokeWidth="20.315"
                        d="M242.888 162.508c-.23 34.436-17.432 73.325-39.074 94.779-25.529 25.308-59.475 39.242-95.596 39.242h-.038c-38.707-.011-96.13-26.903-96.141-64.034-.006-19.707 10.354-27.388 21.323-35.52 10.253-7.602 21.874-16.218 21.87-34.474-.006-18.253-11.63-26.874-21.886-34.479-10.974-8.139-21.34-15.826-21.346-35.535-.005-22.801 16.674-35.674 33.463-45.882 19.175-13.376 43.273-18.094 62.615-18.094h.021c29.491.008 57.517 9.254 81.048 26.736 21.702 16.125 44.463 42.573 47.947 75.486m-51.614 94.679c-6.358 25.196-22.356 37.968-47.594 37.967h-.006c-6.655 0-13.028-.908-18.386-2.04 6.4-6.527 8.399-16.349 10.13-24.858 3.297-16.208 6.415-31.547 31.923-35.191zm61.496-99.637c2.998-2.602 5.977-5.171 8.913-7.675 29.847-25.455 45.489-36.533 53.468-41.354-4.765 8.027-15.741 23.788-41.021 53.906-23.785 28.337-58.77 69.69-82.47 93.885l-25.1-23.827c21.488-21.39 60.491-52.614 86.21-74.935v0"
                      ></path>
                      <circle
                        cx="78.341"
                        cy="95.328"
                        r="22.398"
                        fill="none"
                        stroke="#000"
                        strokeWidth="20.315"
                      ></circle>
                      <circle
                        cx="128.659"
                        cy="132.169"
                        r="22.398"
                        fill="none"
                        stroke="#000"
                        strokeWidth="20.315"
                        transform="translate(24.304 -35.741)"
                      ></circle>
                      <circle
                        cx="79.964"
                        cy="223.845"
                        r="22.398"
                        fill="none"
                        stroke="#000"
                        strokeWidth="20.315"
                      ></circle>
                    </svg>
                  </div>
                  {pickingColor === player.id && (
                    <GithubPicker
                      color={player.playerDetails?.color}
                      colors={colors.filter(c => c === player.playerDetails?.color || !players.map(p => p.playerDetails?.color).includes(c))}
                      onChange={c => updateColor(player.id, c.hex)}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div id="lobby">
        <div>Waiting in lobby</div>
        <div id="users">
          {users.filter(u => !players.find(player => player.id === u.id)).map(
            u => (
              <div key={u.id} draggable="true" onDragStart={e => e.dataTransfer.setData('user', u.id)} className="user">
                <img draggable="false" src={u.avatar}/>{u.name}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Seating;
