import { createClient } from '@content-island/api-client';

const client = createClient({ accessToken: 'fc8daca5fe88b9f35767c48514f4265f' });

async function getProject() {
  try {
    const res = await client.getProject();
    console.log("Success", res);
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

getProject();
