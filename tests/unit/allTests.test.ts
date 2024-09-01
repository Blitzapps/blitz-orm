//this file is needed because I was not able to run queries before mutations sequentially
import { init } from '../helpers/init';
import { testBatchedMutation } from './mutations/batched';
import { testEdgesMutation } from './mutations/edges';
import { testMutationErrors } from './mutations/errors';
import { testMutationPrehooks } from './mutations/preHooks';
import { testReplaceMutation } from './mutations/replaces';
import { testUnsupportedMutation } from './mutations/unsupported';
import { testQuery } from './queries/query';

testQuery(init);
testEdgesMutation(init);
testMutationErrors(init);
testEdgesMutation(init);
testBatchedMutation(init);
testMutationPrehooks(init);
testReplaceMutation(init);
testUnsupportedMutation(init);
