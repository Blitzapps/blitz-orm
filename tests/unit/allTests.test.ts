//this file is needed because I was not able to run queries before mutations sequentially
import { init } from '../helpers/init';
import { testBasicMutation } from './mutations/basic';
import { testBatchedMutation } from './mutations/batched';
import { testEdgesMutation } from './mutations/edges';
import { testMutationErrors } from './mutations/errors';
import { testFilteredMutation } from './mutations/filtered';
import { testMutationPrehooks } from './mutations/preHooks';
import { testRefFieldsMutations } from './mutations/refFields';
import { testReplaceMutation } from './mutations/replaces';
import { testUnsupportedMutation } from './mutations/unsupported';
import { testQuery } from './queries/query';
import { testSchemaDefine } from './schema/define';

testSchemaDefine(init);

testQuery(init);

testBasicMutation(init);
testRefFieldsMutations(init);
testEdgesMutation(init);
testMutationErrors(init);
testBatchedMutation(init);
testMutationPrehooks(init);
testReplaceMutation(init);
testFilteredMutation(init);
testUnsupportedMutation(init);
