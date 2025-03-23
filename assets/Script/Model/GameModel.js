import CellModel from "./CellModel";
import { mergePointArray, exclusivePoint } from "../Utils/ModelUtils"
import { CELL_TYPE, CELL_BASENUM, CELL_STATUS, GRID_WIDTH, GRID_HEIGHT, ANITIME } from "./ConstValue";
import Toast from '../Utils/Toast';
const LeaderboardManager = require("../Manager/LeaderboardManager");
const GlobalData = require("../Utils/GlobalData");

export default class GameModel {
  constructor() {
    this.cells = null;
    this.cellBgs = null;
    this.lastPos = cc.v2(-1, -1);
    this.cellTypeNum = 5;
    this.cellCreateType = []; // 升成种类只在这个数组里面查找
    this.movesLeft = 1;
    this.isGameOver = false;
    this.goalLeft = 99999;
    this.totalCrushed = 0; // 記錄一輪要消除的數量
    this.coin = 0;
    this.thinkingTimeLimit = 10; // 玩家有 10 秒時間思考
    this.currentThinkingTime = this.thinkingTimeLimit;
    this.thinkingTimer = null;
    this.isProcessing = false; // 是否正在執行消除動畫
    this.currentHint = null; // 當前提示
  }

  setGameController(gameController) {
    this.gameController = gameController;
  }

  init(cellTypeNum) {
    // 測試 localStorage 訪問
    const playerId = cc.sys.localStorage.getItem('playerId');
    console.log("遊戲初始化時讀取到的玩家 ID:", playerId);

    this.cells = [];
    this.setCellTypeNum(cellTypeNum || this.cellTypeNum);
    for (var i = 1; i <= GRID_WIDTH; i++) {
      this.cells[i] = [];
      for (var j = 1; j <= GRID_HEIGHT; j++) {
        this.cells[i][j] = new CellModel();
      }
    }

    // this.mock();

    for (var i = 1; i <= GRID_WIDTH; i++) {
      for (var j = 1; j <= GRID_HEIGHT; j++) {
        //已经被mock数据生成了
        if (this.cells[i][j].type != null) {
          continue;
        }
        let flag = true;
        while (flag) {
          flag = false;

          this.cells[i][j].init(this.getRandomCellType());
          let result = this.checkPoint(j, i)[0];
          if (result.length > 2) {
            flag = true;
          }
          this.cells[i][j].setXY(j, i);
          this.cells[i][j].setStartXY(j, i);
        }
      }
    }

    /* Testing */
    this.cells[1][1].type = CELL_TYPE.BIRD;
    this.cells[1][1].status = CELL_STATUS.BIRD;
    this.cells[1][2].type = CELL_TYPE.BIRD;
    this.cells[1][2].status = CELL_STATUS.BIRD;
    this.cells[2][1].status = CELL_STATUS.COLUMN;
    this.cells[2][2].status = CELL_STATUS.WRAP;
  }

  mock() {
    this.mockInit(5, 1, CELL_TYPE.A);
    this.mockInit(5, 3, CELL_TYPE.A);
    this.mockInit(4, 2, CELL_TYPE.A);
    this.mockInit(3, 2, CELL_TYPE.A);
    this.mockInit(5, 2, CELL_TYPE.B);
    this.mockInit(6, 2, CELL_TYPE.B);
    this.mockInit(7, 3, CELL_TYPE.B);
    this.mockInit(8, 2, CELL_TYPE.A);
  }
  mockInit(x, y, type) {
    this.cells[x][y].init(type)
    this.cells[x][y].setXY(y, x);
    this.cells[x][y].setStartXY(y, x);
  }


  initWithData(data) {
    // to do
  }

  /**
   *
   * @param x
   * @param y
   * @param recursive 是否递归查找
   * @returns {([]|string|*)[]}
   */
  checkPoint(x, y, recursive) {
    let rowResult = this.checkWithDirection(x, y, [cc.v2(1, 0), cc.v2(-1, 0)]);
    let colResult = this.checkWithDirection(x, y, [cc.v2(0, -1), cc.v2(0, 1)]);
    let samePoints = [];
    let newCellStatus = "";
    if (rowResult.length >= 5 || colResult.length >= 5) {
      newCellStatus = CELL_STATUS.BIRD;
    }
    else if (rowResult.length >= 3 && colResult.length >= 3) {
      newCellStatus = CELL_STATUS.WRAP;
    }
    else if (rowResult.length >= 4) {
      newCellStatus = CELL_STATUS.LINE;
    }
    else if (colResult.length >= 4) {
      newCellStatus = CELL_STATUS.COLUMN;
    }
    if (rowResult.length >= 3) {
      samePoints = rowResult;
    }
    if (colResult.length >= 3) {
      samePoints = mergePointArray(samePoints, colResult);
    }
    let result = [samePoints, newCellStatus, this.cells[y][x].type, cc.v2(x, y)];
    // 检查一下消除的其他节点， 能不能生成更大范围的消除
    if (recursive && result.length >= 3) {
      let subCheckPoints = exclusivePoint(samePoints, cc.v2(x, y));
      for (let point of subCheckPoints) {
        let subResult = this.checkPoint(point.x, point.y, false);
        if (subResult[1] > result[1] || (subResult[1] === result[1] && subResult[0].length > result[0].length)) {
          result = subResult;
        }
      }
    }
    return result;
  }

  checkWithDirection(x, y, direction) {
    let queue = [];
    let vis = [];
    vis[x + y * 9] = true;
    queue.push(cc.v2(x, y));
    let front = 0;
    while (front < queue.length) {
      //let direction = [cc.v2(0, -1), cc.v2(0, 1), cc.v2(1, 0), cc.v2(-1, 0)];
      let point = queue[front];
      let cellModel = this.cells[point.y][point.x];
      front++;
      if (!cellModel) {
        continue;
      }
      for (let i = 0; i < direction.length; i++) {
        let tmpX = point.x + direction[i].x;
        let tmpY = point.y + direction[i].y;
        if (tmpX < 1 || tmpX > 9
          || tmpY < 1 || tmpY > 9
          || vis[tmpX + tmpY * 9]
          || !this.cells[tmpY][tmpX]) {
          continue;
        }
        if (cellModel.type === this.cells[tmpY][tmpX].type) {
          vis[tmpX + tmpY * 9] = true;
          queue.push(cc.v2(tmpX, tmpY));
        }
      }
    }
    return queue;
  }

  printInfo() {
    for (var i = 1; i <= 9; i++) {
      var printStr = "";
      for (var j = 1; j <= 9; j++) {
        printStr += this.cells[i][j].type + " ";
      }
      console.log(printStr);
    }
  }

