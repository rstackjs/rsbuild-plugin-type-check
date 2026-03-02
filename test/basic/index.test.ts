import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { expect, test } from '@playwright/test';
import { createRsbuild } from '@rsbuild/core';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';
import { getRandomPort, proxyConsole } from '../helper';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('should throw error when exist type errors', async () => {
  const { logs, restore } = proxyConsole();

  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      plugins: [pluginTypeCheck()],
    },
  });

  await expect(rsbuild.build()).rejects.toThrowError('build failed');

  expect(
    logs.find((log) => log.includes('File:') && log.includes('/src/index.ts')),
  ).toBeTruthy();

  expect(
    logs.find((log) =>
      log.includes(
        `Argument of type 'string' is not assignable to parameter of type 'number'.`,
      ),
    ),
  ).toBeTruthy();

  restore();
});

test('should throw error when exist type errors in dev mode', async ({
  page,
}) => {
  const { logs, restore } = proxyConsole();

  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      plugins: [
        pluginTypeCheck({
          tsCheckerOptions: {
            async: false,
          },
        }),
      ],
      server: {
        port: getRandomPort(),
      },
    },
  });

  const { server, urls } = await rsbuild.startDevServer();

  await page.goto(urls[0]);

  expect(
    logs.find((log) => log.includes('File:') && log.includes('/src/index.ts')),
  ).toBeTruthy();

  expect(
    logs.find((log) =>
      log.includes(
        `Argument of type 'string' is not assignable to parameter of type 'number'.`,
      ),
    ),
  ).toBeTruthy();

  restore();
  await server.close();
});

test('should display error in overlay when exist type errors in dev mode', async ({
  page,
}) => {
  process.env.NODE_ENV = 'development';
  const { restore } = proxyConsole();

  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      plugins: [pluginTypeCheck()],
      server: {
        port: getRandomPort(),
      },
    },
  });

  const { server, urls } = await rsbuild.startDevServer();

  await new Promise((resolve) => setTimeout(resolve, 1000));

  await page.goto(urls[0]);

  const OVERLAY_ID = 'rsbuild-error-overlay';
  await page.waitForSelector(OVERLAY_ID, { state: 'attached' });
  const errorOverlay = page.locator(OVERLAY_ID);

  const overlayContent = await errorOverlay.locator('.content').allInnerTexts();
  expect(
    overlayContent.find((txt) =>
      stripVTControlCharacters(txt).includes('TS2345: Argument of type'),
    ),
  ).toBeDefined();

  restore();
  await server.close();
  process.env.NODE_ENV = 'test';
});

test('should not throw error when the file is excluded', async () => {
  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      plugins: [
        pluginTypeCheck({
          tsCheckerOptions: {
            issue: {
              exclude: [{ file: '**/index.ts' }],
            },
          },
        }),
      ],
    },
  });

  await expect(rsbuild.build()).resolves.toBeTruthy();
});

test('should not throw error when the file is excluded by code', async () => {
  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      plugins: [
        pluginTypeCheck({
          tsCheckerOptions: {
            issue: {
              exclude: [{ code: 'TS2345' }],
            },
          },
        }),
      ],
    },
  });

  await expect(rsbuild.build()).resolves.toBeTruthy();
});

test('should not throw error when the type checker is not enabled', async () => {
  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      plugins: [
        pluginTypeCheck({
          enable: false,
        }),
      ],
    },
  });

  await expect(rsbuild.build()).resolves.toBeTruthy();
});
