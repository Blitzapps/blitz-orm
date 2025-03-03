// @ts-nocheck

/**
 * TS Helpers
 */
type NestedKeys<T> = T extends object
	? {
			[P in keyof T]-?: P extends string ? keyof T[P] : never;
		}[keyof T]
	: never;

type AllStateKeys<T> = NestedKeys<T> | keyof T;

/**
 * The debugging object contains an _onEnter method, wich can be set to invoke
 * this function on every transition.
 */
export const d: {
	_onEnter?: OnEnterFunction<Machine>;
} = {};

/**
 * The `createMachine` function creates a state machine. It takes an object of *states* with the key being the state name.
 * The value is usually *state* but might also be *invoke*.
 *
 * @param initial - Creates a machine that has *initial* as it's initial state.
 * @param states - An object of states, where each key is a state name, and the values are one of *state* or *invoke*.
 * @param context - A function that returns an object of extended state values. The function can receive an `event` argument.
 */
export function createMachine<S = {}, C = {}>(
	initial: keyof S,
	states: { [K in keyof S]: MachineState },
	context?: ContextFunction<C>,
): Machine<typeof states, C, AllStateKeys<S>>;
/**
 * The `createMachine` function creates a state machine. It takes an object of *states* with the key being the state name.
 * The value is usually *state* but might also be *invoke*.
 *
 * @param states - An object of states, where each key is a state name, and the values are one of *state* or *invoke*.
 * @param context - A function that returns an object of extended state values. The function can receive an `event` argument.
 */
export function createMachine<S = {}, C = {}>(
	states: { [K in keyof S]: MachineState },
	context?: ContextFunction<C>,
): Machine<typeof states, C, AllStateKeys<S>>;

/**
 * The `state` function returns a state object. A state can take transitions and immediates as arguments.
 *
 * @param args - Any argument needs to be of type Transition or Immediate.
 */
export function state(...args: (Transition | Immediate)[]): MachineState;

/**
 * A `transition` function is used to move from one state to another.
 *
 * @param event - This will give the name of the event that triggers this transition.
 * @param state - The name of the destination state.
 * @param args - Any extra argument will be evaluated to check if they are one of Reducer, Guard or Action.
 */
export function transition<C, E>(
	event: string,
	state: string,
	...args: (Reducer<C, E> | Guard<C, E> | Action<C, E>)[]
): Transition;

/**
 * An `immediate` function is a type of transition that occurs immediately; it doesn't wait for an event to proceed.
 * This is a state that immediately proceeds to the next.
 *
 * @param state - The name of the destination state.
 * @param args - Any extra argument will be evaluated to check if they are a Reducer or a Guard.
 */
export function immediate<C, E>(state: string, ...args: (Reducer<C, E> | Guard<C, E> | Action<C, E>)[]): Transition;

/**
 * A `guard` is a method that determines if a transition can proceed.
 * Returning true allows the transition to occur, returning false prevents it from doing so and leaves the state in its current place.
 *
 * @param guardFunction A Function that can receive *context* and *event* and will return true or false.
 */
export function guard<C, E>(guardFunction?: GuardFunction<C, E>): Guard<C, E>;

/**
 * A `reduce` takes a reducer function for changing the context of the machine. A common use case is to set values coming from form fields.
 *
 * @param reduceFunction A Function that can receive *context* and *event* and will return the context.
 */
export function reduce<C, E>(reduceFunction?: ReduceFunction<C, E>): Reducer<C, E>;

/**
 * An `action` function takes a function that will be run during a transition. The primary purpose of using action is to perform side-effects.
 *
 * @param actionFunction A Function that can receive *context* and *event*. Returned values are discarded.
 */
export function action<C, E>(actionFunction?: ActionFunction<C, E>): Action<C, E>;

/**
 * The `interpret` function takes a machine and creates a service that can send events into the machine, changing its states.
 * A service does not mutate a machine, but rather creates derived machines with the current state set.
 *
 * @param machine The state `machine`, created with *createMachine* to create a new service for.
 * @param onChange A callback that is called when the machine completes a transition. Even if the transition results in returning to the same state, the `onChange` callback is still called.
 * @param event The `event` can be any object. It is passed to the context function
 */
export function interpret<M extends Machine, E>(
	machine: M,
	onChange?: InterpretOnChangeFunction<typeof machine>,
	initialContext?: M['context'],
	event?: { [K in keyof E]: any },
): Service<typeof machine>;

