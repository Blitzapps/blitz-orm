import { EnrichedBqlQuery } from "../../adapters/surrealDB/types/base";
import { BormConfig, DBHandles, EnrichedBormSchema, ParsedBQLQuery, RawBQLQuery } from "../../types";
import { TqlRes } from "../mutation/TQL/parse";
import { createMachine, guard, interpret, invoke, reduce, state, transition } from "../robot3";
import { cleanQueryRes } from "./bql/clean";
import { enrichBQLQuery } from "./bql/enrich";
import { postHooks } from "./postHook";
import { buildTQLQuery } from "./tql/build";
import { parseTQLQuery } from "./tql/parse";
import { runTQLQuery } from "./tql/run";

type MachineContext = {
	bql: {
		raw: RawBQLQuery;
		current: EnrichedBqlQuery;
    res: any;
	};
	typeDB: {
		query: string | string[];
		res: TqlRes;
	};
	schema: EnrichedBormSchema;
	config: BormConfig;
	handles: DBHandles;
	error: string | null;
};

const updateBqlReq = (ctx: MachineContext, event: any) => {
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		bql: { ...ctx.bql, current: event.data },
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

const updateTqlReq = (ctx: MachineContext, event: any) => {
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		typeDB: { ...ctx.typeDB, query: event.data },
	};
};

const updateTqlRes = (ctx: MachineContext, event: any) => {
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		typeDB: { ...ctx.typeDB, res: event.data },
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
			transition('done', 'build', reduce(updateBqlReq)),
			errorTransition,
		),
    build: invoke(
      // @ts-expect-error Bad type
      async (ctx: MachineContext) => buildTQLQuery(ctx.bql.current, ctx.schema),
			transition('done', 'run', reduce(updateTqlReq)),
			errorTransition,
    ),
    run: invoke(
      // @ts-expect-error Bad type
      async (ctx: MachineContext) => runTQLQuery(ctx.handles, ctx.bql.current, ctx.typeDB.query, ctx.config),
			transition('done', 'parse', reduce(updateTqlRes)),
			errorTransition,
    ),
    parse: invoke(
      async (ctx: MachineContext) => parseTQLQuery({
        rawBqlRequest: ctx.bql.raw,
        // @ts-expect-error Bad type
        enrichedBqlQuery: ctx.bql.current,
        schema: ctx.schema,
        config: ctx.config,
        rawTqlRes: ctx.typeDB.res,
        isBatched: Array.isArray(ctx.typeDB.query),
      }),
			transition('done', 'postHooks', reduce(updateBqlRes)),
			errorTransition,
    ),
    postHooks: invoke(
      // @ts-expect-error Bad type
      async (ctx: MachineContext) => postHooks(ctx.schema, ctx.bql.current, ctx.bql.res),
			transition('done', 'clean', reduce(updateBqlRes)),
			errorTransition,
    ),
    clean: invoke(
      async (ctx: MachineContext) => cleanQueryRes(ctx.config, ctx.bql.res),
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
	bql: RawBQLQuery,
	schema: EnrichedBormSchema,
	config: BormConfig,
	handles: DBHandles,
) => {
	return awaitQueryMachine({
    // @ts-expect-error Bad type
		bql: {
			raw: bql,
      res: null,
		},
    // @ts-expect-error Bad type
		typeDB: {},
		schema: schema,
		config: config,
		handles: handles,
		error: null,
	});
};
