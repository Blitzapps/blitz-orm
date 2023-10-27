import type { Filter } from './filters';

type RequiredKey<T, K extends keyof T> = T & { [P in K]-?: T[P] };

type WithRequired<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>> & RequiredKey<T, K>;

export type BQLMutationBlock = {
	[key: string]: any;
	$id?: string | string[];
	$filter?: Filter | Filter[]; // todo: keyof BQLmutationBlock
	$tempId?: string;
	$op?: string;
} & ({ $entity: string } | { $relation: string }); // | { $attribute: string });
export type FilledBQLMutationBlock = WithRequired<BQLMutationBlock, '$tempId' | '$op'>;

export type RawBQLMutation = (
	| {
			$entity: string;
	  }
	| {
			$relation: string;
	  }
) &
	Record<string, any>; /// TODO : explicitly type available fields

export type ParsedBQLMutation = {
	things: BQLMutationBlock[];
	edges: BQLMutationBlock[];
};
