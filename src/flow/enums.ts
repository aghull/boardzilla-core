/**
 * Functions for interrupting flows
 *
 * Three of these functions are for interrupting loops: `Do.break`, `Do.repear`,
 * and `Do.continue`. They can be called from anywhere inside a looping flow
 * ({@link loop}, {@link whileLoop}, {@link forLoop}, {@link forEach}, {@link
 * eachPlayer}) to interrupt the flow, with each one resuming the flow
 * differently.
 *
 * `Do.subflow` can be called anywhere and causes the flow to jump to another
 * subflow. When that subflow completes, the game flow will return to the
 * current flow, where it left off.
 *
 * `Do.break` causes the flow to exit loop and resume after the loop, like the
 * `break` keyword in Javascript.
 *
 * `Do.continue` causes the flow to skip the rest of the current loop iteration
 * and restart the loop at the next iteration, like the `continue` keyword in
 * Javascript.
 *
 * `Do.repeat` causes the flow to skip the rest of the current loop iteration
 * and restart the same iteration of the loop.
 *
 * @example
 * // each player can shout as many times as they like
 * eachPlayer({ name: 'player', do: (
 *   playerActions({ actions: [
 *     { name: 'shout', do: Do.repeat },
 *     'pass'
 *   ]}),
 * ]});
 *
 * // each player can decide to shout, and if so, may subsequently apologize
 * eachPlayer({ name: 'player', do: [
 *   playerActions({ actions: [
 *     { name: 'shout', do: Do.continue },  // if shouting, skip to the next player
 *     'pass'
 *   ]}),
 *   playerActions({ actions: [ 'apologize', 'pass' ] }),
 * ]});
 *
 * // each player can take a card but if the card is a match, it ends this round
 * eachPlayer({ name: 'player', do: (
 *   playerActions({ actions: [
 *     { name: 'takeCard', do: ({ takeCard }) => if (takeCard.card.isMatch()) Do.break() },
 *     'pass'
 *   ]}),
 * ]});
 *
 * @category Flow
 */
export const Do = {
  repeat: (loop?: string | Record<string, string>) => interrupt(InterruptControl.repeat, typeof loop === 'string' ? loop : undefined),
  continue: (loop?: string | Record<string, string>) => interrupt(InterruptControl.continue, typeof loop === 'string' ? loop : undefined),
  break: (loop?: string | Record<string, string>) => interrupt(InterruptControl.break, typeof loop === 'string' ? loop : undefined),
  subflow: (flow: string, args?: Record<string, any>) => interrupt(InterruptControl.subflow, {name: flow, args}),
}

/** @internal */
export const interruptSignal: {data?: any, signal: InterruptControl}[] = [];

function interrupt(signal: InterruptControl, data?: any) {
  if (signal === InterruptControl.subflow) {
    if (interruptSignal.every(s => s.signal === InterruptControl.subflow)) {
      interruptSignal.push({data, signal}); // subflows can be queued but will not override loop interrupt
    }
  } else {
    // loop interrupts cancel other signals
    interruptSignal.splice(0);
    interruptSignal[0] = {data, signal};
  }
}

/** @internal */
export enum InterruptControl {
  repeat = "__REPEAT__",
  continue = "__CONTINUE__",
  break = "__BREAK__",
  subflow = "__SUBFLOW__",
}

/** @internal */
export enum FlowControl {
  ok = "__OK__",
  complete = "__COMPLETE__"
}
