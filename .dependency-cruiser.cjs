/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'kli-core-must-not-import-shell',
      comment: '@kb/kli core layer must not depend on shell (FCIS).',
      severity: 'error',
      from: { path: '^packages/kli/src/core/' },
      to: { path: '^packages/kli/src/shell/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    // Resolve packages that use "exports" with .ts entry points (e.g. boune, boune/testing)
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'default'],
    },
  },
};
