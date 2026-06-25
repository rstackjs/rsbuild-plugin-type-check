import fs from 'node:fs';
import { createRequire } from 'node:module';
import type { RsbuildPlugin } from '@rsbuild/core';
import deepmerge from 'deepmerge';
import json5 from 'json5';
import { type ConfigChain, reduceConfigs } from 'reduce-configs';
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin';

const require = createRequire(import.meta.url);

type TsCheckerOptions = NonNullable<
  ConstructorParameters<typeof TsCheckerRspackPlugin>[0]
>;
type TypeScriptGoPackage = 'typescript' | 'preview';
type TypeScriptOptions = NonNullable<TsCheckerOptions['typescript']>;
type TypeScriptOptionsWithTsgoPackage = TypeScriptOptions & {
  tsgoPackage?: TypeScriptGoPackage;
};

type ProjectTypeScriptPaths = {
  typescriptPath?: string;
  packageJsonPath?: string;
  previewPackageJsonPath?: string;
  supportsTsgo: boolean;
};

const TYPESCRIPT_PACKAGE = 'typescript';
const TYPESCRIPT_PACKAGE_JSON = `${TYPESCRIPT_PACKAGE}/package.json`;
const TYPESCRIPT_PREVIEW_PACKAGE = '@typescript/native-preview';
const TYPESCRIPT_PREVIEW_PACKAGE_JSON = `${TYPESCRIPT_PREVIEW_PACKAGE}/package.json`;

const resolveProjectPackage = (
  packageName: string,
  rootPath: string,
): string | undefined => {
  try {
    return require.resolve(packageName, {
      paths: [rootPath],
    });
  } catch {
    return undefined;
  }
};

const getTypeScriptGoPackage = (
  packageJsonPath: string | undefined,
): TypeScriptGoPackage | undefined => {
  if (!packageJsonPath) {
    return undefined;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const version =
      typeof packageJson.version === 'string' ? packageJson.version : '';
    const versionMatch = version.match(/^(\d+)\.(\d+)(?:\.|$|-)/);

    if (
      packageJson.name === TYPESCRIPT_PACKAGE &&
      versionMatch &&
      Number(versionMatch[1]) >= 7
    ) {
      return 'typescript';
    }

    if (packageJson.name === TYPESCRIPT_PREVIEW_PACKAGE) {
      return 'preview';
    }

    return undefined;
  } catch {
    return undefined;
  }
};

const isTypeScriptGoSupportedPackage = (
  packageJsonPath: string | undefined,
): boolean => getTypeScriptGoPackage(packageJsonPath) === 'typescript';

const resolveProjectTypeScriptPaths = (
  rootPath: string,
): ProjectTypeScriptPaths => {
  const typescriptPath = resolveProjectPackage(TYPESCRIPT_PACKAGE, rootPath);
  const packageJsonPath = resolveProjectPackage(
    TYPESCRIPT_PACKAGE_JSON,
    rootPath,
  );
  const previewPackageJsonPath = resolveProjectPackage(
    TYPESCRIPT_PREVIEW_PACKAGE_JSON,
    rootPath,
  );
  const supportsTsgo = isTypeScriptGoSupportedPackage(packageJsonPath);

  return {
    typescriptPath,
    packageJsonPath,
    previewPackageJsonPath,
    supportsTsgo,
  };
};

const applyTypeScriptDefaults = (
  typescriptOptions: TypeScriptOptions | undefined,
  projectPaths: ProjectTypeScriptPaths,
): boolean => {
  if (!typescriptOptions) {
    return false;
  }

  const configuredPath = typescriptOptions.typescriptPath;
  const normalizedOptions =
    typescriptOptions as TypeScriptOptionsWithTsgoPackage;

  if (configuredPath) {
    const tsgoPackage = getTypeScriptGoPackage(configuredPath);

    if (typescriptOptions.tsgo === undefined && tsgoPackage === 'typescript') {
      typescriptOptions.tsgo = true;
    }

    if (typescriptOptions.tsgo === true && tsgoPackage) {
      normalizedOptions.tsgoPackage = tsgoPackage;
    }

    return Boolean(typescriptOptions.tsgo);
  }

  if (typescriptOptions.tsgo === false) {
    typescriptOptions.typescriptPath = projectPaths.typescriptPath;
    return false;
  }

  if (projectPaths.supportsTsgo) {
    typescriptOptions.typescriptPath = projectPaths.packageJsonPath;
    typescriptOptions.tsgo = true;
    normalizedOptions.tsgoPackage = 'typescript';
    return true;
  }

  if (typescriptOptions.tsgo === true) {
    typescriptOptions.typescriptPath = projectPaths.previewPackageJsonPath;
    normalizedOptions.tsgoPackage = 'preview';
    return true;
  }

  typescriptOptions.typescriptPath = projectPaths.typescriptPath;
  return false;
};

