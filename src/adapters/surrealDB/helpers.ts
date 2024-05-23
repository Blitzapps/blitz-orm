export const sanitizeTableNameSurrealDb = (tableName: string) => {
	return tableName.replace(/`/g, '');
};

export const prepareTableNameSurrealDB = (tableName: string) => {
	//if tableName includes any of the chars of this array, then wrap it in backticks
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
	if (specialChars.some((char) => tableName.includes(char))) {
		return `⟨\`${tableName}\`⟩`;
	}
	return tableName;
};
