# @rsbuild/plugin-type-check

An Rsbuild plugin to run TypeScript type checker in a separate process.

<p>
  <a href="https://npmjs.com/package/@rsbuild/plugin-type-check">
   <img src="https://img.shields.io/npm/v/@rsbuild/plugin-type-check?style=flat-square&colorA=564341&colorB=EDED91" alt="npm version" />
  </a>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square&colorA=564341&colorB=EDED91" alt="license" />
  <a href="https://npmcharts.com/compare/@rsbuild/plugin-type-check?minimal=true"><img src="https://img.shields.io/npm/dm/@rsbuild/plugin-type-check.svg?style=flat-square&colorA=564341&colorB=EDED91" alt="downloads" /></a>
</p>

<img width="1472" alt="Screenshot 2025-02-14 at 23 08 37" src="https://github.com/user-attachments/assets/15d38419-34af-4a69-8841-8f9c608d8b68" />

## Introduction

This plugin internally integrates with [ts-checker-rspack-plugin](https://github.com/rstackjs/ts-checker-rspack-plugin).

The type checking logic of `ts-checker-rspack-plugin` is similar to the native `tsc` command of TypeScript. It automatically reads the configuration options from `tsconfig.json` and can also be modified via the configuration options provided by the Type Check plugin.

The behavior of the plugin differs in the development and production builds:

- In development mode, type errors do not block the build process. They are only logged in the terminal.
- In production mode, type errors cause the build to fail in order to ensure the stability of the production code.

## Usage

Install:

```bash
npm add @rsbuild/plugin-type-check -D
```

Add plugin to your `rsbuild.config.ts`:

```ts
// rsbuild.config.ts
import { pluginTypeCheck } from "@rsbuild/plugin-type-check";

export default {
  plugins: [pluginTypeCheck()],
};
```

### Configuring tsconfig.json

The Type Check plugin by default performs checks based on the `tsconfig.json` file in the root directory of the current project. Below is an example of a `tsconfig.json` file, which you can also adjust according to the needs of your project.

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["DOM", "ES2020"],
    "module": "ESNext",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler"
  },
  "include": ["src"]
}
```

Please note that the fields in `tsconfig.json` will not affect the compilation behavior and output of Rsbuild, but will only affect the results of type checking.

## Options

### enable

Whether to enable TypeScript type checking.

- **Type:** `boolean`
- **Default:** `true`
- **Example:**

Disable TypeScript type checking:

```js
pluginTypeCheck({
  enable: false,
});
```

Enable type checking only in production mode:

```js
pluginTypeCheck({
  enable: process.env.NODE_ENV === "production",
});
```

Enable type checking only in development mode (it is not recommended to disable type checking in production mode, as it may reduce the stability of the production code):

```js
pluginTypeCheck({
  enable: process.env.NODE_ENV === "development",
});
```

### tsCheckerOptions

Modify the options of `ts-checker-rspack-plugin`, please refer to [ts-checker-rspack-plugin - README](https://github.com/rstackjs/ts-checker-rspack-plugin#readme) to learn about available options.

- **Type:** `Object | Function`
- **Default:**

```ts
const defaultOptions = {
  typescript: {
    // set 'readonly' to avoid emitting tsbuildinfo,
    // as the generated tsbuildinfo will break ts-checker-rspack-plugin
    mode: "readonly",
    // enable build when using project reference
    build: useReference,
    // avoid OOM issue
    memoryLimit: 8192,
    // use tsconfig of user project
    configFile: tsconfigPath,
    // use typescript of user project
    typescriptPath: require.resolve("typescript"),
  },
  issue: {
    // ignore types errors from node_modules
    exclude: [({ file = "" }) => /[\\/]node_modules[\\/]/.test(file)],
  },
  logger: {
    log() {
      // do nothing
      // we only want to display error messages
    },
    error(message: string) {
      console.error(message.replace(/ERROR/g, "Type Error"));
    },
  },
};
```

#### Object Type

When the value of `tsCheckerOptions` is an object, it will be deeply merged with the default configuration.

```ts
pluginTypeCheck({
  tsCheckerOptions: {
    issue: {
      exclude: [({ file = "" }) => /[\\/]some-folder[\\/]/.test(file)],
    },
  },
});
```

#### Function Type

When the value of `tsCheckerOptions` is a function, the default configuration will be passed as the first argument. You can directly modify the configuration object or return an object as the final configuration.

```ts
pluginTypeCheck({
  tsCheckerOptions(options) {
    options.async = false;
    return options;
  },
});
```

#### exclude Example

The `exclude` option can filter based on the `code`, `message`, or `file` from TS errors.

For example, the type mismatch error can be excluded using `code: 'TS2345'`:

```ts
pluginTypeCheck({
  tsCheckerOptions: {
    issue: {
      // Ignore "Argument of type 'string' is not assignable to parameter of type 'number'.ts(2345)"
      exclude: [{ code: "TS2345" }],
    },
  },
});
```

Or exclude files under `/some-folder/` using `file`:

```ts
pluginTypeCheck({
  tsCheckerOptions: {
    issue: {
      exclude: [({ file = "" }) => /[\\/]some-folder[\\/]/.test(file)],
    },
  },
});
```

#### Disable type errors from the error overlay

By default, type errors will be reported to Dev Server and displayed in the Rsbuild error overlay in development mode.

If you don't want type errors to be displayed in the error overlay, you can disable it by setting `devServer: false`:

```ts
pluginTypeCheck({
  tsCheckerOptions: {
    async: true,
    devServer: false,
  },
});
```
## Notes

- If you have enabled `ts-loader` in your project and manually configured `compileOnly: false`, please disable the Type Check plugin to avoid duplicate type checking.
- Some errors will be displayed as warnings in IDEs such as VS Code, but they will still be displayed as errors in the `ts-checker-rspack-plugin` check. For details, please refer to: [Why are some errors reported as warnings?](https://code.visualstudio.com/docs/typescript/typescript-compiling#_why-are-some-errors-reported-as-warnings).

## Performance Optimization

This plugin delegates type checking to TypeScript, so overall performance is mostly determined by `tsc` itself.

If you need faster type checks, start by optimizing your TypeScript setup using the [official TypeScript performance guide](https://github.com/microsoft/TypeScript/wiki/Performance).

For example, properly configuring the `include` and `exclude` scopes in `tsconfig.json` can significantly reduce unnecessary type checking and improve TypeScript performance:

```json title="tsconfig.json"
{
  "include": ["src"],
  "exclude": ["**/node_modules", "**/.*/"]
}
```

## Vue Components

To enable typecheck in `.vue` files, use the custom TypeScript wrapper [`@esctn/vue-tsc-api`](https://www.npmjs.com/package/@esctn/vue-tsc-api). It works on top of [`vue-tsc`](https://www.npmjs.com/package/vue-tsc) — a popular CLI tool for type-checking Vue 3 code.

```bash
npm add @esctn/vue-tsc-api -D
```

```js
pluginTypeCheck({
  tsCheckerOptions: {
    typescript: {
      typescriptPath: '@esctn/vue-tsc-api'
    }
  },
});
```

## License

[MIT](./LICENSE).
