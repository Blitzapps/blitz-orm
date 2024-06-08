import { allBench } from '../../unit/bench/bench';
import { init } from '../helpers/init';

allBench(async (): Promise<any> => {
	try {
		await init();
	} catch (error) {
		console.error('Error initializing benchmarking environment:', error);
		throw error;
	}
});
