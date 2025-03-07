import { init } from '../../helpers/init';
import { testParallelQuery } from './paralel';
import { testQuery } from './query';

testQuery(init);
testParallelQuery(init);
