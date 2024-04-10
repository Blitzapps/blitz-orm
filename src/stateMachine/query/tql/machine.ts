import { BormConfig, DBHandles, EnrichedBormSchema, ParsedBQLQuery, RawBQLQuery } from "../../../types";
import { createMachine, invoke, reduce, state, transition } from "../../robot3";
import { cleanQueryRes } from "../bql/clean";
import { parseTQLQuery } from "./parse";

type TypeDbMachineContext = {
	bql: {
		query: ParsedBQLQuery;
    res: any;
	};
	typeDB: {
		query: string | string[];
		res: any;
	};
	schema: EnrichedBormSchema;
	config: BormConfig;
	handles: DBHandles;
	error: string | null;
};

const updateBqlRes = (ctx: TypeDbMachineContext, event: any) => {
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		bql: { ...ctx.bql, res: event.data },
	};
};

const updateTqlReq = (ctx: TypeDbMachineContext, event: any) => {
	if (!event.data) {
		return ctx;
	}
	return {
		...ctx,
		typeDB: { ...ctx.typeDB, query: event.data },
	};
};

const updateTqlRes = (ctx: TypeDbMachineContext, event: any) => {
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
	reduce((ctx: TypeDbMachineContext, event: any) => {
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
      // @ts-expect-error Bad type
      async (ctx: TypeDbMachineContext) => buildTQLQuery(ctx.bql.current, ctx.schema),
			transition('done', 'run', reduce(updateTqlReq)),
			errorTransition,
    ),
    run: invoke(
      // @ts-expect-error Bad type
      async (ctx: TypeDbMachineContext) => runTQLQuery(ctx.handles, ctx.bql.current, ctx.typeDB.query, ctx.config),
			transition('done', 'parse', reduce(updateTqlRes)),
			errorTransition,
    ),
    parse: invoke(
      async (ctx: TypeDbMachineContext) => parseTQLQuery({
        enrichedBqlQuery: ctx.bql.query,
        schema: ctx.schema,
        config: ctx.config,
        rawTqlRes: ctx.typeDB.res,
      }),
			transition('done', 'postHooks', reduce(updateBqlRes)),
			errorTransition,
    ),
    postHooks: invoke(
      // @ts-expect-error Bad type
      async (ctx: TypeDbMachineContext) => postHooks(ctx.schema, ctx.bql.current, ctx.bql.res),
			transition('done', 'clean', reduce(updateBqlRes)),
			errorTransition,
    ),
    clean: invoke(
      async (ctx: TypeDbMachineContext) => cleanQueryRes(ctx.config, ctx.bql.res),
			transition('done', 'success', reduce(updateBqlRes)),
			errorTransition,
    ),
		success: state(),
		error: state(),
  },
  // @ts-expect-error Bad type
	(ctx: TypeDbMachineContext) => ctx,
);