  getCells() {
    return this.cells;
  }
  // controller调用的主要入口
  // 点击某个格子
  selectCell(pos) {
    if (this.isGameOver) {
      console.log("遊戲已結束，無法進行操作。"); // 提示遊戲已結束
      return [[], []];
    }
    if (this.isProcessing) {
      return [[], []]; // 避免動畫期間觸發操作
    }
    this.changeModels = [];// 发生改变的model，将作为返回值，给view播动作
    this.effectsQueue = []; // 动物消失，爆炸等特效
    var lastPos = this.lastPos;
    var delta = Math.abs(pos.x - lastPos.x) + Math.abs(pos.y - lastPos.y);
    if (delta != 1) { //非相邻格子， 直接返回
      this.lastPos = pos;
      return [[], []];
    }

    this.gameController.consumeMove();
    let curClickCell = this.cells[pos.y][pos.x]; //当前点击的格子
    let lastClickCell = this.cells[lastPos.y][lastPos.x]; // 上一次点击的格式
    this.exchangeCell(lastPos, pos);
    var result1 = this.checkPoint(pos.x, pos.y)[0];
    var result2 = this.checkPoint(lastPos.x, lastPos.y)[0];
    this.curTime = 0; // 动画播放的当前时间
    this.pushToChangeModels(curClickCell);
    this.pushToChangeModels(lastClickCell);
    let isCanBomb = (curClickCell.status != CELL_STATUS.COMMON && // 判断两个是否是特殊的动物
      lastClickCell.status != CELL_STATUS.COMMON) ||
      curClickCell.status == CELL_STATUS.BIRD ||
      lastClickCell.status == CELL_STATUS.BIRD;
    if (result1.length < 3 && result2.length < 3 && !isCanBomb) {//不会发生消除的情况
      this.exchangeCell(lastPos, pos);
      curClickCell.moveToAndBack(lastPos);
      lastClickCell.moveToAndBack(pos);
      this.lastPos = cc.v2(-1, -1);
      return [this.changeModels];
    }
    else {
      this.movesLeft--;
      console.log(`剩餘步數: ${this.movesLeft}`);
      this.lastPos = cc.v2(-1, -1);
      curClickCell.moveTo(lastPos, this.curTime);
      lastClickCell.moveTo(pos, this.curTime);
      var checkPoint = [pos, lastPos];
      this.curTime += ANITIME.TOUCH_MOVE;
      this.processCrush(checkPoint);
      return [this.changeModels, this.effectsQueue];
    }
  }
  // 消除
  processCrush(checkPoint) {
    let cycleCount = 1;
    this.isProcessing = true;

    while (checkPoint.length > 0) {
        this.totalCrushed = 0;
        let bombModels = [];
        let specialCrush = false;

        if (cycleCount == 1 && checkPoint.length == 2) {
            let pos1 = checkPoint[0];
            let pos2 = checkPoint[1];
            let model1 = this.cells[pos1.y][pos1.x];
            let model2 = this.cells[pos2.y][pos2.x];
            let lineQuantity = 0, wrapQuantity = 0, birdQuantity = 0;
            lineQuantity += (model1.status == CELL_STATUS.LINE || model1.status == CELL_STATUS.COLUMN);
            lineQuantity += (model2.status == CELL_STATUS.LINE || model2.status == CELL_STATUS.COLUMN);
            wrapQuantity += (model1.status == CELL_STATUS.WRAP);
            wrapQuantity += (model2.status == CELL_STATUS.WRAP);
            birdQuantity += (model1.status == CELL_STATUS.BIRD);
            birdQuantity += (model2.status == CELL_STATUS.BIRD);

            specialCrush = (lineQuantity + wrapQuantity + birdQuantity === 2 || birdQuantity);

            if (!lineQuantity && !wrapQuantity && birdQuantity === 1) {
                if (model1.status == CELL_STATUS.BIRD) {
                    model1.type = model2.type;
                    bombModels.push(model1);
                } else {
                    model2.type = model1.type;
                    bombModels.push(model2);
                }

                this.processBomb(bombModels, cycleCount);
            }
            else if (lineQuantity === 2) {// 直線 * 2
                this.straightPlusStraight(model1, model2);
            }
            else if (lineQuantity && wrapQuantity) {// 直線 + 爆破
                this.straightPlusWrap(model1, model2);
            }
            else if (lineQuantity && birdQuantity) {// 直線 + 鳥
                this.straightPlusBird(model1, model2);
            }
            else if (wrapQuantity === 2) {// 爆破 * 2
                this.wrapPlusWrap(model1, model2);
            }
            else if (wrapQuantity && birdQuantity) {// 爆破 + 鳥
                this.wrapPlusBird(model1, model2);
            }
            else if (birdQuantity === 2) {// 鳥 * 2
                this.birdPlusBird();
            }
        }

        if (!specialCrush) {
            for (let i in checkPoint) {
                let pos = checkPoint[i];
                if (!this.cells[pos.y][pos.x]) continue;
                let [result, newCellStatus, newCellType, crushPoint] = this.checkPoint(pos.x, pos.y, true);
                if (result.length < 3) continue;

                for (let j in result) {
                    let model = this.cells[result[j].y][result[j].x];
                    this.crushCell(result[j].x, result[j].y, false, cycleCount);
                    if (model.status != CELL_STATUS.COMMON) {
                        bombModels.push(model);
                    }
                }
                this.createNewCell(crushPoint, newCellStatus, newCellType);
            }

            this.processBomb(bombModels, cycleCount);
        }

        let copyTotalCrushed = this.totalCrushed;
        let copyCycleCount = cycleCount;

        this.curTime += ANITIME.DIE;
        let nextCheckPoint = this.down();
        let hasNextCrush = nextCheckPoint.length > 0;

        setTimeout(() => {
            this.goalLeft = Math.max(0, this.goalLeft - copyTotalCrushed);
            console.log(`goalLeft: ${this.goalLeft}`);
            this.earnCoinsByCrush(copyTotalCrushed);

            if (copyCycleCount > 1 && hasNextCrush) {
                Toast(`Combo ${copyCycleCount}!`, { duration: 1, gravity: "CENTER" });
                this.earnCoinsByStep(copyCycleCount);
            }

            if (this.goalLeft > 0) {
                this.startThinkingTimer();
            } else {
                this.levelComplete();
            }
        }, this.curTime * 1000);

        checkPoint = nextCheckPoint;
        cycleCount++;
    }

    this.isProcessing = false;
    this.gameController.logicCalculateEnd();
  }

  //生成新cell
  createNewCell(pos, status, type) {
    if (status == "") {
      return;
    }
    if (status == CELL_STATUS.BIRD) {
      type = CELL_TYPE.BIRD
    }
    let model = new CellModel();
    this.cells[pos.y][pos.x] = model
    model.init(type);
    model.setStartXY(pos.x, pos.y);
    model.setXY(pos.x, pos.y);
    model.setStatus(status);
    model.setVisible(0, false);
    model.setVisible(this.curTime, true);
    this.changeModels.push(model);
  }
  // 下落
  down() {
    let newCheckPoint = [];
    for (var i = 1; i <= GRID_WIDTH; i++) {
      for (var j = 1; j <= GRID_HEIGHT; j++) {
        if (this.cells[i][j] == null) {
          var curRow = i;
          for (var k = curRow; k <= GRID_HEIGHT; k++) {
            if (this.cells[k][j]) {
              this.pushToChangeModels(this.cells[k][j]);
              newCheckPoint.push(this.cells[k][j]);
              this.cells[curRow][j] = this.cells[k][j];
              this.cells[k][j] = null;
              this.cells[curRow][j].setXY(j, curRow);
              this.cells[curRow][j].moveTo(cc.v2(j, curRow), this.curTime);
              curRow++;
            }
          }
          var count = 1;
          for (var k = curRow; k <= GRID_HEIGHT; k++) {
            this.cells[k][j] = new CellModel();
            this.cells[k][j].init(this.getRandomCellType());
            this.cells[k][j].setStartXY(j, count + GRID_HEIGHT);
            this.cells[k][j].setXY(j, count + GRID_HEIGHT);
            this.cells[k][j].moveTo(cc.v2(j, k), this.curTime);
            count++;
            this.changeModels.push(this.cells[k][j]);
            newCheckPoint.push(this.cells[k][j]);
          }

        }
      }
    }
    this.curTime += ANITIME.TOUCH_MOVE + 0.3
    return newCheckPoint;
  }

  pushToChangeModels(model) {
    if (this.changeModels.indexOf(model) != -1) {
      return;
    }
    this.changeModels.push(model);
  }

