import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createRsbuild } from '@rsbuild/core';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';
import { proxyConsole } from '../helper';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('should throw error and format diagnostics when using typescript-go', async () => {
  const { logs, restore } = proxyConsole();

  try {
    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        plugins: [
          pluginTypeCheck({
            tsCheckerOptions: {
              typescript: {
                tsgo: true,
              },
            },
          }),
        ],
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
});

test('should respect issue exclude when using typescript-go', async () => {
  const { logs, restore } = proxyConsole();

  try {
    const rsbuild = await createRsbuild({
      cwd: __dirname,
      rsbuildConfig: {
        plugins: [
          pluginTypeCheck({
            tsCheckerOptions: {
              issue: {
                exclude: [{ code: 'TS2345' }],
              },
              typescript: {
                tsgo: true,
              },
            },
          }),
        ],
      },
    });

    await expect(rsbuild.build()).resolves.toBeTruthy();
    expect(logs.some((log) => log.includes('TS2345'))).toBeFalsy();
  } finally {
    restore();
  }
});
