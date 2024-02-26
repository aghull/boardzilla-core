import Space from './space.js'
import { Action, Argument, ActionStub } from '../action/index.js';
import { deserializeObject } from '../action/utils.js';
import Flow from '../flow/flow.js';
import { n } from '../utils.js';

import type {
  default as GameElement,
  ElementJSON,
  ElementClass,
  ElementContext,
  Box,
  ElementUI,
} from './element.js';
import { Player, PlayerCollection } from '../player/index.js';
import {
  ActionStep,
  WhileLoop,
  ForEach,
  ForLoop,
  EachPlayer,
  EveryPlayer,
  IfElse,
  SwitchCase,
} from '../flow/index.js';
import type { FlowStep } from '../flow/flow.js';
import type { Serializable } from '../action/utils.js';

/**
 * Type for layout of player controls
 * @category UI
 */
export type ActionLayout = {
  /**
   * The element to which the controls will anchor themselves
   */
  element: GameElement,
  /**
   * Maximum width of the controls as a percentage of the anchor element
   */
  width?: number,
  /**
   * Maximum height of the controls as a percentage of the anchor element
   */
  height?: number,
  /**
   * Boardzilla will automatically anchor the controls to {@link GameElement}'s
   * selected as part of the action. Include the name of the selection here to
   * prevent that behaviour.
   */
  noAnchor?: string[],
  /**
   * Position of the controls
   * <ul>
   * <li>inset: Inside the element
   * <li>beside: To the left or right of the element
   * <li>stack: Above or below the element
   * </ul>
   */
  position?: 'inset' | 'beside' | 'stack'
  /**
   * Distance from the left edge of the anchor element as a percentage of the
   * element's width
   */
  left?: number,
  /**
   * Distance from the right edge of the anchor element as a percentage of the
   * element's width
   */
  right?: number,
  /**
   * Distance from the top edge of the anchor element as a percentage of the
   * element's height
   */
  center?: number,
  /**
   * Distance from the left edge of the anchor element to the center of the
   * controls as a percentage of the element's width
   */
  top?: number,
  /**
   * Distance from the bottom edge of the anchor element as a percentage of the
   * element's height
   */
  bottom?: number,
  /**
   * For `'beside'` or `'stack'`, `gap` is the distance between the controls and
   * the element as a percentage of the entire board's size.
   */
  gap?: number,
};

export type BoardSize = {
  name: string,
  aspectRatio: number,
  fixed?: 'landscape' | 'portrait'
};

/**
 * Base class for the game. Represents the current state of the game and
 * contains all game elements (spaces and pieces). All games contain a single
 * Game class that inherits from this class and on which custom properties and
 * methods for a specific game can be added.
 *
 * @category Board
 */
export default class Game<P extends Player<P, B> = any, B extends Game<P, B> = any> extends Space<P, B> {
  /**
   * An element containing all game elements that are not currently in
   * play. When elements are removed from the game, they go here, and can be
   * retrieved, using
   * e.g. `game.pile.first('removed-element').putInto('destination-area')`.
   * @category Structure
   */
  pile: GameElement<P>;

  /**
   * The players in this game. See {@link Player}
   * @category Definition
   */
  players: PlayerCollection<P> = new PlayerCollection<P>;

  /**
   * Use instead of Math.random to ensure random number seed is consistent when
   * replaying from history.
   * @category Definition
   */
  random: () => number;

  constructor(ctx: Partial<ElementContext<P, B>>) {
    super({ ...ctx, trackMovement: false });
    this.game = this as unknown as B; // ???
    this.random = ctx.gameManager?.random || Math.random;
    if (ctx.gameManager) this.players = ctx.gameManager.players;
    this._ctx.removed = this.createElement(Space<P, B>, 'removed'),
    this.pile = this._ctx.removed;
  }

  /**
   * This method must be called inside {@link createGame} with all custom Space
   * and Piece class declared in your game.
   * @category Definition
   */
  registerClasses(...classList: ElementClass[]) {
    this._ctx.classRegistry = this._ctx.classRegistry.concat(classList);
  }

  /**
   * Define your game's flow. May contain any of the following:
   * - {@link playerActions}
   * - {@link loop}
   * - {@link whileLoop}
   * - {@link forEach}
   * - {@link forLoop}
   * - {@link eachPlayer}
   * - {@link everyPlayer}
   * - {@link ifElse}
   * - {@link switchCase}
   * @category Definition
   */
  defineFlow(...flow: FlowStep<P>[]) {
    if (this._ctx.gameManager.phase !== 'new') throw Error('cannot call defineFlow once started');
    this._ctx.gameManager.flow = new Flow({ do: flow });
    this._ctx.gameManager.flow.gameManager = this._ctx.gameManager;
  }

