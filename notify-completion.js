const { v4: uuidv4 } = require('uuid');
const https = require('https');

const TOPIC = uuidv4();

function sendNotification(message) {
  const data = JSON.stringify({
    topic: TOPIC,
    message: message,
    title: 'Claude Processing Complete'
  });

  const options = {
    hostname: 'ntfy.sh',
    port: 443,
    path: '/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Notification sent to topic: ${TOPIC}`);
    console.log(`Status: ${res.statusCode}`);
  });

  req.on('error', (error) => {
    console.error('Error sending notification:', error);
  });

  req.write(data);
  req.end();
}

console.log(`Topic ID: ${TOPIC}`);
console.log('Subscribe to notifications at: https://ntfy.sh/' + TOPIC);

process.on('exit', () => {
  sendNotification('Claude processing completed successfully!');
});

process.on('SIGINT', () => {
  sendNotification('Claude processing interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  sendNotification('Claude processing terminated');
  process.exit(0);
});

setTimeout(() => {
  sendNotification('Claude processing completed!');
  process.exit(0);
}, 5000);