import type { TypeGen } from '../../../src';
import type { typesSchema } from '../../mocks/generatedSchema';

export type UserType = TypeGen<typeof typesSchema.entities.User>;
export type KindType = TypeGen<typeof typesSchema.relations.Kind>;
