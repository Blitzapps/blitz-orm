/* eslint-disable prefer-destructuring */

import { init } from '../../helpers/lifecycle';
import type BormClient from '../../../../src/index';
import { deepSort } from '../../../helpers/matchers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Query', () => {
	let cleanup: () => Promise<void>;
	let bormClient: BormClient;

	beforeAll(async () => {
		const res = await init();
		cleanup = res.cleanup;
		bormClient = res.bormClient;
	}, 25000);

	it('Run BQL queries targeting typedb and surrealdb in the same batch', async () => {
		const res = await bormClient.query([
			{
				$entity: 'Space',
				$fields: [
					'id',
					'name',
					{
						$path: 'members',
					},
					{
						$path: 'projects',
					},
				],
			},
			{
				$relation: 'company',
				$fields: [
					'id',
					'name',
					{
						$path: 'employees',
						$fields: [
							'id',
							'name',
							{
								$path: 'tasks',
							},
						],
					},
				],
			},
		]);

		expect(deepSort(res, 'id')).toEqual([
			[
				{
					members: [
						{
							name: 'Jhon',
							email: 'jhon@test.com',
							id: 'user_1',
							$id: 'user_1',
							projects: ['project_1'],
							ownedSpaces: ['space_1'],
							spaces: ['space_1'],
							$thing: 'User',
							$thingType: 'entity',
						},
						{
							name: 'Budi',
							email: 'budi@test.com',
							id: 'user_2',
							$id: 'user_2',
							projects: ['project_1'],
							spaces: ['space_1'],
							$thing: 'User',
							$thingType: 'entity',
						},
						{
							name: 'Susi',
							email: 'susi@test.com',
							id: 'user_3',
							$id: 'user_3',
							projects: ['project_2'],
							spaces: ['space_1'],
							$thing: 'User',
							$thingType: 'entity',
						},
						{
							name: 'Desi',
							email: 'desi@test.com',
							id: 'user_4',
							$id: 'user_4',
							projects: ['project_2'],
							spaces: ['space_1'],
							$thing: 'User',
							$thingType: 'entity',
						},
					],
					projects: [
						{
							name: 'Frontend',
							id: 'project_1',
							$id: 'project_1',
							executors: ['user_1', 'user_2'],
							space: 'space_1',
							$thing: 'Project',
							$thingType: 'entity',
						},
						{
							name: 'Backend',
							id: 'project_2',
							$id: 'project_2',
							executors: ['user_3', 'user_4'],
							space: 'space_1',
							$thing: 'Project',
							$thingType: 'entity',
						},
					],
					$thing: 'Space',
					$thingType: 'entity',
					name: 'Product',
					id: 'space_1',
					$id: 'space_1',
				},
				{
					members: [
						{
							name: 'Joko',
							email: 'joko@test.com',
							id: 'user_5',
							$id: 'user_5',
							projects: ['project_3'],
							ownedSpaces: ['space_2'],
							spaces: ['space_2'],
							$thing: 'User',
							$thingType: 'entity',
						},
						{
							name: 'Iwan',
							email: 'iwan@test.com',
							id: 'user_6',
							$id: 'user_6',
							projects: ['project_3'],
							spaces: ['space_2'],
							$thing: 'User',
							$thingType: 'entity',
						},
						{
							name: 'Dewi',
							email: 'dewi@test.com',
							id: 'user_7',
							$id: 'user_7',
							projects: ['project_4'],
							spaces: ['space_2'],
							$thing: 'User',
							$thingType: 'entity',
						},
						{
							name: 'Intan',
							email: 'intan@test.com',
							id: 'user_8',
							$id: 'user_8',
							projects: ['project_4'],
							spaces: ['space_2'],
							$thing: 'User',
							$thingType: 'entity',
						},
					],
					projects: [
						{
							name: 'Ads',
							id: 'project_3',
							$id: 'project_3',
							executors: ['user_5', 'user_6'],
							space: 'space_2',
							$thing: 'Project',
							$thingType: 'entity',
						},
						{
							name: 'Blog',
							id: 'project_4',
							$id: 'project_4',
							executors: ['user_7', 'user_8'],
							space: 'space_2',
							$thing: 'Project',
							$thingType: 'entity',
						},
					],
					$thing: 'Space',
					$thingType: 'entity',
					name: 'Marketing',
					id: 'space_2',
					$id: 'space_2',
				},
				{
					members: [
						{
							name: 'Adi',
							email: 'adi@test.com',
							id: 'user_10',
							$id: 'user_10',
							projects: ['project_6'],
							spaces: ['space_3'],
							$thing: 'User',
							$thingType: 'entity',
						},
						{
							name: 'Dian',
							email: 'dian@test.com',
							id: 'user_9',
							$id: 'user_9',
							projects: ['project_5'],
							ownedSpaces: ['space_3'],
							spaces: ['space_3'],
							$thing: 'User',
							$thingType: 'entity',
						},
					],
					projects: [
						{
							name: 'Cold call',
							id: 'project_5',
							$id: 'project_5',
							executors: ['user_9'],
							space: 'space_3',
							$thing: 'Project',
							$thingType: 'entity',
						},
						{
							name: 'Prospecting',
							id: 'project_6',
							$id: 'project_6',
							executors: ['user_10'],
							space: 'space_3',
							$thing: 'Project',
							$thingType: 'entity',
						},
					],
					$thing: 'Space',
					$thingType: 'entity',
					name: 'Sales',
					id: 'space_3',
					$id: 'space_3',
				},
			],
			[
				{
					id: 'company1',
					$id: 'company1',
					$thing: 'company',
					$thingType: 'relation',
					name: 'Google',
					employees: [
						{
							$id: 'person1',
							$thing: 'person',
							$thingType: 'relation',
							id: 'person1',
							name: 'Antoine',
							tasks: [
								{
									$id: 'task1',
									id: 'task1',
									name: 'Build search engine',
									executors: ['person1'],
									$thing: 'task',
									$thingType: 'entity',
								},
							],
						},
						{
							$id: 'person2',
							$thing: 'person',
							$thingType: 'relation',
							id: 'person2',
							name: 'Loic',
							tasks: [
								{
									id: 'task2',
									$id: 'task2',
									name: 'Build Google Sheet',
									executors: ['person2'],
									$thing: 'task',
									$thingType: 'entity',
								},
							],
						},
						{
							$id: 'person3',
							$thing: 'person',
							$thingType: 'relation',
							id: 'person3',
							name: 'Ann',
						},
						{
							$id: 'person4',
							$thing: 'person',
							$thingType: 'relation',
							id: 'person4',
							name: 'Ben',
						},
					],
				},
				{
					$id: 'company2',
					$thing: 'company',
					$thingType: 'relation',
					id: 'company2',
					name: 'Apple',
					employees: [
						{
							$id: 'person5',
							$thing: 'person',
							$thingType: 'relation',
							id: 'person5',
							name: 'Charlize',
						},
						{
							$id: 'person6',
							$thing: 'person',
							$thingType: 'relation',
							id: 'person6',
							name: 'Susi',
						},
						{
							$id: 'person7',
							$thing: 'person',
							$thingType: 'relation',
							id: 'person7',
							name: 'Budi',
						},
						{
							$id: 'person8',
							$thing: 'person',
							$thingType: 'relation',
							id: 'person8',
							name: 'Intan',
						},
					],
				},
				{
					$id: 'company3',
					$thing: 'company',
					$thingType: 'relation',
					id: 'company3',
					name: 'Microsoft',
					employees: [
						{
							$id: 'person9',
							$thing: 'person',
							$thingType: 'relation',
							id: 'person9',
							name: 'Satya',
						},
					],
				},
				{
					$id: 'company4',
					$thing: 'company',
					$thingType: 'relation',
					id: 'company4',
					name: 'Facebook',
				},
			],
		]);
	});

	afterAll(async () => {
		await cleanup?.();
	});
});
