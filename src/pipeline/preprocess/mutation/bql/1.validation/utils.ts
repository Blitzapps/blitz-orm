export const sanitizeTempId = (tempId: unknown): string => {
	if (typeof tempId !== 'string') {
		throw new Error('$tempId must be a string.');
	}
	// Ensure the string starts with "_:"
	if (!tempId.startsWith('_:')) {
		throw new Error('TempIds must start with "_:"');
	}

	// Remove the prefix "_:" for further validation
	const sanitizedId = tempId.substring(2);

	// Ensure there are no symbols (only alphanumeric characters, hyphens, and underscores)
	if (!/^[a-zA-Z0-9-_]+$/.test(sanitizedId)) {
		throw new Error('$tempId must contain only alphanumeric characters, hyphens, and underscores.');
	}

	// Ensure the ID is no longer than 36 characters (including the "_:" prefix)
	if (tempId.length > 36) {
		throw new Error('$tempId must not be longer than 36 characters.');
	}

	return sanitizedId;
};
