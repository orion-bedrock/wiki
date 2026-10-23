// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
    redirects: {
        '/': '/en/',
    },
	integrations: [
		starlight({
			title: 'Orion Bedrock',
			social: [
                { icon: 'github', label: 'GitHub', href: 'https://github.com/orion-bedrock' },
                { icon: 'discord', label: 'Discord', href: 'https://discord.gg/NE6TWXz4xU' },
            ],
			sidebar: [
				{
					label: 'Server',
					translations: { es: 'Servidor' },
					items: [{ autogenerate: { directory: 'server' } }],
				},
				{
					label: 'Proxy',
					translations: { es: 'Proxy' },
					items: [{ autogenerate: { directory: 'proxy' } }],
				},
			],
            defaultLocale: 'en',
            locales: {
                en: {
                    label: 'English',
                },
                es: {
                    label: 'Spanish',
                }
            },
		}),
	],
});
