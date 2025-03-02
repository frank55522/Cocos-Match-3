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
    
  },


  // use this for initialization
  onLoad: function () {
    if (!this.audioSource) {
      // 動態查找並初始化
      this.audioSource = cc.find("Canvas/AudioSource").getComponent(cc.AudioSource);
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
  },

  start: function() {
    this.gameModel.startThinkingTimer();
    this.gridScript.setHints(this.getHints());
    this.hintTimer = 2;
    this.hintTimerEnabled = true;
  },

  update: function (dt) {
    if (this.hintTimerEnabled) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) {
        // this.gridScript.showHint(null); // testing
        this.gridScript.showHint();
        // this.resetHintTimer();
        this.hintTimerEnabled = false;
      }
    }
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
    console.log("getGameModel called");
    return this.gameModel;
  },

  getCoin() {
    return this.gameModel.getCoin();
  },

  setCoin(amount) {
    this.gameModel.setCoin(amount);
  },

  checkEndGame() {
    //console.log("call gameModel function checkEndGame");
    this.gameModel.checkEndGame();
  },
  isEndGame() {
    return this.gameModel.isEndGame();
  },

  resetHintTimer: function() {
    this.hintTimer = 2;
  },

  getHints: function() {
    return this.gameModel.findAllHints();
  },

  consumeMove() {
    this.hintTimerEnabled = false;
  },

  logicCalculateEnd: function() {
    this.resetHintTimer();
    this.gridScript.setHints(this.getHints());
  },

  animeEnd: function() {
    
  }
});
