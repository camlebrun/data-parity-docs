// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
  site: 'https://camlebrun.github.io',
  base: '/data-parity-docs',
  integrations: [
    // Must come before Starlight so that ```mermaid fences are handled first.
    mermaid({ theme: 'neutral', autoTheme: true }),
    starlight({
      title: 'data-parity',
      description:
        'Prove that two tables are identical across engines, without moving data. A dbt package plus a small Python CLI that compares row-hash aggregates.',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        alt: 'data-parity logo',
      },
      favicon: '/favicon.svg',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/camlebrun/data-parity' },
      ],
      editLink: {
        baseUrl: 'https://github.com/camlebrun/data-parity-docs/edit/main/',
      },
      lastUpdated: false,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      customCss: ['./src/styles/custom.css'],
      components: {
        Footer: './src/components/Footer.astro',
      },
      plugins: [starlightLinksValidator()],
      sidebar: [
        {
          label: 'Getting started',
          items: [
            'getting-started/install',
            'getting-started/quickstart',
            'getting-started/reading-the-report',
          ],
        },
        {
          label: 'Concepts',
          items: [
            'concepts/how-it-works',
            'concepts/row-hash',
            'concepts/guarantees',
            'concepts/passes',
            'concepts/cache',
          ],
        },
        {
          label: 'Guides',
          items: [
            'guides/configure-models',
            'guides/scope-and-cost',
            'guides/engines',
            'guides/ci',
            'guides/windows',
            'guides/troubleshooting',
          ],
        },
        {
          label: 'Reference',
          items: [
            'reference/cli',
            'reference/macros',
            'reference/parity-json',
            'reference/exit-codes',
            'reference/engine-matrix',
          ],
        },
        { label: 'Example', items: ['example/agg-daily-fuel'] },
        {
          label: 'Contributing',
          items: ['contributing/test-bed', 'contributing/new-engine'],
        },
        { label: 'FR runbook', items: ['fr/runbook'] },
      ],
    }),
  ],
});
