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
        // rendr design system — monochrome
        r: {
          bg: '#0a0a0a',
          surface: '#141414',
          elevated: '#1e1e1e',
          overlay: '#282828',
          border: '#2a2a2a',
          'border-light': '#3a3a3a',
          'input-bg': '#111111',
          'input-border': '#2a2a2a',
          'input-focus': '#ffffff',
          text: '#f5f5f5',
          'text-secondary': '#999999',
          'text-muted': '#666666',
          'text-dim': '#444444',
          accent: '#ffffff',
          'accent-hover': '#e0e0e0',
          'accent-muted': '#cccccc',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
          'error-muted': '#dc2626'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontSize: {
        '2xs': '10px',
        'xs': '12px',
        'sm': '13px',
        'base': '14px'
      },
      fontFamily: {
        mono: ['"Geist Mono"', '"SF Mono"', '"Fira Code"', 'Consolas', 'monospace'],
        sans: ['"Geist"', '"Geist Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        }
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
