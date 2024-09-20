import { init } from '../../helpers/init';
import { testBasicMutation } from './basic';
import { testBatchedMutation } from './batched';
import { testEdgesMutation } from './edges';
import { testMutationErrors } from './errors';
import { testFilteredMutation } from './filtered';
import { testMutationPrehooks } from './preHooks';
import { testReplaceMutation } from './replaces';
import { testUnsupportedMutation } from './unsupported';

testBasicMutation(init);
testMutationErrors(init);
testEdgesMutation(init);
testBatchedMutation(init);
testMutationPrehooks(init);
testReplaceMutation(init);
testUnsupportedMutation(init);
testFilteredMutation(init);
