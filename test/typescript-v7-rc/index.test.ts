import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createRsbuild } from '@rsbuild/core';
import {
  pluginTypeCheck,
  type PluginTypeCheckerOptions,
} from '@rsbuild/plugin-type-check';
import { proxyConsole } from '../helper';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const expectTypeScriptError = async (
  tsCheckerOptions?: PluginTypeCheckerOptions['tsCheckerOptions'],
) => {
  const typescriptPackageJson = require('typescript/package.json') as {
    version: string;
  };
  expect(typescriptPackageJson.version).toMatch(/^7\./);

  const { logs, restore } = proxyConsole();

  try {
    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        plugins: [pluginTypeCheck({ tsCheckerOptions })],
      },
    });

    await expect(rsbuild.build()).rejects.toThrowError('build failed');

    expect(logs.some((log) => log.includes('TS2345'))).toBeTruthy();
    expect(
      logs.some((log) =>
        log.includes(
          `Argument of type 'string' is not assignable to parameter of type 'number'.`,
        ),
      ),
    ).toBeTruthy();
  } finally {
    restore();
  }
};

test('should type check with TypeScript v7 RC', async () => {
  await expectTypeScriptError();
});
