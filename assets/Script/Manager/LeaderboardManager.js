const Toast = require('../Utils/Toast');
const GlobalData = require("../Utils/GlobalData");

cc.Class({
    extends: cc.Component,
    
    properties: {
        serverUrl: {
            default: "https://cocosmatch3-leaderboard-d9f72e8259a4.herokuapp.com/api",
            tooltip: "排行榜伺服器 API 地址"
        },
        maxEntries: {
            default: 10,
            tooltip: "排行榜顯示的最大玩家數量"
        },
        connectionTimeout: {
            default: 10,
            tooltip: "連接超時時間(秒)"
        },
        retryTimes: {
            default: 3,
            tooltip: "連接失敗重試次數"
        }
    },
    
    // 初始化
    onLoad() {
        this.leaderboardData = [];
        this.localLeaderboardData = [];
        this.isLoading = false;
        this.isOfflineMode = false;
        this.currentPlayerId = "";
        this.pendingScores = [];
        
        // 從本地讀取排行榜數據
        this.loadLocalLeaderboard();
        
        // 讀取待上傳的分數
        this.loadPendingScores();
        
        // 檢查連接狀態
        this.checkConnection();
    },
    
    start() {
        // 嘗試上傳待處理的分數
        this.uploadPendingScores();
    },

    // 檢查服務器連接
    checkConnection() {
      let self = this;
      let xhr = new XMLHttpRequest();
      xhr.timeout = this.connectionTimeout * 1000;
      
      xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
              if (xhr.status >= 200 && xhr.status < 300) {
                  console.log("排行榜服務連接正常");
                  self.isOfflineMode = false;
              } else {
                  console.warn("排行榜服務連接失敗，狀態碼：", xhr.status);
                  self.isOfflineMode = true;
              }
          }
      };
      
      xhr.onerror = function() {
          console.error("排行榜服務連接錯誤");
          self.isOfflineMode = true;
      };
      
      xhr.ontimeout = function() {
          console.error("排行榜服務連接超時");
          self.isOfflineMode = true;
      };
      
      try {
          xhr.open("GET", this.serverUrl + "/health", true);
          xhr.send();
      } catch (e) {
          console.error("發送連接請求時出錯：", e);
          this.isOfflineMode = true;
      }
    },
    
    // 獲取排行榜數據
    getLeaderboard(callback, forceRefresh = false) {
        if (this.isLoading && !forceRefresh) {
            if (callback) callback(new Error("正在獲取排行榜數據中"), this.localLeaderboardData);
            return;
        }
        
        this.isLoading = true;
        
        // 如果是離線模式，直接使用本地數據
        if (this.isOfflineMode) {
            this.isLoading = false;
            if (callback) callback(new Error("離線模式"), this.localLeaderboardData);
            return;
        }
        
        let self = this;
        let retryCount = 0;
        
        const fetchLeaderboard = () => {
            let xhr = new XMLHttpRequest();
            xhr.timeout = this.connectionTimeout * 1000;
            
            // 添加時間戳和隨機參數避免快取
            let url = this.serverUrl + "/leaderboard";
            if (forceRefresh) {
                url += "?t=" + Date.now() + "&nocache=" + Math.random();
            }
            
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            let response = JSON.parse(xhr.responseText);
                            if (response && response.data) {
                                self.leaderboardData = response.data;
                                self.saveLocalLeaderboard(response.data);
                                self.isLoading = false;
                                if (callback) callback(null, response.data);
                            } else {
                                throw new Error("服務器返回數據格式無效");
                            }
                        } catch (e) {
                            console.error("解析排行榜數據時出錯：", e);
                            self.retryOrFallback(fetchLeaderboard, callback, retryCount++, e);
                        }
                    } else {
                        console.warn("獲取排行榜失敗，狀態碼：", xhr.status);
                        self.retryOrFallback(fetchLeaderboard, callback, retryCount++, new Error("服務器錯誤：" + xhr.status));
                    }
                }
            };
            
            xhr.onerror = function() {
                console.error("獲取排行榜時網絡錯誤");
                self.retryOrFallback(fetchLeaderboard, callback, retryCount++, new Error("網絡連接錯誤"));
            };
            
            xhr.ontimeout = function() {
                console.error("獲取排行榜超時");
                self.retryOrFallback(fetchLeaderboard, callback, retryCount++, new Error("請求超時"));
            };
            
            try {
                xhr.open("GET", url, true);
                xhr.setRequestHeader("Cache-Control", "no-cache");
                xhr.send();
            } catch (e) {
                console.error("發送獲取排行榜請求時出錯：", e);
                self.retryOrFallback(fetchLeaderboard, callback, retryCount++, e);
            }
        };
        
        fetchLeaderboard();
    },
    
    // 重試或切換到本地模式
    retryOrFallback(fetchFunc, callback, retryCount, error) {
        if (retryCount < this.retryTimes) {
            console.log(`重試獲取排行榜(${retryCount + 1}/${this.retryTimes})...`);
            setTimeout(fetchFunc, 1000); // 延遲1秒後重試
        } else {
            console.log("重試次數用盡，切換到離線模式");
            this.isOfflineMode = true;
            this.isLoading = false;
            if (callback) callback(error, this.localLeaderboardData);
        }
    },

    // 添加分數到排行榜
    addScore(playerId, score, callback) {
      this.currentPlayerId = playerId;
      
      // 先更新本地排行榜，確保有資料可顯示
      this.addScoreLocally(playerId, score);
      
      // 如果是離線模式，加入待上傳隊列
      if (this.isOfflineMode) {
          this.addToPendingScores(playerId, score);
          let rank = this.getPlayerRank(playerId);
          if (callback) callback(new Error("離線模式"), { rank: rank });
          return rank;
      }
      
      let self = this;
      let xhr = new XMLHttpRequest();
      xhr.timeout = this.connectionTimeout * 1000;
      let retryCount = 0;
      
      const sendScore = () => {
          xhr.onreadystatechange = function() {
              if (xhr.readyState === 4) {
                  if (xhr.status >= 200 && xhr.status < 300) {
                      try {
                          let response = JSON.parse(xhr.responseText);
                          console.log("分數上傳成功，服務器返回：", response);
                          
                          // 上傳成功後更新排行榜
                          self.getLeaderboard((err, data) => {
                              if (!err && data) {
                                  let rank = self.getPlayerRank(playerId);
                                  if (callback) callback(null, { rank: rank });
                              } else {
                                  // 如果獲取排行榜失敗，使用本地排名
                                  let rank = self.getPlayerRank(playerId);
                                  if (callback) callback(new Error("獲取最新排行榜失敗"), { rank: rank });
                              }
                          }, true);
                      } catch (e) {
                          console.error("解析上傳分數響應時出錯：", e);
                          self.scoreRetryOrFallback(playerId, score, sendScore, callback, retryCount++, e);
                      }
                  } else {
                      console.warn("上傳分數失敗，狀態碼：", xhr.status);
                      self.scoreRetryOrFallback(playerId, score, sendScore, callback, retryCount++, new Error("服務器錯誤：" + xhr.status));
                  }
              }
          };
          
          xhr.onerror = function() {
              console.error("上傳分數時網絡錯誤");
              self.scoreRetryOrFallback(playerId, score, sendScore, callback, retryCount++, new Error("網絡連接錯誤"));
          };
          
          xhr.ontimeout = function() {
              console.error("上傳分數超時");
              self.scoreRetryOrFallback(playerId, score, sendScore, callback, retryCount++, new Error("請求超時"));
          };
          
          try {
              xhr.open("POST", this.serverUrl + "/leaderboard", true);
              xhr.setRequestHeader("Content-Type", "application/json");
              
              let payload = {
                  playerId: playerId,
                  score: score,
                  date: new Date().toISOString()
              };
              
              xhr.send(JSON.stringify(payload));
          } catch (e) {
              console.error("發送上傳分數請求時出錯：", e);
              self.scoreRetryOrFallback(playerId, score, sendScore, callback, retryCount++, e);
          }
      };
      
      sendScore();
      
      // 返回當前本地排名
      return this.getPlayerRank(playerId);
    },
    
    // 分數上傳重試或回退
    scoreRetryOrFallback(playerId, score, sendFunc, callback, retryCount, error) {
        if (retryCount < this.retryTimes) {
            console.log(`重試上傳分數(${retryCount + 1}/${this.retryTimes})...`);
            setTimeout(sendFunc, 1000); // 延遲1秒後重試
        } else {
            console.log("重試次數用盡，添加到待上傳隊列");
            this.addToPendingScores(playerId, score);
            let rank = this.getPlayerRank(playerId);
            if (callback) callback(error, { rank: rank });
        }
    },
    
    // 本地添加分數
    addScoreLocally(playerId, score) {
        let found = false;
        
        // 檢查是否已有此玩家的紀錄
        for (let i = 0; i < this.localLeaderboardData.length; i++) {
            if (this.localLeaderboardData[i].playerId === playerId) {
                found = true;
                // 只有當新分數更高時才更新
                if (score > this.localLeaderboardData[i].score) {
                    this.localLeaderboardData[i].score = score;
                    this.localLeaderboardData[i].date = new Date().toISOString();
                }
                break;
            }
        }
        
        // 如果沒有找到，添加新紀錄
        if (!found) {
            this.localLeaderboardData.push({
                playerId: playerId,
                score: score,
                date: new Date().toISOString()
            });
        }
        
        // 重新排序
        this.localLeaderboardData.sort((a, b) => b.score - a.score);
        
        // 儲存到本地
        this.saveLocalLeaderboard(this.localLeaderboardData);
        
        return this.getPlayerRank(playerId);
    },
    
    // 獲取玩家排名
    getPlayerRank(playerId) {
        let data = this.isOfflineMode ? this.localLeaderboardData : (this.leaderboardData.length > 0 ? this.leaderboardData : this.localLeaderboardData);
        
        for (let i = 0; i < data.length; i++) {
            if (data[i].playerId === playerId) {
                return i + 1;
            }
        }
        
        return -1; // 未找到玩家
    },

    // 加入待上傳隊列
    addToPendingScores(playerId, score) {
      // 檢查是否已存在
      let found = false;
      for (let i = 0; i < this.pendingScores.length; i++) {
          if (this.pendingScores[i].playerId === playerId) {
              found = true;
              // 只有更高分數才更新
              if (score > this.pendingScores[i].score) {
                  this.pendingScores[i].score = score;
                  this.pendingScores[i].date = new Date().toISOString();
              }
              break;
          }
      }
      
      // 如果沒有找到，添加新紀錄
      if (!found) {
          this.pendingScores.push({
              playerId: playerId,
              score: score,
              date: new Date().toISOString()
          });
      }
      
      // 保存待上傳隊列
      this.savePendingScores();
    },
    
    // 上傳待處理的分數
    uploadPendingScores() {
        if (this.pendingScores.length === 0 || this.isOfflineMode) {
            return;
        }
        
        console.log("嘗試上傳待處理分數，數量：", this.pendingScores.length);
        
        // 複製一份待上傳隊列
        let scoresToUpload = [...this.pendingScores];
        let successCount = 0;
        
        for (let i = 0; i < scoresToUpload.length; i++) {
            let item = scoresToUpload[i];
            let xhr = new XMLHttpRequest();
            
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        console.log(`待處理分數上傳成功：${item.playerId}, 分數: ${item.score}`);
                        successCount++;
                        
                        // 從待上傳隊列中移除
                        let index = this.pendingScores.findIndex(s => s.playerId === item.playerId && s.score === item.score);
                        if (index !== -1) {
                            this.pendingScores.splice(index, 1);
                            this.savePendingScores();
                        }
                        
                        // 所有分數都上傳完成
                        if (successCount === scoresToUpload.length) {
                            console.log("所有待處理分數上傳成功");
                            this.getLeaderboard(); // 刷新排行榜
                        }
                    }
                }
            }.bind(this);
            
            try {
                xhr.open("POST", this.serverUrl + "/leaderboard", true);
                xhr.setRequestHeader("Content-Type", "application/json");
                xhr.send(JSON.stringify(item));
            } catch (e) {
                console.error("上傳待處理分數出錯：", e);
            }
        }
    },
    
    // 保存本地排行榜
    saveLocalLeaderboard(data) {
        if (Array.isArray(data)) {
            try {
                cc.sys.localStorage.setItem('leaderboard', JSON.stringify(data));
            } catch (e) {
                console.error("保存本地排行榜失敗：", e);
            }
        }
    },
    
    // 讀取本地排行榜
    loadLocalLeaderboard() {
        try {
            let data = cc.sys.localStorage.getItem('leaderboard');
            if (data) {
                this.localLeaderboardData = JSON.parse(data);
                // 確保數據是陣列
                if (!Array.isArray(this.localLeaderboardData)) {
                    this.localLeaderboardData = [];
                }
                // 確保排序正確
                this.localLeaderboardData.sort((a, b) => b.score - a.score);
            } else {
                this.localLeaderboardData = [];
            }
        } catch (e) {
            console.error("讀取本地排行榜失敗：", e);
            this.localLeaderboardData = [];
        }
    },
    
    // 保存待上傳分數
    savePendingScores() {
        try {
            cc.sys.localStorage.setItem('pendingScores', JSON.stringify(this.pendingScores));
        } catch (e) {
            console.error("保存待上傳分數失敗：", e);
        }
    },
    
    // 讀取待上傳分數
    loadPendingScores() {
        try {
            let data = cc.sys.localStorage.getItem('pendingScores');
            if (data) {
                this.pendingScores = JSON.parse(data);
                if (!Array.isArray(this.pendingScores)) {
                    this.pendingScores = [];
                }
            } else {
                this.pendingScores = [];
            }
        } catch (e) {
            console.error("讀取待上傳分數失敗：", e);
            this.pendingScores = [];
        }
    },

    // 顯示排行榜界面
    showLeaderboard(skipLoadingToast = false) {
        let canvas = cc.director.getScene().getComponentInChildren(cc.Canvas);
        let self = this;
        
        // 檢查是否已經有排行榜面板在顯示
        let existingLeaderboard = canvas.node.getChildByName("LeaderboardPanel");
        if (existingLeaderboard) {
            console.log("排行榜已經在顯示中，避免重複創建");
            return;
        }
        
        // 獲取當前玩家ID
        let currentPlayerId = GlobalData.getPlayerId();
        if (!currentPlayerId) {
            currentPlayerId = cc.sys.localStorage.getItem('playerId') || "";
        }
        this.currentPlayerId = currentPlayerId;
        
        // 建立遮罩背景
        let maskNode = new cc.Node("LeaderboardMask");
        let maskSprite = maskNode.addComponent(cc.Sprite);
        maskSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        maskNode.width = canvas.node.width;
        maskNode.height = canvas.node.height;
        maskNode.color = cc.color(0, 0, 0);
        maskNode.opacity = 150; // 半透明
        maskNode.parent = canvas.node;
        
        // 建立排行榜面板
        let leaderboardNode = new cc.Node("LeaderboardPanel");
        leaderboardNode.width = 600;
        leaderboardNode.height = 700;
        
        // 使用繪圖元件來畫一個白色矩形
        let graphics = leaderboardNode.addComponent(cc.Graphics);
        graphics.fillColor = cc.color(255, 255, 255, 255);
        graphics.rect(-300, -350, 600, 700);
        graphics.fill();
        
        // 先將節點添加到畫布，但設置為不可見
        leaderboardNode.parent = canvas.node;
        
        // 添加排行榜標題
        let titleNode = new cc.Node("Title");
        let titleLabel = titleNode.addComponent(cc.Label);
        titleLabel.string = "排行榜";
        titleLabel.fontSize = 40;
        titleLabel.lineHeight = 40;
        titleNode.color = cc.color(0, 0, 0);
        titleNode.position = cc.v2(0, 300);
        titleNode.parent = leaderboardNode;
        
        // 添加連接狀態提示
        let statusNode = new cc.Node("Status");
        let statusLabel = statusNode.addComponent(cc.Label);
        statusLabel.string = this.isOfflineMode ? "離線模式，顯示本地排行榜" : "已連接到線上排行榜服務";
        statusLabel.fontSize = 16;
        statusLabel.lineHeight = 16;
        statusNode.color = this.isOfflineMode ? cc.color(255, 0, 0) : cc.color(0, 128, 0);
        statusNode.position = cc.v2(0, 260);
        statusNode.parent = leaderboardNode;
        
        // 添加載入中提示
        let loadingNode = new cc.Node("Loading");
        let loadingLabel = loadingNode.addComponent(cc.Label);
        loadingLabel.string = "載入中...";
        loadingLabel.fontSize = 24;
        loadingNode.position = cc.v2(0, 0);
        loadingNode.parent = leaderboardNode;
        
        // 建立加載提示，但只有在不跳過提示時才顯示
        if (!skipLoadingToast) {
            Toast("正在上傳成績並獲取最新排行資料...", { duration: 2, gravity: "CENTER" });
        }
        
        // 獲取排行榜數據
        this.getLeaderboard(function(err, data) {
            // 移除載入中提示
            loadingNode.destroy();
            
            if (err) {
                console.error("獲取排行榜失敗：", err);
                if (!skipLoadingToast) {
                    Toast("無法獲取線上排行，顯示本地排行榜!", { duration: 2, gravity: "CENTER" });
                }
                
                // 使用本地數據
                data = self.localLeaderboardData;
                statusLabel.string = "離線模式，顯示本地排行榜";
                statusNode.color = cc.color(255, 0, 0);
            } else {
                if (!skipLoadingToast) {
                    Toast("已獲取最新排行資料!", { duration: 2, gravity: "CENTER" });
                }
            }
            
            // 先準備好所有UI元素，但不添加到場景中
            let contentNode = new cc.Node("LeaderboardContent");
            
            // 顯示排行榜數據
            self.renderLeaderboard(contentNode, data, currentPlayerId);
            
            // 分別添加返回主頁按鈕和刷新按鈕
            self.addBackButton(contentNode, maskNode);
            self.addRefreshButton(contentNode, maskNode);
            
            // 一次性添加到排行榜面板，避免多次重繪
            contentNode.parent = leaderboardNode;
        }, true);
    },

    // 渲染排行榜數據
    renderLeaderboard(contentNode, data, currentPlayerId) {
      // 確保數據有效
      if (!data || !Array.isArray(data)) {
          data = [];
      }
      
      // 查找當前玩家的排名
      let currentPlayerRank = -1;
      let currentPlayerData = null;
      
      for (let i = 0; i < data.length; i++) {
          if (data[i].playerId === currentPlayerId) {
              currentPlayerRank = i + 1;
              currentPlayerData = data[i];
              break;
          }
      }
      
      // 如果當前玩家不在排行榜中，則創建一個臨時數據
      if (currentPlayerRank === -1 && currentPlayerId) {
          currentPlayerData = {
              playerId: currentPlayerId,
              score: 0, // 預設分數為0
              date: new Date().toISOString()
          };
          // 不給予排名，會顯示為「未上榜」
      }
      
      // 顯示前十名
      let displayCount = Math.min(10, data.length);
      
      // 建立排行榜表頭 - 增加字體大小
      let headerNode = new cc.Node("Header");
      headerNode.position = cc.v2(0, 230);
      headerNode.parent = contentNode;
      
      // 排名表頭
      let rankHeaderNode = new cc.Node("RankHeader");
      let rankHeaderLabel = rankHeaderNode.addComponent(cc.Label);
      rankHeaderLabel.string = "排名";
      rankHeaderLabel.fontSize = 30; // 增加字體大小
      rankHeaderNode.color = cc.color(100, 100, 100);
      rankHeaderNode.position = cc.v2(-200, 0);
      rankHeaderNode.parent = headerNode;
      
      // 玩家ID表頭
      let idHeaderNode = new cc.Node("IDHeader");
      let idHeaderLabel = idHeaderNode.addComponent(cc.Label);
      idHeaderLabel.string = "玩家ID";
      idHeaderLabel.fontSize = 30; // 增加字體大小
      idHeaderNode.color = cc.color(100, 100, 100);
      idHeaderNode.position = cc.v2(0, 0);
      idHeaderNode.parent = headerNode;
      
      // 分數表頭
      let scoreHeaderNode = new cc.Node("ScoreHeader");
      let scoreHeaderLabel = scoreHeaderNode.addComponent(cc.Label);
      scoreHeaderLabel.string = "分數";
      scoreHeaderLabel.fontSize = 30; // 增加字體大小
      scoreHeaderNode.color = cc.color(100, 100, 100);
      scoreHeaderNode.position = cc.v2(200, 0);
      scoreHeaderNode.parent = headerNode;
      
      // 分隔線
      let lineNode = new cc.Node("Line");
      let lineGraphics = lineNode.addComponent(cc.Graphics);
      lineGraphics.strokeColor = cc.color(200, 200, 200);
      lineGraphics.lineWidth = 2;
      lineGraphics.moveTo(-275, 0);
      lineGraphics.lineTo(275, 0);
      lineGraphics.stroke();
      lineNode.position = cc.v2(0, 210);
      lineNode.parent = contentNode;
      
      // 計算內容區域的高度，用於後續計算玩家項目的位置
      let availableHeight = 480; // 估計可用高度
      let itemHeight = 45; // 每個項目的高度
      let totalItems = displayCount + (currentPlayerRank > 10 || currentPlayerRank === -1 ? 1 : 0);
      
      // 創建排行榜項目
      for (let i = 0; i < displayCount; i++) {
          let entry = data[i];
          
          let entryNode = new cc.Node(`Entry_${i}`);
          entryNode.position = cc.v2(0, 180 - i * 45); // 調整間距，以適應較大字體
          entryNode.parent = contentNode;
          
          // 如果是當前玩家，先增加高亮背景
          if (entry.playerId === currentPlayerId) {
              let highlightNode = new cc.Node("Highlight");
              let highlightGraphics = highlightNode.addComponent(cc.Graphics);
              highlightGraphics.fillColor = cc.color(135, 206, 250, 100);
              highlightGraphics.rect(-275, -22, 550, 44); // 調整高亮區域大小
              highlightGraphics.fill();
              highlightNode.parent = entryNode;
              highlightNode.setSiblingIndex(0); // 確保背景在最底層
          }
          
          // 排名
          let rankNode = new cc.Node("Rank");
          let rankLabel = rankNode.addComponent(cc.Label);
          rankLabel.string = (i + 1).toString();
          rankLabel.fontSize = 28; // 增加字體大小
          rankNode.color = cc.color(0, 0, 0);
          rankNode.position = cc.v2(-200, 0);
          rankNode.parent = entryNode;
          
          // 玩家ID
          let idNode = new cc.Node("ID");
          let idLabel = idNode.addComponent(cc.Label);
          idLabel.string = entry.playerId || "未知玩家";
          idLabel.fontSize = 28; // 增加字體大小
          idNode.color = cc.color(0, 0, 0);
          idNode.position = cc.v2(0, 0);
          idNode.parent = entryNode;
          
          // 分數
          let scoreNode = new cc.Node("Score");
          let scoreLabel = scoreNode.addComponent(cc.Label);
          scoreLabel.string = entry.score.toString();
          scoreLabel.fontSize = 28; // 增加字體大小
          scoreNode.color = cc.color(0, 0, 0);
          scoreNode.position = cc.v2(200, 0);
          scoreNode.parent = entryNode;
      }
      
      // 如果當前玩家不在前十名或不在排行榜中，單獨顯示
      if ((currentPlayerRank > 10 || currentPlayerRank === -1) && currentPlayerData) {
        // 添加一條分隔線
        let separatorNode = new cc.Node("Separator");
        let separatorGraphics = separatorNode.addComponent(cc.Graphics);
        separatorGraphics.strokeColor = cc.color(200, 200, 200);
        separatorGraphics.lineWidth = 2;
        separatorGraphics.moveTo(-275, 0);
        separatorGraphics.lineTo(275, 0);
        separatorGraphics.stroke();
        
        // 計算第10名的位置，然後加上一個項目的高度作為分隔線位置
        // 如果沒有10個項目，則使用實際項目數計算
        let itemCount = Math.min(10, displayCount);
        let separatorY = 180 - (itemCount * 45) + 33.75;
        separatorNode.position = cc.v2(0, separatorY);
        separatorNode.parent = contentNode;
        
        // 創建當前玩家項目
        let playerEntryNode = new cc.Node("CurrentPlayerEntry");
        // 將當前玩家的位置設為分隔線下方一個項目高度處
        let playerEntryY = separatorY - 33.75;
        playerEntryNode.position = cc.v2(0, playerEntryY);
        playerEntryNode.parent = contentNode;
        
        // 先設置高亮背景
        let highlightNode = new cc.Node("Highlight");
        let highlightGraphics = highlightNode.addComponent(cc.Graphics);
        highlightGraphics.fillColor = cc.color(135, 206, 250, 100);
        highlightGraphics.rect(-275, -22, 550, 44); // 調整高亮區域大小
        highlightGraphics.fill();
        highlightNode.parent = playerEntryNode;
        highlightNode.setSiblingIndex(0); // 確保背景在最底層
        
        // 排名
        let rankNode = new cc.Node("Rank");
        let rankLabel = rankNode.addComponent(cc.Label);
        rankLabel.string = currentPlayerRank > 0 ? currentPlayerRank.toString() : "未上榜";
        rankLabel.fontSize = 28;
        rankNode.color = cc.color(0, 0, 0);
        rankNode.position = cc.v2(-200, 0);
        rankNode.parent = playerEntryNode;
        
        // 玩家ID
        let idNode = new cc.Node("ID");
        let idLabel = idNode.addComponent(cc.Label);
        idLabel.string = currentPlayerData.playerId;
        idLabel.fontSize = 28;
        idNode.color = cc.color(0, 0, 0);
        idNode.position = cc.v2(0, 0);
        idNode.parent = playerEntryNode;
        
        // 分數
        let scoreNode = new cc.Node("Score");
        let scoreLabel = scoreNode.addComponent(cc.Label);
        scoreLabel.string = currentPlayerData.score.toString();
        scoreLabel.fontSize = 28;
        scoreNode.color = cc.color(0, 0, 0);
        scoreNode.position = cc.v2(200, 0);
        scoreNode.parent = playerEntryNode;
      }
    },

    // 返回主頁按鈕
    addBackButton(contentNode, maskNode) {
        // 創建返回按鈕 (左側按鈕)
        let backButton = new cc.Node("BackButton");
        backButton.width = 220;
        backButton.height = 60;
        backButton.position = cc.v2(-120, -320); // 修改位置，向左偏移
        backButton.parent = contentNode;
        
        // 使用 Graphics 繪製按鈕背景
        let buttonGraphics = backButton.addComponent(cc.Graphics);
        buttonGraphics.fillColor = cc.color(51, 122, 183, 255);
        
        // 確保矩形大小與按鈕節點大小一致
        buttonGraphics.rect(-110, -30, 220, 60);
        buttonGraphics.fill();
        
        // 添加標籤
        let buttonLabel = new cc.Node("Label");
        let label = buttonLabel.addComponent(cc.Label);
        label.string = "返回主頁";
        label.fontSize = 30;
        label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;  // 水平居中
        label.verticalAlign = cc.Label.VerticalAlign.CENTER;      // 垂直居中
        
        // 調整標籤位置，使其在按鈕中間偏下一點
        buttonLabel.position = cc.v2(0, -2);
        
        buttonLabel.color = cc.color(255, 255, 255);
        buttonLabel.parent = backButton;
        
        // 添加點擊事件
        backButton.on(cc.Node.EventType.TOUCH_END, () => {
            console.log("返回主頁");
            
            // 禁用按鈕防止多次點擊
            backButton.off(cc.Node.EventType.TOUCH_END);
            
            let leaderboardPanel = backButton.parent.parent; // contentNode的父節點，即leaderboardNode
            leaderboardPanel.destroy();
            maskNode.destroy();
            this.loadLoginScene();
        });
    },

    // 刷新排行榜按鈕
    addRefreshButton(contentNode, maskNode) {
        // 創建刷新按鈕 (右側按鈕)
        let refreshButton = new cc.Node("RefreshButton");
        refreshButton.width = 220;
        refreshButton.height = 60;
        refreshButton.position = cc.v2(120, -320); // 向右偏移
        refreshButton.parent = contentNode;
        
        // 添加按鈕組件
        let buttonComp = refreshButton.addComponent(cc.Button);
        
        // 使用 Graphics 繪製按鈕背景
        let buttonGraphics = refreshButton.addComponent(cc.Graphics);
        buttonGraphics.fillColor = cc.color(46, 204, 113, 255); // 使用綠色以區分
        
        // 確保矩形大小與按鈕節點大小一致
        buttonGraphics.rect(-110, -30, 220, 60);
        buttonGraphics.fill();
        
        // 添加標籤
        let buttonLabel = new cc.Node("Label");
        let label = buttonLabel.addComponent(cc.Label);
        label.string = "刷新排行榜";
        label.fontSize = 30;
        label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;  // 水平居中
        label.verticalAlign = cc.Label.VerticalAlign.CENTER;      // 垂直居中
        
        // 調整標籤位置，使其在按鈕中間偏下一點
        buttonLabel.position = cc.v2(0, -2);
        
        buttonLabel.color = cc.color(255, 255, 255);
        buttonLabel.parent = refreshButton;
        
        // 添加點擊事件
        refreshButton.on(cc.Node.EventType.TOUCH_END, () => {
            // 臨時禁用按鈕防止連續多次點擊
            refreshButton.getComponent(cc.Button) || refreshButton.addComponent(cc.Button);
            let refreshBtnComp = refreshButton.getComponent(cc.Button);
            refreshBtnComp.interactable = false;
            
            console.log("刷新排行榜");
            
            // 顯示加載中提示
            const Toast = require('../Utils/Toast');
            Toast("正在刷新排行榜資料...", { duration: 2, gravity: "CENTER" });
            
            // 獲取當前顯示的排行榜面板
            let leaderboardPanel = refreshButton.parent.parent;
            
            // 獲取當前內容容器
            let contentContainer = refreshButton.parent;
            
            // 取得當前玩家ID
            let currentPlayerId = this.currentPlayerId;
            
            // 重新獲取排行榜數據
            this.getLeaderboard((err, data) => {
                // 重新啟用按鈕
                if (refreshBtnComp) {
                    refreshBtnComp.interactable = true;
                }
                
                if (err) {
                    Toast("無法獲取最新排行榜資料，顯示本地資料", { duration: 2, gravity: "CENTER" });
                    data = this.localLeaderboardData;
                } else {
                    Toast("已獲取最新排行榜資料！", { duration: 2, gravity: "CENTER" });
                }
                
                // 找到並更新狀態顯示
                let statusNode = leaderboardPanel.getChildByName("Status");
                if (statusNode) {
                    let statusLabel = statusNode.getComponent(cc.Label);
                    statusLabel.string = this.isOfflineMode ? "離線模式，顯示本地排行榜" : "已連接到線上排行榜服務";
                    statusNode.color = this.isOfflineMode ? cc.color(255, 0, 0) : cc.color(0, 128, 0);
                }
                
                // 創建新的內容容器
                let newContentNode = new cc.Node("LeaderboardContent");
                
                // 重新渲染排行榜
                this.renderLeaderboard(newContentNode, data, currentPlayerId);
                
                // 分別添加返回主頁按鈕和刷新按鈕
                this.addBackButton(newContentNode, maskNode);
                this.addRefreshButton(newContentNode, maskNode);
                
                // 一次性將新內容添加到面板
                newContentNode.parent = leaderboardPanel;
                
                // 移除舊內容（確保在新內容添加後再移除）
                if (contentContainer && contentContainer !== newContentNode) {
                    contentContainer.destroy();
                }
            }, true); // 強制刷新
        });
    },
        
    // 載入登入場景
    loadLoginScene() {
        try {
            // 清理當前場景中的任何計時器或動作
            this.cleanupCurrentScene();

            cc.loader.onProgress = null; // 清除載入進度回調
            
            // 預加載登入場景
            cc.director.preloadScene("Login", () => {
                cc.director.loadScene("Login");
            });
        } catch (e) {
            console.error("載入登入場景失敗：", e);

            cc.loader.onProgress = null; // 清除載入進度回調
            
            // 如果預加載失敗，直接嘗試載入
            try {
                cc.director.loadScene("Login");
            } catch (err) {
                console.error("直接載入場景失敗：", err);
                
                // 最後嘗試重啟遊戲
                try {
                    cc.game.restart();
                } catch (finalErr) {
                    console.error("重啟遊戲失敗：", finalErr);
                    Toast("返回主頁失敗，請重新啟動遊戲", { duration: 3, gravity: "CENTER" });
                }
            }
        }
    },
    
    // 清理當前場景
    cleanupCurrentScene() {
        // 尋找並停止所有計時器
        let canvas = cc.director.getScene();
        let gameSceneNode = canvas.getChildByName('GameScene') || canvas.getChildByName('Canvas').getChildByName('GameScene');
        
        if (gameSceneNode) {
            let gameController = gameSceneNode.getComponent('GameController');
            if (gameController) {
                // 使用 GameController 的重啟方法
                gameController.restartGame();
                return;
            }
        }
        
        // 如果找不到 GameController，嘗試手動清理
        let allNodes = [];
        this.collectAllNodes(canvas, allNodes);
        
        // 停止所有節點的動作
        allNodes.forEach(node => {
            node.stopAllActions();
        });
    },
    
    // 收集所有節點
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

    // 專門處理登入畫面的排行榜顯示
    showLoginLeaderboard() {
        let canvas = cc.director.getScene().getComponentInChildren(cc.Canvas);
        let self = this;
        
        // 檢查是否已經有排行榜面板在顯示
        let existingLeaderboard = canvas.node.getChildByName("LeaderboardPanel");
        if (existingLeaderboard) {
            console.log("排行榜已經在顯示中，避免重複創建");
            return;
        }
        
        // 獲取當前玩家ID
        let currentPlayerId = GlobalData.getPlayerId();
        if (!currentPlayerId) {
            currentPlayerId = cc.sys.localStorage.getItem('playerId') || "";
        }
        this.currentPlayerId = currentPlayerId;

        // 隱藏輸入欄位
        let playerInputField = canvas.node.getChildByName("playerIdInput");
        if (playerInputField) {
            if (!playerInputField._originalActive) {
                playerInputField._originalActive = playerInputField.active;
            }
            playerInputField.active = false;
        }
        
        // 禁用登入和排行榜按鈕
        this._disableLoginButtons(canvas.node);
        
        // 建立遮罩背景
        let maskNode = new cc.Node("LeaderboardMask");
        let maskSprite = maskNode.addComponent(cc.Sprite);
        maskSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        maskNode.width = canvas.node.width;
        maskNode.height = canvas.node.height;
        maskNode.color = cc.color(0, 0, 0);
        maskNode.opacity = 150; // 半透明
        maskNode.parent = canvas.node;
        
        // 建立排行榜面板
        let leaderboardNode = new cc.Node("LeaderboardPanel");
        leaderboardNode.width = 600;
        leaderboardNode.height = 700;
        
        // 使用繪圖元件來畫一個白色矩形
        let graphics = leaderboardNode.addComponent(cc.Graphics);
        graphics.fillColor = cc.color(255, 255, 255, 255);
        graphics.rect(-300, -350, 600, 700);
        graphics.fill();
        
        // 先將節點添加到畫布，但設置為不可見
        leaderboardNode.parent = canvas.node;
        
        // 添加排行榜標題
        let titleNode = new cc.Node("Title");
        let titleLabel = titleNode.addComponent(cc.Label);
        titleLabel.string = "排行榜";
        titleLabel.fontSize = 40;
        titleLabel.lineHeight = 40;
        titleNode.color = cc.color(0, 0, 0);
        titleNode.position = cc.v2(0, 300);
        titleNode.parent = leaderboardNode;
        
        // 添加連接狀態提示
        let statusNode = new cc.Node("Status");
        let statusLabel = statusNode.addComponent(cc.Label);
        statusLabel.string = this.isOfflineMode ? "離線模式，顯示本地排行榜" : "已連接到線上排行榜服務";
        statusLabel.fontSize = 16;
        statusLabel.lineHeight = 16;
        statusNode.color = this.isOfflineMode ? cc.color(255, 0, 0) : cc.color(0, 128, 0);
        statusNode.position = cc.v2(0, 260);
        statusNode.parent = leaderboardNode;
        
        // 添加載入中提示
        let loadingNode = new cc.Node("Loading");
        let loadingLabel = loadingNode.addComponent(cc.Label);
        loadingLabel.string = "載入中...";
        loadingLabel.fontSize = 24;
        loadingNode.position = cc.v2(0, 0);
        loadingNode.parent = leaderboardNode;
        
        // 建立加載提示
        Toast("正在獲取排行榜資料...", { duration: 2, gravity: "CENTER" });
        
        // 獲取排行榜數據
        this.getLeaderboard(function(err, data) {
            // 移除載入中提示
            loadingNode.destroy();
            
            if (err) {
                console.error("獲取排行榜失敗：", err);
                Toast("無法獲取線上排行，顯示本地排行榜!", { duration: 2, gravity: "CENTER" });
                
                // 使用本地數據
                data = self.localLeaderboardData;
                statusLabel.string = "離線模式，顯示本地排行榜";
                statusNode.color = cc.color(255, 0, 0);
            } else {
                Toast("已獲取最新排行資料!", { duration: 2, gravity: "CENTER" });
            }
            
            // 先準備好所有UI元素，但不添加到場景中
            let contentNode = new cc.Node("LeaderboardContent");
            
            // 顯示排行榜數據（登入用的特殊版本）
            self.renderLoginLeaderboard(contentNode, data, currentPlayerId);
            
            // 添加關閉按鈕
            self.addCloseButton(contentNode, maskNode);
            
            // 一次性添加到排行榜面板，避免多次重繪
            contentNode.parent = leaderboardNode;
        }, true);
    },

    // 渲染登入畫面的排行榜數據
    renderLoginLeaderboard(contentNode, data, currentPlayerId) {
        // 確保數據有效
        if (!data || !Array.isArray(data)) {
            data = [];
        }
        
        // 查找當前玩家的排名和分數
        let currentPlayerRank = -1;
        let currentPlayerData = null;
        
        for (let i = 0; i < data.length; i++) {
            if (data[i].playerId === currentPlayerId) {
                currentPlayerRank = i + 1;
                currentPlayerData = data[i];
                break;
            }
        }
        
        // 如果當前玩家不在排行榜中，則創建臨時數據，顯示為N/A
        if (currentPlayerRank === -1 && currentPlayerId) {
            currentPlayerData = {
                playerId: currentPlayerId,
                score: "N/A", // 新玩家顯示N/A
                date: new Date().toISOString()
            };
        }
        
        // 顯示前十名
        let displayCount = Math.min(10, data.length);
        
        // 建立排行榜表頭 - 增加字體大小
        let headerNode = new cc.Node("Header");
        headerNode.position = cc.v2(0, 230);
        headerNode.parent = contentNode;
        
        // 排名表頭
        let rankHeaderNode = new cc.Node("RankHeader");
        let rankHeaderLabel = rankHeaderNode.addComponent(cc.Label);
        rankHeaderLabel.string = "排名";
        rankHeaderLabel.fontSize = 30;
        rankHeaderNode.color = cc.color(100, 100, 100);
        rankHeaderNode.position = cc.v2(-200, 0);
        rankHeaderNode.parent = headerNode;
        
        // 玩家ID表頭
        let idHeaderNode = new cc.Node("IDHeader");
        let idHeaderLabel = idHeaderNode.addComponent(cc.Label);
        idHeaderLabel.string = "玩家ID";
        idHeaderLabel.fontSize = 30;
        idHeaderNode.color = cc.color(100, 100, 100);
        idHeaderNode.position = cc.v2(0, 0);
        idHeaderNode.parent = headerNode;
        
        // 分數表頭
        let scoreHeaderNode = new cc.Node("ScoreHeader");
        let scoreHeaderLabel = scoreHeaderNode.addComponent(cc.Label);
        scoreHeaderLabel.string = "分數";
        scoreHeaderLabel.fontSize = 30;
        scoreHeaderNode.color = cc.color(100, 100, 100);
        scoreHeaderNode.position = cc.v2(200, 0);
        scoreHeaderNode.parent = headerNode;
        
        // 分隔線
        let lineNode = new cc.Node("Line");
        let lineGraphics = lineNode.addComponent(cc.Graphics);
        lineGraphics.strokeColor = cc.color(200, 200, 200);
        lineGraphics.lineWidth = 2;
        lineGraphics.moveTo(-275, 0);
        lineGraphics.lineTo(275, 0);
        lineGraphics.stroke();
        lineNode.position = cc.v2(0, 210);
        lineNode.parent = contentNode;
        
        // 創建排行榜項目
        for (let i = 0; i < displayCount; i++) {
            let entry = data[i];
            
            let entryNode = new cc.Node(`Entry_${i}`);
            entryNode.position = cc.v2(0, 180 - i * 45);
            entryNode.parent = contentNode;
            
            // 如果是當前玩家，先增加高亮背景
            if (entry.playerId === currentPlayerId) {
                let highlightNode = new cc.Node("Highlight");
                let highlightGraphics = highlightNode.addComponent(cc.Graphics);
                highlightGraphics.fillColor = cc.color(135, 206, 250, 100);
                highlightGraphics.rect(-275, -22, 550, 44);
                highlightGraphics.fill();
                highlightNode.parent = entryNode;
                highlightNode.setSiblingIndex(0);
            }
            
            // 排名
            let rankNode = new cc.Node("Rank");
            let rankLabel = rankNode.addComponent(cc.Label);
            rankLabel.string = (i + 1).toString();
            rankLabel.fontSize = 28;
            rankNode.color = cc.color(0, 0, 0);
            rankNode.position = cc.v2(-200, 0);
            rankNode.parent = entryNode;
            
            // 玩家ID
            let idNode = new cc.Node("ID");
            let idLabel = idNode.addComponent(cc.Label);
            idLabel.string = entry.playerId || "未知玩家";
            idLabel.fontSize = 28;
            idNode.color = cc.color(0, 0, 0);
            idNode.position = cc.v2(0, 0);
            idNode.parent = entryNode;
            
            // 分數
            let scoreNode = new cc.Node("Score");
            let scoreLabel = scoreNode.addComponent(cc.Label);
            scoreLabel.string = entry.score.toString();
            scoreLabel.fontSize = 28;
            scoreNode.color = cc.color(0, 0, 0);
            scoreNode.position = cc.v2(200, 0);
            scoreNode.parent = entryNode;
        }
        
        // 如果當前玩家不在前十名或不在排行榜中，單獨顯示
        if ((currentPlayerRank > 10 || currentPlayerRank === -1) && currentPlayerData) {
            // 添加一條分隔線
            let separatorNode = new cc.Node("Separator");
            let separatorGraphics = separatorNode.addComponent(cc.Graphics);
            separatorGraphics.strokeColor = cc.color(200, 200, 200);
            separatorGraphics.lineWidth = 2;
            separatorGraphics.moveTo(-275, 0);
            separatorGraphics.lineTo(275, 0);
            separatorGraphics.stroke();
            
            // 計算分隔線位置
            let itemCount = Math.min(10, displayCount);
            let separatorY = 180 - (itemCount * 45) + 33.75;
            separatorNode.position = cc.v2(0, separatorY);
            separatorNode.parent = contentNode;
            
            // 創建當前玩家項目
            let playerEntryNode = new cc.Node("CurrentPlayerEntry");
            // 將當前玩家的位置設為分隔線下方一個項目高度處
            let playerEntryY = separatorY - 33.75;
            playerEntryNode.position = cc.v2(0, playerEntryY);
            playerEntryNode.parent = contentNode;
            
            // 先設置高亮背景
            let highlightNode = new cc.Node("Highlight");
            let highlightGraphics = highlightNode.addComponent(cc.Graphics);
            highlightGraphics.fillColor = cc.color(135, 206, 250, 100);
            highlightGraphics.rect(-275, -22, 550, 44);
            highlightGraphics.fill();
            highlightNode.parent = playerEntryNode;
            highlightNode.setSiblingIndex(0);
            
            // 排名
            let rankNode = new cc.Node("Rank");
            let rankLabel = rankNode.addComponent(cc.Label);
            rankLabel.string = currentPlayerRank > 0 ? currentPlayerRank.toString() : "N/A";
            rankLabel.fontSize = 28;
            rankNode.color = cc.color(0, 0, 0);
            rankNode.position = cc.v2(-200, 0);
            rankNode.parent = playerEntryNode;
            
            // 玩家ID
            let idNode = new cc.Node("ID");
            let idLabel = idNode.addComponent(cc.Label);
            idLabel.string = currentPlayerData.playerId;
            idLabel.fontSize = 28;
            idNode.color = cc.color(0, 0, 0);
            idNode.position = cc.v2(0, 0);
            idNode.parent = playerEntryNode;
            
            // 分數
            let scoreNode = new cc.Node("Score");
            let scoreLabel = scoreNode.addComponent(cc.Label);
            scoreLabel.string = currentPlayerData.score.toString();
            scoreLabel.fontSize = 28;
            scoreNode.color = cc.color(0, 0, 0);
            scoreNode.position = cc.v2(200, 0);
            scoreNode.parent = playerEntryNode;
        }
    },

    // 添加關閉按鈕
    addCloseButton(contentNode, maskNode) {
        // 創建關閉按鈕
        let closeButton = new cc.Node("CloseButton");
        closeButton.width = 220;
        closeButton.height = 60;
        closeButton.position = cc.v2(0, -320);
        closeButton.parent = contentNode;
        
        // 使用 Graphics 繪製按鈕背景
        let buttonGraphics = closeButton.addComponent(cc.Graphics);
        buttonGraphics.fillColor = cc.color(220, 20, 60, 255); // 紅色按鈕
        
        // 確保矩形大小與按鈕節點大小一致
        buttonGraphics.rect(-110, -30, 220, 60);
        buttonGraphics.fill();
        
        // 添加標籤
        let buttonLabel = new cc.Node("Label");
        let label = buttonLabel.addComponent(cc.Label);
        label.string = "關閉";
        label.fontSize = 30;
        label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
        label.verticalAlign = cc.Label.VerticalAlign.CENTER;
        
        // 調整標籤位置
        buttonLabel.position = cc.v2(0, -2);
        
        buttonLabel.color = cc.color(255, 255, 255);
        buttonLabel.parent = closeButton;
        
        // 添加點擊事件
        closeButton.on(cc.Node.EventType.TOUCH_END, () => {
            console.log("關閉排行榜");
            
            // 禁用按鈕防止多次點擊
            closeButton.off(cc.Node.EventType.TOUCH_END);
            
            // 恢復輸入欄位顯示
            let canvas = cc.director.getScene().getComponentInChildren(cc.Canvas);
            let playerInputField = canvas.node.getChildByName("playerIdInput");
            if (playerInputField && playerInputField._originalActive !== undefined) {
                playerInputField.active = playerInputField._originalActive;
            }
            
            // 恢復登入和排行榜按鈕
            this._restoreLoginButtons(canvas.node);
            
            let leaderboardPanel = closeButton.parent.parent;
            leaderboardPanel.destroy();
            maskNode.destroy();
        });
    },

    // 禁用按鈕
    _disableLoginButtons(canvasNode) {
        // 找到登入按鈕和排行榜按鈕
        let loginButton = canvasNode.getChildByName('loginButton');
        let leaderboardButton = canvasNode.getChildByName('LeaderboardButton');
        
        // 保存按鈕原始狀態並禁用
        if (loginButton) {
            let buttonComp = loginButton.getComponent(cc.Button);
            if (buttonComp) {
                loginButton._originalInteractable = buttonComp.interactable;
                buttonComp.interactable = false;
                
                // 也可以選擇降低透明度表示禁用狀態
                loginButton._originalOpacity = loginButton.opacity;
                loginButton.opacity = 120;
            }
        }
        
        if (leaderboardButton) {
            let buttonComp = leaderboardButton.getComponent(cc.Button);
            if (buttonComp) {
                leaderboardButton._originalInteractable = buttonComp.interactable;
                buttonComp.interactable = false;
                
                // 降低透明度
                leaderboardButton._originalOpacity = leaderboardButton.opacity;
                leaderboardButton.opacity = 120;
            }
        }
    },

    // 恢復按鈕
    _restoreLoginButtons(canvasNode) {
        // 找到登入按鈕和排行榜按鈕
        let loginButton = canvasNode.getChildByName('loginButton');
        let leaderboardButton = canvasNode.getChildByName('LeaderboardButton');
        
        // 恢復按鈕原始狀態
        if (loginButton) {
            let buttonComp = loginButton.getComponent(cc.Button);
            if (buttonComp && loginButton._originalInteractable !== undefined) {
                buttonComp.interactable = loginButton._originalInteractable;
                
                // 恢復透明度
                if (loginButton._originalOpacity !== undefined) {
                    loginButton.opacity = loginButton._originalOpacity;
                }
            }
        }
        
        if (leaderboardButton) {
            let buttonComp = leaderboardButton.getComponent(cc.Button);
            if (buttonComp && leaderboardButton._originalInteractable !== undefined) {
                buttonComp.interactable = leaderboardButton._originalInteractable;
                
                // 恢復透明度
                if (leaderboardButton._originalOpacity !== undefined) {
                    leaderboardButton.opacity = leaderboardButton._originalOpacity;
                }
            }
        }
    }
});