  cleanCmd() {
    for (var i = 1; i <= GRID_WIDTH; i++) {
      for (var j = 1; j <= GRID_HEIGHT; j++) {
        if (this.cells[i][j]) {
          this.cells[i][j].cmd = [];
        }
      }
    }
  }

  exchangeCell(pos1, pos2) {
    var tmpModel = this.cells[pos1.y][pos1.x];
    this.cells[pos1.y][pos1.x] = this.cells[pos2.y][pos2.x];
    this.cells[pos1.y][pos1.x].x = pos1.x;
    this.cells[pos1.y][pos1.x].y = pos1.y;
    this.cells[pos2.y][pos2.x] = tmpModel;
    this.cells[pos2.y][pos2.x].x = pos2.x;
    this.cells[pos2.y][pos2.x].y = pos2.y;
  }
  // 设置种类
  // Todo 改成乱序算法
  setCellTypeNum(num) {
    console.log("num = ", num);
    this.cellTypeNum = num;
    this.cellCreateType = [];
    let createTypeList = this.cellCreateType;
    for (let i = 1; i <= CELL_BASENUM; i++) {
      createTypeList.push(i);
    }
    for (let i = 0; i < createTypeList.length; i++) {
      let index = Math.floor(Math.random() * (CELL_BASENUM - i)) + i;
      createTypeList[i], createTypeList[index] = createTypeList[index], createTypeList[i]
    }
  }
  // 随要生成一个类型
  getRandomCellType() {
    var index = Math.floor(Math.random() * this.cellTypeNum);
    return this.cellCreateType[index];
  }
  // TODO bombModels去重
  processBomb(bombModels, cycleCount) {
    while (bombModels.length > 0) {
      let newBombModel = [];
      let bombTime = ANITIME.BOMB_DELAY;
      bombModels.forEach(function (model) {
        if (model.status == CELL_STATUS.LINE) {
          for (let i = 1; i <= GRID_WIDTH; i++) {
            if (this.cells[model.y][i]) {
              if (this.cells[model.y][i].status != CELL_STATUS.COMMON) {
                newBombModel.push(this.cells[model.y][i]);
              }
              this.crushCell(i, model.y, false, cycleCount);
            }
          }
          this.addRowBomb(this.curTime, cc.v2(model.x, model.y));
        }
        else if (model.status == CELL_STATUS.COLUMN) {
          for (let i = 1; i <= GRID_HEIGHT; i++) {
            if (this.cells[i][model.x]) {
              if (this.cells[i][model.x].status != CELL_STATUS.COMMON) {
                newBombModel.push(this.cells[i][model.x]);
              }
              this.crushCell(model.x, i, false, cycleCount);
            }
          }
          this.addColBomb(this.curTime, cc.v2(model.x, model.y));
        }
        else if (model.status == CELL_STATUS.WRAP) {
          let x = model.x;
          let y = model.y;
          for (let i = 1; i <= GRID_HEIGHT; i++) {
            for (let j = 1; j <= GRID_WIDTH; j++) {
              let delta = Math.abs(x - j) + Math.abs(y - i);
              if (this.cells[i][j] && delta <= 2) {
                if (this.cells[i][j].status != CELL_STATUS.COMMON) {
                  newBombModel.push(this.cells[i][j]);
                }
                this.crushCell(j, i, false, cycleCount);
              }
            }
          }
        }
        else if (model.status == CELL_STATUS.BIRD) {
          let crushType = model.type
          if (bombTime < ANITIME.BOMB_BIRD_DELAY) {
            bombTime = ANITIME.BOMB_BIRD_DELAY;
          }
          if (crushType == CELL_TYPE.BIRD) {
            crushType = this.getRandomCellType();
          }
          for (let i = 1; i <= GRID_HEIGHT; i++) {
            for (let j = 1; j <= GRID_WIDTH; j++) {
              if (this.cells[i][j] && this.cells[i][j].type == crushType) {
                if (this.cells[i][j].status != CELL_STATUS.COMMON) {
                  newBombModel.push(this.cells[i][j]);
                }
                this.crushCell(j, i, true, cycleCount);
              }
            }
          }
          //this.crushCell(model.x, model.y);
        }
      }, this);
      if (bombModels.length > 0) {
        this.curTime += bombTime;
      }
      bombModels = newBombModel;
    }
  }

  straightPlusStraight(model1, model2) {
    let bombPos = {x: model1.x, y: model1.y};
    
    for (let col = 1; col <= GRID_WIDTH; col++) {
        if (this.cells[bombPos.y][col]) {
            if (this.cells[bombPos.y][col].status != CELL_STATUS.COMMON) {
                this.crushCell(col, bombPos.y, false, 1);
            } else {
                this.crushCell(col, bombPos.y, false, 1);
            }
        }
    }
    
    for (let row = 1; row <= GRID_HEIGHT; row++) {
        if (this.cells[row][bombPos.x]) {
            if (this.cells[row][bombPos.x].status != CELL_STATUS.COMMON && 
                !(row === bombPos.y)) {
                this.crushCell(bombPos.x, row, false, 1);
            } else if (!(row === bombPos.y)) {
                this.crushCell(bombPos.x, row, false, 1);
            }
        }
    }
    
    this.addRowBomb(this.curTime, cc.v2(bombPos.x, bombPos.y));
    this.addColBomb(this.curTime, cc.v2(bombPos.x, bombPos.y));

    // 獎勵 250 金幣
    this.earnSpecialComboBonusCoin(250, "直線+直線");
  }

  straightPlusWrap(model1, model2) {
    let straightModel = model1.status === CELL_STATUS.LINE || model1.status === CELL_STATUS.COLUMN ? model1 : model2;
    let wrapModel = model1.status === CELL_STATUS.WRAP ? model1 : model2;
    let bombPos = {x: model1.x, y: model1.y};
    
    for (let col = 1; col <= GRID_WIDTH; col++) {
        for (let offset = -1; offset <= 1; offset++) {
            let row = bombPos.y + offset;
            if (row >= 1 && row <= GRID_HEIGHT && this.cells[row][col]) {
                if (this.cells[row][col].status != CELL_STATUS.COMMON) {
                    this.crushCell(col, row, false, 1);
                } else {
                    this.crushCell(col, row, false, 1);
                }
            }
        }
    }
    
    for (let row = 1; row <= GRID_HEIGHT; row++) {
        for (let offset = -1; offset <= 1; offset++) {
            let col = bombPos.x + offset;
            if (col >= 1 && col <= GRID_WIDTH && this.cells[row][col]) {
                let inHorizontalRange = Math.abs(row - bombPos.y) <= 1;
                if (!inHorizontalRange || col !== bombPos.x || row !== bombPos.y) {
                    if (this.cells[row][col].status != CELL_STATUS.COMMON) {
                        this.crushCell(col, row, false, 1);
                    } else {
                        this.crushCell(col, row, false, 1);
                    }
                }
            }
        }
    }
    
    this.addRowBomb(this.curTime, cc.v2(bombPos.x, bombPos.y+1));
    this.addRowBomb(this.curTime, cc.v2(bombPos.x, bombPos.y));
    this.addRowBomb(this.curTime, cc.v2(bombPos.x, bombPos.y-1));
    this.addColBomb(this.curTime, cc.v2(bombPos.x+1, bombPos.y));
    this.addColBomb(this.curTime, cc.v2(bombPos.x, bombPos.y));
    this.addColBomb(this.curTime, cc.v2(bombPos.x-1, bombPos.y));

    // 獎勵 400 金幣
    this.earnSpecialComboBonusCoin(400, "直線+爆炸");
  }