/**
 * The `invoke` is a special type of state that immediately invokes a Promise-returning or Machine-returning function, or another machine.
 *
 * @param fn - Promise-returning function
 * @param args - Any argument needs to be of type Transition or Immediate.
 */
export function invoke<C, T, E extends {} = any>(
	fn: (ctx: C, e?: E) => Promise<T>,
	...args: (Transition | Immediate)[]
): MachineState;

/**
 * The `invoke` is a special type of state that immediately invokes a Promise-returning or Machine-returning function, or another machine.
 *
 * @param fn - Machine-returning function
 * @param args - Any argument needs to be of type Transition or Immediate.
 */
export function invoke<C, E extends {} = any, M extends Machine>(
	fn: (ctx: C, e?: E) => M,
	...args: (Transition | Immediate)[]
): MachineState;

/**
 * The `invoke` is a special type of state that immediately invokes a Promise-returning or Machine-returning function, or another machine.
 *
 * @param machine - Machine
 * @param args - Any argument needs to be of type Transition or Immediate.
 */
export function invoke<M extends Machine>(machine: M, ...args: (Transition | Immediate)[]): MachineState;

/* General Types */

export type ContextFunction<T> = (initialContext: T) => T;

export type GuardFunction<C, E> = (context: C, event: E) => boolean;

export type ActionFunction<C, E> = (context: C, event: E) => unknown;

export type ReduceFunction<C, E> = (context: C, event: E) => C;

export type InterpretOnChangeFunction<T extends Machine> = (service: Service<T>) => void;

export type SendEvent = string | { type: string; [key: string]: any };
export type SendFunction<T = SendEvent> = (event: T) => void;

/**
 * This function is invoked before entering a new state and is bound to the debug
 * object. It is usable to inspect or log changes.
 *
 * @param machine - Machine
 * @param to - name of the target state
 * @param state - current state
 * @param prevState - previous state
 * @param event - event provoking the state change
 */
export type OnEnterFunction<M extends Machine> = <C = M['state']>(
	machine: M,
	to: string,
	state: C,
	prevState: C,
	event?: SendEvent,
) => void;

export type Machine<S = {}, C = {}, K = string> = {
	context: C;
	current: K;
	states: S;
	state: {
		name: K;
		value: MachineState;
	};
};

export type Action<C, E> = {
	fn: ActionFunction<C, E>;
};

export type Reducer<C, E> = {
	fn: ReduceFunction<C, E>;
};

export type Guard<C, E> = {
	fn: GuardFunction<C, E>;
};

export interface MachineState {
	final: boolean;
	transitions: Map<string, Transition[]>;
	immediates?: Map<string, Immediate[]>;
	enter?: any;
}

export interface Transition {
	from: string | null;
	to: string;
	guards: any[];
	reducers: any[];
}

export interface Service<M extends Machine> {
	child?: Service<M>;
	machine: M;
	context: M['context'];
	onChange: InterpretOnChangeFunction<M>;
	send: SendFunction;
}

export type Immediate = Transition;

function valueEnumerable(value) {
	return { enumerable: true, value };
}

function valueEnumerableWritable(value) {
	return { enumerable: true, writable: true, value };
}

const truthy = () => true;
const empty = () => ({});
const identity = (a) => a;
const callBoth = (par, fn, self, args) => par.apply(self, args) && fn.apply(self, args);
const callForward = (par, fn, self, [a, b]) => fn.call(self, par.call(self, a, b), b);
const create = (a, b) => Object.freeze(Object.create(a, b));

function stack(fns, def, caller) {
	return fns.reduce((par, fn) => {
		return function (...args) {
			return caller(par, fn, this, args);
		};
	}, def);
}

function fnType(fn) {
	return create(this, { fn: valueEnumerable(fn) });
}

const reduceType = {};
export const reduce = fnType.bind(reduceType);
export const action = (fn) => reduce((ctx, ev) => !!~fn(ctx, ev) && ctx);

const guardType = {};
export const guard = fnType.bind(guardType);

function filter(Type, arr) {
	return arr.filter((value) => Type.isPrototypeOf(value));
}

function makeTransition(from, to, ...args) {
	const guards = stack(
		filter(guardType, args).map((t) => t.fn),
		truthy,
		callBoth,
	);
	const reducers = stack(
		filter(reduceType, args).map((t) => t.fn),
		identity,
		callForward,
	);
	return create(this, {
		from: valueEnumerable(from),
		to: valueEnumerable(to),
		guards: valueEnumerable(guards),
		reducers: valueEnumerable(reducers),
	});
}

