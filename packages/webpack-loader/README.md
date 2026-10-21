# @jqhtml/webpack-loader

webpack loader for [JQHTML](https://github.com/jqhtml/jqhtml) templates. Import `.jqhtml` files in a webpack 5 build; the same rule works in Rspack.

```bash
npm install @jqhtml/core jquery
npm install --save-dev @jqhtml/webpack-loader
```

## Setup

```javascript
// webpack.config.js (or rspack.config.js)
module.exports = {
  module: {
    rules: [{ test: /\.jqhtml$/, loader: '@jqhtml/webpack-loader' }]
  }
};
```

## Usage

Each `.jqhtml` file becomes an ES module whose default export is the compiled template of its first `<Define:>`. Register it with the runtime:

```javascript
import jqhtml from '@jqhtml/core';
import User_Card_Template from './user_card.jqhtml';

jqhtml.register(User_Card_Template);
```

A component with behaviour also registers its class; the runtime pairs class and template by name:

```javascript
import { Jqhtml_Component } from '@jqhtml/core';

class User_Card extends Jqhtml_Component {
  async on_load() { /* ... */ }
}
jqhtml.register(User_Card);
```

## Behaviour

- **No options.** Templates compile with `@jqhtml/parser` at the same version as this loader.
- **Source maps** follow webpack's `devtool`: when it asks for maps, errors and breakpoints map back to the `.jqhtml` line and column.
- **Compile errors** fail the build, naming the file, line and column (`at src/user_card.jqhtml:4:3`) with a code excerpt.
- **Cacheable**: the output depends only on the template source.
- **Rspack**: the loader uses only the standard loader API (`this.callback`, `this.cacheable`, `this.sourceMap`, `this.resourcePath`).

Full documentation: **[docs.jqhtml.org](https://docs.jqhtml.org/)**

## License

MIT
