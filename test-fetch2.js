import { createClient } from '@content-island/api-client';
const client = createClient({ accessToken: 'fc8daca5fe88b9f35767c48514f4265f' });

async function testFetch() {
  try {
    const project = await client.getProject();
    console.log("Project Content Types:");
    for (const ct of project.contentTypes) {
      console.log(`- ${ct.name} (id: ${ct.id})`);
      const res = await client.getContentList({ contentType: ct.id, language: 'es' });
      console.log(`  Items by ID (es): ${res?.length || 0}`);
      const resEn = await client.getContentList({ contentType: ct.id, language: 'en' });
      console.log(`  Items by ID (en): ${resEn?.length || 0}`);
      const resAll = await client.getContentList({ contentType: ct.id });
      console.log(`  Items by ID (all/default): ${resAll?.length || 0}`);
      try {
        const camelCase = 'experienciasLaborales';
        const res3 = await client.getContentList({ contentType: camelCase });
        console.log(`  Items by camelCase '${camelCase}': ${res3?.length || 0}`);
      } catch (e) {
      }
    }
  } catch (err) {
    console.error("error", err.message);
  }
}
testFetch();
