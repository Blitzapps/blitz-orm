import { getCurrentSchema } from '../../helpers';
import type { EnrichedBormEntity, EnrichedBormRelation } from '../../types';
import type { PipelineOperation } from '../pipeline';

// type TQLRoot = 'attribute' | 'entity' | 'relation';

// type TQLDataFieldRes =
// 	| {
// 			[key: string]: {
// 				type: {
// 					label: string;
// 					root: TQLRoot;
// 				};
// 				value: string;
// 				value_type: 'string';
// 			}[];
// 	  }
// 	| {
// 			type: {
// 				label: string;
// 				root: TQLRoot;
// 			};
// 	  };

export const parseTQLQuery: PipelineOperation = async (req, res) => {
	const { enrichedBqlQuery, rawBqlRequest, schema } = req;
	const { rawTqlRes } = res;
	if (!enrichedBqlQuery) {
		throw new Error('BQL request not enriched');
	} else if (!rawTqlRes) {
		throw new Error('TQL query not executed');
	}
	console.log('rawTqlRes', JSON.stringify(rawTqlRes, null, 2));
	console.log('rawBqlRequest', JSON.stringify(rawBqlRequest, null, 2));

	const parseDataFields = (dataFields: any, currentSchema: EnrichedBormEntity | EnrichedBormRelation) => {
		const dataFieldsRes: object = {};

		for (const key in dataFields) {
			if (key !== 'type') {
				const field = currentSchema.dataFields?.filter((field: any) => field.path === key);
				if (field?.[0].cardinality === 'ONE') {
					// @ts-expect-error todo
					dataFieldsRes[key] = dataFields[key][0].value;
				} else if (field?.[0].cardinality === 'MANY') {
					const fields = dataFields[key].map((o: { value: string }) => o.value);
					// @ts-expect-error todo
					dataFieldsRes[key] = fields;
				}
			}
		}
		return dataFieldsRes;
	};
	const parseRoleFields = (roleFields: { $roleFields: object[]; $key: string }[]) => {
		console.log('roleFields', JSON.stringify(roleFields, null, 2));
		const linkFieldsRes: object = {};
		// each linkField
		for (const roleField of roleFields) {
			const { $roleFields, $key } = roleField;
			const items = [];
			// each item of specific linkField
			for (const item of $roleFields) {
				const { dataFields, currentSchema, linkFields, roleFields } = parseFields(item);

				const parsedDataFields = parseDataFields(dataFields, currentSchema);
				const parsedLinkFields = parseLinkFields(linkFields);
				const parsedRoleFields = parseRoleFields(roleFields);
				items.push({ ...parsedDataFields, ...parsedLinkFields, ...parsedRoleFields });
			}

			// linkFieldsRes[currentSchema.name] = { ...parseDataFields, ...parseLinkFields };
			// @ts-expect-error todo
			linkFieldsRes[$key] = items;
		}
		return linkFieldsRes;
		return {};
	};

	const parseLinkFields = (linkFields: { $linkFields: object[]; $key: string }[]) => {
		const linkFieldsRes: object = {};
		// each linkField
		for (const linkField of linkFields) {
			const { $linkFields, $key } = linkField;
			const items = [];
			// each item of specific linkField
			for (const item of $linkFields) {
				const { dataFields, currentSchema, linkFields, roleFields } = parseFields(item);

				const parsedDataFields = parseDataFields(dataFields, currentSchema);
				const parsedLinkFields = parseLinkFields(linkFields);
				const parsedRoleFields = parseRoleFields(roleFields);
				items.push({ ...parsedDataFields, ...parsedLinkFields, ...parsedRoleFields });
			}

			// linkFieldsRes[currentSchema.name] = { ...parseDataFields, ...parseLinkFields };
			// @ts-expect-error todo
			linkFieldsRes[$key] = items;
		}
		return linkFieldsRes;
	};
	const parseFields = (obj: any) => {
		let dataFields: object = {};
		// console.log('obj: ', JSON.stringify(obj, null, 2));

		for (const key in obj) {
			if (key.endsWith('.dataFields')) {
				dataFields = obj[key];
			}
		}
		// console.log('dataFields: ', JSON.stringify(dataFields, null, 2));
		// @ts-expect-error todo
		const dataFieldsThing = dataFields.type;
		const schemaValue: { $thing: string; $thingType: string } = {
			$thing: dataFieldsThing.label,
			$thingType: dataFieldsThing.root,
		};
		const node = { [`$${schemaValue.$thingType}`]: schemaValue.$thing };
		const currentSchema = getCurrentSchema(schema, node);

		const linkFields = [];
		const roleFields = [];
		for (const key in obj) {
			const _keys = key.split('.');
			const identifier = _keys[_keys.length - 1];
			const foundLinkField = currentSchema.linkFields?.find(
				(o) => o.path === identifier && identifier !== 'dataFields',
			);
			// @ts-expect-error todo
			const foundRoleField = currentSchema.roles?.[identifier];
			if (foundLinkField) {
				linkFields.push({ $linkFields: obj[key], $key: identifier });
			}
			if (foundRoleField) {
				roleFields.push({ $roleFields: obj[key], $key: identifier });
			}
		}

		return { dataFields, schemaValue, currentSchema, linkFields, roleFields };
	};
	const parser = (tqlRes: object[]) => {
		const res: any = [];
		tqlRes.forEach((resObj) => {
			const { dataFields, currentSchema, linkFields } = parseFields(resObj);
			// console.log('ROOT.linkFields', JSON.stringify(linkFields, null, 2));
			const parsedDataFields = parseDataFields(dataFields, currentSchema);
			const parsedLinkFields = parseLinkFields(linkFields);
			res.push({ ...parsedDataFields, ...parsedLinkFields });
		});
		return res;
	};

	const parsedTqlRes = parser(rawTqlRes as object[]);

	console.log('parsedTqlRes', JSON.stringify(parsedTqlRes, null, 2));
	res.parsedTqlRes = parsedTqlRes;
};
