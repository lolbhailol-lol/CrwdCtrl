/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // Enable class-based dark mode
    theme: {
        screens: {
            xs: '20rem',        // 320px — iPhone SE
            sm375: '23.4375rem', // 375px — iPhone 14/15/16
            sm430: '26.875rem', // 430px — iPhone Pro Max
            sm: '40rem',        // 640px — Tailwind default
            md: '48rem',        // 768px — tablets
            lg: '64rem',        // 1024px — laptops
            xl: '80rem',        // 1280px
            '2xl': '90rem',     // 1440px — desktops
        },
        extend: {
            fontFamily: {
                sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
                inter: ['Poppins', 'system-ui', 'sans-serif'],
                poppins: ['Poppins', 'system-ui', 'sans-serif'],
            },
            colors: {
                // Custom colors for better dark mode support
                dark: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0f172a',
                    950: '#0E0E0F', // Custom dark background color
                }
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'slide-in': 'slideIn 0.3s ease-out',
                'bounce-gentle': 'bounceGentle 2s infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                bounceGentle: {
                    '0%, 100%': { transform: 'translateY(-5%)' },
                    '50%': { transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}