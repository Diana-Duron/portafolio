import * as fs from 'fs';
const dts = fs.readFileSync('node_modules/@content-island/api-client/dist/index.d.ts', 'utf8');

// Match everything from 'export declare type FieldType =' up to the end of its definition
const typeMatches = Array.from(dts.matchAll(/export declare (interface|type) (\w+)[^]*?(?=\n\nexport|\n\ndeclare|$)/g));
for (const match of typeMatches) {
  if (['CreateEntityParams', 'CreateEnumParams', 'FieldType', 'FieldTypeSpec', 'Model', 'EntityContentType'].includes(match[2])) {
    console.log(match[0]);
    console.log('---');
  }
}