  straightPlusBird(model1, model2) {
    let bombModels = [];
    let changeType = (model1.status === CELL_STATUS.BIRD) ? model2.type : model1.type;
    for (let row = 1; row <= GRID_HEIGHT; row++) {
      for (let col = 1; col <= GRID_WIDTH; col++) {
        if (!this.cells[row][col]) continue;
                        
        if (this.cells[row][col].type === changeType) {
          this.cells[row][col].status = (Math.random() < 0.5) ? CELL_STATUS.LINE : CELL_STATUS.COLUMN;
          bombModels.push(this.cells[row][col]);
        }
      }
    }
    this.processBomb(bombModels, 1);

    // 獎勵 600 金幣
    this.earnSpecialComboBonusCoin(600, "直線+鳥");
  }

  wrapPlusWrap(model1, model2) {
    let bombPos = {x: model1.x, y: model1.y};
    for (let row = 1; row <= GRID_HEIGHT; row++) {
        for (let col = 1; col <= GRID_WIDTH; col++) {
            let chebyshevDist = Math.max(
                Math.abs(col - bombPos.x),
                Math.abs(row - bombPos.y)
            );
            
            if (chebyshevDist <= 2 && this.cells[row][col]) {
                if (this.cells[row][col].status != CELL_STATUS.COMMON) {
                    this.crushCell(col, row, false, 1);
                } else {
                    this.crushCell(col, row, false, 1);
                }
            }
        }
    }

    // 獎勵 500 金幣
    this.earnSpecialComboBonusCoin(500, "爆炸+爆炸");
  }

  wrapPlusBird(model1, model2) {
    let bombModels = [];
    let changeType = (model1.status === CELL_STATUS.BIRD) ? model2.type : model1.type;
    for (let row = 1; row <= GRID_HEIGHT; row++) {
      for (let col = 1; col <= GRID_WIDTH; col++) {
        if (!this.cells[row][col]) continue;
                        
        if (this.cells[row][col].type === changeType) {
          this.cells[row][col].status = CELL_STATUS.WRAP;
          bombModels.push(this.cells[row][col]);
        }
      }
    }
    this.processBomb(bombModels, 1);

    // 獎勵 750 金幣
    this.earnSpecialComboBonusCoin(750, "爆炸+鳥");
  }

  birdPlusBird() {
    for (let row = 1; row <= GRID_HEIGHT; row++) {
      for (let col = 1; col <= GRID_WIDTH; col++) {
        this.crushCell(col, row, true, 1);
      }
    }
    this.curTime += ANITIME.BOMB_BIRD_DELAY;

    // 獎勵 1000 金幣
    this.earnSpecialComboBonusCoin(1000, "鳥+鳥");
  }


  /**
   * 
   * @param {开始播放的时间} playTime 
   * @param {*cell位置} pos 
   * @param {*第几次消除，用于播放音效} step 
   */
  addCrushEffect(playTime, pos, step) {
    this.effectsQueue.push({
      playTime,
      pos,
      action: "crush",
      step
    });
  }

  addRowBomb(playTime, pos) {
    this.effectsQueue.push({
      playTime,
      pos,
      action: "rowBomb"
    });
  }

  addColBomb(playTime, pos) {
    this.effectsQueue.push({
      playTime,
      pos,
      action: "colBomb"
    });
  }

  addWrapBomb(playTime, pos) {
    this.effectsQueue.push({
        playTime,
        pos,
        action: "wrapBomb"  // 確保使用 wrapBomb 而不是其他動作名稱
    });
  }

  // cell消除逻辑
  crushCell(x, y, needShake, step) {
    let model = this.cells[y][x];
    this.pushToChangeModels(model);
    if (needShake) {
        model.toShake(this.curTime);
    }

    this.totalCrushed++;

    let shakeTime = needShake ? ANITIME.DIE_SHAKE : 0;
    model.toDie(this.curTime + shakeTime);
    this.addCrushEffect(this.curTime + shakeTime, cc.v2(model.x, model.y), step);
    this.cells[y][x] = null;
  }

  earnCoinsByCrush(crushQuantity) {
    let totalEarn = 0;

    if (crushQuantity >= 21)
      totalEarn += 150;
    else if (crushQuantity >= 18)
      totalEarn += 120;
    else if (crushQuantity >= 15)
      totalEarn += 85;
    else if (crushQuantity >= 12)
      totalEarn += 45;
    else if (crushQuantity >= 9)
      totalEarn += 25;
    else if (crushQuantity >= 6)
      totalEarn += 15;
    else if (crushQuantity >= 3)
      totalEarn += 10;

    this.earnCoin(totalEarn);
  }

  earnCoinsByStep(totalSteps) {
    let stepBonus = 3 * Math.pow(totalSteps, 2);
    console.log(`Combo ${totalSteps} 結算獲得 ${stepBonus} 金幣！`);
    this.earnCoin(stepBonus);
  }

  checkEndGame() {
    //console.log("gameModel do checkEndGame");
    if (!this.isGameOver) {
      if (this.goalLeft == 0)
        this.levelComplete();
      else if (this.movesLeft == 0)
        this.endGame();
    }
  }

  endGame() {
    this.isGameOver = true;
    console.log("遊戲結束！步數已用完。");
    
    // 停止思考時間計時器
    if (this.thinkingTimer) {
      clearInterval(this.thinkingTimer);
      this.thinkingTimer = null; // 設為 null 確保不會再被使用
    }
    
    // 確保所有金幣計算完成
    setTimeout(() => {
      this.saveScoreToLeaderboard();
      this.showLeaderboard();
    }, 500); // 給予足夠時間確保金幣計算完成
  }

  isEndGame() { return this.isGameOver; }

  levelComplete() {
    this.isGameOver = true;
  
    // 停止思考時間計時器
    if (this.thinkingTimer) {
      clearInterval(this.thinkingTimer);
      this.thinkingTimer = null;
    }
  
    // 引爆場上剩餘特殊動物
    // To do
  
    console.log(`已通關，剩餘步數(${this.movesLeft})轉成金幣(${this.movesLeft * 15})`);
  
    // 先轉換剩餘步數為金幣
    this.leftMovesToCoins(() => {
      // 在金幣轉換完成後保存分數並顯示排行榜
      this.saveScoreToLeaderboard();
      this.showLeaderboard();
    });
  }

  leftMovesToCoins(callback) {
    if (this.movesLeft > 0) {
        this.movesLeft--;
        this.earnCoin(15);
        setTimeout(() => { 
            this.leftMovesToCoins(callback); 
        }, 50);
    } else if (callback) {
        // 所有步數都轉換完成後，執行回調
        callback();
    }
  }

  setCoin(amount) {
    this.coin = Math.max(0, amount); // 避免負數
    console.log(`金幣數量更新：${this.coin}`);
  }
  getCoin() {
      return this.coin;
  }

  earnCoin(amount) {
    this.setCoin(this.getCoin() + amount);
  }

  startThinkingTimer() {
    if (this.goalLeft === 0 || this.isGameOver) {
        return;
    }

    if (this.thinkingTimer) {
        clearInterval(this.thinkingTimer);
    }
    this.currentThinkingTime = this.thinkingTimeLimit;

    this.thinkingTimer = setInterval(() => {
        if (this.goalLeft === 0) {
            clearInterval(this.thinkingTimer);
            return;
        }

        this.currentThinkingTime--;

        let thinkingTimeView = cc.find("Canvas/ThinkingTimeLabel").getComponent("ThinkingTimeView");
        if (thinkingTimeView) {
            thinkingTimeView.updateThinkingTime();
        }

        if (this.currentThinkingTime <= 0) {
            this.handleThinkingTimeout();
        }
    }, 1000);
  }

