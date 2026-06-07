const { createCanvas } = require('canvas');
const fs = require('fs');

const W = 1280, H = 800;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = '#0f1117';
ctx.fillRect(0, 0, W, H);

// Header bar
ctx.fillStyle = '#1a1f2e';
ctx.fillRect(0, 0, W, 60);
ctx.fillStyle = '#68d391';
ctx.font = 'bold 22px sans-serif';
ctx.fillText('📈 WallStreet Alerts', 30, 38);

// Subtitle
ctx.fillStyle = '#a0aec0';
ctx.font = '16px sans-serif';
ctx.fillText('Real-time stock price alerts for NYSE & NASDAQ', 30, 90);

// Alert cards
const alerts = [
  { symbol: 'AAPL', price: '$182.50', change: '+1.23%', type: 'Price Alert', status: '🟢 Active', color: '#2d3748' },
  { symbol: 'TSLA', price: '$245.80', change: '-0.87%', type: 'RSI Alert', status: '🟡 Triggered', color: '#2d3748' },
  { symbol: 'NVDA', price: '$498.20', change: '+3.45%', type: 'MACD Alert', status: '🟢 Active', color: '#2d3748' },
  { symbol: 'MSFT', price: '$378.90', change: '+0.62%', type: 'Volume Alert', status: '🔴 Fired', color: '#2d3748' },
];

alerts.forEach((a, i) => {
  const x = 30 + (i % 2) * 610;
  const y = 120 + Math.floor(i / 2) * 160;
  
  // Card
  ctx.fillStyle = a.color;
  ctx.beginPath();
  ctx.roundRect(x, y, 580, 140, 12);
  ctx.fill();
  
  // Border
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Symbol
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(a.symbol, x + 20, y + 42);
  
  // Price
  ctx.fillStyle = '#68d391';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(a.price, x + 20, y + 76);
  
  // Change
  ctx.fillStyle = a.change.startsWith('+') ? '#68d391' : '#fc8181';
  ctx.font = '16px sans-serif';
  ctx.fillText(a.change, x + 20, y + 102);
  
  // Type
  ctx.fillStyle = '#a0aec0';
  ctx.font = '14px sans-serif';
  ctx.fillText(a.type, x + 20, y + 126);
  
  // Status
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px sans-serif';
  ctx.fillText(a.status, x + 400, y + 42);
});

// Bottom panel - add alert button
ctx.fillStyle = '#1a1f2e';
ctx.fillRect(0, 580, W, 220);

ctx.fillStyle = '#68d391';
ctx.beginPath();
ctx.roundRect(30, 610, 260, 50, 8);
ctx.fill();
ctx.fillStyle = '#000000';
ctx.font = 'bold 18px sans-serif';
ctx.fillText('+ Add New Alert', 70, 641);

// Stats
ctx.fillStyle = '#a0aec0';
ctx.font = '14px sans-serif';
ctx.fillText('4 active alerts  •  2 triggered today  •  Powered by Finnhub', 320, 636);

// Worker URL info
ctx.fillStyle = '#4a5568';
ctx.font = '13px sans-serif';
ctx.fillText('Cloudflare Worker connected  ✓', 30, 700);

ctx.fillStyle = '#2d3748';
ctx.fillRect(30, 720, 580, 40);
ctx.fillStyle = '#68d391';
ctx.font = '13px sans-serif';
ctx.fillText('https://your-worker.workers.dev', 50, 745);

fs.writeFileSync('/home/user/WallStreet_Alerts/screenshot.png', canvas.toBuffer('image/png'));
console.log('Screenshot generated');
