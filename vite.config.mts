import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		reporters: ['minimal', 'github-actions'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			reporter: ['text', 'lcovonly'],
		},
		include: ['test/**/*.test.ts'],
		hookTimeout: 120000, // 2 minutes, as mongodb server will be downloaded on startup
	},
});
