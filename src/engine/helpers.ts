const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
const STRIP_KEYWORDS = /(\s*async\s*|\s*function\s*|\s*\(\s*|\s*\)\s*=>|\s*\)\s*\{)/;

export const getParamNames = (func: (...args: any[]) => any): string[] => {
	const fnStr: string = func.toString().replace(STRIP_COMMENTS, '').trim();
	// Remove function keywords and split at the first => or { to isolate parameters
	const fnBodyStr: string = fnStr.split('=>')[0].split('{')[0].replace(STRIP_KEYWORDS, '').trim();
	const paramsBlock = fnBodyStr.substring(fnBodyStr.indexOf('(') + 1, fnBodyStr.lastIndexOf(')')).trim();

	if (!paramsBlock) {
		return [];
	}

	// Match including destructured parameters with special characters
	const paramsMatch = paramsBlock.match(/(\{[^}]*\}|[^,]+)/g) || [];

	return paramsMatch
		.flatMap((param) => {
			// Remove leading/trailing braces and split based on comma outside of quotes
			if (param.includes('{') && param.includes('}')) {
				const destructuredParams = param.replace(/^\{|\}$/g, '').match(/(?:[^,"']+|"[^"]*"|'[^']*')+/g) || [];
				return destructuredParams.map((p) =>
					p
						.split(':')[0]
						.trim()
						.replace(/['"[\]]/g, ''),
				);
			}
			return param.trim();
		})
		.filter(Boolean);
};