  /**
   * Define your game's actions.
   * @param actions - An object consisting of actions where the key is the name
   * of the action and value is a function that accepts a player taking the
   * action and returns the result of calling {@link action} and chaining
   * choices, results and messages onto the result
   */
  defineActions(actions: Record<string, (player: P) => Action<P, Record<string, Argument<P>>>>) {
    if (this._ctx.gameManager.phase !== 'new') throw Error('cannot call defineActions once started');
    this._ctx.gameManager.actions = actions;
  }

  /**
   * Retrieve the selected setting value for a setting defined in {@link
   * render}.
   * @category Definition
   */
  setting(key: string) {
    return this._ctx.gameManager.settings[key];
  }

  /**
   * Create an {@link Action}. An action is a single move that a player can
   * take. Some actions require choices, sometimes several, before they can be
   * executed. Some don't have any choices, like if a player can simply
   * 'pass'. What defines where one action ends and another begins is how much
   * you as a player can decide before you "commit". For example, in chess you
   * select a piece to move and then a place to put it. These are a single move,
   * not separate. (Unless playing touch-move, which is rarely done in digital
   * chess.) In hearts, you pass 3 cards to another players. These are a single
   * move, not 3. You can change your mind as you select the cards, rather than
   * have to commit to each one. Similarly, other players do not see any
   * information about your choices until you actually commit the entire move.
   *
   * This function is called for each action in the game `actions` you define in
   * {@link defineActions}. These actions are initially declared with an optional
   * prompt and condition. Further information is added to the action by chaining
   * methods that add choices and behaviour. See {@link Action}.
   *
   * If this action accepts prior arguments besides the ones chosen by the
   * player during the execution of this action (especially common for {@link
   * followUp} actions) then a generic can be added for these arguments to help
   * Typescript type these parameters, e.g.:
   * `player => action<{ cards: number}>(...)`
   *
   * @param definition.prompt - The prompt that will appear for the player to
   * explain what the action does. Further prompts can be defined for each choice
   * they subsequently make to complete the action.
   *
   * @param definition.condition - A boolean or a function returning a boolean
   * that determines whether the action is currently allowed. Note that the
   * choices you define for your action will further determine if the action is
   * allowed. E.g. if you have a play card action and you add a choice for cards
   * in your hand, Boardzilla will automatically disallow this action if there
   * are no cards in your hand based on the face that there are no valid choices
   * to complete the action. You do not need to specify a `condition` for these
   * types of limitations. If using the function form, the function will receive
   * an object with any arguments passed to this action, e.g. from {@link
   * followUp}.
   *
   * @example
   * action({
   *   prompt: 'Flip one of your cards'
   * }).chooseOnBoard({
   *   choices: game.all(Card, {mine: true})
   * }).do(
   *   card => card.hideFromAll()
   * )
   *
   * @category Definition
   */
  action<A extends Record<string, Argument<P>> = NonNullable<unknown>>(definition: {
    prompt?: string,
    description?: string,
    condition?: Action<P, A>['condition'],
  } = {}) {
    return new Action<P, A>(definition);
  }

  /**
   * Queue up a follow-up action while processing an action. If called during
   * the processing of a game action, the follow-up action given will be added
   * as a new action immediately following the current one, before the game's
   * flow can resume normally. This is common for card games where the play of a
   * certain card may require more actions be taken.
   *
   * @param {Object} action - The action added to the follow-up queue.
   *
   * @example
   * defineAction({
   *   ...
   *   playCard: player => action()
   *     .chooseOnBoard('card', cards)
   *     .do(
   *       ({ card }) => {
   *         if (card.damage) {
   *           // this card allows another action to do damage to another Card
   *           game.followUp({
   *             name: 'doDamage',
   *             args: { amount: card.damage }
   *           });
   *         }
   *       }
   *     )
   * @category Game Management
   */
  followUp(action: ActionStub<P>) {
    this._ctx.gameManager.followups.push(action);
  }

  flowGuard = (): true => {
    if (this._ctx.gameManager.phase !== 'new') {
      throw Error('Cannot call playerActions once game has started. It is likely that this function is in the wrong place and must be called directly in defineFlow as a FlowDefinition');
    }
    return true;
  };

