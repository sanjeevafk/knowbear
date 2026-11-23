import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    { ignores: ['dist'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.ts'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
    },
    {
        // Browser extension: classic scripts sharing globalThis.KB (not ES modules).
        extends: [js.configs.recommended],
        files: ['extension/**/*.js'],
        ignores: ['extension/tests/**'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: { ...globals.browser, ...globals.webextensions, ...globals.serviceworker },
        },
    },
    {
        extends: [js.configs.recommended],
        files: ['extension/tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.browser, ...globals.node, ...globals.webextensions },
        },
    }
)