export type PluginTypeCheckerOptions = {
  /**
   * Whether to enable TypeScript type checking.
   * @default true
   */
  enable?: boolean;
  /**
   * To modify the options of `ts-checker-rspack-plugin`.
   * @see https://github.com/rstackjs/ts-checker-rspack-plugin#readme
   */
  tsCheckerOptions?: ConfigChain<TsCheckerOptions>;
  /**
   * @deprecated use `tsCheckerOptions` instead.
   */
  forkTsCheckerOptions?: ConfigChain<TsCheckerOptions>;
};

export const PLUGIN_TYPE_CHECK_NAME = 'rsbuild:type-check';

export const pluginTypeCheck = (
  options: PluginTypeCheckerOptions = {},
): RsbuildPlugin => {
  return {
    name: PLUGIN_TYPE_CHECK_NAME,

    setup(api) {
      // `api.logger` is available since Rsbuild 1.4.0
      const logger = api.logger ?? console;

      const NODE_MODULES_REGEX: RegExp = /[\\/]node_modules[\\/]/;
      const checkedTsconfig = new Map<
        // tsconfig path
        string,
        // environment
        string
      >();

      api.modifyBundlerChain(
        async (chain, { isProd, environment, CHAIN_ID }) => {
          const { enable = true, forkTsCheckerOptions } = options;
          let { tsCheckerOptions } = options;
          const { tsconfigPath } = environment;

          // compatible with the legacy option
          if (
            tsCheckerOptions === undefined &&
            forkTsCheckerOptions !== undefined
          ) {
            tsCheckerOptions = forkTsCheckerOptions;
          }

          if (!tsconfigPath || enable === false) {
            return;
          }

          // If there are identical tsconfig.json files,
          // apply type checker only once to avoid duplicate checks.
          if (
            checkedTsconfig.has(tsconfigPath) &&
            checkedTsconfig.get(tsconfigPath) !== environment.name
          ) {
            return;
          }
          checkedTsconfig.set(tsconfigPath, environment.name);

          const { references } = json5.parse(
            fs.readFileSync(tsconfigPath, 'utf-8'),
          );
          const useReference =
            Array.isArray(references) && references.length > 0;
          const projectTypescriptPaths = resolveProjectTypeScriptPaths(
            api.context.rootPath,
          );

          const defaultOptions: TsCheckerOptions = {
            typescript: {
              // set 'readonly' to avoid emitting tsbuildinfo,
              // as the generated tsbuildinfo will break ts-checker-rspack-plugin
              mode: 'readonly',
              // enable build when using project reference
              build: useReference,
              // avoid OOM issue
              memoryLimit: 8192,
              // use tsconfig of user project
              configFile: tsconfigPath,
            },
            issue: {
              // ignore types errors from node_modules
              exclude: [({ file = '' }) => NODE_MODULES_REGEX.test(file)],
            },
            logger: {
              log() {
                // do nothing
                // we only want to display error messages
              },
              error(message: string) {
                console.error(
                  message
                    .replace(/ERROR/g, 'Type Error')
                    .replace(/WARNING/g, 'Type Warning'),
                );
              },
            },
          };

          const mergedOptions = reduceConfigs({
            initial: defaultOptions,
            config: tsCheckerOptions,
            mergeFn: deepmerge,
          });

          const typescriptOptions = mergedOptions.typescript;
          const isTypeScriptGoEnabled = applyTypeScriptDefaults(
            typescriptOptions,
            projectTypescriptPaths,
          );

          if (typescriptOptions && !typescriptOptions.typescriptPath) {
            const typeCheckerPackage = isTypeScriptGoEnabled
              ? TYPESCRIPT_PREVIEW_PACKAGE
              : TYPESCRIPT_PACKAGE;
            logger.warn(
              `"${typeCheckerPackage}" is not found in current project, Type checker will not work.`,
            );
            return;
          }

          if (isProd) {
            logger.info(
              isTypeScriptGoEnabled
                ? 'Type checker is enabled.'
                : 'Type checker is enabled. It may take some time. You can enable `typescript.tsgo` to speed up type checking.',
            );
          }

          chain
            .plugin(CHAIN_ID.PLUGIN.TS_CHECKER)
            .use(TsCheckerRspackPlugin, [mergedOptions]);
        },
      );
    },
  };
};
