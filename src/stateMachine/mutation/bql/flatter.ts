import { isArray, isSymbol } from 'radash';
import { parseValueSurrealDB } from '../../../adapters/surrealDB/parsing/values';
import { getCurrentFields, oFilter } from '../../../helpers';
import type { BormOperation, EnrichedBormSchema, EnrichedBQLMutationBlock, EnrichedLinkField } from '../../../types';
import { Parent } from '../../../types/symbols';

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
  //console.log('>>> flattenBQLMutation', JSON.stringify({ tree, schema }));
  const result: FlatBqlMutation = {
    things: [],
    edges: [],
    arcs: [],
    references: [],
  };

  const traverse = (
    block: EnrichedBQLMutationBlock,
    parent?: { bzId: string; edgeField: string; tempId?: string },
  ): void => {
    if (!block?.$thing) {
      //console.log('block without $thing', block);
      //this for instance happens in flexValues inside refFields
      return;
    }
    const { $op, $bzId, $tempId } = block;

    const currentSchema = schema.relations[block.$thing] || schema.entities[block.$thing];
    if (!currentSchema) {
      throw new Error(`[Internal] No schema found for ${block.$thing}`);
    }

    const parentObj = parent?.bzId ? parent : { bzId: '', edgeField: 'root' };

    //const { idFields } = currentSchema;
    const { usedDataFields, usedLinkFields, usedRoleFields, usedRefFields } = getCurrentFields(currentSchema, block);

    //const isOne = $op === 'create' || !isArray($id);

    //1. THINGS
    if (['create', 'update', 'delete', 'link', 'unlink', 'match', 'replace'].includes($op)) {
      const thing = {
        ...oFilter(block, (k: string) => ![...usedRoleFields, ...usedLinkFields, ...usedRefFields].includes(k)),
        ...($op === 'link' || $op === 'unlink' || $op === 'replace' || ($op === 'update' && usedDataFields.length === 0)
          ? { $op: 'match' }
          : {}),
        ...($op === 'link' || $op === 'replace' ? {} : { [Parent]: parentObj }), //links and replaces don't read from the parent but the entire table,
      } as EnrichedBQLMutationBlock;

      result.things.push(thing);
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

      for (const role of usedRoleFields) {
        //1 traverse them as well
        if (isArray(block[role])) {
          for (const child of block[role] as EnrichedBQLMutationBlock[]) {
            traverse(child, { bzId: $bzId, edgeField: role, tempId: $tempId });
          }
        } else {
          traverse(block[role], { bzId: $bzId, edgeField: role, tempId: $tempId });
        }

        //2 fill the arrays
        const edges = (isArray(block[role]) ? block[role] : [block[role]]).filter(
          Boolean,
        ) as EnrichedBQLMutationBlock[]; //pre-queries add some undefineds

        for (const [operation, opTypes] of Object.entries(operationMap)) {
          const filteredEdges = edges.filter((edge) => opTypes.includes(edge.$op)).map((edge) => edge.$bzId);

          if (filteredEdges.length > 0) {
            result.edges.push({
              ...edgeMeta,
              [role]: filteredEdges,
              $op: operation as BormOperation,
            });
          }
        }
      }
    }
    if (usedLinkFields) {
      for (const ulf of usedLinkFields) {
        //1 traverse them
        if (isArray(block[ulf])) {
          for (const child of block[ulf] as EnrichedBQLMutationBlock[]) {
            traverse(child, { bzId: $bzId, edgeField: ulf, tempId: $tempId });
          }
        } else {
          traverse(block[ulf], { bzId: $bzId, edgeField: ulf, tempId: $tempId });
        }

        //2 fill the arrays
        const edgeSchema = currentSchema.linkFields?.find((lf) => lf.path === ulf) as EnrichedLinkField;
        const edges = (isArray(block[ulf]) ? block[ulf] : [block[ulf]]) as EnrichedBQLMutationBlock[];
        //console.log('edges:', edges);

        //case 2.2 indirect edges
        if (edgeSchema.target === 'relation') {
          for (const [operation, opTypes] of Object.entries(operationMap)) {
            const filteredEdges = edges.filter((edge) => opTypes.includes(edge.$op));

            for (const edge of filteredEdges) {
              const edgeMeta = oFilter(
                edge,
                (k: string | symbol) => isSymbol(k) || k.startsWith('$'),
              ) as EnrichedBQLMutationBlock;

              result.edges.push({
                ...edgeMeta,
                [edgeSchema.plays]: $bzId,
                $op: operation as BormOperation,
              });
            }
          }
        }
        // 3. INFERRED EDGES
        if (edgeSchema.target === 'role') {
          const arcOperationMap = {
            create: ['link', 'create'],
            delete: ['unlink', 'delete'],
            replace: ['replace'],
          };

          for (const [operation, opTypes] of Object.entries(arcOperationMap)) {
            const filteredEdges = edges.filter((edge) => opTypes.includes(edge.$op));

            if (filteredEdges.length === 0) {
              continue;
            }

            for (const edge of filteredEdges) {
              const arc = {
                //technically is a multi-arc
                $thing: edgeSchema.relation,
                $thingType: 'relation' as const,
                $bzId: `arc_${edge.$bzId}`,
                [edgeSchema.plays]: $bzId,
                [edgeSchema.oppositeLinkFieldsPlayedBy[0].plays]: edge.$bzId,
                $op: operation as BormOperation,
              };

              result.arcs.push(arc);
            }
          }
        }
      }
    }
    if (usedRefFields) {
      for (const urf of usedRefFields) {
        //const { contentType } = currentSchema.refFields[urf];
        //1 traverse them to push the nested items
        if (isArray(block[urf])) {
          for (const child of block[urf] as EnrichedBQLMutationBlock[]) {
            traverse(child, { bzId: $bzId, edgeField: urf, tempId: $tempId });
          }
        } else {
          traverse(block[urf], { bzId: $bzId, edgeField: urf, tempId: $tempId });
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
          result.references.push({
            ...childMeta,
            [urf]: filteredChildren,
            $op: 'replace' as BormOperation, //Probably add / replace/ remove but lets do only replaces for now
          });
        }
      }
    }
  };

  const treeItems = Array.isArray(tree) ? tree : [tree];
  for (const item of treeItems) {
    traverse(item);
  }

  //order by $Op, first unlink, then link
  const orderedEdges = [...result.edges].sort((a, b) => {
    const order = ['unlink', 'link'];
    return order.indexOf(a.$op) - order.indexOf(b.$op);
  });

  //console.log('tree:', JSON.stringify(tree, null, 2));
  //console.log('flat:', JSON.stringify(result, null, 2));

  return {
    ...result,
    edges: orderedEdges,
  };
};
