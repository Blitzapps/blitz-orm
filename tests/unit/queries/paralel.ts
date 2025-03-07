import { it } from 'vitest';
import { createTest } from '../../helpers/createTest';

export const testParallelQuery = createTest('Query', (ctx) => {
  it('par1[parallel, unrelated, simple] Multiple parallel queries to different entities', async () => {
    await Promise.all([
      ctx.query({ $entity: 'User' }),
      ctx.query({ $entity: 'Space' }),
      ctx.query({ $relation: 'DataField' }),
    ]);
  });

  it('par2[parallel, related, complex] Multiple parallel with multiple nested things', async () => {
    await Promise.all([
      ctx.query({ $entity: 'User', $fields: [{ $path: 'accounts', $fields: ['id'] }] }),
      ctx.query({ $entity: 'Space', $fields: [{ $path: 'users', $fields: ['id'] }] }),
      ctx.query({ $relation: 'DataField', $fields: [{ $path: 'data', $fields: ['id'] }] }),
    ]);
  });

  it('par3[parallel, related, multiple] Multiple parallel with multiple nested things', async () => {
    await Promise.all([
      ctx.query({ $entity: 'User', $fields: [{ $path: 'accounts', $fields: ['id'] }] }),
      ctx.query({ $entity: 'Space', $fields: [{ $path: 'users', $fields: ['id'] }] }),
      ctx.query({ $relation: 'DataField', $fields: [{ $path: 'data', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $entity: 'Hook', $fields: [{ $path: 'hooks', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTag', $fields: [{ $path: 'groups', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTagGroup', $fields: [{ $path: 'tags', $fields: ['id'] }] }),
    ]);
  });

  it('par4[parallel, maxi] Ridiculously long and repetitive paralel query', async () => {
    await Promise.all([
      ctx.query({ $entity: 'User', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTag', $fields: [{ $path: 'groups', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTag', $fields: [{ $path: 'groups', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTag', $fields: [{ $path: 'groups', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTag', $fields: [{ $path: 'groups', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTag', $fields: [{ $path: 'groups', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTag', $fields: [{ $path: 'groups', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTag', $fields: [{ $path: 'groups', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTag', $fields: [{ $path: 'groups', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTag', $fields: [{ $path: 'groups', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTag', $fields: [{ $path: 'groups', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTag', $fields: [{ $path: 'groups', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $relation: 'UserTag', $fields: [{ $path: 'groups', $fields: ['id'] }] }),
    ]);
  });

  it('par5[parallel, maxi, id] Ridiculously long and repetitive with repeated $id filters', async () => {
    await Promise.all([
      ctx.query({ $entity: 'User', $id: 'user1', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $id: 'user2', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $id: 'user3', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $id: 'user4', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $id: 'user1', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $id: 'user2', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $id: 'user3', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
      ctx.query({ $entity: 'User', $id: 'user4', $fields: [{ $path: 'spaces', $fields: ['id'] }] }),
    ]);
  });
});
