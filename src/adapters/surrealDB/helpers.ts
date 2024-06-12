import { RecordId } from 'surrealdb.js';

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
		return `⟨\`${tableName}\`⟩`;
	}
	return tableName;
};

export const cleanRecordIdSurrealDb = (id: string | RecordId, tableName: string) => {
	if (id === undefined) {
		throw new Error('id is undefined');
	}
	if (typeof id === 'object' && id instanceof RecordId) {
		return id.id;
	}
	if (typeof id !== 'string') {
		throw new Error(`id is not a string ${id}, typeof: ${typeof id})}`);
	}
	const cleanedId = id.replace(new RegExp(`^${tableName}:`), '');
	console.log('cleanedId', cleanedId);
	return cleanedId;
};
