/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './index.html',
        './js/**/*.js',
        './mapa-godmode.html'
    ],
    theme: {
        extend: {
            fontFamily: {
                cinzel: ['Cinzel', 'Georgia', 'serif'],
                sans: ['Inter', 'system-ui', 'sans-serif']
            }
        }
    },
    // ATENÇÃO: preflight desativado de propósito.
    //
    // O style.css já faz o reset do projeto e tem regras de ID (#content-container,
    // #sub-menu-bar) que conflitam com o preflight. Manter os dois ligados
    // causava reestilização inconsistente entre abas.
    corePlugins: {
        preflight: false
    },
    plugins: []
};