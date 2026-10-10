import { createClient } from '@content-island/api-client';

const client = createClient({ accessToken: 'fc8daca5fe88b9f35767c48514f4265f' });

async function createModels() {
  try {
    const res = await client.createModel({
      name: 'Experiencia Laboral',
      id: 'experienciaLaboral', // typically ids are camelCase or dashed
      description: 'Modelo para experiencias laborales',
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        }
      ]
    });
    console.log("Success", res);
  } catch (err) {
    console.error("Failed:", err.message);
    if (err.response) {
       console.error("Response:", await err.response.text());
    }
    console.error("Details:", err);
  }
}

createModels();
