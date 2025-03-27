import AudioUtils from "../Utils/AudioUtils";
const GlobalData = require("../Utils/GlobalData");
const Toast = require("../Utils/Toast");

cc.Class({
  extends: cc.Component,

  properties: {
    loadingBar: {
      type: cc.ProgressBar,
      default: null,
    },
    loginButton: {
      type: cc.Button,
      default: null,
    },
    worldSceneBGM: {
      type: cc.AudioClip,
      default: null,
    },
    playerIdInput: {
      type: cc.EditBox,
      default: null,
    },
    LeaderboardButton: {
      type: cc.Button,
      default: null,
    }
  },

  onLoad() {
    this.gameSceneBGMAudioId = cc.audioEngine.play(this.worldSceneBGM, true, 1);
    
    // 設置登錄按鈕事件
    if (this.loginButton) {
      this.loginButton.node.on('click', this.onStartGame, this);
    }
    
    // 設置排行榜按鈕事件
    if (this.LeaderboardButton) {
      this.LeaderboardButton.node.on('click', this.onLeaderboardButtonClick, this);
      // 初始状态下禁用排行榜按钮，直到玩家输入ID
      this.LeaderboardButton.interactable = false;
    }
    
    // 添加輸入框更改事件
    if (this.playerIdInput) {
      this.playerIdInput.node.on('text-changed', this.onPlayerIdChanged, this);
      // 確保輸入框初始為空
      this.playerIdInput.string = "";
    }
  },
  
  onPlayerIdChanged(editbox) {
    // 當輸入框內容改變時，檢查內容是否為空
    // 如果不為空，啟用排行榜按鈕；否則禁用
    if (this.LeaderboardButton) {
      this.LeaderboardButton.interactable = (editbox.string.trim().length > 0);
    }
  },
  
  onLeaderboardButtonClick() {
    // 確保玩家有輸入ID
    if (!this.playerIdInput || this.playerIdInput.string.trim() === "") {
      Toast("請先輸入玩家ID", { duration: 2, gravity: "CENTER" });
      return;
    }
    
    let playerId = this.playerIdInput.string.trim();
    
    // 設置全局數據中的玩家ID
    GlobalData.setPlayerId(playerId);
    
    // 初始化並顯示排行榜
    this.showLoginLeaderboard();
  },
  
  showLoginLeaderboard() {
    // 檢查場景中是否已有排行榜管理器
    let leaderboardNode = cc.director.getScene().getChildByName('LeaderboardManager');
    let leaderboardManager;
    
    if (!leaderboardNode) {
      leaderboardNode = new cc.Node('LeaderboardManager');
      leaderboardNode.parent = cc.director.getScene();
      leaderboardManager = leaderboardNode.addComponent('LeaderboardManager');
    } else {
      leaderboardManager = leaderboardNode.getComponent('LeaderboardManager');
    }
    
    // 顯示排行榜，但傳入特殊參數，表示這是從登入畫面呼叫的
    leaderboardManager.showLoginLeaderboard();
  },
  
  onStartGame() {
    if (!this.playerIdInput) {
      this.onLogin();
      return;
    }
    
    // 獲取玩家 ID（如果沒有則生成訪客 ID）
    let playerId = "";
    if (this.playerIdInput.string.trim()) {
      playerId = this.playerIdInput.string.trim();
    } else {
      playerId = "Guest_" + Math.floor(Math.random() * 10000);
    }
    
    console.log("保存玩家 ID:", playerId);
    
    // 使用全局數據模組
    GlobalData.setPlayerId(playerId);
    
    // 也保存到 localStorage
    cc.sys.localStorage.setItem('playerId', playerId);
    
    // 保存到一個簡單的全局變數
    window.gamePlayerID = playerId;
    
    // 繼續原來的加載遊戲場景邏輯
    this.onLogin();
  },

  onLogin: function () {
    this.last = 0;
    this.loadingBar.node.active = true;
    this.loginButton.node.active = false;
    this.loadingBar.progress = 0;
    this.loadingBar.barSprite.fillRange = 0;
    cc.loader.onProgress = (count, amount, item) => {
      let progress = (count / amount).toFixed(2);
      if (progress > this.loadingBar.barSprite.fillRange) {
        this.loadingBar.barSprite.fillRange = count / amount;
      }
    };
    cc.director.preloadScene("Game", function () {
      this.loadingBar.node.active = false;
      this.loginButton.node.active = false;
      // cc.log("加載成功");
      cc.director.loadScene("Game");
    }.bind(this));
  },

  onDestroy: function () {
    cc.audioEngine.stop(this.gameSceneBGMAudioId);
  }
});