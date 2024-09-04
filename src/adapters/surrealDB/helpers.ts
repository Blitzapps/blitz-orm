export const sanitizeTableNameSurrealDb = (tableName: string) => {
	return tableName.replace(/`/g, '');
};

const specialChars = [
	' ',
	'-',
	'+',
	'*',
	'/',
	'=',
	'!',
	'@',
	'#',
	'$',
	'%',
	'^',
	'&',
	'(',
	')',
	'[',
	']',
	'{',
	'}',
	'|',
	'\\',
	';',
	':',
	"'",
	'"',
	',',
	'<',
	'>',
	'.',
	'?',
	'~',
	'`',
];

export const sanitizeNameSurrealDB = (name: string) => {
	//if tableName includes any of the chars of this array, then wrap it in backticks

	if (specialChars.some((char) => name.includes(char))) {
		return `⟨${name}⟩`;
	}
	return name;
};

export const tempSanitizeVarSurrealDB = (input: string): string =>
	input.replace(/[ \-+*/=!@#$%^&()[\]{}|\\;:'"<>,.?~`]/g, '');
