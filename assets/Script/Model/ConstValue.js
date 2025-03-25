
export const CELL_TYPE = {
  EMPTY: 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  BIRD: 7
}
// 反向查找
export const CELL_TYPE_REVERSE = Object.fromEntries(
  Object.entries(CELL_TYPE).map(([key, value]) => [value, key])
);

export const CELL_BASENUM = 6;
export const CELL_STATUS = {
  COMMON: 0,
  CLICK: "click",
  LINE: "line",
  COLUMN: "column",
  WRAP: "wrap",
  BIRD: "bird"
}

export const GRID_WIDTH = 9;
export const GRID_HEIGHT = 9;

export const CELL_WIDTH = 70;
export const CELL_HEIGHT = 70;

export const GRID_PIXEL_WIDTH = GRID_WIDTH * CELL_WIDTH;
export const GRID_PIXEL_HEIGHT = GRID_HEIGHT * CELL_HEIGHT;


// ********************   时间表  animation time **************************
export const ANITIME = {
  TOUCH_MOVE: 0.3,
  DIE: 0.2,
  DOWN: 0.5,
  BOMB_DELAY: 0.3,
  BOMB_BIRD_DELAY: 0.7,
  DIE_SHAKE: 0.4 // 死前抖动
}


// ********************   目標  animation time **************************
export const GOAL_TYPE = {
  NOPE: 0,
  SINGLE_COLOR: 1,
  STRAIGHT: 2,
  WRAP: 3,
  BIRD: 4,
  STRAIGHT_PLUS_STRAIGHT: 5,
  STRAIGHT_PLUS_WRAP: 6,
  STRAIGHT_PLUS_BIRD: 7,
  WRAP_PLUS_WRAP: 8,
  WRAP_PLUS_BIRD: 9,
  BIRD_PLUS_BIRD: 10
}

// 反向查找(回傳字串)
export const GOAL_TYPE_REVERSE = Object.fromEntries(
  Object.entries(GOAL_TYPE).map(([key, value]) => [value, key])
);

export const COMPLETE_COINS = [
  0,      // NOPE
  100,    // SINGLE_COLOR
  200,    // STRAIGHT
  250,    // WRAP
  400,    // BIRD
  300,    // STRAIGHT_PLUS_STRAIGHT
  450,    // STRAIGHT_PLUS_WRAP
  600,    // STRAIGHT_PLUS_BIRD
  600,    // WRAP_PLUS_WRAP
  800,    // WRAP_PLUS_BIRD
  1000    // BIRD_PLUS_BIRD
];

export const CRUSH_QUANTITY = [
  NaN,    // NOPE
  100,    // SINGLE_COLOR
  10,     // STRAIGHT
  7,      // WRAP
  5,      // BIRD
  4,      // STRAIGHT_PLUS_STRAIGHT
  3,      // STRAIGHT_PLUS_WRAP
  2,      // STRAIGHT_PLUS_BIRD
  3,      // WRAP_PLUS_WRAP
  2,      // WRAP_PLUS_BIRD
  1       // BIRD_PLUS_BIRD
];