  /**
   * The flow commands available for this game. See:
   * - {@link playerActions}
   * - {@link loop}
   * - {@link whileLoop}
   * - {@link forEach}
   * - {@link forLoop}
   * - {@link eachPlayer}
   * - {@link everyPlayer}
   * - {@link ifElse}
   * - {@link switchCase}
   * @category Definition
   */
  flowCommands = {
    playerActions: (options: ConstructorParameters<typeof ActionStep<P>>[0]) => this.flowGuard() && new ActionStep<P>(options),
    loop: (...block: FlowStep<P>[]) => this.flowGuard() && new WhileLoop<P>({do: block, while: () => true}),
    whileLoop: (options: ConstructorParameters<typeof WhileLoop<P>>[0]) => this.flowGuard() && new WhileLoop<P>(options),
    forEach: <T extends Serializable<P>>(options: ConstructorParameters<typeof ForEach<P, T>>[0]) => this.flowGuard() && new ForEach<P, T>(options),
    forLoop: <T = Serializable<P>>(options: ConstructorParameters<typeof ForLoop<P, T>>[0]) => this.flowGuard() && new ForLoop<P, T>(options),
    eachPlayer: (options: ConstructorParameters<typeof EachPlayer<P>>[0]) => this.flowGuard() && new EachPlayer<P>(options),
    everyPlayer: (options: ConstructorParameters<typeof EveryPlayer<P>>[0]) => this.flowGuard() && new EveryPlayer<P>(options),
    ifElse: (options: ConstructorParameters<typeof IfElse<P>>[0]) => this.flowGuard() && new IfElse<P>(options),
    switchCase: <T extends Serializable<P>>(options: ConstructorParameters<typeof SwitchCase<P, T>>[0]) => this.flowGuard() && new SwitchCase<P, T>(options),
  };

  /**
   * End the game
   *
   * @param winner - a player or players that are the winners of the game. In a
   * solo game if no winner is provided, this is considered a loss.
   * @param announcement - an optional announcement from {@link render} to
   * replace the standard boardzilla announcement.
   * @category Game Management
   */
  finish(winner?: P | P[], announcement?: string) {
    this._ctx.gameManager.phase = 'finished';
    if (winner) this._ctx.gameManager.winner = winner instanceof Array ? winner : [winner];
    this._ctx.gameManager.announcements.push(announcement ?? '__finish__');
  }

  /**
   * Return array of game winners, or undefined if game is not yet finished
   * @category Game Management
   */
  getWinners() {
    let winner = this._ctx.gameManager.winner;
    if (!(winner instanceof Array)) winner = [winner];
    return this._ctx.gameManager.phase === 'finished' ? winner : undefined;
  }

  /**
   * Add a delay in the animation of the state change at this point for player
   * as they receive game updates.
   * @category Game Management
   */
  addDelay() {
    if (this.game._ctx.trackMovement) {
      this._ctx.gameManager.sequence += 1;
    } else if (this._ctx.gameManager.intermediateUpdates.length) {
      return; // even if not tracking, record one intermediate to allow UI to extract proper state to animate towards
    }
    this._ctx.gameManager.intermediateUpdates.push(this.players.map(
      p => this._ctx.gameManager.getState(p) // TODO unnecessary for all players if in context of player
    ));
    this.resetMovementTracking();
  }

  /**
   * Add a message that will be broadcast in the chat at the next game update,
   * based on the current state of the game.
   *
   * @param text - The text of the message to send. This can contain interpolated strings
   * with double braces, i.e. {{player}} that are defined in args. Of course,
   * strings can be interpolated normally using template literals. However game
   * objects (e.g. players or pieces) passed in as args will be displayed
   * specially by Boardzilla.
   *
   * @param args - AN object of key-value pairs of strings for interpolation in
   * the message.
   *
   * @example
   * game.message(
   *   '{{player}} has a score of {{score}}',
   *   { player, score: player.score() }
   * );
   */
  message(text: string, args?: Record<string, Argument<P>>) {
    this._ctx.gameManager.messages.push({body: n(text, args, true)});
  }

  /**
   * Broadcast a message to all players that interrupts the game and requires
   * dismissal before actions can be taken.
   *
   * @param announcement - The modal name to announce, as provided in {@link render}.
   *
   * @example
   * game.message(
   *   '{{player}} has a score of {{score}}',
   *   { player, score: player.score() }
   * );
   */
  announce(announcement: string) {
    this._ctx.gameManager.announcements.push(announcement);
    this.addDelay();
    this._ctx.gameManager.announcements = [];
  }

  // also gets removed elements
  allJSON(seenBy?: number): ElementJSON[] {
    return [this.toJSON(seenBy)].concat(
      this._ctx.removed._t.children.map(el => el.toJSON(seenBy))
    );
  }