  handleThinkingTimeout() {
    if (this.goalLeft === 0 || this.isGameOver) {
        clearInterval(this.thinkingTimer);
        return;
    }

    console.log("時間到，自動消除當下提示的組合...");

    const currentHint = this.currentHint; 
    if (currentHint && currentHint.swapPositions.length >= 2) {
        console.log("自動消除提示的組合:", currentHint.swapPositions);
        
        const pos1 = cc.v2(currentHint.swapPositions[0][1], currentHint.swapPositions[0][0]);
        const pos2 = cc.v2(currentHint.swapPositions[1][1], currentHint.swapPositions[1][0]);
        
        this.gameController.autoSelectCells(pos1, pos2);
    } else {
        console.log("當前提示沒有有效的消除組合");
    }

    clearInterval(this.thinkingTimer);
  }

  // return value: [hints], hint: [crushCells]
  findAllHints() {
    //console.log(JSON.stringify(this.cells)); // look board in console
    let result = [];
    for (let type = CELL_TYPE.A; type < CELL_TYPE.A + this.cellTypeNum; type++) {
      for (let row = 1; row <= GRID_HEIGHT; row++) {
        for (let col = 1; col <= GRID_WIDTH; col++) {
          let someHints = this.findHintsAtPoint(type, row, col);
          for (const hint of someHints)
            result.push(hint);
        }
      }
    }
    return result;
  }
  findHintsAtPoint(type, row, col) { // for findAllHints()
    let result = [];
    if (this.cells[row][col].type === type)
      return result;

    let upCount = this.countCellsOnDirection(type, row, col, 1, 0);
    let downCount = this.countCellsOnDirection(type, row, col, -1, 0);
    let rightCount = this.countCellsOnDirection(type, row, col, 0, 1);
    let leftCount = this.countCellsOnDirection(type, row, col, 0, -1);

    if (upCount) {
      let crushPositions = this.getHintCrushCells(row, col, -1, downCount, rightCount, leftCount);
      if (crushPositions.length) {
        crushPositions.push([row + 1, col]);
        let swapPositions = [[row, col], [row + 1, col]];
        result.push({crushPositions: crushPositions, swapPositions: swapPositions});
      }
    }
    if (downCount) {
      let crushPositions = this.getHintCrushCells(row, col, upCount, -1, rightCount, leftCount);
      if (crushPositions.length) {
        crushPositions.push([row - 1, col]);
        let swapPositions = [[row, col], [row - 1, col]];
        result.push({crushPositions: crushPositions, swapPositions: swapPositions});
      }
    }
    if (rightCount) {
      let crushPositions = this.getHintCrushCells(row, col, upCount, downCount, -1, leftCount);
      if (crushPositions.length) {
        crushPositions.push([row, col + 1]);
        let swapPositions = [[row, col], [row, col + 1]];
        result.push({crushPositions: crushPositions, swapPositions: swapPositions});
      }
    }
    if (leftCount) {
      let crushPositions = this.getHintCrushCells(row, col, upCount, downCount, rightCount, -1);
      if (crushPositions.length) {
        crushPositions.push([row, col - 1]);
        let swapPositions = [[row, col], [row, col - 1]];
        result.push({crushPositions: crushPositions, swapPositions: swapPositions});
      }
    }

    return result;
  }
  countCellsOnDirection(type, row, col, deltaRow, deltaCol) { // for findHintsAtPoint()
    let result = 0;

    for (let i = 1; this.isPositionValid(row + deltaRow * i, col + deltaCol * i) &&
    this.cells[row + deltaRow * i][col + deltaCol * i].type === type; i++)
      result++;

    return result;
  }
  // If swap up: upcount = -1
  getHintCrushCells(row, col, upCount, downCount, rightCount, leftCount) { // for findHintsAtPoint()
    let result = [];

    if (upCount >= 2) {
      result.push([row + 1, col]);
      result.push([row + 2, col]);
    }
    if (downCount >= 2) {
      result.push([row - 1, col]);
      result.push([row - 2, col]);
    }
    if (rightCount >= 2) {
      result.push([row, col + 1]);
      result.push([row, col + 2]);
    }
    if (leftCount >= 2) {
      result.push([row, col - 1]);
      result.push([row, col - 2]);
    }

    if (upCount === 1 && downCount > 0)
      result.push([row + 1, col]);
    if (downCount === 1 && upCount > 0)
      result.push([row - 1, col]);
    if (rightCount === 1 && leftCount > 0)
      result.push([row, col + 1]);
    if (leftCount === 1 && rightCount > 0)
      result.push([row, col - 1]);

    return result;
  }

  isPositionValid(row, col) {
    return row > 0 && col > 0 && row <= GRID_HEIGHT && col <= GRID_WIDTH;
  }

