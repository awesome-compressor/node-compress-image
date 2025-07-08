import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      // eslint ignore globs here
    ],
  },
  {
    rules: {
      'node/prefer-global/buffer': 'off',
      'no-console': 'off',
    },
  },
)
