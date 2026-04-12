#!/usr/bin/env node
import { Command } from 'commander';
import prompts from 'prompts';
import { defaultFeatureSelection, featureCatalog } from '../src/config/features.js';
import { writeProjectToDirectory } from '../src/modules/generator/generator.engine.js';

const program = new Command();

function parseJsonEntity(value) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid entity JSON: ${value}`);
  }
}

function parseFeatureList(value) {
  if (!value) return undefined;

  const selected = Object.fromEntries(
    Object.keys(featureCatalog).map((key) => [key, false])
  );

  for (const key of value.split(',').map((item) => item.trim()).filter(Boolean)) {
    if (!Object.hasOwn(featureCatalog, key)) {
      throw new Error(`Unknown feature: ${key}`);
    }

    selected[key] = true;
  }

  return selected;
}

function featureObjectFromKeys(keys) {
  const selected = Object.fromEntries(
    Object.keys(featureCatalog).map((key) => [key, false])
  );

  for (const key of keys) {
    selected[key] = true;
  }

  return selected;
}

async function promptForMissing(options) {
  const questions = [];

  if (!options.name) {
    questions.push({
      type: 'text',
      name: 'projectName',
      message: 'Project name',
      initial: 'My SaaS API'
    });
  }

  if (!options.paymentMode) {
    questions.push({
      type: 'select',
      name: 'paymentMode',
      message: 'Payment mode',
      choices: [
        { title: 'Mock payments', value: 'mock' },
        { title: 'Razorpay', value: 'razorpay' }
      ],
      initial: 0
    });
  }

  if (!options.features) {
    questions.push({
      type: 'multiselect',
      name: 'featureKeys',
      message: 'Select features',
      choices: Object.entries(featureCatalog).map(([key, feature]) => ({
        title: feature.label,
        value: key,
        selected: defaultFeatureSelection[key]
      }))
    });
  }

  if (!options.output) {
    questions.push({
      type: 'text',
      name: 'output',
      message: 'Output directory',
      initial: process.cwd()
    });
  }

  questions.push({
    type: 'confirm',
    name: 'addCrud',
    message: 'Add a CRUD entity now?',
    initial: false
  });

  const answers = await prompts(questions, {
    onCancel: () => {
      process.exit(1);
    }
  });

  let crudEntities = options.entity?.map(parseJsonEntity) ?? [];

  if (answers.addCrud) {
    const crud = await prompts([
      {
        type: 'text',
        name: 'name',
        message: 'Entity name in PascalCase',
        initial: 'Post'
      },
      {
        type: 'text',
        name: 'route',
        message: 'Route segment',
        initial: 'posts'
      },
      {
        type: 'select',
        name: 'access',
        message: 'Access level',
        choices: [
          { title: 'Authenticated users', value: 'authenticated' },
          { title: 'Public', value: 'public' },
          { title: 'Admins only', value: 'admin' },
          { title: 'Pro subscribers only', value: 'pro' }
        ]
      },
      {
        type: 'text',
        name: 'fields',
        message: 'Fields as name:type pairs, comma-separated',
        initial: 'title:String,content:String,published:Boolean'
      }
    ]);

    crudEntities = crudEntities.concat({
      name: crud.name,
      route: crud.route,
      access: crud.access,
      fields: crud.fields.split(',').map((field) => {
        const [name, type = 'String'] = field.trim().split(':');
        return { name, type, required: true };
      })
    });
  }

  return {
    projectName: options.name ?? answers.projectName,
    packageName: options.packageName,
    paymentMode: options.paymentMode ?? answers.paymentMode,
    features: options.features ? parseFeatureList(options.features) : featureObjectFromKeys(answers.featureKeys),
    crudEntities,
    output: options.output ?? answers.output
  };
}

program
  .name('saas-builder')
  .description('Generate production-ready SaaS backend boilerplates')
  .version('1.0.0');

program
  .command('create-app')
  .description('Create a SaaS backend project')
  .option('-n, --name <name>', 'project name')
  .option('-p, --package-name <name>', 'npm package name')
  .option('-o, --output <directory>', 'output directory')
  .option('-m, --payment-mode <mode>', 'payment mode: mock or razorpay')
  .option('-f, --features <features>', 'comma-separated feature keys')
  .option('-e, --entity <json...>', 'CRUD entity JSON; may be passed multiple times')
  .action(async (options) => {
    const input = await promptForMissing(options);
    const result = await writeProjectToDirectory(input, input.output);

    console.log(`Created ${result.config.projectName}`);
    console.log(`Path: ${result.projectRoot}`);
    console.log(`Files: ${result.fileCount}`);
    console.log('Next: npm install && npx prisma migrate dev && npm run dev');
  });

program.parseAsync(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