  saveScoreToLeaderboard() {
    // 從 GlobalData 獲取玩家 ID
    let playerId = GlobalData.getPlayerId();
    
    // 如果沒有玩家 ID，使用訪客 ID
    if (!playerId || playerId.trim() === "") {
        playerId = "Guest_" + Math.floor(Math.random() * 10000);
        // 更新到 GlobalData
        GlobalData.setPlayerId(playerId);
    }
    
    try {
        const Toast = require('../Utils/Toast');
        // 先顯示上傳中提示
        Toast("正在上傳成績...", { duration: 2, gravity: "CENTER" });
        
        // 初始化排行榜管理器
        const LeaderboardManagerClass = require("../Manager/LeaderboardManager");
        let leaderboardNode = cc.director.getScene().getChildByName('LeaderboardManager');
        let leaderboardManager;
        
        // 檢查場景中是否已有排行榜管理器
        if (!leaderboardNode) {
            leaderboardNode = new cc.Node('LeaderboardManager');
            leaderboardNode.parent = cc.director.getScene();
            leaderboardManager = leaderboardNode.addComponent(LeaderboardManagerClass);
            leaderboardManager.initialize();
        } else {
            leaderboardManager = leaderboardNode.getComponent(LeaderboardManagerClass);
        }
        
        // 保存實例以便後續使用
        this.leaderboardManager = leaderboardManager;
        
        // 儲存當前玩家 ID 到全局位置
        cc.game.currentPlayerId = playerId;
        
        // 修改：先在本地添加分數，確保排行榜包含當前分數
        leaderboardManager.addScoreLocally(playerId, this.coin);
        
        // 顯示"正在上傳成績"消息，持續時間更長
        Toast("正在上傳成績到伺服器...", { duration: 3, gravity: "CENTER" });
        
        // 重要：始終保持正確的執行順序
        // 1. 先上傳分數到服務器
        // 2. 等待上傳成功後，再獲取最新排行榜
        // 3. 最後顯示排行榜
        
        let self = this;
        
        // 清除之前的超時計時器
        if (this._uploadTimeoutId) {
            clearTimeout(this._uploadTimeoutId);
        }
        
        // 暫時禁用初始化時自動獲取排行榜數據
        if (leaderboardManager.originalLoadLeaderboard === undefined) {
            leaderboardManager.originalLoadLeaderboard = leaderboardManager.loadLeaderboard;
            // 暫時替換為空函數，避免初始化時自動獲取排行榜
            leaderboardManager.loadLeaderboard = function() { 
                console.log("排行榜初始加載被跳過，等待分數上傳完成後再加載"); 
                return [];
            };
        }
        
        console.log("正在上傳分數，玩家ID:", playerId, "分數:", this.coin);
        
        // 變數用來跟踪重試次數
        let retryCount = 0;
        const maxRetries = 3;
        
        // 設置上傳超時計時器 - 15秒
        this._uploadTimeoutId = setTimeout(() => {
            console.error("上傳分數超時，使用本地排行榜");
            Toast("上傳分數超時，使用本地排行榜", { duration: 2, gravity: "CENTER" });
            
            // 恢復原始的 loadLeaderboard 函數
            if (leaderboardManager.originalLoadLeaderboard !== undefined) {
                leaderboardManager.loadLeaderboard = leaderboardManager.originalLoadLeaderboard;
                leaderboardManager.originalLoadLeaderboard = undefined;
            }
            
            // 使用本地排行榜顯示
            self.showLeaderboard();
        }, 15000);
        
        // 定義上傳函數，方便重試
        const performUpload = () => {
            // 添加分數到排行榜，等待回調完成
            leaderboardManager.addScore(playerId, this.coin, (err, result) => {
                // 清除超時計時器
                clearTimeout(self._uploadTimeoutId);
                
                // 恢復原始的 loadLeaderboard 函數
                if (leaderboardManager.originalLoadLeaderboard !== undefined) {
                    leaderboardManager.loadLeaderboard = leaderboardManager.originalLoadLeaderboard;
                    leaderboardManager.originalLoadLeaderboard = undefined;
                }
                
                if (err) {
                    console.error("添加分數到排行榜時出錯:", err);
                    
                    // 嘗試重試
                    if (retryCount < maxRetries) {
                        retryCount++;
                        console.log(`上傳分數失敗，正在重試 (${retryCount}/${maxRetries})...`);
                        Toast(`上傳分數失敗，正在重試 (${retryCount}/${maxRetries})...`, { duration: 1, gravity: "CENTER" });
                        
                        // 延遲後重試
                        setTimeout(performUpload, 1000);
                        return;
                    }
                    
                    Toast("添加分數時發生錯誤，將使用本地排行榜", { duration: 2, gravity: "CENTER" });
                    
                    // 即使出錯也顯示排行榜，使用本地數據
                    setTimeout(() => {
                        self.showLeaderboard();
                    }, 1000);
                } else {
                    console.log("成功添加分數到排行榜");
                    
                    // 儲存當前排名供顯示界面使用
                    self.currentRank = result ? result.rank : leaderboardManager.getRank(playerId);
                    
                    // 顯示載入排行榜提示
                    Toast("添加成功，正在獲取最新排行榜...", { duration: 2, gravity: "CENTER" });
                    
                    // 清除之前的獲取排行榜超時計時器
                    if (self._leaderboardTimeoutId) {
                        clearTimeout(self._leaderboardTimeoutId);
                    }
                    
                    // 獲取最新排行榜的函數
                    const loadLeaderboard = () => {
                        console.log("開始獲取最新排行榜數據");
                        
                        // 重設重試次數
                        retryCount = 0;
                        
                        // 設置新的獲取排行榜超時計時器 - 10秒
                        self._leaderboardTimeoutId = setTimeout(() => {
                            console.error("獲取排行榜超時，顯示本地數據");
                            Toast("獲取線上排行榜超時，顯示本地資料", { duration: 2, gravity: "CENTER" });
                            
                            // 超時時顯示排行榜
                            self.showLeaderboard();
                        }, 10000);
                        
                        // 明確地重新加載最新排行榜數據，使用強制刷新選項
                        leaderboardManager.loadLeaderboard((loadErr, leaderboardData) => {
                            // 清除超時計時器
                            clearTimeout(self._leaderboardTimeoutId);
                            
                            if (loadErr) {
                                console.error("加載排行榜數據時出錯:", loadErr);
                                
                                // 嘗試重試
                                if (retryCount < maxRetries) {
                                    retryCount++;
                                    console.log(`獲取排行榜失敗，正在重試 (${retryCount}/${maxRetries})...`);
                                    Toast(`獲取排行榜失敗，正在重試 (${retryCount}/${maxRetries})...`, { duration: 1, gravity: "CENTER" });
                                    
                                    // 延遲後重試
                                    setTimeout(loadLeaderboard, 1000);
                                    return;
                                }
                                
                                Toast("獲取最新排行榜失敗，使用本地數據", { duration: 2, gravity: "CENTER" });
                            } else {
                                console.log("成功獲取最新排行榜數據，條目數量:", leaderboardData.length);
                                
                                // 檢查數據是否包含當前玩家的最新分數
                                let currentPlayerEntry = leaderboardData.find(entry => entry.playerId === playerId);
                                if (currentPlayerEntry) {
                                    console.log("排行榜中當前玩家數據:", currentPlayerEntry.playerId, "分數:", currentPlayerEntry.score);
                                    
                                    // 檢查分數是否正確
                                    if (currentPlayerEntry.score < self.coin) {
                                        console.warn("警告：排行榜中玩家分數小於當前遊戲分數");
                                        console.warn("排行榜分數:", currentPlayerEntry.score, "當前分數:", self.coin);
                                    }
                                } else {
                                    console.warn("警告：排行榜中未找到當前玩家數據");
                                }
                            }
                            
                            // 無論成功與否，都顯示排行榜
                            self.showLeaderboard();
                        }, true); // 傳入 true 表示強制刷新
                    };
                    
                    // 添加延遲，確保服務器有足夠時間處理上傳的分數
                    setTimeout(loadLeaderboard, 1500);
                }
            });
        };
        
        // 開始上傳流程
        performUpload();
        
    } catch (e) {
        console.error("添加分數到排行榜時出錯:", e);
        console.error(e.stack); // 顯示詳細錯誤堆疊
        
        // 出錯時也嘗試顯示排行榜
        this.showLeaderboard();
    }
  }

