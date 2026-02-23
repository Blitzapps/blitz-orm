import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Surreal } from 'surrealdb';
import { genAlphaId } from '../../src/helpers';

const DB_URL = 'ws://127.0.0.1:8101';
const NAMESPACE = 'borm_bench';
const DATABASE = 'borm_bench';
const USERNAME = 'borm_bench';
const PASSWORD = 'borm_bench';
const CONTAINER_NAME = 'borm_bench_one_to_many';
const CONTAINER_ENDPOINT = 'http://localhost:8101';
const SCHEMA_FILE = fileURLToPath(new globalThis.URL('./schema.surql', import.meta.url));

const main = async (batchLength: number, batchSize: number) => {
  await runContainer();

  const data1 = generateData(batchLength * batchSize);
  const data2 = generateData(batchLength * batchSize);
  const data3 = generateData(batchLength * batchSize);
  const client = await createClient();

  const parentSurql1 = createParentSurql(data1.parent);
  const parentSurql2 = createParentSurql(data2.parent);
  const parentSurql3 = createParentSurql(data3.parent);

  const refBatches = Array.from({ length: batchLength }, (_, i) => {
    return createChildrenRefSurql(data1.parent, data1.children.slice(i * batchSize, (i + 1) * batchSize));
  });

  const edgeBatches = Array.from({ length: batchLength }, (_, i) => {
    return createChildrenEdgeSurql(data2.parent, data2.children.slice(i * batchSize, (i + 1) * batchSize));
  });

  const fosterRefBatches = Array.from({ length: batchLength }, (_, i) => {
    return createFosterChildrenSurql(data3.parent, data3.children.slice(i * batchSize, (i + 1) * batchSize));
  });

  await client.query(parentSurql1);
  await client.query(parentSurql2);
  await client.query(parentSurql3);

  const refDurations = await time(refBatches, async (query) => await client.query(query));
  const edgeDurations = await time(edgeBatches, async (query) => await client.query(query));
  const fosterRefDurations = await time(fosterRefBatches, async (query) => await client.query(query));

  console.log(`\n> Ref durations:\n${JSON.stringify(refDurations)}`);
  console.log(`\n> Edge durations:\n${JSON.stringify(edgeDurations)}`);
  console.log(`\n> Foster durations:\n${JSON.stringify(fosterRefDurations)}`);

  console.log(`> Ref total duration: ${refDurations.reduce((a, b) => a + b, 0)}ms`);
  console.log(`> Edge total duration: ${edgeDurations.reduce((a, b) => a + b, 0)}ms`);
  console.log(`> Foster total duration: ${fosterRefDurations.reduce((a, b) => a + b, 0)}ms`);
};

const runContainer = async () => {
  await stopContainer();

  await runCommand('docker', [
    'run',
    // '--rm',
    '--detach',
    '--name',
    CONTAINER_NAME,
    '--user',
    'root',
    '-p',
    '8101:8101',
    '--pull',
    'always',
    'surrealdb/surrealdb:v2',
    'start',
    '-u',
    USERNAME,
    '-p',
    PASSWORD,
    '--bind',
    '0.0.0.0:8101',
    'rocksdb:///data/blitz.db',
  ]);

  await waitUntil(
    async () => {
      try {
        const output = await runCommand('docker', ['inspect', '-f', '{{.State.Running}}', CONTAINER_NAME]);
        return output.trim() === 'true';
      } catch {
        return false;
      }
    },
    100,
    120000,
    'Timed out waiting for container to be running',
  );

  await waitUntil(
    async () => {
      try {
        await runCommand('docker', ['exec', CONTAINER_NAME, './surreal', 'is-ready', '--endpoint', CONTAINER_ENDPOINT]);
        return true;
      } catch {
        return false;
      }
    },
    500,
    30000,
    'Timed out waiting for SurrealDB to be ready',
  );

  await runCommand(
    'docker',
    [
      'exec',
      '-i',
      CONTAINER_NAME,
      './surreal',
      'sql',
      '-u',
      USERNAME,
      '-p',
      PASSWORD,
      '--endpoint',
      CONTAINER_ENDPOINT,
    ],
    [
      `DEFINE NAMESPACE ${NAMESPACE};`,
      `USE NS ${NAMESPACE};`,
      `DEFINE DATABASE ${DATABASE};`,
      `DEFINE USER ${USERNAME} ON NAMESPACE PASSWORD '${PASSWORD}' ROLES OWNER;`,
      '',
    ].join('\n'),
  );

  await runCommand('docker', ['cp', SCHEMA_FILE, `${CONTAINER_NAME}:/tmp/schema.surql`]);

  await runCommand('docker', [
    'exec',
    '-i',
    CONTAINER_NAME,
    './surreal',
    'import',
    '-u',
    USERNAME,
    '-p',
    PASSWORD,
    '--namespace',
    NAMESPACE,
    '--database',
    DATABASE,
    '--endpoint',
    CONTAINER_ENDPOINT,
    '/tmp/schema.surql',
  ]);
};

