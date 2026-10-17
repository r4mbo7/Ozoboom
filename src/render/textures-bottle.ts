import { type Shape, WHITE, paint } from './paint';

const BLACK = '#000000';

// The Méprisant's plastic bottle, neck first, in black and pure white whatever the hour, at twice
// the world size: 27 × 9 px once scaled to its projectile.
export function paintBottle(): Shape {
  return paint(72, 32, 10, (ctx) => {
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-25, -9);
      ctx.lineTo(6, -9);
      ctx.quadraticCurveTo(15, -9, 17, -4);
      ctx.lineTo(21, -4);
      ctx.lineTo(21, 4);
      ctx.lineTo(17, 4);
      ctx.quadraticCurveTo(15, 9, 6, 9);
      ctx.lineTo(-25, 9);
      ctx.quadraticCurveTo(-28, 9, -28, 6);
      ctx.lineTo(-28, -6);
      ctx.quadraticCurveTo(-28, -9, -25, -9);
      ctx.closePath();
    };
    const cap = () => {
      ctx.beginPath();
      ctx.roundRect(20.4, -5.8, 6.8, 11.6, 1.6);
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 10.2;
    body();
    ctx.stroke();
    ctx.lineWidth = 6;
    cap();
    ctx.stroke();
    ctx.fillStyle = BLACK;
    body();
    ctx.fill();
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 4.2;
    body();
    ctx.stroke();
    ctx.fillStyle = WHITE;
    cap();
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-20, -4.4);
    ctx.lineTo(2, -4.4);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    for (const x of [-16, -6]) {
      ctx.beginPath();
      ctx.moveTo(x, -8);
      ctx.lineTo(x, 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}