  showLeaderboard() {
    // 清除所有可能的超時計時器
    if (this._leaderboardTimeoutId) {
        clearTimeout(this._leaderboardTimeoutId);
        this._leaderboardTimeoutId = null;
    }
    
    let canvas = cc.director.getScene().getComponentInChildren(cc.Canvas);
    let self = this; // 保存 this 引用

    // 先檢查是否已有排行榜資料
    let hasValidLeaderboardData = false;
    if (this.leaderboardManager && this.leaderboardManager.getLeaderboard) {
        const leaderboardData = this.leaderboardManager.getLeaderboard();
        hasValidLeaderboardData = leaderboardData && Array.isArray(leaderboardData) && leaderboardData.length > 0;
    }

    // 先新增一個半透明黑色遮罩背景覆蓋整個畫面
    let maskNode = new cc.Node("Mask");
    let maskSprite = maskNode.addComponent(cc.Sprite);
    maskSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    maskNode.width = canvas.node.width;
    maskNode.height = canvas.node.height;
    maskNode.color = cc.color(0, 0, 0);
    maskNode.opacity = 150; // 半透明
    maskNode.parent = canvas.node;
    
    // 創建排行榜背景面板
    let leaderboardNode = new cc.Node("LeaderboardPanel");
    leaderboardNode.width = 600;
    leaderboardNode.height = 700;
    
    // 使用繪圖元件來畫一個白色矩形
    let graphics = leaderboardNode.addComponent(cc.Graphics);
    graphics.fillColor = cc.color(255, 255, 255, 255);
    graphics.rect(-300, -350, 600, 700);
    graphics.fill();
    
    leaderboardNode.parent = canvas.node;
    
    // 添加排行榜標題
    let titleNode = new cc.Node("Title");
    let titleLabel = titleNode.addComponent(cc.Label);
    titleLabel.string = "在線排行榜";
    titleLabel.fontSize = 40;
    titleLabel.lineHeight = 40;
    titleNode.color = cc.color(0, 0, 0);
    titleNode.position = cc.v2(0, 300);
    titleNode.parent = leaderboardNode;

    // 添加連接狀態提示
    let statusNode = new cc.Node("Status");
    let statusLabel = statusNode.addComponent(cc.Label);
    statusLabel.string = "已連接到在線排行榜服務";
    statusLabel.fontSize = 16;
    statusLabel.lineHeight = 16;
    statusNode.color = cc.color(0, 128, 0);
    statusNode.position = cc.v2(0, 260);
    statusNode.parent = leaderboardNode;
    
    // 創建載入中提示
    let loadingNode = new cc.Node("Loading");
    let loadingLabel = loadingNode.addComponent(cc.Label);
    loadingLabel.string = "正在獲取線上排行榜...";
    loadingLabel.fontSize = 24;
    loadingNode.position = cc.v2(0, 150);
    loadingNode.parent = leaderboardNode;
    
    // 獲取當前玩家ID
    let currentPlayerId = GlobalData.getPlayerId();
    console.log("當前玩家ID:", currentPlayerId);
    
    // 使用已保存的排行榜管理器實例
    let leaderboardManager = this.leaderboardManager;
    
    if (!leaderboardManager) {
        try {
            const LeaderboardManagerClass = require("../Manager/LeaderboardManager");
            // 檢查場景中是否已有排行榜管理器
            let leaderboardMgrNode = cc.director.getScene().getChildByName('LeaderboardManager');
            
            if (!leaderboardMgrNode) {
                leaderboardMgrNode = new cc.Node('LeaderboardManager');
                leaderboardMgrNode.parent = cc.director.getScene();
                leaderboardManager = leaderboardMgrNode.addComponent(LeaderboardManagerClass);
                leaderboardManager.initialize();
            } else {
                leaderboardManager = leaderboardMgrNode.getComponent(LeaderboardManagerClass);
            }
        } catch (e) {
            console.error("獲取排行榜管理器失敗:", e);
        }
    }
    
    if (!leaderboardManager) {
        // 如果仍然沒有排行榜管理器，顯示錯誤
        loadingNode.destroy();
        let errorNode = new cc.Node("Error");
        let errorLabel = errorNode.addComponent(cc.Label);
        errorLabel.string = "無法獲取排行榜管理器";
        errorLabel.fontSize = 24;
        errorNode.color = cc.color(255, 0, 0);
        errorNode.position = cc.v2(0, 150);
        errorNode.parent = leaderboardNode;
        return;
    }
    
    // 獲取連接狀態
    let connectionInfo = { isOffline: true, status: "未知連接狀態" };
    
    try {
        // 檢查是否處於離線模式
        connectionInfo = leaderboardManager.getConnectionStatus();
        
        // 更新網絡狀態指示
        statusLabel.string = connectionInfo.status;
        statusNode.color = connectionInfo.isOffline ? cc.color(255, 0, 0) : cc.color(0, 128, 0);
    } catch (e) {
        console.error("獲取連接狀態失敗:", e);
    }
    
    // 將displayLeaderboard函數定義提到最外層，避免作用域問題
    const displayLeaderboard = (leaderboardData) => {
        // 檢查是否有排行榜數據
        if (leaderboardData.length > 0) {
            console.log("排行榜數據條數:", leaderboardData.length);
            
            // 確保我們有當前遊戲中玩家的分數記錄
            let playerHasEntry = false;
            let currentPlayerRank = -1;
            let currentPlayerData = null;
            
            // 在完整的排行榜數據中查找當前玩家的記錄和排名
            for (let i = 0; i < leaderboardData.length; i++) {
                if (leaderboardData[i].playerId === currentPlayerId) {
                    playerHasEntry = true;
                    currentPlayerRank = i + 1;
                    currentPlayerData = leaderboardData[i];
                    console.log(`找到當前玩家: ${currentPlayerId}, 排名: ${currentPlayerRank}`);
                    break;
                }
            }
            
            // 如果找不到當前玩家，但我們知道當前玩家的分數
            if (!playerHasEntry && self.coin > 0) {
                // 創建當前玩家的資料
                currentPlayerData = {
                    playerId: currentPlayerId,
                    score: self.coin,
                    date: new Date().toISOString()
                };
                
                // 添加到臨時數組並排序，以確定當前玩家的排名
                let tempLeaderboard = [...leaderboardData, currentPlayerData];
                tempLeaderboard.sort((a, b) => b.score - a.score);
                
                for (let i = 0; i < tempLeaderboard.length; i++) {
                    if (tempLeaderboard[i].playerId === currentPlayerId) {
                        currentPlayerRank = i + 1;
                        console.log(`計算當前玩家排名: ${currentPlayerRank}`);
                        break;
                    }
                }
                
                playerHasEntry = true;
            }
            
            // 決定要顯示的排行榜項目（前10名）
            let displayCount = Math.min(10, leaderboardData.length);
            
            // 動態創建排行榜項目（前10名）
            for (let i = 0; i < displayCount; i++) {
                let entry = leaderboardData[i];
                
                let entryNode = new cc.Node(`Entry_${i}`);
                entryNode.position = cc.v2(0, 230 - i * 50);
                entryNode.parent = leaderboardNode;
                
                // 排名
                let rankNode = new cc.Node("Rank");
                let rankLabel = rankNode.addComponent(cc.Label);
                rankLabel.string = (i + 1).toString();
                rankLabel.fontSize = 30;
                rankNode.color = cc.color(0, 0, 0);
                rankNode.position = cc.v2(-200, 0);
                rankNode.parent = entryNode;
                
                // 玩家ID
                let idNode = new cc.Node("ID");
                let idLabel = idNode.addComponent(cc.Label);
                idLabel.string = entry.playerId || "未知玩家";
                idLabel.fontSize = 30;
                idNode.color = cc.color(0, 0, 0);
                idNode.position = cc.v2(0, 0);
                idNode.parent = entryNode;
                
                // 分數
                let scoreNode = new cc.Node("Score");
                let scoreLabel = scoreNode.addComponent(cc.Label);
                scoreLabel.string = (entry.score || 0).toString();
                scoreLabel.fontSize = 30;
                scoreNode.color = cc.color(0, 0, 0);
                scoreNode.position = cc.v2(200, 0);
                scoreNode.parent = entryNode;
                
                // 高亮顯示當前玩家
                if (entry.playerId === currentPlayerId) {
                    let highlight = new cc.Node("Highlight");
                    let hlGraphics = highlight.addComponent(cc.Graphics);
                    hlGraphics.fillColor = cc.color(135, 206, 250, 100);
                    hlGraphics.rect(-275, -22.5, 550, 45);
                    hlGraphics.fill();
                    highlight.parent = entryNode;
                    highlight.setSiblingIndex(0);
                }
            }
            
            // 沒進前10名的玩家成績排行顯示
            if (playerHasEntry && currentPlayerRank > 10) {
                console.log(`添加當前玩家額外項: ${currentPlayerId}, 排名: ${currentPlayerRank}`);
                
                // 添加一條分隔線
                let separatorNode = new cc.Node("Separator");
                let separatorGraphics = separatorNode.addComponent(cc.Graphics);
                separatorGraphics.strokeColor = cc.color(200, 200, 200);
                separatorGraphics.lineWidth = 2;
                separatorGraphics.moveTo(-275, 0);
                separatorGraphics.lineTo(275, 0);
                separatorGraphics.stroke();
                separatorNode.position = cc.v2(0, 230 - 9 * 50 - 25); // 第10名下方10個像素
                separatorNode.parent = leaderboardNode;
                
                // 創建當前玩家項
                let playerEntryNode = new cc.Node("CurrentPlayerEntry");
                playerEntryNode.position = cc.v2(0, 230 - 10 * 50); // 位置上移，與返回按鈕不重疊
                playerEntryNode.parent = leaderboardNode;
                
                // 排名
                let rankNode = new cc.Node("Rank");
                let rankLabel = rankNode.addComponent(cc.Label);
                // 如果排名超過99，顯示為99+
                rankLabel.string = currentPlayerRank > 99 ? "99+" : currentPlayerRank.toString();
                rankLabel.fontSize = 30;
                rankNode.color = cc.color(0, 0, 0);
                rankNode.position = cc.v2(-200, 0);
                rankNode.parent = playerEntryNode;
                
                // 玩家ID
                let idNode = new cc.Node("ID");
                let idLabel = idNode.addComponent(cc.Label);
                idLabel.string = currentPlayerData.playerId || "未知玩家";
                idLabel.fontSize = 30;
                idNode.color = cc.color(0, 0, 0);
                idNode.position = cc.v2(0, 0);
                idNode.parent = playerEntryNode;
                
                // 分數
                let scoreNode = new cc.Node("Score");
                let scoreLabel = scoreNode.addComponent(cc.Label);
                scoreLabel.string = (currentPlayerData.score || 0).toString();
                scoreLabel.fontSize = 30;
                scoreNode.color = cc.color(0, 0, 0);
                scoreNode.position = cc.v2(200, 0);
                scoreNode.parent = playerEntryNode;
                
                // 高亮顯示當前玩家
                let highlight = new cc.Node("Highlight");
                let hlGraphics = highlight.addComponent(cc.Graphics);
                hlGraphics.fillColor = cc.color(135, 206, 250, 100);
                hlGraphics.rect(-275, -22.5, 550, 45);
                hlGraphics.fill();
                highlight.parent = playerEntryNode;
                highlight.setSiblingIndex(0);
            }
            
        } else {
            // 如果沒有數據，顯示提示信息
            let emptyNode = new cc.Node("Empty");
            let emptyLabel = emptyNode.addComponent(cc.Label);
            emptyLabel.string = "排行榜暫無數據，遊戲結束後會記錄分數";
            emptyLabel.fontSize = 24;
            emptyNode.position = cc.v2(0, 150);
            emptyNode.parent = leaderboardNode;
        }
    };
    
    // 設置加載超時計時器 - 延長超時時間至10秒
    let timeoutTimer = setTimeout(() => {
        // 如果超時仍未收到在線資料，則顯示本地排行榜
        if (loadingNode && loadingNode.isValid) {
            loadingNode.destroy();
            
            // 只有在沒有有效資料時才顯示超時提示
            if (!hasValidLeaderboardData) {
                const Toast = require('../Utils/Toast');
                Toast("獲取線上排行榜超時，顯示本地資料", { duration: 2, gravity: "CENTER" });
            }
            
            // 顯示本地排行榜
            displayLeaderboard(leaderboardManager.getLeaderboard() || []);
        }
    }, 10000); // 10秒超時
    
    // 保存計時器以便在其他地方可以取消
    this._leaderboardTimeoutId = timeoutTimer;
    
    // 重新獲取最新的排行榜數據 - 只有在沒有有效資料時才請求
    if (!hasValidLeaderboardData) {
        leaderboardManager.loadLeaderboard((err, data) => {
            // 清除超時計時器
            clearTimeout(timeoutTimer);
            this._leaderboardTimeoutId = null;
            
            if (loadingNode && loadingNode.isValid) {
                loadingNode.destroy();
            }
            
            if (!err && data && data.length > 0) {
                console.log("成功加載線上排行榜數據");
                displayLeaderboard(data);
            } else {
                console.log("加載線上排行榜失敗，顯示本地數據");
                const Toast = require('../Utils/Toast');
                
                // 只在確實有錯誤時才顯示提示
                if (err) {
                    Toast("無法獲取線上排行榜，顯示本地資料", { duration: 2, gravity: "CENTER" });
                }
                
                displayLeaderboard(leaderboardManager.getLeaderboard() || []);
            }
        }, true); // 傳入 true 表示強制刷新
    } else {
        // 已有有效資料，直接顯示
        clearTimeout(timeoutTimer);
        this._leaderboardTimeoutId = null;
        
        if (loadingNode && loadingNode.isValid) {
            loadingNode.destroy();
        }
        
        displayLeaderboard(leaderboardManager.getLeaderboard() || []);
    }
    
    // 創建返回按鈕（使用 Graphics 繪製）
    let backButton = new cc.Node("BackButton");
    backButton.width = 200;
    backButton.height = 50;
    backButton.position = cc.v2(0, -320);
    backButton.parent = leaderboardNode;

    // 使用 Graphics 繪製按鈕背景
    let buttonGraphics = backButton.addComponent(cc.Graphics);
    buttonGraphics.fillColor = cc.color(51, 122, 183, 255); // 藍色
    buttonGraphics.rect(-100, -30, 200, 60); // 繪製矩形
    buttonGraphics.fill();

    // 添加標籤
    let buttonLabel = new cc.Node("Label");
    let label = buttonLabel.addComponent(cc.Label);
    label.string = "返回主頁";
    label.fontSize = 30;
    buttonLabel.color = cc.color(255, 255, 255); // 白色
    buttonLabel.parent = backButton;

    // 返回主頁按鈕點擊事件
    const onBackButtonClicked = () => {
        console.log("返回主頁");

        // 檢查場景是否正在載入
        if (!cc.director.isLoadingScene) {
            // 禁用按鈕，防止多次點擊
            backButton.off(cc.Node.EventType.TOUCH_END, onBackButtonClicked);
            
            // 先移除當前排行榜
            leaderboardNode.destroy();
            maskNode.destroy();
            
            // 清除超時計時器
            if (this._leaderboardTimeoutId) {
                clearTimeout(this._leaderboardTimeoutId);
                this._leaderboardTimeoutId = null;
            }
            
            // 確保遊戲模型的計時器被清理
            if (self.thinkingTimer) {
                clearInterval(self.thinkingTimer);
                self.thinkingTimer = null;
            }
            
            // 使用 GameController 的重啟方法，確保進行更完整的清理
            let canvas = cc.director.getScene();
            let gameSceneNode = canvas.getChildByName('GameScene') || canvas.getChildByName('Canvas').getChildByName('GameScene');
            
            if (gameSceneNode) {
                let gameController = gameSceneNode.getComponent('GameController');
                if (gameController && typeof gameController.restartGame === 'function') {
                    // 使用現有的重啟遊戲函數
                    gameController.restartGame();
                    return; // 已處理完畢，不需要後續代碼
                }
            }
            
            // 如果上述方法失敗，使用備用方法
            try {
                // 預加載場景，確保資源已準備好
                cc.director.preloadScene("Login", function() {
                    // 場景預加載成功後再進行切換
                    cc.director.loadScene("Login");
                });
            } catch (e) {
                console.error("場景預加載失敗:", e);
                
                // 延遲後嘗試直接載入場景
                setTimeout(function() {
                    try {
                        cc.director.loadScene("Login");
                    } catch (e2) {
                        console.error("載入場景失敗:", e2);
                        
                        // 最終嘗試：重啟遊戲
                        cc.game.restart();
                    }
                }, 500);
            }
        } else {
            console.log("場景正在載入中，請稍後再試");
        }
    };

    backButton.on(cc.Node.EventType.TOUCH_END, onBackButtonClicked);
  }

  // 特殊合併獎勵金幣
  earnSpecialComboBonusCoin(amount, comboName) {
    this.earnCoin(amount);
    console.log(`特殊組合[${comboName}]獎勵 ${amount} 金幣！`);
    
    // 顯示特殊獎勵提示
    const Toast = require('../Utils/Toast');
    Toast(`特殊組合：${comboName}\n獎勵 ${amount} 金幣！`, { 
      duration: 1.5, 
      gravity: "CENTER" 
    });
  }
}