// LeaderboardManager.js - 更新版
cc.Class({
  extends: cc.Component,
  
  properties: {
    maxEntries: {
      default: 10,
      tooltip: "排行榜最多顯示的玩家數量"
    },
    leaderboardService: {
      default: null,
      type: cc.Node,
      tooltip: "LeaderboardService 節點"
    },
    showLoadingIndicator: {
      default: true,
      tooltip: "加載排行榜時是否顯示讀取指示器"
    }
  },
  
  // 初始化
  initialize() {
    // 創建 LeaderboardService 服務如果沒有指定
    if (!this.leaderboardService) {
      this.leaderboardService = this.createLeaderboardService();
    }
    
    // 初始化本地緩存的排行榜
    this.leaderboard = [];
    this.isLoading = false;
    this.lastErrorMessage = "";
    
    // 加載排行榜數據
    this.loadLeaderboard();
  },
  
  createLeaderboardService() {
    let serviceNode = new cc.Node('LeaderboardService');
    let service = serviceNode.addComponent('LeaderboardService');
    serviceNode.parent = this.node;
    return serviceNode;
  },
  
  // 載入排行榜數據
  loadLeaderboard(callback) {
    if (this.isLoading) {
      if (callback) callback(new Error("排行榜正在加載中"), null);
      return;
    }
    
    this.isLoading = true;
    if (this.showLoadingIndicator) {
      this.showLoading(true);
    }
    
    // 先加載本地緩存的排行榜數據
    this.leaderboard = this.loadLocalLeaderboard();
    
    // 如果本地沒有數據，創建一個空陣列
    if (!this.leaderboard || !Array.isArray(this.leaderboard)) {
      this.leaderboard = [];
    }
    
    let self = this;
    let serviceComp = this.leaderboardService.getComponent('LeaderboardService');
    
    // 檢查是否有網絡連接
    if (serviceComp && !serviceComp.offlineMode) {
      serviceComp.getLeaderboard(function(err, data) {
        self.isLoading = false;
        
        if (self.showLoadingIndicator) {
          self.showLoading(false);
        }
        
        if (err) {
          console.error("加載排行榜數據時出錯：", err);
          // 保存錯誤信息，但不顯示給用戶
          self.lastErrorMessage = err.message || "未知錯誤";
          
          // 已經使用本地數據，所以這裡只需回調
          if (callback) callback(err, self.leaderboard);
        } else {
          self.lastErrorMessage = "";
          
          // 確保數據是有效的陣列
          if (data && Array.isArray(data)) {
            self.leaderboard = data;
            // 確保數據量不超過最大顯示數量
            if (self.leaderboard.length > self.maxEntries) {
              self.leaderboard = self.leaderboard.slice(0, self.maxEntries);
            }
            
            // 保存到本地存儲
            cc.sys.localStorage.setItem('leaderboard', JSON.stringify(self.leaderboard));
          } else {
            console.warn("從服務器獲取的排行榜數據格式無效");
          }
          
          if (callback) callback(null, self.leaderboard);
        }
      });
    } else {
      // 離線模式，直接使用本地數據
      this.isLoading = false;
      
      if (this.showLoadingIndicator) {
        this.showLoading(false);
      }
      
      if (callback) {
        callback(new Error("離線模式"), this.leaderboard);
      }
    }
    
    // 無論如何，都返回已加載的本地數據
    return this.leaderboard;
  },
  
  // 從本地存儲加載排行榜（作為備用）
  loadLocalLeaderboard() {
    let leaderboardData = cc.sys.localStorage.getItem('leaderboard');
    if (leaderboardData) {
      try {
        return JSON.parse(leaderboardData);
      } catch (e) {
        console.error('無法解析排行榜數據:', e);
        return [];
      }
    }
    return [];
  },
  
  // 顯示/隱藏加載指示器
  showLoading(show) {
    let canvas = cc.director.getScene().getComponentInChildren(cc.Canvas);
    let loadingNode = canvas.node.getChildByName("LeaderboardLoading");
    
    if (show) {
      if (!loadingNode) {
        loadingNode = new cc.Node("LeaderboardLoading");
        loadingNode.parent = canvas.node;
        
        // 創建背景
        let bg = new cc.Node("Background");
        bg.width = 200;
        bg.height = 100;
        
        let graphics = bg.addComponent(cc.Graphics);
        graphics.fillColor = cc.color(0, 0, 0, 150);
        graphics.roundRect(-100, -50, 200, 100, 10);
        graphics.fill();
        
        bg.parent = loadingNode;
        
        // 創建文本
        let label = new cc.Node("Label");
        let textComp = label.addComponent(cc.Label);
        textComp.string = "載入排行榜中...";
        textComp.fontSize = 20;
        textComp.lineHeight = 20;
        label.parent = loadingNode;
        
        // 居中顯示
        loadingNode.position = cc.v2(0, 0);
      }
      loadingNode.active = true;
    } else if (loadingNode) {
      loadingNode.active = false;
    }
  },
  
  // 檢查連線狀態
  getConnectionStatus() {
    let service = this.leaderboardService.getComponent('LeaderboardService');
    if (!service) {
      return {
        isOffline: true,
        status: "服務未初始化"
      };
    }
    
    // 使用新的連接狀態方法
    if (typeof service.getConnectionStatusDescription === 'function') {
      return {
        isOffline: service.offlineMode,
        status: service.getConnectionStatusDescription()
      };
    }
    
    // 向下兼容的方式
    return {
      isOffline: service.offlineMode,
      status: service.offlineMode ? "網絡連接不可用，顯示本地排行榜" : "已連接到在線排行榜服務"
    };
  },
  
  // 添加新的玩家成績
  addScore(playerId, score, callback) {
    if (!playerId) {
      if (callback) callback(new Error("玩家 ID 無效"), null);
      return -1;
    }
    
    let self = this;
    let serviceComp = this.leaderboardService.getComponent('LeaderboardService');
    
    serviceComp.addScore(playerId, score, function(err, result) {
      if (err) {
        console.error("添加分數時出錯：", err);
        
        // 使用本地添加作為備用
        let rank = self.addScoreLocally(playerId, score);
        if (callback) callback(err, { rank: rank });
      } else {
        // 更新本地排行榜
        self.loadLeaderboard(function() {
          if (callback) callback(null, result);
        });
      }
    });
    
    // 返回當前本地緩存中的排名（可能不準確，等待回調獲取正確排名）
    return this.getRank(playerId);
  },
  
  // 本地添加分數（備用方法）
  addScoreLocally(playerId, score) {
    // 檢查玩家是否已經在排行榜中
    let existingEntry = this.leaderboard.find(entry => entry.playerId === playerId);
    
    if (existingEntry) {
      // 如果新分數更高則更新
      if (score > existingEntry.score) {
        existingEntry.score = score;
        existingEntry.date = new Date().toISOString();
      }
    } else {
      // 新增玩家到排行榜
      this.leaderboard.push({
        playerId: playerId,
        score: score,
        date: new Date().toISOString()
      });
    }
    
    // 重新排序排行榜
    this.leaderboard.sort((a, b) => b.score - a.score);
    
    // 如果超過最大數量，則移除多餘的項目
    if (this.leaderboard.length > this.maxEntries) {
      this.leaderboard = this.leaderboard.slice(0, this.maxEntries);
    }
    
    // 保存到本地存儲
    cc.sys.localStorage.setItem('leaderboard', JSON.stringify(this.leaderboard));
    
    return this.getRank(playerId);
  },
  
  // 獲取玩家在排行榜中的排名
  getRank(playerId) {
    for (let i = 0; i < this.leaderboard.length; i++) {
      if (this.leaderboard[i].playerId === playerId) {
        return i + 1;
      }
    }
    return -1;
  },
  
  // 獲取排行榜數據
  getLeaderboard() {
    return this.leaderboard;
  },
  
  // 清除排行榜
  clearLeaderboard(callback) {
    // 本地清除
    this.leaderboard = [];
    cc.sys.localStorage.removeItem('leaderboard');
    
    // 清除待上傳的分數
    let serviceComp = this.leaderboardService.getComponent('LeaderboardService');
    if (serviceComp && serviceComp.pendingScores) {
      serviceComp.pendingScores = [];
      serviceComp.savePendingScores();
    }
    
    if (callback) {
      callback(new Error("伺服器端排行榜清除需要管理員權限"));
    }
    
    console.log("本地排行榜已清除");
  }
});