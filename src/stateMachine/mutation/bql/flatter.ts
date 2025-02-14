import type { BormOperation, EnrichedBormSchema, EnrichedBQLMutationBlock, EnrichedLinkField } from '../../../types';
import { getCurrentFields, oFilter } from '../../../helpers';
import { isArray, isSymbol } from 'radash';
import { Parent } from '../../../types/symbols';
import { parseValueSurrealDB } from '../../../adapters/surrealDB/parsing/values';

export type FlatBqlMutation = {
	things: EnrichedBQLMutationBlock[];
	edges: EnrichedBQLMutationBlock[];
	arcs: EnrichedBQLMutationBlock[];
	references: EnrichedBQLMutationBlock[];
};

export const flattenBQLMutation = (
	tree: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
	schema: EnrichedBormSchema,
): FlatBqlMutation => {
	const result: FlatBqlMutation = {
		things: [],
		edges: [],
		arcs: [],
		references: [],
	};

	const treeItems = Array.isArray(tree) ? tree : [tree];
	treeItems.forEach((item) => {
		if (item.id === 'mev_1gC2Zx4Ncp83lsLd4Lna6') {
			console.log('1');
		}
		traverse({ flatMutation: result, block: item, schema });
	});

	//order by $Op, first unlink, then link
	const orderedEdges = [...result.edges].sort((a, b) => {
		const order = ['unlink', 'link'];
		return order.indexOf(a.$op) - order.indexOf(b.$op);
	});

	return {
		...result,
		edges: orderedEdges,
	};
};

/**
 * Mutate `flatMutation`.
 */
