import GameModel from "../Model/GameModel";
import Toast from '../Utils/Toast';

cc.Class({
  extends: cc.Component,

  properties: {
    grid: {
        default: null,
        type: cc.Node
    },
    audioButton: {
        default: null,
        type: cc.Node
    },
    audioSource: { 
        default: null, // 設置默認值
        type: cc.AudioSource
    },
    hintTimer: {
      default: null,
      type: cc.Node
    },
    goalLeftLabel: {
      default: null,
      type: cc.Node
    }
  },

  // use this for initialization
  onLoad: function () {
    if (!this.audioSource) {
      // 動態查找並初始化
      this.audioSource = cc.find("Canvas/AudioSource").getComponent(cc.AudioSource);
    }
    if (!this.goalLeftLabel) {
      this.goalLeftLabel = cc.find("Canvas/Goal/Goal Left");
    }

    let audioButton = this.node.parent.getChildByName('audioButton')
    audioButton.on('click', this.callback, this)
    this.gameModel = new GameModel();
    this.gameModel.setGameController(this);
    this.gameModel.init(5);
    this.gridScript = this.grid.getComponent("GridView");
    this.gridScript.setController(this);
    this.gridScript.initWithCellModels(this.gameModel.getCells());
    this.audioSource = cc.find('Canvas/GameScene')._components[1].audio;
    this.hintTimerScript = this.hintTimer.getComponent("HintTimer");
    this.hintTimerScript.setGameController(this);
    this.goalLeftLabelScript = this.goalLeftLabel.getComponent("GoalLeftView");
    this.goalLeftLabelScript.setGameController(this);
  },

  start: function() {
    this.gameModel.nextGoal();
    this.gameModel.startThinkingTimer();
    this.gridScript.setHints(this.getHints());
    this.hintTimerScript.setInterval(2);
    this.hintTimerScript.setWorkable(true);
  },

  callback: function () {
    let state = this.audioSource._state;
    state === 1 ? this.audioSource.pause() : this.audioSource.play()
    Toast(state === 1 ? '关闭背景音乐🎵' : '打开背景音乐🎵' )
  },

  selectCell: function (pos) {
    return this.gameModel.selectCell(pos);
  },
  cleanCmd: function () {
    this.gameModel.cleanCmd();
  },

  getGameModel() {
    return this.gameModel;
  },

  getCoin() {
    return this.gameModel.getCoin();
  },

  setCoin(amount) {
    this.gameModel.setCoin(amount);
  },

  checkEndGame() {
    this.gameModel.checkEndGame();
  },
  isEndGame() {
    return this.gameModel.isEndGame();
  },

  hintTimerTrigger: function() {
    this.gridScript.showHint();
  },

  getHints: function() {
    return this.gameModel.findAllHints();
  },

  consumeMove() {
    this.hintTimerScript.setWorkable(false);
  },

  logicCalculateEnd: function() {
    this.gridScript.setHints(this.getHints());
  },

  animeEnd: function() {
    this.hintTimerScript.setWorkable(true);
  },

  autoSelectCells: function (pos1, pos2) {
    console.log(`自動執行消除操作: (${pos1.x},${pos1.y}) <-> (${pos2.x},${pos2.y})`);
    this.gridScript.selectCell(pos1);
    this.gridScript.selectCell(pos2);
  },

  restartGame() {
    console.log("GameController: 正在重啟遊戲...");
    
    // 停止遊戲中的計時器
    if (this.gameModel && this.gameModel.thinkingTimer) {
        clearInterval(this.gameModel.thinkingTimer);
        this.gameModel.thinkingTimer = null;
    }
    
    // 清除所有運行中的動作
    this.node.stopAllActions();
    
    // 嘗試載入登入場景
    try {
        cc.director.loadScene("Login");
    } catch (e) {
        console.error("載入Login場景失敗，嘗試重啟遊戲:", e);
        try {
            cc.game.restart();
        } catch (err) {
            console.error("重啟遊戲失敗:", err);
        }
    }
  },

  getLogicGoalLeft() {
    return this.gameModel.getGoalLeft();
  },
  setLogicGoalLeft(num) {
    this.gameModel.setGoalLeft(num);
  },
  getUIGoalLeft() {
    return this.goalLeftLabelScript.getGoalLeft();
  },
  setUIGoalLeft(num) {
    this.goalLeftLabelScript.setGoalLeft(num);
  },

  uiGoalLeftMinus() {
    this.goalLeftLabelScript.goalLeftMinus();
  },

  checkGoalLeft() {
    console.log(`Logic Goal Left: ${this.getLogicGoalLeft()}, UI Goal Left: ${this.getUIGoalLeft()}`);
    if (this.getLogicGoalLeft() !== this.getUIGoalLeft()) {
      console.error("邏輯和UI的goalLeft不一致，自動校正");
      this.setUIGoalLeft(this.getLogicGoalLeft());
    }

    if (this.gameModel.getGoalLeft() === 0) {
      this.gameModel.nextGoal();
    }
  },

  goalComplete() {
    this.gameModel.drawGoalCompleteCoins();
  },

  startThinkingTimer() {
    this.gameModel.startThinkingTimer();
  }
});
