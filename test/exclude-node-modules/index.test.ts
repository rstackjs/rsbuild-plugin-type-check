import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@rstest/playwright';
import { createRsbuild, loadConfig } from '@rsbuild/core';
import fse from 'fs-extra';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createFooPackage() {
  const fooPath = join(__dirname, 'node_modules', 'foo');

  fse.outputFileSync(
    join(fooPath, 'src/index.ts'),
    'export const foo: number = "foo"',
  );
  fse.outputJSONSync(join(fooPath, 'package.json'), {
    name: 'foo',
    version: '1.0.0',
    main: './src/index.ts',
  });
  fse.outputJSONSync(join(fooPath, 'tsconfig.json'), {
    include: ['src/index.ts'],
  });
}

test('should exclude type errors from node_modules', async () => {
  createFooPackage();
  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: (await loadConfig({ cwd: __dirname })).content,
  });
  await expect(rsbuild.build()).resolves.toBeTruthy();
});