const traverse = (params: {
	flatMutation: FlatBqlMutation;
	block: EnrichedBQLMutationBlock;
	parent?: { bzId: string; edgeField: string; tempId?: string };
	schema: EnrichedBormSchema;
}): void => {
	const { flatMutation, block, parent, schema } = params;
	if (!block?.$thing) {
		//this for instance happens in flexValues inside refFields
		return;
	}
	const { $op, $bzId, $tempId } = block;

	const currentSchema = schema.relations[block.$thing] || schema.entities[block.$thing];
	if (!currentSchema) {
		throw new Error(`[Internal] No schema found for ${block.$thing}`);
	}

	const parentObj = parent?.bzId ? parent : { bzId: '', edgeField: 'root' };
	const { usedDataFields, usedLinkFields, usedRoleFields, usedRefFields } = getCurrentFields(currentSchema, block);

	//1. THINGS
	if (['create', 'update', 'delete', 'link', 'unlink', 'match', 'replace'].includes($op)) {
		const thing = {
			...oFilter(block, (k: string) => ![...usedRoleFields, ...usedLinkFields, ...usedRefFields].includes(k)),
			...($op === 'link' || $op === 'unlink' || $op === 'replace' || ($op === 'update' && usedDataFields.length === 0)
				? { $op: 'match' }
				: {}),
			...($op === 'link' || $op === 'replace' ? {} : { [Parent]: parentObj }), //links and replaces don't read from the parent but the entire table,
		} as EnrichedBQLMutationBlock;

		flatMutation.things.push(thing);
	}

	//2. EDGES
	// 2.1 Case one direct EDGES

	// left side is what happens in the edge, right side is the op in the children that creates that edge op
	const operationMap = {
		link: ['link', 'create'],
		unlink: ['unlink', 'delete'],
		replace: ['replace'],
	};

	if (usedRoleFields) {
		const edgeMeta = oFilter(
			block,
			(k: string | symbol) => isSymbol(k) || k.startsWith('$'),
		) as EnrichedBQLMutationBlock;

		usedRoleFields.forEach((role) => {
			//1 traverse them as well
			if (isArray(block[role])) {
				block[role].forEach((child: EnrichedBQLMutationBlock) => {
					if (child.id === 'mev_1gC2Zx4Ncp83lsLd4Lna6') {
						console.log('2');
					}
					traverse({ ...params, block: child, parent: { bzId: $bzId, edgeField: role, tempId: $tempId } });
				});
			} else {
				if (block[role].id === 'mev_1gC2Zx4Ncp83lsLd4Lna6') {
					console.log('3');
				}
				traverse({ ...params, block: block[role], parent: { bzId: $bzId, edgeField: role, tempId: $tempId } });
			}

			//2 fill the arrays
			const edges = (isArray(block[role]) ? block[role] : [block[role]]).filter(Boolean) as EnrichedBQLMutationBlock[]; //pre-queries add some undefineds

			Object.entries(operationMap).forEach(([operation, opTypes]) => {
				const filteredEdges = edges.filter((edge) => opTypes.includes(edge.$op)).map((edge) => edge.$bzId);

				if (filteredEdges.length > 0) {
					flatMutation.edges.push({
						...edgeMeta,
						[role]: filteredEdges,
						$op: operation as BormOperation,
					});
				}
			});
		});
	}

	if (usedLinkFields) {
		usedLinkFields.forEach((ulf) => {
			//1 traverse them
			if (isArray(block[ulf])) {
				block[ulf].forEach((child: EnrichedBQLMutationBlock) => {
					if (child.id === 'mev_1gC2Zx4Ncp83lsLd4Lna6') {
						console.log('4', usedLinkFields);
					}
					traverse({ ...params, block: child, parent: { bzId: $bzId, edgeField: ulf, tempId: $tempId } });
				});
			} else {
				if (block[ulf].id === 'mev_1gC2Zx4Ncp83lsLd4Lna6') {
					console.log('5');
				}
				traverse({ ...params, block: block[ulf], parent: { bzId: $bzId, edgeField: ulf, tempId: $tempId } });
			}

			//2 fill the arrays
			const edgeSchema = currentSchema.linkFields?.find((lf) => lf.path === ulf) as EnrichedLinkField;
			const edges = (isArray(block[ulf]) ? block[ulf] : [block[ulf]]) as EnrichedBQLMutationBlock[];
			//console.log('edges:', edges);

			//case 2.2 indirect edges
			if (edgeSchema.target === 'relation') {
				Object.entries(operationMap).forEach(([operation, opTypes]) => {
					const filteredEdges = edges.filter((edge) => opTypes.includes(edge.$op));

					filteredEdges.forEach((edge) => {
						const edgeMeta = oFilter(
							edge,
							(k: string | symbol) => isSymbol(k) || k.startsWith('$'),
						) as EnrichedBQLMutationBlock;

						flatMutation.edges.push({
							...edgeMeta,
							[edgeSchema.plays]: $bzId,
							$op: operation as BormOperation,
						});
					});
				});
			}
			// 3. INFERRED EDGES
			if (edgeSchema.target === 'role') {
				const arcOperationMap = {
					create: ['link', 'create'],
					delete: ['unlink', 'delete'],
					replace: ['replace'],
				};

				Object.entries(arcOperationMap).forEach(([operation, opTypes]) => {
					const filteredEdges = edges.filter((edge) => opTypes.includes(edge.$op));

					if (filteredEdges.length === 0) {
						return;
					}

					filteredEdges.forEach((edge) => {
						const arc = {
							//technically is a multi-arc
							$thing: edgeSchema.relation,
							$thingType: 'relation' as const,
							$bzId: `arc_${edge.$bzId}`,
							[edgeSchema.plays]: $bzId,
							[edgeSchema.oppositeLinkFieldsPlayedBy[0].plays]: edge.$bzId,
							$op: operation as BormOperation,
						};

						flatMutation.arcs.push(arc);
					});
				});
			}
		});
	}

	if (usedRefFields) {
		usedRefFields.forEach((urf) => {
			//1 traverse them to push the nested items
			if (isArray(block[urf])) {
				block[urf].forEach((child: EnrichedBQLMutationBlock) => {
					if (child.id === 'mev_1gC2Zx4Ncp83lsLd4Lna6') {
						console.log('6');
					}
					traverse({ ...params, block: child, parent: { bzId: $bzId, edgeField: urf, tempId: $tempId } });
				});
			} else {
				if (block[urf].id === 'mev_1gC2Zx4Ncp83lsLd4Lna6') {
					console.log('7');
				}
				traverse({ ...params, block: block[urf], parent: { bzId: $bzId, edgeField: urf, tempId: $tempId } });
			}

			//2 fill the arrays. We need this with refFields as well because in surrealdb we need to apply link operations at the end in case the order is incorrect
			const children = (isArray(block[urf]) ? block[urf] : [block[urf]]).filter(
				(x) => x !== null && x !== undefined,
			) as EnrichedBQLMutationBlock[];

			const childMeta = oFilter(
				block,
				(k: string | symbol) => isSymbol(k) || k.startsWith('$'),
			) as EnrichedBQLMutationBlock;

			const filteredChildren = children.map((child) =>
				child.$op ? `$⟨${child.$bzId}⟩` : parseValueSurrealDB(child, 'FLEX'),
			);

			if (filteredChildren.length > 0) {
				flatMutation.references.push({
					...childMeta,
					[urf]: filteredChildren,
					$op: 'replace' as BormOperation, //Probably add / replace/ remove byt lets do only replaces for now
				});
			}
		});
	}
};