  fromJSON(boardJSON: ElementJSON[]) {
    let { className, children, _id, order, ...rest } = boardJSON[0];
    if (this.constructor.name !== className) throw Error(`Cannot create board from JSON. ${className} must equal ${this.constructor.name}`);

    // reset all on self
    for (const key of Object.keys(this)) {
      if (!Game.unserializableAttributes.includes(key) && !(key in rest))
        rest[key] = undefined;
    }
    this.createChildrenFromJSON(children || [], '0');
    this._ctx.removed.createChildrenFromJSON(boardJSON.slice(1), '1');
    if (order) this._t.order = order;

    if (this._ctx.gameManager) rest = deserializeObject({...rest}, this);
    Object.assign(this, {...rest});
    this.assignAttributesFromJSON(children || [], '0');
    this._ctx.removed.assignAttributesFromJSON(boardJSON.slice(1), '1');
  }

  // UI

  _ui: ElementUI<this> & {
    boardSize: BoardSize,
    boardSizes?: (screenX: number, screenY: number, mobile: boolean) => BoardSize
    setupLayout?: (game: B, player: P, boardSize: string) => void;
    frame?: Box;
    disabledDefaultAppearance?: boolean;
    boundingBoxes?: boolean;
    stepLayouts: Record<string, ActionLayout>;
    previousStyles: Record<any, Box>;
    announcements: Record<string, (game: B) => JSX.Element>;
    infoModals: {
      title: string,
      condition?: (game: B) => boolean,
      modal: (game: B) => JSX.Element
    }[];
  } = {
    boardSize: {name: '_default', aspectRatio: 1},
    layouts: [],
    appearance: {},
    stepLayouts: {},
    previousStyles: {},
    announcements: {},
    infoModals: [],
  };

  // restore default layout rules before running setupLayout
  resetUI() {
    super.resetUI();
    this._ui.stepLayouts = {};
    this._ui.previousStyles ||= {};
  }

  setBoardSize(this: B, boardSize: BoardSize) {
    if (boardSize.name !== this._ui.boardSize.name) {
      this._ui.boardSize = boardSize;
    }
  }

  getBoardSize(screenX: number, screenY: number, mobile: boolean) {
    return this._ui.boardSizes && this._ui.boardSizes(screenX, screenY, mobile) || { name: '_default', aspectRatio: 1 };
  }

  applyLayouts(this: B, base?: (b: B) => void) {
    this.resetUI();
    if (this._ui.setupLayout) {
      this._ui.setupLayout(this, this._ctx.player!, this._ui.boardSize.name);
    }
    if (base) base(this);

    const aspectRatio = this._ui.boardSize.aspectRatio;
    this._ui.frame = {
      left: 0,
      top: 0,
      width: aspectRatio < 1 ? aspectRatio * 100 : 100,
      height: aspectRatio > 1 ? 100 / aspectRatio : 100
    };
    return super.applyLayouts();
  }

  /**
   * Apply default layout rules for all the placement of all player prompts and
   * choices, in relation to the board
   *
   * @param attributes - see {@link ActionLayout}
   *
   * @category UI
   */
  layoutControls(attributes: ActionLayout) {
    this._ui.stepLayouts["*"] = attributes;
  }

  /**
   * Apply layout rules to a particular step in the flow, controlling where
   * player prompts and choices appear in relation to the board
   *
   * @param step - the name of the step as defined in {@link playerActions}
   * @param attributes - see {@link ActionLayout}
   *
   * @category UI
   */
  layoutStep(step: string, attributes: ActionLayout) {
    if (!this._ctx.gameManager.flow.getStep(step)) throw Error(`No such step: ${step}`);
    this._ui.stepLayouts["step:" + step] = attributes;
  }

  /**
   * Apply layout rules to a particular action, controlling where player prompts
   * and choices appear in relation to the board
   *
   * @param action - the name of the action as defined in {@link game#defineActions}
   * @param attributes - see {@link ActionLayout}
   *
   * @category UI
   */
  layoutAction(action: string, attributes: ActionLayout) {
    this._ui.stepLayouts["action:" + action] = attributes;
  }

  /**
   * Remove all built-in default appearance. If any elements have not been given a
   * custom appearance, this causes them to be hidden.
   *
   * @category UI
   */
  disableDefaultAppearance() {
    this._ui.disabledDefaultAppearance = true;
  }

  /**
   * Show bounding boxes around every layout
   *
   * @category UI
   */
  showLayoutBoundingBoxes() {
    this._ui.boundingBoxes = true;
  }
}
