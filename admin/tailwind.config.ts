import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        oli: {
          green:      '#5F7D67',
          'green-dk': '#4a6454',
          gold:       '#B8893C',
          bg:         '#F4EFEA',
          dark:       '#2F2F2F',
          gray:       '#6B6B6B',
          lgray:      '#9B9B9B',
          border:     '#E0D8D0',
          red:        '#D9534F',
          sidebar:    '#1E2A22',
        },
      },
    },
  },
  plugins: [],
};

export default config;
