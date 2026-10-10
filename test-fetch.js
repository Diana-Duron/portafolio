import { createClient } from '@content-island/api-client';
const client = createClient({ accessToken: 'fc8daca5fe88b9f35767c48514f4265f' });

async function testFetch() {
  try {
    const res = await client.getContentList({ contentType: 'experiencias-laborales' });
    console.log("experiencias-laborales:", res);
  } catch (err) {
    console.error("error experiencias-laborales", err.message);
  }
}
testFetch();
