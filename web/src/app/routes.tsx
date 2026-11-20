import type { RouteObject } from 'react-router';
import { RootLayout } from './RootLayout';
import { NotFound } from './NotFound';

/**
 * Route table. Heavy routes (3D, camera, ML) are lazy-loaded so the landing
 * bundle stays small and the 3D/vision code is only fetched when needed.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('@/features/landing/LandingPage')).LandingPage,
        }),
      },
      {
        path: 'setup',
        lazy: async () => ({ Component: (await import('@/features/setup/SetupPage')).SetupPage }),
      },
      {
        path: 'workspace',
        lazy: async () => ({
          Component: (await import('@/features/workspace/WorkspacePage')).WorkspacePage,
        }),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];
