// Two projects:
//   "domain"     — pure TypeScript logic, runs on node (fast, no RN runtime)
//   "components" — renders the real screens through react-native-web in jsdom
//
// Keeping them separate means COMPONENT-001 cannot silently pass by
// re-running the domain suite.
//
// NOTE on the component environment: the full `jest-expo` native preset is not
// usable in this sandbox — it babel-transforms the entire react-native native
// source tree and the process is OOM-killed (host has 3.9 GB total RAM;
// observed "FATAL ERROR: Ineffective mark-compacts near heap limit" and a
// kernel "Killed"). react-native-web is the renderer this app's declared
// `web-companion` target actually uses, so these tests exercise the same
// component code the preview runs.
module.exports = {
  projects: [
    {
      displayName: 'domain',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/*.test.ts'],
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
      },
    },
    {
      displayName: 'components',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/__tests__/*.test.tsx'],
      moduleNameMapper: {
        '^react-native$': 'react-native-web',
      },
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
      },
      transformIgnorePatterns: [
        'node_modules/(?!(react-native-web|react-native|@react-native|expo|@expo)/)',
      ],
    },
  ],
};
