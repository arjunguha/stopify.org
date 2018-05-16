import * as storage from '@google-cloud/storage';

export const sto = storage();

async function init() {
  const functionName = process.env.FUNCTION_NAME;
  if (typeof functionName !== 'string') {
    console.warn('Running locally with hardcoded settings');
    return {
      thirdPartyCompilers: 'http://104.198.65.105:8000',
      outputBucket: sto.bucket('stopify-compiler-output-testing')
    };
  }

  const bucket = sto.bucket('arjun-umass-settings');
  const [buf] = await bucket.file(functionName + '.json').download();
  const settings = JSON.parse(buf.toString());

  const thirdPartyCompilers = settings['third-party-compilers'];
  const outputBucket = settings['output-bucket'];
  if (typeof thirdPartyCompilers !== 'string') {
    throw new Error(`expected key 'third-party-compilers' in settings`);
  }
  if (typeof outputBucket !== 'string') {
    throw new Error(`expected key 'output-bucket' in settings`);
  }
  console.info('Successfully loaded settings: ' + buf.toString());
  return { thirdPartyCompilers, outputBucket: sto.bucket(outputBucket) };
}

export const settings = init();