const stopContainer = async () => {
  try {
    await runCommand('docker', ['rm', '-f', CONTAINER_NAME]);
  } catch {
    // Container may not exist; that's fine for cleanup.
  }
};

const waitUntil = async (
  condition: () => Promise<boolean>,
  intervalMs: number,
  timeoutMs: number,
  timeoutMessage: string,
) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) {
      return;
    }
    await sleep(intervalMs);
  }
  throw new Error(timeoutMessage);
};

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const runCommand = async (command: string, args: string[], stdin?: string): Promise<string> => {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      stdout += text;
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      process.stderr.write(text);
      stderr += text;
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}: ${stderr || stdout}`));
    });

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
};

const time = async <T>(input: T[], cb: (input: T) => Promise<unknown>) => {
  const durations: number[] = [];
  for (const item of input) {
    const start = performance.now();
    await cb(item);
    const end = performance.now();
    durations.push(end - start);
  }
  return durations;
};

const createClient = async () => {
  const db = new Surreal();
  await db.connect(DB_URL, {
    namespace: NAMESPACE,
    database: DATABASE,
    versionCheck: false,
    reconnect: {
      enabled: false,
    },
    authentication: async () => ({ username: USERNAME, password: PASSWORD }),
  });
  return db;
};

interface Parent {
  id: string;
  name: string;
}

interface Child {
  id: string;
  name: string;
  parent: Parent;
}

const generateData = (childrenLen: number): { parent: Parent; children: Child[] } => {
  const parent: Parent = {
    id: genAlphaId(16),
    name: genAlphaId(16),
  };

  const children: Child[] = Array.from({ length: childrenLen }, () => ({
    id: genAlphaId(16),
    name: genAlphaId(16),
    parent,
  }));

  return { parent, children };
};

const createParentSurql = (parent: Parent): string => {
  return `CREATE parent:${parent.id} CONTENT { name: '${parent.name}' };`;
};

const createChildrenRefSurql = (parent: Parent, children: Child[]): string => {
  const childrenCreateQuery = children
    .map((child) => `CREATE child:${child.id} CONTENT { name: '${child.name}', parent: parent:${parent.id} };`)
    .join('\n');
  return `BEGIN TRANSACTION;\n${childrenCreateQuery}\nCOMMIT TRANSACTION;`;
};

const createChildrenEdgeSurql = (parent: Parent, children: Child[]): string => {
  const childrenCreateQuery = children
    .map((child) => `CREATE child:${child.id} CONTENT { name: '${child.name}' };`)
    .join('\n');
  const edgesCreateQuery = children
    .map((child) => `RELATE parent:${parent.id}->parent_child->child:${child.id};`)
    .join('\n');
  return `BEGIN TRANSACTION;\n${childrenCreateQuery}\n${edgesCreateQuery}\nCOMMIT TRANSACTION;`;
};

const createFosterChildrenSurql = (parent: Parent, children: Child[]): string => {
  const childrenCreateQuery = children
    .map((child) => `CREATE child:${child.id} CONTENT { name: '${child.name}', foster_parent: parent:${parent.id} };`)
    .join('\n');
  return `BEGIN TRANSACTION;\n${childrenCreateQuery}\nCOMMIT TRANSACTION;`;
};

main(10, 100)
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopContainer();
  });
