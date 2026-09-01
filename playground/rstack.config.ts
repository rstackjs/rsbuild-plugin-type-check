// Configuration guide: https://rstack.rs/config
import { define } from 'rstack';

define.app(async () => {
  const { pluginTypeCheck } = await import('../src/index.ts');

  return {
    plugins: [pluginTypeCheck()],
  };
});
