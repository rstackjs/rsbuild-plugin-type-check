import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@rstest/playwright';
import { createRsbuild, loadConfig } from '@rsbuild/core';
import { proxyConsole } from '@rstackjs/test-utils';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('should check multiple tsconfig.json as expected', async () => {
  const { logs, restore } = proxyConsole();

  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: (await loadConfig({ cwd: __dirname })).content,
  });

  await expect(rsbuild.build()).rejects.toThrowError('build failed');

  expect(
    logs.find((log) =>
      log.includes(
        `Argument of type 'string' is not assignable to parameter of type 'number'.`,
      ),
    ),
  ).toBeTruthy();

  expect(
    logs.find((log) =>
      log.includes(
        `Argument of type '{}' is not assignable to parameter of type 'number'.`,
      ),
    ),
  ).toBeTruthy();

  restore();
});
