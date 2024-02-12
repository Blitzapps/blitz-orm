import { capitalizeFirstLetter, getCurrentSchema } from '../../../../helpers';
import type { FilledBQLMutationBlock, Hooks, BormTrigger, Action, EnrichedBormSchema } from '../../../../types';

export const getTriggeredActions = (node: FilledBQLMutationBlock, schema: EnrichedBormSchema) => {
	const hooks = getCurrentSchema(schema, node).hooks as Hooks;
	if (hooks?.pre) {
		const currentEvent = `on${capitalizeFirstLetter(node.$op)}` as BormTrigger;
		const currentHooks = hooks.pre.filter((hook) => hook.triggers[currentEvent]?.());
		const actions = currentHooks.flatMap((hook) => hook.actions);
		return actions;
	}
	return [] as Action[];
};
