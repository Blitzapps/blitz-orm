import { isArray } from 'radash';
import { genId } from '../../../../helpers';
import type { BQLMutationBlock } from '../../../../types';

export const get$bzId = (node: BQLMutationBlock, thing?: string) => {
	if (node.$bzId) {
		return node.$bzId;
	}
	if (node.$tempId) {
		return node.$tempId;
	}
	// particular case, where we have a single $id, which is unique per $things so no need to generate multiple bzIds we can unify
	if (node.$id && !isArray(node.$id)) {
		return thing ? `SN_ONE_${thing}_${node.$id}` : `SN_ONE_${node.$id}`; //also we add prefix SN_ONE as we know is cardinality ONE
	}
	if (node.$id && isArray(node.$id)) {
		return thing ? `SN_MANY_${thing}_${genId()}` : `SN_MANY_${genId()}`; //also we add prefix SN_MANY as we know is cardinality MANY
	}

	return `SM_${genId()}`;
};
