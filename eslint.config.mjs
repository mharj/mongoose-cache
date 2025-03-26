import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylisticTs from '@stylistic/eslint-plugin-ts';
import importPlugin from 'eslint-plugin-import';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import sonarjs from 'eslint-plugin-sonarjs';
import tsParser from '@typescript-eslint/parser';
import cspellESLintPluginRecommended from '@cspell/eslint-plugin/recommended';
import jsdoc from 'eslint-plugin-jsdoc';

export default tseslint.config(
	eslint.configs.recommended,
	tseslint.configs.recommendedTypeChecked,
	tseslint.configs.stylisticTypeChecked,
	tseslint.configs.strictTypeChecked,
	importPlugin.flatConfigs.recommended,
	importPlugin.flatConfigs.typescript,
	sonarjs.configs.recommended,
	cspellESLintPluginRecommended,
	jsdoc.configs['flat/recommended-typescript'],
	prettierRecommended,
	{
		ignores: ['**/dist', '**/node_modules', '**/.github', '**/.nyc_output', '**/vite.config.mts', 'eslint.config.mjs'],
	},
	{
		plugins: {
			'@stylistic/ts': stylisticTs,
			jsdoc,
		},
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2020,
			sourceType: 'module',
			parserOptions: {
				project: './tsconfig.test.json',
			},
		},
		settings: {
			'import/resolver': {
				typescript: {
					extensions: ['.mts'],
					moduleDirectory: ['node_modules', 'src/'],
				},
			},
			jsdoc: {
				mode: 'typescript',
			},
		},
		rules: {
			'sort-imports': 'off',
			'import/order': [
				'warn',
				{
					groups: ['builtin', 'external', 'parent', 'sibling', 'index'],

					alphabetize: {
						order: 'asc',
						caseInsensitive: true,
					},

					named: true,
					'newlines-between': 'never',
				},
			],
			camelcase: 'off',
			'@typescript-eslint/naming-convention': [
				'warn',
				{
					selector: ['variable', 'parameter'],
					modifiers: ['destructured'],
					format: null,
				},
				{
					selector: 'variable',
					modifiers: ['const'],
					format: ['camelCase'],
					leadingUnderscore: 'allow',
				},
				{
					selector: 'variableLike',
					format: ['camelCase', 'PascalCase'],
					leadingUnderscore: 'allow',
				},
				{
					selector: 'typeAlias',
					format: ['PascalCase'],
				},
				{
					selector: 'interface',
					prefix: ['I'],
					format: ['PascalCase'],
				},
			],
			'import/no-useless-path-segments': 'warn',
			'import/no-duplicates': 'error',
			curly: 'error',
			'@typescript-eslint/no-this-alias': [
				'warn',
				{
					allowedNames: ['self'],
				},
			],
			'sort-keys': [
				'warn',
				'asc',
				{
					caseSensitive: false,
					natural: true,
					minKeys: 5,
				},
			],
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
			'@typescript-eslint/no-deprecated': 'warn',
			'lines-between-class-members': 'off',
			'@stylistic/ts/lines-between-class-members': [
				'warn',
				'always',
				{
					exceptAfterOverload: true,
					exceptAfterSingleLine: true,
				},
			],
			'@typescript-eslint/consistent-type-imports': [
				'warn',
				{
					prefer: 'type-imports',
					fixStyle: 'inline-type-imports',
				},
			],
			'@typescript-eslint/member-ordering': [
				'warn',
				{
					classes: ['static-field', 'static-method', 'field', 'constructor', 'public-method', 'protected-method', 'private-method', '#private-method'],
				},
			],
			'@typescript-eslint/no-unnecessary-condition': 'off',
			'sonarjs/use-type-alias': 'off',
			'sonarjs/deprecation': 'off', // we use another rule
			'@typescript-eslint/no-unsafe-function-type': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/consistent-indexed-object-style': 'off',
			'@typescript-eslint/array-type': 'off',
			'@typescript-eslint/consistent-type-definitions': 'off',
			'@typescript-eslint/no-unnecessary-type-parameters': 'off', // not working ok atm
			'jsdoc/no-types': 'off',
			'jsdoc/require-param-type': 'warn',
			'jsdoc/require-param': 'warn',
			'jsdoc/require-template': 'warn',
			'jsdoc/require-throws': 'warn',
			'jsdoc/require-returns': 'warn',
			'jsdoc/require-returns-type': 'warn',
			'jsdoc/check-values': 'error',
			'jsdoc/check-types': 'error',
			'jsdoc/no-restricted-syntax': [
				'warn',
				{
					contexts: [
						{
							comment: 'JsdocBlock:not(*:has(JsdocTag[tag=since]))',
							context: 'ExportNamedDeclaration',
							message: '@since required on each block',
						},
					],
				},
			],
		},
	},
	{
		files: ['test/**/*.ts'],
		rules: {
			'no-console': 'off',
			'no-proto': 'off',
			'@cspell/spellchecker': 'off',
			'sonarjs/pseudo-random': 'off',
			'sonarjs/no-duplicate-string': 'off',
			'sonarjs/assertions-in-tests': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-confusing-void-expression': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			'jsdoc/require-jsdoc': 'off',
			'@typescript-eslint/naming-convention': 'off',
			'@typescript-eslint/no-deprecated': 'off',
		},
	},
);
