import {
    defineConfig,
    presetAttributify,
    presetIcons,
    presetTypography,
    presetUno,
    presetWebFonts,
    transformerDirectives,
    transformerVariantGroup
} from 'unocss'

export default defineConfig({
    presets: [
        presetUno(),
        presetAttributify(),
        presetIcons({
            scale: 1.2,
            warn: true,
        }),
        presetTypography(),
        presetWebFonts({
            fonts: {
                sans: 'Inter:400,600,700',
                mono: 'Fira Code',
            },
        }),
    ],
    transformers: [
        transformerDirectives(),
        transformerVariantGroup(),
    ],
    shortcuts: {
        'btn': 'px-4 py-2 rounded-lg font-semibold transition-all duration-200 cursor-pointer',
        'btn-primary': 'btn bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95',
        'btn-secondary': 'btn bg-gray-200 text-gray-800 hover:bg-gray-300 active:scale-95',
        'input-base': 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all',
        'card': 'bg-white rounded-xl shadow-lg p-6',
        'form-group': 'mb-4',
        'label': 'block mb-2 font-semibold text-gray-700',
    },
    theme: {
        colors: {
            primary: '#10b981',
            secondary: '#6366f1',
        }
    }
})
