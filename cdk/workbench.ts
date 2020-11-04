import * as fs from 'fs';
import * as path from 'path';

import * as yaml from 'js-yaml';

const file = fs.readFileSync(path.join(__dirname, '../manifests/services/imageservice.yaml'), 'utf8');
const manifest = yaml.safeLoadAll(file);

const deployment = manifest.find(m => m.kind == 'Deployment');
const container = deployment.spec.template.spec.containers.find((c: { name: string; }) => c.name == 'imageservice');

console.log(container);