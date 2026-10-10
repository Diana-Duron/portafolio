import { createClient } from '@content-island/api-client';
const client = createClient({ accessToken: 'fc8daca5fe88b9f35767c48514f4265f' });

async function check() {
  const project = await client.getProject();
  for (const ct of project.contentTypes) {
    if (ct.name === 'Experiencias Laborales') {
      console.log("Keys of ContentType:", Object.keys(ct));
      console.log("ContentType object:", JSON.stringify(ct, null, 2));
    }
  }
}
check();