const transitionType = {};
const immediateType = {};
export const transition = makeTransition.bind(transitionType);
export const immediate = makeTransition.bind(immediateType, null);

function enterImmediate(machine, service, event) {
	return transitionTo(service, machine, event, this.immediates) || machine;
}

function transitionsToMap(transitions) {
	const m = new Map();
	for (const t of transitions) {
		if (!m.has(t.from)) {
			m.set(t.from, []);
		}
		m.get(t.from).push(t);
	}
	return m;
}

const stateType = { enter: identity };
export function state(...args) {
	const transitions = filter(transitionType, args);
	const immediates = filter(immediateType, args);
	const desc = {
		final: valueEnumerable(args.length === 0),
		transitions: valueEnumerable(transitionsToMap(transitions)),
	};
	if (immediates.length) {
		desc.immediates = valueEnumerable(immediates);
		desc.enter = valueEnumerable(enterImmediate);
	}
	return create(stateType, desc);
}

const invokeFnType = {
	enter(machine2, service, event) {
		const rn = this.fn.call(service, service.context, event);
		if (machine.isPrototypeOf(rn)) {
			return create(invokeMachineType, {
				machine: valueEnumerable(rn),
				transitions: valueEnumerable(this.transitions),
			}).enter(machine2, service, event);
		}
		rn.then((data) => service.send({ type: 'done', data })).catch((error) => service.send({ type: 'error', error }));
		return machine2;
	},
};
const invokeMachineType = {
	enter(machine, service, event) {
		service.child = interpret(
			this.machine,
			(s) => {
				service.onChange(s);
				if (service.child == s && s.machine.state.value.final) {
					delete service.child;
					service.send({ type: 'done', data: s.context });
				}
			},
			service.context,
			event,
		);
		if (service.child.machine.state.value.final) {
			const data = service.child.context;
			delete service.child;
			return transitionTo(service, machine, { type: 'done', data }, this.transitions.get('done'));
		}
		return machine;
	},
};
export function invoke(fn, ...transitions) {
	const t = valueEnumerable(transitionsToMap(transitions));
	return machine.isPrototypeOf(fn)
		? create(invokeMachineType, {
				machine: valueEnumerable(fn),
				transitions: t,
			})
		: create(invokeFnType, {
				fn: valueEnumerable(fn),
				transitions: t,
			});
}

const machine = {
	get state() {
		return {
			name: this.current,
			value: this.states[this.current],
		};
	},
};

export function createMachine(current, states, contextFn = empty) {
	if (typeof current !== 'string') {
		contextFn = states || empty;
		states = current;
		current = Object.keys(states)[0];
	}
	if (d._create) {
		d._create(current, states);
	}
	return create(machine, {
		context: valueEnumerable(contextFn),
		current: valueEnumerable(current),
		states: valueEnumerable(states),
	});
}

function transitionTo(service, machine, fromEvent, candidates) {
	const { context } = service;
	for (const { to, guards, reducers } of candidates) {
		if (guards(context, fromEvent)) {
			service.context = reducers.call(service, context, fromEvent);

			const original = machine.original || machine;
			const newMachine = create(original, {
				current: valueEnumerable(to),
				original: { value: original },
			});

			if (d._onEnter) {
				d._onEnter(machine, to, service.context, context, fromEvent);
			}
			const state = newMachine.state.value;
			service.machine = newMachine;
			service.onChange(service);
			return state.enter(newMachine, service, fromEvent);
		}
	}
}

function send(service, event) {
	const eventName = event.type || event;
	const { machine } = service;
	const { value: state, name: currentStateName } = machine.state;

	if (state.transitions.has(eventName)) {
		return transitionTo(service, machine, event, state.transitions.get(eventName)) || machine;
	} else {
		if (d._send) {
			d._send(eventName, currentStateName);
		}
	}
	return machine;
}

const service = {
	send(event) {
		send(this, event);
	},
};

export function interpret(machine, onChange, initialContext, event) {
	const s = Object.create(service, {
		machine: valueEnumerableWritable(machine),
		context: valueEnumerableWritable(machine.context(initialContext, event)),
		onChange: valueEnumerable(onChange),
	});
	s.send = s.send.bind(s);
	s.machine = s.machine.state.value.enter(s.machine, s, event);
	return s;
}
