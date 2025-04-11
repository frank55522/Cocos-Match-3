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
    thinkingTimer: {
      default: null,
      type: cc.Node,
    },
    goalLeftLabel: {
      default: null,
      type: cc.Node
    },
    goal: {
      default: null,
      type: cc.Node,
      tooltip: "包含所有目標圖片的父節點"
    },
    comboLabel: {
      default: null,
      type: cc.Node,
      tooltip: "顯示連擊數的標籤"
    }
  },

  // use this for initialization
  onLoad: function () {
    if (!this.audioSource) {
      this.audioSource = cc.find("Canvas/AudioSource").getComponent(cc.AudioSource);
    }
    if (!this.goalLeftLabel) {
      this.goalLeftLabel = cc.find("Canvas/Goal/Goal Left");
    }
    if (!this.goal) {
      this.goal = cc.find("Canvas/Goal");
    }
    if (!this.thinkingTimer) {
      this.thinkingTimer = cc.find("Canvas/ThinkingTimeLabel");
    }
    if (!this.comboLabel) {
      this.comboLabel = cc.find("Canvas/ComboLabel");
    }

    let audioButton = this.node.parent.getChildByName('audioButton')
    audioButton.on('click', this.callback, this)
    this.gameModel = new GameModel();
    this.gameModel.setGameController(this);
    this.gameModel.init(4);
    this.gridScript = this.grid.getComponent("GridView");
    this.gridScript.setController(this);
    this.gridScript.initWithCellModels(this.gameModel.getCells());
    this.audioSource = cc.find('Canvas/GameScene')._components[1].audio;
    this.hintTimerScript = this.hintTimer.getComponent("HintTimer");
    this.hintTimerScript.setGameController(this);
    this.thinkingTimerScript = this.thinkingTimer.getComponent("ThinkingTimer");
    this.thinkingTimerScript.setGameController(this);
    this.goalLeftLabelScript = this.goalLeftLabel.getComponent("GoalLeftView");
    this.goalLeftLabelScript.setGameController(this);
    this.goalTypeImgScript = this.goal.getComponent("GoalTypeImgView");
    
    // 初始化 comboLabel
    if (this.comboLabel) {
      this.comboLabelComponent = this.comboLabel.getComponent(cc.Label);
      if (this.comboLabelComponent) {
        this.comboLabelComponent.string = "";  // 初始時不顯示
        this.comboLabel.opacity = 0;  // 初始時隱藏
      }
    }
  },

  start: function() {
    this.gameModel.nextGoal();
    this.gridScript.setHints(this.getHints());
    this.hintTimerScript.setInterval(2);
    this.hintTimerScript.setWorkable(true);
    
    // 設置思考計時器
    this.thinkingTimerScript.setTimeLimit(15); // 設置15秒思考時間
    this.thinkingTimerScript.setWorkable(true); // 啟動計時器
  },

  callback: function () {
    let state = this.audioSource._state;
    state === 1 ? this.audioSource.pause() : this.audioSource.play()
    Toast(state === 1 ? '关闭背景音乐🎵' : '打开背景音乐🎵' )
  },

  selectCell: function (pos) {
    if (this.isGameOver) {
      console.log("遊戲已結束，無法進行操作。");
      return [[], []];
    }
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
    this.thinkingTimerScript.setWorkable(false);
  },

  logicCalculateEnd: function() {
    this.gridScript.setHints(this.getHints());
  },

  animeEnd: function() {
    this.hintTimerScript.setWorkable(true);
    this.thinkingTimerScript.setWorkable(true);
  },

  autoSelectCells: function (pos1, pos2) {
    console.log(`自動執行消除操作: (${pos1.x},${pos1.y}) <-> (${pos2.x},${pos2.y})`);
    this.gridScript.selectCell(pos1);
    this.gridScript.selectCell(pos2);
  },

  restartGame() {
    console.log("GameController: 正在重啟遊戲...");
    
    // 停止所有計時器
    if (this.gameModel) {
        // 標記遊戲結束，避免任何進行中的邏輯
        this.gameModel.isGameOver = true;
    }
    
    // 停止提示計時器
    if (this.hintTimerScript) {
        this.hintTimerScript.setWorkable(false);
    }

    // 停止思考計時器
    if (this.thinkingTimerScript) {
      this.thinkingTimerScript.setWorkable(false);
    }
    
    // 清除所有運行中的動作
    this.node.stopAllActions();
    
    // 找到場景中所有節點並停止動作
    let canvas = cc.director.getScene().getChildByName('Canvas');
    if (canvas) {
        let allNodes = [];
        this.collectAllNodes(canvas, allNodes);
        
        // 停止所有節點的動作和計時器
        allNodes.forEach(node => {
            node.stopAllActions();
        });
    }
    
    // 確保音效停止
    if (this.audioSource && this.audioSource._state === 1) {
        this.audioSource.pause();
    }

    cc.loader.onProgress = null; // 清除載入進度回調
    
    // 預加載登入場景，然後載入
    try {
        cc.director.preloadScene("Login", function() {
            cc.director.loadScene("Login");
        });
    } catch (e) {
        console.error("載入Login場景失敗，嘗試直接切換:", e);
        try {
            // 直接切換場景
            cc.director.loadScene("Login");
        } catch (err) {
            console.error("直接載入場景失敗，嘗試重啟遊戲:", err);
            try {
                cc.game.restart();
            } catch (finalErr) {
                console.error("重啟遊戲失敗:", finalErr);
                // 顯示錯誤提示給用戶
                const Toast = require('../Utils/Toast');
                if (Toast) {
                    Toast("遊戲重啟失敗，請重新開啟應用", { duration: 3, gravity: "CENTER" });
                }
            }
        }
    }
  },

  collectAllNodes(node, result) {
    if (!node) return;
    
    result.push(node);
    
    const children = node.children;
    if (children && children.length > 0) {
        for (let i = 0; i < children.length; i++) {
            this.collectAllNodes(children[i], result);
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

  setGoalTypeImg(goalType, cellType) {
    this.goalTypeImgScript.changeSprite(goalType, cellType);
  },

  startThinkingTimer() {
    this.gameModel.startThinkingTimer();
  },

  thinkingTimerTrigger: function() {
    if (!this.gameModel.isGameOver && !this.gameModel.isProcessing) {
        // 時間到自動消除提示的組合
        const currentHint = this.gameModel.currentHint;
        if (currentHint && currentHint.swapPositions.length >= 2) {
            console.log(`思考時間到，自動執行提示的消除操作`);
            const pos1 = cc.v2(currentHint.swapPositions[0][1], currentHint.swapPositions[0][0]);
            const pos2 = cc.v2(currentHint.swapPositions[1][1], currentHint.swapPositions[1][0]);
            this.autoSelectCells(pos1, pos2);
        }
    }
  },

  getCurrentThinkingTime: function() {
    if (this.thinkingTimerScript) {
        return Math.ceil(this.thinkingTimerScript.getCurrentTime());
    }
    return 0;
  },

  showCombo: function(comboCount) {
    if (!this.comboLabel || !this.comboLabelComponent) return;
    
    // 停止當前可能正在運行的動作
    this.comboLabel.stopAllActions();
    
    // 設置 Combo 文字
    this.comboLabelComponent.string = "Combo " + comboCount + "!";
    
    // 重置屬性
    this.comboLabel.opacity = 255;
    this.comboLabel.scale = 0;  // 從0開始，實現彈出效果
    
    // 根據 combo 數量設置不同顏色
    if (comboCount >= 10) {
        this.comboLabel.color = cc.color(255, 0, 0);  // 紅色
    } else if (comboCount >= 5) {
        this.comboLabel.color = cc.color(255, 165, 0);  // 橙色
    } else {
        this.comboLabel.color = cc.color(255, 255, 255);  // 白色
    }
    
    // 創建更生動的動畫效果
    const popIn = cc.scaleTo(0.2, 1.3).easing(cc.easeBackOut());  // 彈出效果
    const scaleNormal = cc.scaleTo(0.1, 1.0);  // 回到正常大小
    const stay = cc.delayTime(0.8);  // 停留時間
    
    // 創建淡出效果
    const fadeOut = cc.fadeTo(0.3, 0);
    
    // 重置位置的回調
    const resetPosition = cc.callFunc(() => {
        if (this.comboLabel) {
            this.comboLabel.y = this.comboLabel.y + 0;  // 重置 y 坐標
        }
    });
    
    // 組合動畫序列
    const sequence = cc.sequence(
      popIn,                         // 彈出
      scaleNormal,                   // 恢復正常大小
      stay,                          // 停留
      fadeOut,                       // 淡出
      resetPosition                  // 重置位置
    );
    
    // 運行動畫序列
    this.comboLabel.runAction(sequence);
  },
});