import { createClient } from '@content-island/api-client';
const client = createClient({ accessToken: 'fc8daca5fe88b9f35767c48514f4265f' });

async function check() {
  const slugs = [
    'experiencias-laborales',
    'experienciasLaborales',
    'experiencias_laborales',
    'Experiencias Laborales',
    'experienciaslaborales',
    'experiencias-laboral',
    'experiencia-laboral'
  ];

  for (const slug of slugs) {
    try {
      const res = await client.getContentList({ contentType: slug });
      console.log(`Slug '${slug}': ${res?.length || 0}`);
    } catch (e) {
      console.log(`Slug '${slug}': ERROR (${e.message})`);
    }
  }
}
check();
