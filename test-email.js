import { sendStudioEmail } from './src/modules/studio/studio.email.js';

async function main() {
  console.log('Sending email...');
  try {
    const res = await sendStudioEmail({
      to: 'vargavmishra2002@gmail.com',
      subject: 'Test Email',
      html: '<p>Test</p>',
      text: 'Test'
    });
    console.log('Success:', res);
  } catch (e) {
    console.log('Failed:', e.message);
  }
}

main().catch(console.error);
