import nodemailer from 'nodemailer';

async function test() {
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'vargavmishra2002@gmail.com',
      pass: 'VargavMishra@123'
    }
  });

  try {
    console.log('Sending...');
    await transport.sendMail({
      from: '"Your Studio vargavmishra2002@gmail.com"',
      to: 'test@example.com',
      subject: 'Test',
      text: 'Test'
    });
    console.log('Sent!');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
