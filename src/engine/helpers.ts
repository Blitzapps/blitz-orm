const STRIP_COMMENTS = /((\/\/.*$)|(\/\*.*\*\/))/gm;
const STRIP_KEYWORDS = /(\s*async\s*|\s*function\s*)+/;
// This regex captures parameters, ignoring any patterns inside the function body
const ARGUMENT_NAMES = /(?:function\s*[^(\s]*\s*|\s*=>\s*|^\s*)\(([^)]*)\)/;
const ARGUMENT_SPLIT = /[ ,\n\r\t]+/;

export const getParamNames = (func: (...args: any[]) => any): string[] => {
	const fnStr: string = func.toString().replace(STRIP_COMMENTS, '').replace(STRIP_KEYWORDS, '').trim();
	const matches: RegExpExecArray | null = ARGUMENT_NAMES.exec(fnStr);

	if (!matches) {
		return [];
	}

	let match: string | undefined;
	for (const matchGroup of matches.slice(1)) {
		if (matchGroup) {
			match = matchGroup;
			break;
		}
	}

	if (!match) {
		return [];
	}

	// Handle destructured parameters by removing curly braces and spaces
	match = match.replace(/\{\s*/g, '').replace(/\s*\}/g, '');

	return match.split(ARGUMENT_SPLIT).filter((part) => part.trim() !== '');
};
