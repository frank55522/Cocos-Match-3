import AudioUtils from "../Utils/AudioUtils";
const GlobalData = require("../Utils/GlobalData");

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
    // 新增輸入框元件
    playerIdInput: {
      type: cc.EditBox,
      default: null,
    }
  },

  onLoad() {
    this.gameSceneBGMAudioId = cc.audioEngine.play(this.worldSceneBGM, true, 1);
    
    // 載入儲存的玩家資料
    this.loadPlayerData();
    
    // 設置登錄按鈕事件 - 這裡缺少按鈕點擊事件的設定
    if (this.loginButton) {
      this.loginButton.node.on('click', this.onStartGame, this);
    }
  },
  
  loadPlayerData() {
    if (!this.playerIdInput) return;
    
    // 嘗試載入之前的玩家ID
    let savedPlayerId = cc.sys.localStorage.getItem('playerId');
    console.log("嘗試載入之前保存的玩家 ID:", savedPlayerId);
    
    if (savedPlayerId) {
      this.playerIdInput.string = savedPlayerId;
    }
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