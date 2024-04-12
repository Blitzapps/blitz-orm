import { assertDefined } from "../../helpers";
import { BormConfig, DBHandles, EnrichedBormSchema, EnrichedBQLQuery, RawBQLQuery } from "../../types";
import { TqlRes } from "../mutation/TQL/parse";
import { createMachine, guard, interpret, invoke, reduce, state, transition } from "../robot3";
import { cleanQueryRes } from "./bql/clean";
import { enrichBQLQuery } from "./bql/enrich";
import { postHooks } from "./postHook";
import { buildTQLQuery } from "./tql/build";
import { runTypeDbQueryMachine } from "./tql/machine";
import { parseTQLQuery } from "./tql/parse";
import { runTQLQuery } from "./tql/run";

type MachineContext = {
	bql: {
		raw: RawBQLQuery[];
		queries?: EnrichedBQLQuery[];
    res?: any[]; // TODO
	};
	schema: EnrichedBormSchema;
	config: BormConfig;
	handles: DBHandles;
	error: string | null;
};

const updateBqlReq = (ctx: MachineContext, event: any) => {
  console.log('updateBqlReq', JSON.stringify(event));
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		bql: { ...ctx.bql, queries: event.data },
	};
};

const updateBqlRes = (ctx: MachineContext, event: any) => {
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		bql: { ...ctx.bql, res: event.data },
	};
};

const errorTransition = transition(
	'error',
	'error',
	reduce((ctx: MachineContext, event: any) => {
		return {
			...ctx,
			error: event.error,
		};
	}),
);

export const queryMachine = createMachine(
	'enrich',
  {
		enrich: invoke(
			async (ctx: MachineContext) => enrichBQLQuery(ctx.bql.raw, ctx.schema),
			transition('done', 'adapter', reduce(updateBqlReq)),
			errorTransition,
		),
    adapter: invoke(
      async (ctx: MachineContext) => {
        const res = await runTypeDbQueryMachine(
          ctx.bql.raw,
          assertDefined(ctx.bql.queries),
          ctx.schema,
          ctx.config,
          ctx.handles,
        );
        if (res.error) {
          throw new Error(res.error);
        }
        return res.bql.res;
      },
			transition('done', 'postHooks', reduce(updateBqlRes)),
			errorTransition,
    ),
    postHooks: invoke(
      async (ctx: MachineContext) => postHooks(ctx.schema, assertDefined(ctx.bql.queries), assertDefined(ctx.bql.res)),
			transition('done', 'clean', reduce(updateBqlRes)),
			errorTransition,
    ),
    clean: invoke(
      async (ctx: MachineContext) => cleanQueryRes(ctx.config, assertDefined(ctx.bql.res)),
			transition('done', 'success', reduce(updateBqlRes)),
			errorTransition,
    ),
		success: state(),
		error: state(),
  },
  // @ts-expect-error Bad type
	(ctx: MachineContext) => ctx,
);

export const awaitQueryMachine = async (context: MachineContext) => {
	return new Promise<MachineContext>((resolve, reject) => {
    // @ts-expect-error Bad type
		interpret(
			queryMachine,
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

export const runQueryMachine = async (
	bql: RawBQLQuery[],
	schema: EnrichedBormSchema,
	config: BormConfig,
	handles: DBHandles,
) => {
	return awaitQueryMachine({
		bql: {
			raw: bql,
		},
		schema: schema,
		config: config,
		handles: handles,
		error: null,
	});
};
