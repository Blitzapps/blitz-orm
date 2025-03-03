import { isObject } from 'radash';
import { getSchemaByThing } from '../../../../helpers';
import type {
  BQLResponse,
  BormConfig,
  DBHandles,
  EnrichedBQLMutationBlock,
  EnrichedBormEntity,
  EnrichedBormRelation,
  EnrichedBormSchema,
  EnrichedDataField,
  EnrichedLinkField,
  EnrichedRoleField,
  FilledBQLMutationBlock,
} from '../../../../types';
import { DBNode } from '../../../../types/symbols';
import { runQueryMachine } from '../../../query/queryMachine';

export const preHookDependencies = async (
  blocks: EnrichedBQLMutationBlock | EnrichedBQLMutationBlock[],
  schema: EnrichedBormSchema,
  config: BormConfig,
  dbHandles: DBHandles,
) => {
  const mutations = Array.isArray(blocks) ? blocks : [blocks];
  const transformationPreQueryReq = mutations.map((m) => mutationToQuery(m, true));
  const res = await runQueryMachine(
    // @ts-expect-error todo
    transformationPreQueryReq,
    schema,
    config,
    dbHandles,
  );
  const transformationPreQueryRes = res.bql.res as BQLResponse[];
  return mutations.map((mut, i) => {
    const thing = getSchemaByThing(schema, mut.$thing);
    return setDbNode({
      mut: mut as Mutation,
      node: transformationPreQueryRes[i] as DbValue,
      schema,
      thing,
    });
  });
};

const FORBIDDEN_ROOT_QUERY_PROP = new Set(['$op', '$bzId', '$parentKey']);
const FORBIDDEN_SUB_QUERY_PROP = new Set(['$relation', '$entity', '$id', ...FORBIDDEN_ROOT_QUERY_PROP]);

type FieldQuery = string | { $path: string; $fields?: FieldQuery[] };

const mutationToQuery = (block: FilledBQLMutationBlock, root: boolean) => {
  const $fields: Record<string, FieldQuery> = {};
  block.$fields?.forEach((f: any) => {
    if (typeof f === 'string') {
      $fields[f] = f;
    } else {
      $fields[f.$path] = f;
    }
  });
  const filteredBlock: { $fields?: FieldQuery[]; [k: `$${string}`]: any } = {};

  for (const k in block) {
    if (FORBIDDEN_ROOT_QUERY_PROP.has(k)) {
      continue;
    }
    if (FORBIDDEN_SUB_QUERY_PROP.has(k) && !root) {
      continue;
    }
    const v = block[k];
    if (k.startsWith('$')) {
      filteredBlock[k as `$${string}`] = v;
    } else if (Array.isArray(v)) {
      // NOTE: If a link/role field mutation is an array, we only look at the first mutation block.
      // Each mutation block may have totally different structures.
      if (v[0] && typeof v[0] === 'object') {
        $fields[k] = {
          $path: k,
          ...mutationToQuery(v[0], false),
        };
      }
    } else if (isObject(v)) {
      $fields[k] = {
        $path: k,
        ...mutationToQuery(v as any, false),
      };
    }
  }

  filteredBlock.$fields = Object.values($fields);

  return filteredBlock;
};

type Mutation = {
  $id: string;
  $fields?: FieldQuery[];
} & {
  [k: string]: string | number | null | Mutation | Mutation[];
};

type MutationWithDBNode = {
  $id: string;
  [DBNode]?: DbNode;
  [k: string]: string | number | null | MutationWithDBNode | MutationWithDBNode[];
};

const setDbNode = (props: {
  mut: Mutation | Mutation[];
  node: DbValue | DbValue[];
  schema: EnrichedBormSchema;
  thing: EnrichedBormEntity | EnrichedBormRelation;
}) => {
  const { mut, node, schema, thing } = props;
  const fieldMap = getFieldMap(thing);
  const subNodeMap = getNodeMap(node);
  if (Array.isArray(mut)) {
    return mut.map((subMut) => {
      const subNode = subNodeMap[subMut.$id];
      if (!subNode) {
        return subMut;
      }
      return setDbNodeSingle({
        mut: subMut,
        node: subNode,
        schema,
        thing,
        ...fieldMap,
      });
    });
  }
  const subNode = subNodeMap[mut.$id];
  return setDbNodeSingle({
    mut,
    node: subNode,
    schema,
    thing,
    ...fieldMap,
  });
};

const setDbNodeSingle = (props: {
  mut: Mutation;
  node?: DbNode;
  schema: EnrichedBormSchema;
  thing: EnrichedBormEntity | EnrichedBormRelation;
  dataFieldMap: Record<string, EnrichedDataField>;
  linkFieldMap: Record<string, EnrichedLinkField>;
  roleFieldMap: Record<string, EnrichedRoleField>;
}) => {
  const { mut, node, schema, thing, dataFieldMap, linkFieldMap, roleFieldMap } = props;
  const { $fields: _, ..._mut } = mut;
  if (!node) {
    return _mut;
  }
  const dbNode = getDbNode({
    $fields: mut.$fields,
    node,
    schema,
    thing,
    dataFieldMap,
    linkFieldMap,
    roleFieldMap,
  });
  const newMut: MutationWithDBNode = { ..._mut, [DBNode]: dbNode };

  // Update sub-mutation that has pre-queried db node.
  for (const key in mut) {
    if (key.startsWith('$')) {
      continue;
    }
    const value = mut[key];
    const df = dataFieldMap[key];
    if (df || !value || typeof value !== 'object') {
      newMut[key] = value;
      continue;
    }
    const $thing = linkFieldMap[key]?.oppositeLinkFieldsPlayedBy?.[0]?.thing || roleFieldMap[key]?.playedBy?.[0]?.thing;
    if (!$thing) {
      throw new Error(`"${thing.name}" does not have field "${key}"`);
    }
    const subThing = getSchemaByThing(schema, $thing);
    newMut[key] = setDbNode({
      mut: value,
      schema,
      node: node[key],
      thing: subThing,
    });
  }

  return newMut;
};

