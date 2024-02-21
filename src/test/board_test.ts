import chai from 'chai';
import spies from 'chai-spies';
import random from 'random-seed';

import {
  Board,
  Space,
  Piece,
  GameElement,
} from '../board/index.js';

import {
  Player,
  PlayerCollection,
} from '../player/index.js';

chai.use(spies);
const { expect } = chai;

describe('Board', () => {
  let board: Board<Player>;

  const players = new PlayerCollection<Player>;
  players.className = Player;
  players.addPlayer({
    id: 'joe',
    name: 'Joe',
    position: 1,
    color: 'red',
    avatar: '',
    host: true
  });
  players.addPlayer({
    id: 'jane',
    name: 'Jane',
    position: 2,
    color: 'green',
    avatar: '',
    host: false
  });

  beforeEach(() => {
    board = new Board({
      // @ts-ignore
      game: { players, addDelay: () => {}, random: random.create('a').random },
      classRegistry: [Space, Piece, GameElement]
    });
    board._ctx.game.board = board;
  });

  it('renders', () => {
    expect(board.allJSON()).to.deep.equals(
      [
        { className: 'Board', _id: 0 },
      ]
    );
  });

  it('creates new spaces', () => {
    board.create(Space, 'map', {});
    expect(board.allJSON()).to.deep.equals(
      [
        { className: 'Board', _id: 0, children: [
          { className: 'Space', name: 'map', _id: 2 }
        ]},
      ]
    );
  });

  it('creates new pieces', () => {
    board.create(Piece, 'token', { player: players[0] });
    expect(board.allJSON()).to.deep.equals(
      [
        { className: 'Board', _id: 0, children: [
          { className: 'Piece', name: 'token', _id: 2, player: '$p[1]' }
        ]},
      ]
    );
  });

  it('destroys pieces', () => {
    board.create(Piece, 'token', { player: players[1] });
    board.create(Piece, 'token', { player: players[0] });
    board.first(Piece)!.destroy();
    expect(board.allJSON()).to.deep.equals(
      [
        { className: 'Board', _id: 0, children: [
          { className: 'Piece', name: 'token', _id: 3, player: '$p[1]' }
        ]},
      ]
    );
  });

  it('removes pieces', () => {
    board.create(Piece, 'token', { player: players[1] });
    board.create(Piece, 'token', { player: players[0] });
    board.first(Piece)!.remove();
    expect(board.allJSON()).to.deep.equals(
      [
        { className: 'Board', _id: 0, children: [
          { className: 'Piece', name: 'token', _id: 3, player: '$p[1]' }
        ]},
        { className: 'Piece', name: 'token', _id: 2, player: '$p[2]' }
      ]
    );
  });

  it('removes all', () => {
    board.create(Piece, 'token', { player: players[1] });
    board.create(Piece, 'token', { player: players[0] });
    board.all(Piece).remove();
    expect(board.allJSON()).to.deep.equals(
      [
        { className: 'Board', _id: 0},
        { className: 'Piece', name: 'token', _id: 2, player: '$p[2]' },
        { className: 'Piece', name: 'token', _id: 3, player: '$p[1]' }
      ]
    );
  });

  it('builds from json', () => {
    const map = board.create(Space, 'map', {});
    const france = map.create(Space, 'france', {});
    const piece3 = map.create(Piece, 'token3');
    const england = map.create(Space, 'england', {});
    const play = board.create(Space, 'play', {});
    const piece1 = france.create(Piece, 'token1', { player: players[0] });
    const piece2 = france.create(Piece, 'token2', { player: players[1] });
    const json = board.allJSON();
    board.fromJSON(JSON.parse(JSON.stringify(board.allJSON())));
    expect(board.allJSON()).to.deep.equals(json);
    expect(board.first(Piece, 'token1')!._t.id).to.equal(piece1._t.id);
    expect(board.first(Piece, 'token1')!.player).to.equal(players[0]);
    expect(board.first(Piece, 'token2')!._t.id).to.equal(piece2._t.id);
    expect(board.first(Piece, 'token2')!.player).to.equal(players[1]);
    expect(board.first(Space, 'france')).to.equal(france);
  });

  it('preserves serializable attributes from json', () => {
    class Country extends Space<Player> {
      rival: Country;
      general: Piece<Player>;
    }
    board._ctx.classRegistry = [Space, Piece, GameElement, Country];

    const map = board.create(Space, 'map', {});
    const napolean = map.create(Piece, 'napolean')
    const england = map.create(Country, 'england', {});
    const france = map.create(Country, 'france', { rival: england, general: napolean });
    const json = board.allJSON();
    board.fromJSON(JSON.parse(JSON.stringify(json)));
    expect(board.allJSON()).to.deep.equals(json);
    expect(board.first(Country, 'france')).to.equal(france);
    expect(board.first(Country, 'france')!.rival).to.equal(england);
    expect(board.first(Country, 'france')!.general).to.equal(napolean);
  });

  it('handles cyclical serializable attributes', () => {
    class Country extends Space<Player> {
      general?: General;
    }
    class General extends Piece<Player> {
      country?: Country;
    }
    board._ctx.classRegistry = [Space, Piece, GameElement, Country, General];

    const map = board.create(Space, 'map', {});
    const france = map.create(Country, 'france');
    const napolean = france.create(General, 'napolean', { country: france });
    france.general = napolean;
    const json = board.allJSON(1);
    board.fromJSON(JSON.parse(JSON.stringify(json)));
    expect(board.allJSON(1)).to.deep.equals(json);
    expect(board.first(Country, 'france')).to.equal(france);
    expect(board.first(Country, 'france')!.general?.name).to.equal('napolean');
    expect(board.first(Country, 'france')!.general?.country).to.equal(france);
  });

  it('understands branches', () => {
    const map = board.create(Space, 'map', {});
    const france = map.create(Space, 'france', {});
    const england = map.create(Space, 'england', {});
    const play = board.create(Space, 'play', {});
    const piece1 = france.create(Piece, 'token1', { player: players[0] });
    const piece2 = france.create(Piece, 'token2', { player: players[1] });
    const piece3 = play.create(Piece, 'token3');
    expect(piece1.branch()).to.equal('0/0/0/0');
    expect(piece2.branch()).to.equal('0/0/0/1');
    expect(piece3.branch()).to.equal('0/1/0');
    expect(board.atBranch('0/0/0/0')).to.equal(piece1);
    expect(board.atBranch('0/0/0/1')).to.equal(piece2);
    expect(board.atBranch('0/1/0')).to.equal(piece3);
  });

  it('assigns and finds IDs', () => {
    const map = board.create(Space, 'map', {});
    const france = map.create(Space, 'france', {});
    const england = map.create(Space, 'england', {});
    const play = board.create(Space, 'play', {});
    const piece1 = france.create(Piece, 'token1', { player: players[0] });
    const piece2 = france.create(Piece, 'token2', { player: players[1] });
    const piece3 = play.create(Piece, 'token3');
    expect(piece1._t.id).to.equal(6);
    expect(piece2._t.id).to.equal(7);
    expect(piece3._t.id).to.equal(8);
    expect(board.atID(6)).to.equal(piece1);
    expect(board.atID(7)).to.equal(piece2);
    expect(board.atID(8)).to.equal(piece3);
  });

  it('clones', () => {
    const map = board.create(Space, 'map', {});
    const france = map.create(Space, 'france', {});
    const england = map.create(Space, 'england', {});
    const piece1 = france.create(Piece, 'token1', { player: players[0] });
    const piece2 = piece1.cloneInto(england);
    expect(piece1.player).to.equal(piece2.player);
    expect(piece1.name).to.equal(piece2.name);
    expect(england._t.children).to.include(piece2);
  });

  describe("Element subclasses", () => {
    class Card extends Piece<Player> {
      suit: string;
      pip: number = 1;
      flipped?: boolean = false;
      state?: string = 'initial';
    }

    beforeEach(() => {
      board._ctx.classRegistry.push(Card);
    });

    it('takes attrs', () => {
      board.create(Card, '2H', { suit: 'H', pip: 2 });
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 2 }
          ]},
        ]
      );
    });

    it('takes base attrs', () => {
      board.create(Card, '2H', { player: players[1], suit: 'H', pip: 2 });
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Card', flipped: false, state: 'initial', name: '2H', player: '$p[2]', suit: 'H', pip: 2, _id: 2 }
          ]},
        ]
      );
    });

    it('searches', () => {
      board.create(Card, 'AH', { suit: 'H', pip: 1 });
      board.create(Card, '2H', { suit: 'H', pip: 2 });
      board.create(Card, '3H', { suit: 'H', pip: 3 });
      const card = board.first(Card, {pip: 2});
      expect(card!.name).equals('2H');
      const card2 = board.first(Card, {pip: 4});
      expect(card2).equals(undefined);
      const card3 = board.first(Card, {pip: 2, suit: 'D'});
      expect(card3).equals(undefined);
      const cards = board.all(Card, c => c.pip >= 2);
      expect(cards.length).equals(2);
      expect(cards[0].name).equals('2H');
      expect(cards[1].name).equals('3H');
      const card4 = board.first("2H");
      expect(card4!.name).equals('2H');
    });

    it('searches undefined', () => {
      board.create(Card, 'AH', { suit: 'H', pip: 1, player: players[0] });
      board.create(Card, '2H', { suit: 'H', pip: 2, player: players[1] });
      const h3 = board.create(Card, '3H', { suit: 'H', pip: 3 });
      expect(board.first(Card, {player: undefined})).to.equal(h3);
    }),

    it('has', () => {
      board.create(Card, 'AH', { suit: 'H', pip: 1, player: players[0] });
      board.create(Card, '2H', { suit: 'H', pip: 2, player: players[1] });
      expect(board.has(Card, {pip: 2})).to.equal(true);
      expect(board.has(Card, {pip: 2, suit: 'C'})).to.equal(false);
    }),

    it('modifies', () => {
      board.create(Card, 'AH', { suit: 'H', pip: 1 });
      board.create(Card, '2H', { suit: 'H', pip: 2 });
      board.create(Card, '3H', { suit: 'H', pip: 3 });
      const card = board.first(Card, {pip: 2})!;
      card.suit = 'D';
      expect(card.suit).equals('D');
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 2 },
            { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'D', pip: 2, _id: 3 },
            { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 4 }
          ]},
        ]
      );
    });

    it('takes from pile', () => {
      board.create(Card, 'AH', { suit: 'H', pip: 1 });
      board.create(Card, '2H', { suit: 'H', pip: 2 });
      const pile = board._ctx.removed;
      const h3 = pile.create(Card, '3H', { suit: 'H', pip: 3 });

      expect(h3.branch()).to.equal('1/0');
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 2 },
            { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 3 },
          ]},
          { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 4 }
        ]
      );

      expect(board.all(Card).length).to.equal(2);
      expect(pile.all(Card).length).to.equal(1);
    });

    it('moves', () => {
      const deck = board.create(Space, 'deck');
      const discard = board.create(Space, 'discard');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.create(Card, '3H', { suit: 'H', pip: 3 });
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, children: [
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 },
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 }
            ]},
            { className: 'Space', name: 'discard', _id: 3}
          ]},
        ]
      );

      deck.lastN(2, Card).putInto(discard);
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, children: [
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 }
            ]},
            { className: 'Space', name: 'discard', _id: 3, children: [
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 }
            ]}
          ]},
        ]
      );
    });

    it('moves with stacking order', () => {
      const deck = board.create(Space, 'deck');
      const discard = board.create(Space, 'discard');
      deck.setOrder('stacking');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.create(Card, '3H', { suit: 'H', pip: 3 });
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, order: 'stacking', children: [
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 },
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 }
            ]},
            { className: 'Space', name: 'discard', _id: 3}
          ]},
        ]
      );

      deck.lastN(2, Card).putInto(discard);
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, order: 'stacking', children: [
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 }
            ]},
            { className: 'Space', name: 'discard', _id: 3, children: [
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 }
            ]}
          ]},
        ]
      );

      discard.all(Card).putInto(deck);
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, order: 'stacking', children: [
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 },
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 }
            ]},
            { className: 'Space', name: 'discard', _id: 3}
          ]},
        ]
      );
    });

    it('moves fromTop', () => {
      const deck = board.create(Space, 'deck');
      const discard = board.create(Space, 'discard');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.create(Card, '3H', { suit: 'H', pip: 3 });
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, children: [
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 },
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 }
            ]},
            { className: 'Space', name: 'discard', _id: 3}
          ]},
        ]
      );

      deck.lastN(2, Card).putInto(discard, {fromTop: 0});
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, children: [
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 }
            ]},
            { className: 'Space', name: 'discard', _id: 3, children: [
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 },
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 }
            ]}
          ]},
        ]
      );
    });

    it('tracks movement', () => {
      const deck = board.create(Space, 'deck');
      const discard = board.create(Space, 'discard');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.create(Card, '3H', { suit: 'H', pip: 3 });
      const json = board.allJSON();
      board._ctx.trackMovement = true;
      board.fromJSON(json);

      deck.lastN(2, Card).putInto(discard);
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, children: [
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4, was: '0/0/0' }
            ]},
            { className: 'Space', name: 'discard', _id: 3, children: [
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5, was: '0/0/1' },
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6, was: '0/0/2' }
            ]}
          ]},
        ]
      );
    });

    it("understands players", () => {
      const players1Mat = board.create(Space, 'mat', {player: players[0]});
      board.create(Space, 'mat', {player: players[1]});

      players1Mat.create(Card, 'player-1-card', { suit: 'H', pip: 1, player: players[0] });
      players1Mat.create(Card, 'player-2-card', { suit: 'H', pip: 1, player: players[1] });
      players1Mat.create(Card, 'neutral-card', { suit: 'H', pip: 2 });
      players[0].board = board;
      players[1].board = board;

      expect(() => board.all(Card, { mine: true })).to.throw;

      board._ctx.player = players[0];
      expect(board.all(Card, { mine: true }).length).to.equal(2);
      expect(board.all(Card, { mine: false }).length).to.equal(1);
      expect(board.all(Card, { owner: players[0] }).length).to.equal(2);
      expect(board.last(Card, { mine: true })!.name).to.equal('neutral-card');
      expect(board.first('neutral-card')!.owner).to.equal(players[0]);

      board._ctx.player = players[1];
      expect(board.all(Card, { mine: true }).length).to.equal(1);
      expect(board.all(Card, { owner: players[1] }).length).to.equal(1);
      expect(board.all(Card, { mine: false }).length).to.equal(2);

      expect(players[0].allMy(Card).length).to.equal(2);
      expect(players[1].allMy(Card).length).to.equal(1);
      expect(players[0].has(Card, {pip: 1})).to.equal(true);
      expect(players[0].has(Card, 'player-2-card')).to.equal(false);
      expect(players[0].has(Card, {pip: 2})).to.equal(true);
      expect(players[1].has(Card, {pip: 1})).to.equal(true);
      expect(players[1].has(Card, {pip: 2})).to.equal(false);
    });

    it("sorts", () => {
      const deck = board.create(Space, 'deck');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2C', { suit: 'C', pip: 2 });
      deck.create(Card, '3D', { suit: 'D', pip: 3 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });

      expect(board.all(Card).withHighest('pip')!.name).to.equal('3D');
      expect(board.all(Card).withHighest('suit')!.name).to.equal('AH');
      expect(board.all(Card).withHighest('suit', 'pip')!.name).to.equal('2H');
      expect(board.all(Card).withHighest(c => c.suit === 'D' ? 100 : 1)!.name).to.equal('3D');
      expect(board.all(Card).min('pip')).to.equal(1);
      expect(board.all(Card).max('pip')).to.equal(3);
      expect(board.all(Card).min('suit')).to.equal('C');
      expect(board.all(Card).max('suit')).to.equal('H');
    });

    it("shuffles", () => {
      const deck = board.create(Space, 'deck');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2C', { suit: 'C', pip: 2 });
      deck.create(Card, '3D', { suit: 'D', pip: 3 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.shuffle();
      expect(deck.first(Card)!.name).to.not.equal('AH');
    });

    it("isVisibleTo", () => {
      const card = board.create(Card, 'AH', { suit: 'H', pip: 1 });
      expect(card.isVisible()).to.equal(true);
      card.hideFromAll();
      expect(card.isVisible()).to.equal(false);
      expect(card.isVisibleTo(1)).to.equal(false);
      expect(card.isVisibleTo(2)).to.equal(false);
      card.showTo(1);
      expect(card.isVisibleTo(1)).to.equal(true);
      expect(card.isVisibleTo(2)).to.equal(false);
      card.hideFrom(1);
      expect(card.isVisibleTo(1)).to.equal(false);
      expect(card.isVisibleTo(2)).to.equal(false);
      card.showToAll();
      expect(card.isVisibleTo(1)).to.equal(true);
      expect(card.isVisibleTo(2)).to.equal(true);
      card.hideFrom(1);
      expect(card.isVisibleTo(1)).to.equal(false);
      expect(card.isVisibleTo(2)).to.equal(true);
      card.showTo(1);
      expect(card.isVisibleTo(1)).to.equal(true);
      expect(card.isVisibleTo(2)).to.equal(true);
    });

    it("hides", () => {
      Card.revealWhenHidden('pip', 'flipped', 'state');
      const card = board.create(Card, 'AH', { suit: 'H', pip: 1 });
      card.showOnlyTo(1);
      expect(card.toJSON(1)).to.deep.equal(
        { className: 'Card', _id: 2, flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _visible: { default: false, except: [1] } },
      );
      expect(card.toJSON(2)).to.deep.equal(
        { className: 'Card', flipped: false, state: 'initial', pip: 1, _visible: { default: false, except: [1] } },
      )
      board.fromJSON(JSON.parse(JSON.stringify(board.allJSON(2))));
      const card3 = board.first(Card)!;
      expect(card3.pip).to.equal(1);
      expect(card3.suit).to.equal(undefined);
    });

    it("hides spaces", () => {
      const hand = board.create(Space, 'hand', { player: players[0] });
      hand.create(Card, 'AH', { suit: 'H', pip: 1 });
      hand.showOnlyTo(1);

      expect(hand.toJSON(1)).to.deep.equal(
        { className: 'Space', name: "hand", player: "$p[1]", _id: 2, _visible: { default: false, except: [1] }, children: [
          {className: 'Card', _id: 3, flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1},
        ]}
      );

      expect(hand.toJSON(2)).to.deep.equal(
        { className: 'Space', _id: 2, _visible: { default: false, except: [1] } }
      );
    });

    it("listens to add events", () => {
      const eventSpy = chai.spy();
      board.onEnter(Card, eventSpy);
      const card = board.create(Card, "AH", {suit: "H", pip: 1});
      expect(eventSpy).to.have.been.called.with(card)
    });

    it("listens to add events from moves", () => {
      const eventSpy = chai.spy();
      const deck = board.create(Space, 'deck');
      board.create(Space, 'discard');
      deck.onEnter(Card, eventSpy);
      const card = board.create(Card, "AH", {suit: "H", pip: 1});
      card.putInto(deck);
      expect(eventSpy).to.have.been.called.with(card)
    });

    it("listens to exit events from moves", () => {
      const eventSpy = chai.spy();
      const deck = board.create(Space, 'deck');
      board.create(Space, 'discard');
      deck.onExit(Card, eventSpy);
      const card = board.create(Card, "AH", {suit: "H", pip: 1});
      card.putInto(deck);
      expect(eventSpy).not.to.have.been.called()
      card.remove();
      expect(eventSpy).to.have.been.called.with(card)
    });

    it("preserves events in JSON", () => {
      const eventSpy = chai.spy();
      board.onEnter(Card, eventSpy);
      board.fromJSON(JSON.parse(JSON.stringify(board.allJSON())));
      board.create(Card, "AH", {suit: "H", pip: 1});
      expect(eventSpy).to.have.been.called()
    });
  });

  describe("graph", () => {
    it("adjacency", () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      a.connectTo(b);
      expect(a.isAdjacentTo(b)).to.equal(true);
      expect(a.isAdjacentTo(c)).to.equal(false);
      expect(a.others({ adjacent: true }).includes(b)).to.equal(true);
      expect(a.others({ adjacent: true }).includes(c)).to.not.equal(true);
    })

    it("calculates distance", () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      a.connectTo(b, 2);
      b.connectTo(c, 3);
      a.connectTo(c, 6);
      expect(a.distanceTo(c)).to.equal(5);
    })

    it("calculates closest", () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      a.connectTo(b, 2);
      b.connectTo(c, 3);
      a.connectTo(c, 6);
      expect(a.closest()).to.equal(b);
    })

    it("finds adjacencies", () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      const d = board.create(Space, 'd');
      a.connectTo(b, 2);
      b.connectTo(c, 3);
      a.connectTo(c, 6);
      c.connectTo(d, 1);
      expect(a.adjacencies()).to.deep.equal([b, c]);
      expect(a.others({ adjacent: true })).to.deep.equal([b, c]);
      expect(c.adjacencies()).to.deep.equal([a, b, d]);
      expect(c.others({ adjacent: true })).to.deep.equal([a, b, d]);
    })

    it("searches by distance", () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      const d = board.create(Space, 'd');
      a.connectTo(b, 2);
      b.connectTo(c, 3);
      a.connectTo(c, 6);
      c.connectTo(d, 1);
      expect(a.withinDistance(5).all(Space)).to.deep.equal([b,c]);
      expect(a.others({ withinDistance: 5}).length).to.equal(2);
    })
  });

  describe('grids', () => {
    class Cell extends Space<Player> { color: string }

    it('creates squares', () => {
      board = new Board({ classRegistry: [Space, Piece, GameElement, Cell] });
      board.createGrid({ rows: 3, columns: 3 }, Cell, 'cell');
      expect(board.all(Cell).length).to.equal(9);
      expect(board.first(Cell)!.row).to.equal(1);
      expect(board.first(Cell)!.column).to.equal(1);
      expect(board.last(Cell)!.row).to.equal(3);
      expect(board.last(Cell)!.column).to.equal(3);

      const corner = board.first(Cell, {row: 1, column: 1})!;
      expect(corner.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,2], [2,1]]);

      const middle = board.first(Cell, {row: 2, column: 2})!;
      expect(middle.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,2], [2,1], [2,3], [3,2]]);
    });

    it('creates squares with diagonals', () => {
      board = new Board({ classRegistry: [Space, Piece, GameElement, Cell] });
      board.createGrid({ rows: 3, columns: 3, diagonalDistance: 1.5 }, Cell, 'cell');
      expect(board.all(Cell).length).to.equal(9);
      expect(board.first(Cell)!.row).to.equal(1);
      expect(board.first(Cell)!.column).to.equal(1);
      expect(board.last(Cell)!.row).to.equal(3);
      expect(board.last(Cell)!.column).to.equal(3);

      const corner = board.first(Cell, {row: 1, column: 1})!;
      expect(corner.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,2], [2,1], [2,2]]);

      const knight = board.first(Cell, {row: 3, column: 2})!;
      expect(corner.distanceTo(knight)).to.equal(2.5);
    });

    it('creates hexes', () => {
      board = new Board({ classRegistry:  [Space, Piece, GameElement, Cell] });
      board.createGrid({ rows: 3, columns: 3, style: 'hex' }, Cell, 'cell');
      expect(board.all(Cell).length).to.equal(9);
      expect(board.first(Cell)!.row).to.equal(1);
      expect(board.first(Cell)!.column).to.equal(1);
      expect(board.last(Cell)!.row).to.equal(3);
      expect(board.last(Cell)!.column).to.equal(3);

      const corner = board.first(Cell, {row: 1, column: 1})!;
      expect(corner.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,2], [2,1], [2,2]]);

      const middle = board.first(Cell, {row: 2, column: 2})!;
      expect(middle.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,1], [1,2], [2,1], [2,3], [3,2], [3,3]]);
    });

    it('creates inverse hexes', () => {
      board = new Board({ classRegistry: [Space, Piece, GameElement, Cell] });
      board.createGrid({ rows: 3, columns: 3, style: 'hex-inverse' }, Cell, 'cell');
      expect(board.all(Cell).length).to.equal(9);
      expect(board.first(Cell)!.row).to.equal(1);
      expect(board.first(Cell)!.column).to.equal(1);
      expect(board.last(Cell)!.row).to.equal(3);
      expect(board.last(Cell)!.column).to.equal(3);

      const corner = board.first(Cell, {row: 1, column: 1})!;
      expect(corner.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,2], [2,1]]);

      const middle = board.first(Cell, {row: 2, column: 2})!;
      expect(middle.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,2], [1,3], [2,1], [2,3], [3,1], [3,2]]);
    });

    it('adjacencies', () => {
      board = new Board({ classRegistry: [Space, Piece, GameElement, Cell] });
      board.createGrid({ rows: 3, columns: 3 }, Cell, 'cell');
      for (const cell of board.all(Cell, {row: 2})) cell.color = 'red';
      const center = board.first(Cell, {row: 2, column: 2})!;
      expect(center.adjacencies(Cell).map(c => [c.row, c.column])).to.deep.equal([[1, 2], [2, 1], [2, 3], [3, 2]]);
      expect(center.adjacencies(Cell, {color: 'red'}).map(c => [c.row, c.column])).to.deep.equal([[2, 1], [2, 3]]);
      expect(center.isAdjacentTo(board.first(Cell, {row: 1, column: 2})!)).to.be.true;
      expect(center.isAdjacentTo(board.first(Cell, {row: 1, column: 1})!)).to.be.false;
    });
  });

  describe('placement', () => {
    it('creates squares', () => {
      board = new Board({ classRegistry: [Space, Piece] });
      const piece1 = board.create(Piece, 'piece-1', { row: 1, column: 1 });
      const piece2 = board.create(Piece, 'piece-2', { row: 1, column: 2 });
      const piece3 = board.create(Piece, 'piece-3', { row: 2, column: 2 });

      expect(piece1.adjacencies(Piece).length).to.equal(1);
      expect(piece1.adjacencies(Piece)[0]).to.equal(piece2);
      expect(piece2.adjacencies(Piece).length).to.equal(2);
      expect(piece2.adjacencies(Piece)).includes(piece1);
      expect(piece2.adjacencies(Piece)).includes(piece3);

      expect(piece2.isAdjacentTo(piece1)).to.equal(true);
      expect(piece2.isAdjacentTo(piece3)).to.equal(true);
      expect(piece1.isAdjacentTo(piece3)).to.equal(false);
    });
  });

  describe('layouts', () => {
    beforeEach(() => {
      board = new Board({ classRegistry: [Space, Piece, GameElement] });
      board.layout(GameElement, {
        margin: 0,
        gap: 0,
      });
    });

    it('applies', () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      const d = board.create(Space, 'd');
      board.applyLayouts();

      expect(board._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 100, height: 100 })
      expect(a._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 50, height: 50 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
    });

    it('applies overlaps', () => {
      const s1 = board.create(Space, 's1');
      const s2 = board.create(Space, 's2');
      const s3 = board.create(Space, 's3');
      const s4 = board.create(Space, 's4');
      const p1 = board.create(Piece, 'p1');
      const p2 = board.create(Piece, 'p2');
      const p3 = board.create(Piece, 'p3');
      const p4 = board.create(Piece, 'p4');
      board.applyLayouts(() => {
        board.layout(Piece, {
          rows: 3,
          columns: 3,
          direction: 'ltr'
        });
      });

      expect(p1._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 100 / 3, height: 100 / 3 })
      expect(p2._ui.computedStyle).to.deep.equal({ left: 100 / 3, top: 0, width: 100 / 3, height: 100 / 3 })
      expect(p3._ui.computedStyle).to.deep.equal({ left: 200 / 3, top: 0, width: 100 / 3, height: 100 / 3 })
      expect(p4._ui.computedStyle).to.deep.equal({ left: 0, top: 100 / 3, width: 100 / 3, height: 100 / 3 })
    });

    it('adds gaps and margins', () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      const d = board.create(Space, 'd');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          gap: 10,
          margin: 5
        });
      });
      expect(a._ui.computedStyle).to.deep.equal({ left: 5, top: 5, width: 40, height: 40 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 55, top: 5, width: 40, height: 40 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 5, top: 55, width: 40, height: 40 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 55, top: 55, width: 40, height: 40 })
    });

    it('adds gaps and margins absolutely to relative sizes', () => {
      const outer = board.createMany(4, Space, 'outer');
      const a = outer[3].create(Space, 'a');
      const b = outer[3].create(Space, 'b');
      const c = outer[3].create(Space, 'c');
      const d = outer[3].create(Space, 'd');
      board.applyLayouts(() => {
        outer[3].layout(GameElement, {
          gap: 4,
          margin: 2
        });
      });
      expect(a._ui.computedStyle).to.deep.equal({ left: 4, top: 4, width: 42, height: 42 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 54, top: 4, width: 42, height: 42 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 4, top: 54, width: 42, height: 42 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 54, top: 54, width: 42, height: 42 })
    });

    it('areas are relative to parent', () => {
      const outer = board.createMany(3, Space, 'outer');
      const a = outer[2].create(Space, 'a');
      const b = outer[2].create(Space, 'b');
      const c = outer[2].create(Space, 'c');
      const d = outer[2].create(Space, 'd');
      board.applyLayouts(() => {
        outer[2].layout(GameElement, {
          gap: 4,
          area: {
            left: 10,
            top: 20,
            width: 80,
            height: 60,
          }
        });
      });
      expect(a._ui.computedStyle).to.deep.equal({ left: 10, top: 20, width: 36, height: 26 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 54, top: 20, width: 36, height: 26 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 10, top: 54, width: 36, height: 26 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 54, top: 54, width: 36, height: 26 })
    });

    it('aligns', () => {
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          aspectRatio: 4 / 5,
          scaling: 'fit',
          alignment: 'right',
        });
      });

      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 60, top: 0, width: 40, height: 50 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 20, top: 0, width: 40, height: 50 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 60, top: 50, width: 40, height: 50 })
    });

    it('aligns vertical', () => {
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          aspectRatio: 5 / 4,
          scaling: 'fit',
          alignment: 'bottom right',
        });
      });

      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 50, top: 60, width: 50, height: 40 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 0, top: 60, width: 50, height: 40 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 50, top: 20, width: 50, height: 40 })
    });

    it('sizes to fit', () => {
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          aspectRatio: 4 / 5,
          scaling: 'fit'
        });
      });
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 10, top: 0, width: 40, height: 50 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 40, height: 50 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 10, top: 50, width: 40, height: 50 })
    });

    it('sizes to fill', () => {
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          aspectRatio: 4 / 5,
          scaling: 'fill'
        });
      });
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 50, height: 62.5 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 62.5 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 0, top: 37.5, width: 50, height: 62.5 })
    });

    it('retains sizes', () => {
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          size: { width: 20, height: 25 },
        });
      });
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 30, top: 25, width: 20, height: 25 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 50, top: 25, width: 20, height: 25 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 30, top: 50, width: 20, height: 25 })
    });

    it('fits based on aspect ratios', () => {
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          aspectRatio: 5 / 4,
          scaling: 'fit'
        });
      });
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 0, top: 10, width: 50, height: 40 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 50, top: 10, width: 50, height: 40 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 40 })
    });

    it('fills based on aspect ratios', () => {
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          aspectRatio: 5 / 4,
          scaling: 'fill'
        });
      });
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 62.5, height: 50 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 37.5, top: 0, width: 62.5, height: 50 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 62.5, height: 50 })
    });

    it('accommodate min row', () => {
      const spaces = board.createMany(10, Space, 'space');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          rows: { min: 2 },
          columns: 1,
          aspectRatio: 5 / 4,
          scaling: 'fill'
        });
      });
      expect(spaces[0]._ui.computedStyle?.width).to.equal(62.5);
      expect(spaces[0]._ui.computedStyle?.height).to.equal(50);
      expect(spaces[0]._ui.computedStyle?.top).to.be.approximately(0, 0.0001);
    });

    it('accommodate min col', () => {
      const spaces = board.createMany(10, Space, 'space');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          columns: { min: 2 },
          rows: 1,
          aspectRatio: 4 / 5,
          scaling: 'fill'
        });
      });
      expect(spaces[0]._ui.computedStyle?.height).to.equal(62.5);
      expect(spaces[0]._ui.computedStyle?.width).to.equal(50);
      expect(spaces[0]._ui.computedStyle?.left).to.be.approximately(0, 0.0001);
    });

    it('accommodate min row with size', () => {
      const spaces = board.createMany(10, Space, 'space');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          rows: { min: 2 },
          columns: 1,
          size: { width: 5, height: 4 },
          scaling: 'fill'
        });
      });
      expect(spaces[0]._ui.computedStyle?.width).to.equal(62.5);
      expect(spaces[0]._ui.computedStyle?.height).to.equal(50);
      expect(spaces[0]._ui.computedStyle?.top).to.be.approximately(0, 0.0001);
    });

    it('accommodate min columns with size', () => {
      const spaces = board.createMany(10, Space, 'space');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          columns: { min: 2 },
          rows: 1,
          size: { width: 4, height: 5 },
          scaling: 'fill'
        });
      });
      expect(spaces[0]._ui.computedStyle?.height).to.equal(62.5);
      expect(spaces[0]._ui.computedStyle?.width).to.equal(50);
      expect(spaces[0]._ui.computedStyle?.left).to.be.approximately(0, 0.0001);
    });

    it('isomorphic', () => {
      const spaces = board.createMany(9, Space, 'space');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          aspectRatio: 4 / 5,
          offsetColumn: {x: 100, y: 100},
          scaling: 'fit',
        });
      });

      expect(spaces[0]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 42, top: 0 });
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 58, top: 20 });
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 74, top: 40 });
      expect(spaces[3]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 26, top: 20 });
      expect(spaces[4]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 42, top: 40 });
      expect(spaces[5]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 58, top: 60 });
      expect(spaces[6]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 10, top: 40 });
      expect(spaces[7]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 26, top: 60 });
      expect(spaces[8]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 42, top: 80 });
    });

    it('stacks', () => {
      const spaces = board.createMany(9, Space, 'space');
      board.applyLayouts(() => {
        board.layout(GameElement, {
          aspectRatio: 4 / 5,
          offsetColumn: {x: -5, y: -5},
          scaling: 'fit',
          direction: 'ltr'
        });
      });

      expect(spaces[8]!._ui.computedStyle!.top).to.equal(0);
      expect(spaces[0]!._ui.computedStyle!.top + spaces[0]!._ui.computedStyle!.height).to.equal(100);
    });

    it('align+scale', () => {
      const pieces = board.createMany(6, Piece, 'piece');

      board.applyLayouts(() => {
        board.layout(Piece, {
          offsetColumn: {x: 10, y: 10},
          scaling: 'fit',
        });
      });

      expect(pieces[0]!._ui.computedStyle!.top).to.equal(0);
      expect(pieces[5]!._ui.computedStyle!.top + pieces[5]!._ui.computedStyle!.height).to.equal(100);
      expect(pieces[3]!._ui.computedStyle!.left).to.equal(0);
      expect(pieces[2]!._ui.computedStyle!.left + pieces[2]!._ui.computedStyle!.width).to.equal(100);
    });

    it('specificity', () => {
      class Country extends Space<Player> { }
      board = new Board({ classRegistry: [Space, Piece, GameElement, Country] });

      const spaces = board.createMany(4, Space, 'space');
      const space = board.create(Space, 'special');
      const france = board.create(Country, 'france');
      const special = board.create(Country, 'special');
      const el = board.create(GameElement, 'whatev');

      board.applyLayouts(() => {
        board.layout(spaces[2], { direction: 'btt-rtl', showBoundingBox: '1' });
        board.layout('special', { direction: 'ttb-rtl', showBoundingBox: '2' });
        board.layout(spaces.slice(0, 2), { direction: 'ttb', showBoundingBox: '3' });
        board.layout(Country, { direction: 'rtl', showBoundingBox: '4' });
        board.layout(Space, { direction: 'btt', showBoundingBox: '5' });
        board.layout(GameElement, { direction: 'ltr-btt', showBoundingBox: '6' });
      });

      expect(board._ui.computedLayouts?.[6].children).to.include(el); // by GameElement
      expect(board._ui.computedLayouts?.[5].children).contains(spaces[3]); // by Space
      expect(board._ui.computedLayouts?.[4].children).contains(france); // by more specific class
      expect(board._ui.computedLayouts?.[3].children).contains(spaces[0]); // by single ref
      expect(board._ui.computedLayouts?.[2].children).contains(space); // by name
      expect(board._ui.computedLayouts?.[2].children).contains(special); // by name
      expect(board._ui.computedLayouts?.[1].children).contains(spaces[2]); // by array ref
    });

    it('can place', () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      const d = board.create(Space, 'd');
      a.row = 2;
      a.column = 2;
      board.applyLayouts();

      expect(a._ui.computedStyle).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 50, height: 50 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
    });

    it('can shift bounds', () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      const d = board.create(Space, 'd');
      a.row = 4;
      a.column = 4;
      board.applyLayouts();

      expect(a._ui.computedStyle).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 50, height: 50 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
    });

    it('can shift negative', () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      const d = board.create(Space, 'd');
      a.row = -4;
      a.column = -4;
      board.applyLayouts();

      expect(a._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 50, height: 50 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
    });

    it('can stretch bounds', () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      const d = board.create(Space, 'd');
      a.row = 1;
      a.column = 2;
      d.row = 4;
      d.column = 2;
      board.applyLayouts();

      expect(a._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 100, height: 25 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 0, top: 25, width: 100, height: 25 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 100, height: 25 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 0, top: 75, width: 100, height: 25 })
    });

    it('can become sparse', () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      const d = board.create(Space, 'd');
      a.row = 4;
      a.column = 1;
      d.row = 1;
      d.column = 4;
      board.applyLayouts();

      expect(a._ui.computedStyle).to.deep.equal({ left: 0, top: 75, width: 25, height: 25 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 25, height: 25 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 25, top: 0, width: 25, height: 25 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 75, top: 0, width: 25, height: 25 })
    });

    it('can place sticky', () => {
      const a = board.create(Piece, 'a');
      const b = board.create(Piece, 'b');
      const c = board.create(Piece, 'c');
      const d = board.create(Piece, 'd');
      board.applyLayouts(() => {
        board.layout(Piece, { sticky: true });
      });
      a.remove();

      expect(b._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
    });
  });
});

      // console.log('<div style="width: 200; height: 200; position: relative; outline: 1px solid black">');
      // for (const c of board._t.children) console.log(`<div style="position: absolute; left: ${c._ui.computedStyle?.left}%; top: ${c._ui.computedStyle?.top}%; width: ${c._ui.computedStyle?.width}%; height: ${c._ui.computedStyle?.height}%; background: red; outline: 1px solid blue"></div>`);
      // console.log('</div>');
