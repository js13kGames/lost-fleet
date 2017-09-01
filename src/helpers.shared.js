const EPSILON=1;

let
  min = Math.min,
  max = Math.max,
  add = ([x, y], [z, w]) => [x+z, y+w],
  inv = ([x, y]) => [-x, -y],
  sub = (a, b) => add(a, inv(b)),
  scale = ([x, y], f) => [f*x, f*y],
  leng = ([x, y]) => Math.sqrt(x*x+y*y),
  norm = (a) => {
    let l = leng(a);
    return (l !== 0) ? scale(a, 1/l) : [0, 0];
  },
  clamp = (val) => Math.max(0, val),
  mix = (val, min, max) => min + (max - min) * val,
  normal = (uniform_1, uniform_2) => Math.sqrt(-2 * Math.log(uniform_1)) * Math.cos(2 * Math.PI * uniform_2), // Using Box-Muller
  towards = (from, to, inc) => from < to ? min(from + inc, to) : max(to, from - inc),
  scalar_angle = ([dx, dy]) => Math.atan2(dy, dx) + (Math.PI * 0.5),
  nums = {
    multiply: (a, b) => a * b,
    divide: (a, b) => a / b,
    add: (a, b) => a + b,
    subtract: (a, b) => a - b,
  };

Function.prototype.curry = function(...init_args) {
  return (...extra_args) => this(...init_args.concat(extra_args));
}

function in_rounded_rectangle(point, radius, corner_a, corner_b) {
  if(!corner_b) corner_b = corner_a;
  let t = min(corner_a[1], corner_b[1]),
      b = max(corner_a[1], corner_b[1]),
      l = min(corner_a[0], corner_b[0]),
      r = max(corner_a[0], corner_b[0]),
      x = point[0],
      y = point[1];
  if(l < x && x < r) {
    if(t - radius < y && y < b + radius) return true;
    else return false;
  }
  if(t < y && y < b) {
    if(l - radius < x && x < r + radius) return true;
    else return false;
  }
  if(Math.min(leng(sub(point, [l, t])),
              leng(sub(point, [r, t])),
              leng(sub(point, [l, b])),
              leng(sub(point, [r, b]))) < radius) return true;
  return false;
}

// RNG inspired by https://gist.github.com/blixt/f17b47c62508be59987b
function RNG(seed) {
  if(seed < 0) seed *= -1;
  if(seed === 0) seed = 42;
  this.seed = seed % 2147483647;
}

RNG.prototype.random = function() {
  return (this.random_int() - 1)/ 2147483647;
}

RNG.prototype.random_int = function() {
  return this.seed = (this.seed * this.seed * 59749 + this.seed * 16087) % 2147483647;
}

Object.prototype.values = function() {
  return Object.values(this);
}
