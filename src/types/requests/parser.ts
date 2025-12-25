import { z } from 'zod/v4';

export const BQLFilterValueParser = z.json();

export type BQLFilterValue = z.infer<typeof BQLFilterValueParser>;

export const BQLFilterValueListParser = z.array(BQLFilterValueParser);

export type BQLFilterValueList = z.infer<typeof BQLFilterValueListParser>;

export type BQLFilter = {
  // Logic Operators
  $and?: BQLFilter;
  $or?: BQLFilter;
  $not?: BQLFilter;
  // Catch-all for fields or custom keys
  [key: string]: BQLFilterValue | BQLFilterValueList | NestedBQLFilter | undefined;
};

export interface NestedBQLFilter extends BQLFilter {
  // Scalar Operators
  $eq?: BQLFilterValue;
  $neq?: BQLFilterValue;
  $gt?: BQLFilterValue;
  $lt?: BQLFilterValue;
  $gte?: BQLFilterValue;
  $lte?: BQLFilterValue;
  $contains?: BQLFilterValue;
  $containsNot?: BQLFilterValue;
  // List Operators
  $in?: BQLFilterValueList;
  $nin?: BQLFilterValueList;
  $containsAll?: BQLFilterValueList;
  $containsAny?: BQLFilterValueList;
  $containsNone?: BQLFilterValueList;
};

export const StrictBQLValueFilterParser = z.strictObject({
  $eq: BQLFilterValueParser.optional(),
  $neq: BQLFilterValueParser.optional(),
  $gt: BQLFilterValueParser.optional(),
  $lt: BQLFilterValueParser.optional(),
  $gte: BQLFilterValueParser.optional(),
  $lte: BQLFilterValueParser.optional(),
  $contains: BQLFilterValueParser.optional(),
  $containsNot: BQLFilterValueParser.optional(),
  $in: BQLFilterValueListParser.optional(),
  $nin: BQLFilterValueListParser.optional(),
  $containsAll: BQLFilterValueListParser.optional(),
  $containsAny: BQLFilterValueListParser.optional(),
  $containsNone: BQLFilterValueListParser.optional(),
});

export const BQLFilterParser: z.ZodType<BQLFilter> = z.lazy(() =>
  z.object({
    // Recursive Operators
    $and: z.lazy(() => BQLFilterParser).optional(),
    $or: z.lazy(() => BQLFilterParser).optional(),
    $not: z.lazy(() => BQLFilterParser).optional(),
  }).catchall(
    // "Everything else" (Custom fields)
    z.union([
      BQLFilterValueParser,
      BQLFilterValueListParser,
      z.lazy(() => NestedBQLFilterParser),
    ])
  )
);

export const NestedBQLFilterParser: z.ZodType<NestedBQLFilter> = z.lazy(() =>
  z.object({
    // Recursive Operators
    $and: z.lazy(() => BQLFilterParser).optional(),
    $or: z.lazy(() => BQLFilterParser).optional(),
    $not: z.lazy(() => BQLFilterParser).optional(),
    // Scalar Value Operators
    $eq: BQLFilterValueParser.optional(),
    $neq: BQLFilterValueParser.optional(),
    $gt: BQLFilterValueParser.optional(),
    $lt: BQLFilterValueParser.optional(),
    $gte: BQLFilterValueParser.optional(),
    $lte: BQLFilterValueParser.optional(),
    $contains: BQLFilterValueParser.optional(),
    $containsNot: BQLFilterValueParser.optional(),
    // List Value Operators
    $in: BQLFilterValueListParser.optional(),
    $nin: BQLFilterValueListParser.optional(),
    $containsAll: BQLFilterValueListParser.optional(),
    $containsAny: BQLFilterValueListParser.optional(),
    $containsNone: BQLFilterValueListParser.optional(),
  }).catchall(
    // "Everything else" (Custom fields)
    z.union([
      BQLFilterValueParser,
      BQLFilterValueListParser,
      z.lazy(() => NestedBQLFilterParser),
    ])
  )
);

const BaseBQLParser = z.object({
  $id: z.union([z.string(), z.array(z.string())]).optional(),
  $filter: BQLFilterParser.optional(),
  $fields: z.array(z.union([z.string(), z.lazy(() => NestedBQLParser)])).optional(),
  $excludedFields: z.array(z.string()).optional(),
  $limit: z.number().optional(),
  $offset: z.number().optional(),
  $sort: z.array(
    z.union([
      z.object({
        field: z.string(),
        desc: z.boolean().optional(),
      }),
      z.string()
    ])
  ).optional(),
});

interface BaseBQL {
  $id?: string | string[];
  $filter?: BQLFilter;
  $fields?: (string | NestedBQL)[];
  $excludedFields?: string[];
  $limit?: number;
  $offset?: number;
  $sort?: ({ field: string; desc?: boolean } | string)[];
}

export const NestedBQLParser: z.ZodType<NestedBQL> = BaseBQLParser.extend({
  $path: z.string(),
  $as: z.string().optional(),
});

export interface NestedBQL extends BaseBQL {
  $path: string;
  $as?: string;
}

export type BQLField = string | NestedBQL;

export const BQLQueryParser = BaseBQLParser.extend({
  $thing: z.string().optional(),
  $entity: z.string().optional(),
  $relation: z.string().optional(),
})
  .superRefine((data, ctx) => {
    if (!data.$thing && !data.$entity && !data.$relation) {
      ctx.addIssue({
        code: 'custom',
        message: "Query must contain at least one of: $thing, $entity, or $relation",
        path: ["$thing"],
      });
    }
  })
  .transform((data) => {
    const { $thing, $entity, $relation, ...rest } = data;

    return {
      ...rest,
      $thing: $thing ?? $entity ?? $relation as string, // Guaranteed to exist by superRefine
    };
  });

export type BQLQuery = z.infer<typeof BQLQueryParser>;