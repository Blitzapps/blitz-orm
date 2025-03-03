import type { ContentTypeMapping } from '.';

type ContentTypeToType<C extends keyof ContentTypeMapping> = ContentTypeMapping[C];

type HandleCardinality<T, C extends 'ONE' | 'MANY'> = C extends 'MANY' ? T[] : T;

type ContentTypeAndCardinality = { contentType: keyof ContentTypeMapping; cardinality: 'ONE' | 'MANY' };
type ForDataField = { path: string; contentType: keyof ContentTypeMapping; cardinality: 'ONE' | 'MANY' };
type ForLinkField = { path: string; cardinality: 'ONE' | 'MANY' };
type ForRoleFIeld = { cardinality: 'ONE' | 'MANY' };
type BaseSchemaEntity = {
  dataFields: readonly ForDataField[];
  linkFields?: readonly ForLinkField[];
};
type BaseSchemaRelation = BaseSchemaEntity & {
  roles?: Record<string, ForRoleFIeld[]>;
};
type BaseSchema = BaseSchemaEntity | BaseSchemaRelation;

type FieldToType<F extends ContentTypeAndCardinality> = HandleCardinality<
  ContentTypeToType<F['contentType']>,
  F['cardinality']
>;
type ExtractDataFields<
  S extends {
    dataFields: readonly ForDataField[];
  },
> = {
  [K in S['dataFields'][number]['path']]?: FieldToType<Extract<S['dataFields'][number], { path: K }>>;
};

type ExtractLinkFields<S> = S extends { linkFields?: readonly ForLinkField[] }
  ? S['linkFields'] extends readonly ForLinkField[]
    ? {
        [K in S['linkFields'][number]['path']]?: HandleCardinality<
          string,
          Extract<S['linkFields'][number], { path: K }>['cardinality']
        >;
      }
    : ///for some reason is the only thing working, probably required in the linkFields too
      // eslint-disable-next-line @typescript-eslint/ban-types
      Record<string, never>
  : ///for some reason is the only thing working, probably required in the linkFields too
    // eslint-disable-next-line @typescript-eslint/ban-types
    Record<string, never>;

type ExtractRoles<S> = 'roles' extends keyof S
  ? {
      [K in keyof S['roles']]?: S['roles'][K] extends { cardinality: 'ONE' | 'MANY' }
        ? HandleCardinality<string, S['roles'][K]['cardinality']>
        : never;
    }
  : ///for some reason is the only thing working, probably required in the linkFields too
    Record<string, never>;

export type TypeGen<S extends BaseSchema> = ExtractDataFields<S> & ExtractLinkFields<S> & ExtractRoles<S>;
