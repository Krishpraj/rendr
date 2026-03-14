/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/src/**/*.{ts,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        // VS Code exact colors
        vsc: {
          bg: '#1e1e1e',
          'bg-dark': '#181818',
          'bg-darker': '#111111',
          sidebar: '#181818',
          'sidebar-bg': '#181818',
          activitybar: '#181818',
          'activitybar-active': '#d7d7d7',
          'activitybar-inactive': '#7f7f7f',
          editor: '#1e1e1e',
          titlebar: '#181818',
          statusbar: '#007acc',
          'statusbar-text': '#ffffff',
          'statusbar-hover': '#1f8ad2',
          tab: '#1e1e1e',
          'tab-inactive': '#2d2d2d',
          'tab-border': '#252526',
          border: '#2b2b2b',
          'border-light': '#3c3c3c',
          'input-bg': '#313131',
          'input-border': '#3c3c3c',
          selection: '#264f78',
          highlight: '#0078d4',
          'list-hover': '#2a2d2e',
          'list-active': '#37373d',
          'list-focus': '#04395e',
          text: '#cccccc',
          'text-dim': '#969696',
          'text-dimmer': '#6e7681',
          'text-bright': '#e8e8e8',
          green: '#3fb950',
          red: '#f85149',
          blue: '#007acc',
          orange: '#cca700'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontSize: {
        '2xs': '10px',
        'vsc': '13px'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
        mono: ['Consolas', 'Menlo', 'Monaco', 'Courier New', 'monospace']
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
