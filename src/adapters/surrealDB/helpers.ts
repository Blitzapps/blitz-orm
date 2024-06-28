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

export const prepareTableNameSurrealDB = (tableName: string) => {
	//if tableName includes any of the chars of this array, then wrap it in backticks

	if (specialChars.some((char) => tableName.includes(char))) {
		return `⟨${tableName}⟩`;
	}
	return tableName;
};
