import CellModel from "./CellModel";
import { mergePointArray, exclusivePoint } from "../Utils/ModelUtils"
import { CELL_TYPE, CELL_BASENUM, CELL_STATUS, GRID_WIDTH, GRID_HEIGHT, ANITIME } from "./ConstValue";
import Toast from '../Utils/Toast';

export default class GameModel {
  constructor() {
    this.cells = null;
    this.cellBgs = null;
    this.lastPos = cc.v2(-1, -1);
    this.cellTypeNum = 5;
    this.cellCreateType = []; // 升成种类只在这个数组里面查找
    this.movesLeft = 99999;
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

            }
            else if (lineQuantity && wrapQuantity) {// 直線 + 爆破

            }
            else if (lineQuantity && birdQuantity) {// 直線 + 鳥
                this.straightPlusBird(model1, model2);
            }
            else if (wrapQuantity === 2) {// 爆破 * 2

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

  straightPlusStraight(pos) {

  }
  straightPlusWrap() {

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
  }
  wrapPlusWrap() {

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
  }
  birdPlusBird() {
    for (let row = 1; row <= GRID_HEIGHT; row++) {
      for (let col = 1; col <= GRID_WIDTH; col++) {
        this.crushCell(col, row, true, 1);
      }
    }
    this.curTime += ANITIME.BOMB_BIRD_DELAY;
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
    // TODO
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
  }
  isEndGame() { return this.isGameOver; }

  levelComplete() {
    this.isGameOver = true;

    // 引爆場上剩餘特殊動物
    // To do

    console.log(`已通關，剩餘步數(${this.movesLeft})轉成金幣(${this.movesLeft * 15})`);
    this.leftMovesToCoins();
  }
  leftMovesToCoins() {
    if (this.movesLeft > 0) {
      this.movesLeft--;
      this.earnCoin(15);
      setTimeout(() => { this.leftMovesToCoins(); }, 50);
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
}