type DbValue = string | number | boolean | null | DbNode;

type DbNode = {
  $id: string;
  [k: string]: DbValue | DbValue[];
};

/**
 * Extract the response of field queries from a superset query response.
 */
const getDbNode = (props: {
  $fields?: FieldQuery[];
  node: DbNode;
  schema: EnrichedBormSchema;
  thing: EnrichedBormEntity | EnrichedBormRelation;
  dataFieldMap: Record<string, EnrichedDataField>;
  linkFieldMap: Record<string, EnrichedLinkField>;
  roleFieldMap: Record<string, EnrichedRoleField>;
}) => {
  const { $fields, node, schema, thing, dataFieldMap, linkFieldMap, roleFieldMap } = props;
  const fields = $fields ? $fields : getAllFields(thing);
  const newNode: DbNode = { $id: node.$id };

  fields.forEach((f) => {
    const isObj = typeof f !== 'string';
    const key = isObj ? f.$path : f;
    const value = node[key];
    const df = dataFieldMap[key];
    if (df) {
      newNode[key] = value;
      return;
    }
    const $thing = linkFieldMap[key]?.oppositeLinkFieldsPlayedBy?.[0]?.thing || roleFieldMap[key]?.playedBy?.[0]?.thing;
    if (!$thing) {
      throw new Error(`"${thing.name}" does not have field "${key}"`);
    }
    if (!isObj) {
      if (value) {
        newNode[key] = Array.isArray(value) ? value.map(getIdFromDbValue) : getIdFromDbValue(value);
      }
      return;
    }
    const subThing = getSchemaByThing(schema, $thing);
    const fieldMap = getFieldMap(subThing);
    newNode[key] = Array.isArray(value)
      ? value.map((v) => getDbNodeFromDbValue({ ...fieldMap, $fields: f.$fields, value: v, schema, thing: subThing }))
      : getDbNodeFromDbValue({ ...fieldMap, $fields: f.$fields, value, schema, thing: subThing });
  });

  return newNode;
};

/**
 *  Get data field, link field, and role paths of a thing.
 */
const getAllFields = (thing: EnrichedBormEntity | EnrichedBormRelation): string[] => {
  const fields: string[] = [];
  thing.dataFields?.forEach((f) => {
    fields.push(f.path);
  });
  thing.linkFields?.forEach((f) => {
    fields.push(f.path);
  });
  if (thing.thingType === 'relation') {
    fields.push(...Object.keys(thing.roles));
  }
  return fields;
};

/**
 *  Throw an error if it's not an id(s) and doesn't contain prop $id.
 */
const getIdFromDbValue = (value: DbValue) => {
  if (typeof value === 'string') {
    return value;
  }
  if (!value || typeof value !== 'object') {
    throw new Error(`"${JSON.stringify(value)}" is neither an id nor an object with prop "$id"`);
  }
  if (typeof value.$id !== 'string') {
    throw new Error(`"${JSON.stringify(value)}" is does not have prop "$id"`);
  }
  return value.$id;
};

/**
 *  Throw an error if it's not a db node.
 */
const getDbNodeFromDbValue = (props: {
  $fields?: FieldQuery[];
  value: DbValue;
  schema: EnrichedBormSchema;
  thing: EnrichedBormEntity | EnrichedBormRelation;
  dataFieldMap: Record<string, EnrichedDataField>;
  linkFieldMap: Record<string, EnrichedLinkField>;
  roleFieldMap: Record<string, EnrichedRoleField>;
}) => {
  const { value } = props;
  if (!value || typeof value !== 'object' || !value.$id) {
    throw new Error(`"${JSON.stringify(props)}" is neither an id nor an object with prop "$id"`);
  }
  return getDbNode({ ...props, node: value });
};

const getFieldMap = (thing: EnrichedBormEntity | EnrichedBormRelation) => {
  const dataFieldMap = Object.fromEntries(thing.dataFields?.map((f) => [f.path, f]) || []);
  const linkFieldMap = Object.fromEntries(thing.linkFields?.map((f) => [f.path, f]) || []);
  const roleFieldMap = thing.thingType === 'relation' ? thing.roles || {} : {};
  return { dataFieldMap, linkFieldMap, roleFieldMap };
};

/**
 * Non-DbNode(s) are ignored.
 */
const getNodeMap = (value: DbValue | DbValue[]) => {
  if (!Array.isArray(value)) {
    if (value && typeof value === 'object' && value.$id) {
      return { [value.$id]: value };
    }
    return {};
  }

  const map: Record<string, DbNode> = {};

  value.forEach((v) => {
    if (!v || typeof v !== 'object' || !v.$id) {
      return;
    }
    map[v.$id] = v;
  });

  return map;
};
