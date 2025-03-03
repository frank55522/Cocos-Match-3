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
    }
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
    this.hintTimerScript = this.hintTimer.getComponent("HintTimer");
    this.hintTimerScript.setGameController(this);
  },

  start: function() {
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
  }
});
