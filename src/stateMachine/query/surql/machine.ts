import { BormConfig, DBHandles, EnrichedBQLQuery, EnrichedBormSchema, RawBQLQuery } from "../../../types";
import { createMachine, invoke, reduce, state, transition } from "../../robot3";
import { buildTQLQuery } from "../tql/build";
import { build, buildSurrealDbQuery } from "./build";

export type SurrealDbMachineContext = {
	bql: {
    raw: RawBQLQuery[];
		queries: EnrichedBQLQuery[];
    res?: any[];
	};
  surql: {
    queries?: string[];
    res?: any[];
  };
	schema: EnrichedBormSchema;
	config: BormConfig;
	handles: DBHandles;
	error?: string | null;
};

const errorTransition = transition(
	'error',
	'error',
	reduce((ctx: SurrealDbMachineContext, event: any): SurrealDbMachineContext => {
		return {
			...ctx,
			error: event.error,
		};
	}),
);

export const typeDbQueryMachine = createMachine(
	'build',
  {
    build: invoke(
      (ctx: SurrealDbMachineContext) => build({ queries: ctx.bql.queries, schema: ctx.schema }),
			transition('done', 'run', reduce(() => {})),
			errorTransition,
    ),
    run: invoke(
      async
    ),
		success: state(),
		error: state(),
  },
  // @ts-expect-error Bad type
	(ctx: SurrealDbMachineContext) => ctx,
);

const awaitQueryMachine = async (context: SurrealDbMachineContext) => {
	return new Promise<SurrealDbMachineContext>((resolve, reject) => {
    // @ts-expect-error Bad type
		interpret(
			typeDbQueryMachine,
      // @ts-expect-error Bad type
			(service) => {
				if (service.machine.state.name === 'success') {
					resolve(service.context);
				}
				if (service.machine.state.name === 'error') {
					reject(service.context);
				}
			},
			context,
		);
	});
};

export const runTypeDbQueryMachine = async (
	bql: RawBQLQuery[],
  enrichedBql: EnrichedBQLQuery[],
	schema: EnrichedBormSchema,
	config: BormConfig,
	handles: DBHandles,
) => {
	return awaitQueryMachine({
		bql: {
			raw: bql,
      queries: enrichedBql,
		},
    surql: {},
		schema: schema,
		config: config,
		handles: handles,
		error: null,
	});
};