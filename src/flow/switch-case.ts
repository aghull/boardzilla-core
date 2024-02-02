import Flow from './flow.js';

import { serialize, deserialize } from '../action/utils.js';

import type { FlowArguments, FlowDefinition, FlowBranchNode, FlowStep } from './flow.js';
import type { Player } from '../player/index.js';
import type { Serializable } from '../action/utils.js';

export type SwitchCasePostion<T> = { index?: number, value?: T, default?: boolean }

export type SwitchCaseCases<P extends Player, T> = ({eq: T, do: FlowDefinition<P>} | {test: (a: T) => boolean, do: FlowDefinition<P>})[];

export default class SwitchCase<P extends Player, T extends Serializable<P>> extends Flow<P> {
  position: SwitchCasePostion<T>;
  switch: ((a: FlowArguments) => T) | T;
  cases: SwitchCaseCases<P, T>;
  default?: FlowDefinition<P>;
  type: FlowBranchNode<P>['type'] = "switch-case";

  constructor({ name, switch: switchExpr, cases, default: def }: {
    name?: string,
    switch: ((a: FlowArguments) => T) | T,
    cases: SwitchCaseCases<P, T>;
    default?: FlowDefinition<P>
  }) {
    super({ name });
    this.switch = switchExpr;
    this.cases = cases;
    this.default = def;
  }

  reset() {
    const test = (typeof this.switch === 'function') ? this.switch(this.flowStepArgs()) : this.switch;
    let position: typeof this.position = { index: -1, value: test }
    for (let c = 0; c != this.cases.length; c += 1) {
      const ca = this.cases[c];
      if ('test' in ca && ca.test(test) || ('eq' in ca && ca.eq === test)) {
        position.index = c;
        break;
      }
    }
    if (position.index === -1 && this.default) position.default = true;
    this.setPosition(position);
  }
  
  currentBlock() {
    if (this.position.default) return this.default;
    if (this.position.index !== undefined && this.position.index >= 0) {
      return this.cases[this.position.index].do;
    }
  }

  toJSON(forPlayer=true) {
    return {
      index: this.position.index,
      value: serialize<P>(this.position.value, forPlayer),
      default: !!this.position.default
    };
  }

  fromJSON(position: any) {
    return {
      index: position.index,
      value: deserialize(position.value, this.game),
      default: position.default,
    };
  }

  allSteps(): FlowDefinition<P> {
    const cases = this.cases.reduce<FlowStep<P>[]>((a, f) => a.concat(f.do ? ((f.do instanceof Array) ? f.do : [f.do]) : []), []);
    const defaultExpr = this.default ? ((this.default instanceof Array) ? this.default : [this.default]) : [];
    return cases.concat(defaultExpr);
  }

  toString(): string {
    return `switch-case${this.name ? ":" + this.name : ""} (${this.position.value}${this.block instanceof Array ? ', item #' + this.sequence: ''})`;
  }

  visualize() {
    let block: string | undefined = undefined;
    if (this.position.default) {
      block = 'default'
    } else if (this.position.index !== undefined && this.position.index >= 0) {
      const c = this.cases[this.position.index];
      block = String('eq' in c ? c.eq : c.test);
    }

    return this.visualizeBlocks({
      type: 'switchCase',
      blocks: Object.fromEntries(
        this.cases.map(c => [String('eq' in c ? c.eq : c.test), c.do instanceof Array ? c.do : [c.do]]).concat([
          this.default ? ['default', (this.default instanceof Array ? this.default : [this.default])] : []
        ])
      ) as Record<string, FlowStep<P>[]>,
      block,
      position: this.position?.value,
    });
  }
}
