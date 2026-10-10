import { defineCollection, z } from 'astro:content';
import { createClient } from '@content-island/api-client';

// Astro carga las variables de entorno automáticamente
const client = createClient({
  accessToken: import.meta.env.CONTENT_ISLAND_ACCESS_TOKEN || process.env.CONTENT_ISLAND_ACCESS_TOKEN || ''
});

// Loader genérico para conectar Content Island a Astro
function contentIslandLoader(contentType: string) {
  return {
    name: `content-island-${contentType}`,
    load: async ({ store, logger }: any) => {
      logger.info(`Sincronizando ${contentType} desde Content Island...`);
      try {
        const items = await client.getContentList({ contentType, pagination: { take: 1000 } });
        store.clear();
        for (const item of items) {
          store.set({
            id: item.id,
            data: item // Los campos retornan en la raíz del item
          });
        }
      } catch (err: any) {
        logger.error(`Error al cargar ${contentType}: ${err.message}`);
      }
    }
  };
}

// Media schema que usa Content Island
const mediaSchema = z.object({
  name: z.string(),
  url: z.string()
});

const experienciasLaborales = defineCollection({
  loader: contentIslandLoader('Experiencias Laborales'),
  schema: z.object({
    id: z.string(),
    language: z.string(),
    lastUpdate: z.string(),
    title: z.string().optional(),
    company: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isCurrent: z.boolean().optional(),
    description: z.string().optional(),
  })
});

const proyectos = defineCollection({
  loader: contentIslandLoader('proyectos'),
  schema: z.object({
    id: z.string(),
    language: z.string(),
    lastUpdate: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    image: mediaSchema.optional(),
    repoUrl: z.string().optional(),
    liveUrl: z.string().optional(),
    technologies: z.array(z.string()).optional(),
  })
});

const blogs = defineCollection({
  loader: contentIslandLoader('blogs'),
  schema: z.object({
    id: z.string(),
    language: z.string(),
    lastUpdate: z.string(),
    title: z.string().optional(),
    slug: z.string().optional(),
    summary: z.string().optional(),
    content: z.string().optional(),
    publishDate: z.string().optional(),
    coverImage: mediaSchema.optional(),
  })
});

const perfil = defineCollection({
  loader: contentIslandLoader('perfil'),
  schema: z.object({
    id: z.string(),
    language: z.string(),
    lastUpdate: z.string(),
    name: z.string().optional(),
    bio: z.string().optional(),
    avatar: mediaSchema.optional(),
    githubUrl: z.string().optional(),
    linkedinUrl: z.string().optional(),
    cvUrl: mediaSchema.optional(),
  })
});

const habilidades = defineCollection({
  loader: contentIslandLoader('habilidades'),
  schema: z.object({
    id: z.string(),
    language: z.string(),
    lastUpdate: z.string(),
    name: z.string().optional(),
    category: z.string().optional(),
  })
});

export const collections = {
  'experienciasLaborales': experienciasLaborales,
  'proyectos': proyectos,
  'blogs': blogs,
  'perfil': perfil,
  'habilidades': habilidades
};
