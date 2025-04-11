import CellModel from "./CellModel";
import { mergePointArray, exclusivePoint } from "../Utils/ModelUtils";
import { CELL_TYPE, CELL_BASENUM, CELL_STATUS, GRID_WIDTH, GRID_HEIGHT, ANITIME } from "./ConstValue";
import { GoalModel } from "./GoalModel";
import Toast from '../Utils/Toast';
const LeaderboardManager = require("../Manager/LeaderboardManager");
const GlobalData = require("../Utils/GlobalData");

export default class GameModel {
  constructor() {
    this.cells = null;
    this.cellBgs = null;
    this.lastPos = cc.v2(-1, -1);
    this.cellTypeNum = 4;
    this.cellCreateType = [];                             // 升成种类只在这个数组里面查找
    this.movesLeft = 20;
    this.isGameOver = false;
    this.goalLeft = 99999;
    this.goalCompleteCoins = 0;
    this.goalModel = new GoalModel();
    this.totalCrushed = 0;                                // 記錄一輪要消除的數量
    this.coin = 0;
    this.isProcessing = false;                            // 是否正在執行消除動畫
    this.currentHint = null;                              // 當前提示
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
    //this.cells[1][1].type = CELL_TYPE.BIRD;
    //this.cells[1][1].status = CELL_STATUS.BIRD;
    //this.cells[1][2].type = CELL_TYPE.BIRD;
    //this.cells[1][2].status = CELL_STATUS.BIRD;
    //this.cells[2][1].status = CELL_STATUS.COLUMN;
    //this.cells[2][2].status = CELL_STATUS.WRAP;
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

  nextGoal() {
    [this.goalLeft, this.goalCompleteCoins] = this.goalModel.getRandomGoalModel(this.cellTypeNum);
    this.gameController.setUIGoalLeft(this.goalLeft);
    this.gameController.setGoalTypeImg(this.goalModel.getGoalType(), this.goalModel.getSpecifyColor());
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
      this.gameController.consumeMove();
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
            
            if (lineQuantity + wrapQuantity + birdQuantity === 2) {
                if (this.goalLeft > 0 && this.goalModel.isConformGoal(model1, model2)) {
                    this.goalLeft--;
                    this.gameController.uiGoalLeftMinus();
                }
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
          this.earnCoinsByCrush(copyTotalCrushed);
      
          if (copyCycleCount > 1 && hasNextCrush) {
              // 使用 comboLabel 而非 Toast
              if (this.gameController) {
                  this.gameController.showCombo(copyCycleCount);
              }
              this.earnCoinsByStep(copyCycleCount);
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

    let goalMinus = false;
    if (this.goalLeft > 0 && this.goalModel.isConformGoal(model)) {
      goalMinus = true;
      this.goalLeft--;
    }

    this.totalCrushed++;

    let shakeTime = needShake ? ANITIME.DIE_SHAKE : 0;
    model.toDie(this.curTime + shakeTime, goalMinus);
    this.addCrushEffect(this.curTime + shakeTime, cc.v2(model.x, model.y), step);
    this.cells[y][x] = null;
  }

  setGoalLeft(num) {
    this.goalLeft = num;
  }
  getGoalLeft() {
    return this.goalLeft;
  }

  drawGoalCompleteCoins() {
    if (this.goalCompleteCoins) {
      console.log(`完成目標 獲得${this.goalCompleteCoins}金幣`);
      this.earnCoin(this.goalCompleteCoins);
    }
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
    if (!this.isGameOver && this.movesLeft === 0) {
      this.endGame();
    }
  }

  endGame() {
    this.isGameOver = true;
    console.log("遊戲結束！步數已用完。");
    
    // 確保所有金幣計算完成
    setTimeout(() => {
      this.saveScoreToLeaderboard();
      this.showLeaderboard();
    }, 500); // 給予足夠時間確保金幣計算完成
  }

  isEndGame() { return this.isGameOver; }

  levelComplete() {
    this.isGameOver = true;
  
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

  // return { value: [hints], hint: [crushCells] }
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
        // 同時保存到 localStorage
        cc.sys.localStorage.setItem('playerId', playerId);
    }
    
    try {
        // 顯示上傳中提示
        Toast("正在上傳成績...", { duration: 2, gravity: "CENTER" });
        
        // 初始化排行榜管理器
        let leaderboardNode = cc.director.getScene().getChildByName('LeaderboardManager');
        let leaderboardManager;
        
        // 檢查場景中是否已有排行榜管理器
        if (!leaderboardNode) {
            leaderboardNode = new cc.Node('LeaderboardManager');
            leaderboardNode.parent = cc.director.getScene();
            leaderboardManager = leaderboardNode.addComponent('LeaderboardManager');
        } else {
            leaderboardManager = leaderboardNode.getComponent('LeaderboardManager');
        }
        
        // 保存實例以便後續使用
        this.leaderboardManager = leaderboardManager;
        
        console.log("正在上傳分數，玩家ID:", playerId, "分數:", this.coin);
        
        // 上傳分數到排行榜
        leaderboardManager.addScore(playerId, this.coin, (err, result) => {
            if (err) {
                console.warn("上傳分數時出錯:", err.message);
                Toast("上傳分數時出現問題，將使用本地排行榜", { duration: 2, gravity: "CENTER" });
            } else {
                console.log("分數上傳成功，排名:", result.rank);
            }
            
            // 無論成功與否，都顯示排行榜
            // 注意：這裡不再調用 this.showLeaderboard()，而是直接調用 leaderboardManager.showLeaderboard()
            // 這樣可以避免重複觸發排行榜加載流程
            setTimeout(() => {
                leaderboardManager.showLeaderboard(true); // 傳入一個參數表示這是從分數上傳後直接顯示的，避免重複提示
            }, 500);
        });
    } catch (e) {
        console.error("添加分數到排行榜時出錯:", e);
        console.error(e.stack); // 顯示詳細錯誤堆疊
        
        // 出錯時也嘗試顯示排行榜
        setTimeout(() => {
            this.showLeaderboard();
        }, 500);
    }
  }

  showLeaderboard() {
    // 確保我們有排行榜管理器實例
    if (!this.leaderboardManager) {
        try {
            let leaderboardNode = cc.director.getScene().getChildByName('LeaderboardManager');
            if (leaderboardNode) {
                this.leaderboardManager = leaderboardNode.getComponent('LeaderboardManager');
            } else {
                // 如果找不到，創建一個新的
                leaderboardNode = new cc.Node('LeaderboardManager');
                leaderboardNode.parent = cc.director.getScene();
                this.leaderboardManager = leaderboardNode.addComponent('LeaderboardManager');
            }
        } catch (e) {
            console.error("獲取排行榜管理器失敗:", e);
            Toast("無法顯示排行榜，請重試", { duration: 2, gravity: "CENTER" });
            return;
        }
    }
    
    // 顯示排行榜，這是正常的調用方式
    this.leaderboardManager.showLeaderboard(false); // 傳入 false 表示這是普通的顯示，需要提示
  }

  // 特殊合併獎勵金幣
  earnSpecialComboBonusCoin(amount, comboName) {
    this.earnCoin(amount);
    console.log(`特殊組合[${comboName}]獎勵 ${amount} 金幣！`);
    
    const Toast = require('../Utils/Toast');
    Toast(`${comboName} +${amount} 金幣！`, { 
        duration: 2, 
        gravity: "CENTER",
        bg_color: cc.color(0, 0, 0, 200),
        text_color: cc.color(255, 215, 0) // 金色文字
    });
  }
}