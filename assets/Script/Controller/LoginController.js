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
    },
    HowToPlayButton: {
      type: cc.Button,
      default: null,
    },
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

    // 設置如何遊玩按鈕事件
    if (this.HowToPlayButton) {
      this.HowToPlayButton.node.on('click', this.onHowToPlayClick, this);
    }

    // 設置玩家ID輸入框的最大長度
    if (this.playerIdInput) {
      this.playerIdInput.maxLength = 20;
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
  },

  onHowToPlayClick() {
    let canvas = cc.director.getScene().getComponentInChildren(cc.Canvas);
  
    let leaderboardNode = cc.director.getScene().getChildByName('LeaderboardManager');
    if (!leaderboardNode) {
      leaderboardNode = new cc.Node('LeaderboardManager');
      leaderboardNode.parent = cc.director.getScene();
      leaderboardNode.addComponent('LeaderboardManager');
    }

    let leaderboardManager = leaderboardNode.getComponent('LeaderboardManager');
    if (leaderboardManager && leaderboardManager._disableLoginButtons) {
      leaderboardManager._disableLoginButtons(canvas.node);
    }
  
    // 遮罩 - 使用全屏遮罩
    const maskNode = new cc.Node("HowToPlayMask");
    const maskSprite = maskNode.addComponent(cc.Sprite);
    maskSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    maskNode.width = canvas.node.width;
    maskNode.height = canvas.node.height;
    maskNode.color = cc.Color.BLACK;
    maskNode.opacity = 150;
    maskNode.parent = canvas.node;
  
    // 主面板 - 大幅增加高度，讓面板更加符合手機屏幕
    const panelNode = new cc.Node("HowToPlayPanel");
    panelNode.width = 600;
    panelNode.height = 700; // 進一步增加高度
    const graphics = panelNode.addComponent(cc.Graphics);
    graphics.fillColor = cc.Color.WHITE;
    graphics.rect(-300, -350, 600, 700); // 調整矩形大小
    graphics.fill();
    panelNode.parent = canvas.node;
  
    // 標題
    const titleNode = new cc.Node("Title");
    const titleLabel = titleNode.addComponent(cc.Label);
    titleLabel.string = "玩法說明";
    titleLabel.fontSize = 36;
    titleLabel.lineHeight = 40;
    titleNode.color = cc.Color.BLACK;
    titleNode.position = cc.v2(0, 320); // 進一步上移標題位置
    titleNode.parent = panelNode;
  
    // 關閉按鈕 - 進一步降低位置
    const closeButton = new cc.Node("CloseButton");
    closeButton.width = 200;
    closeButton.height = 60;
    closeButton.position = cc.v2(0, -320); // 調整關閉按鈕位置
    closeButton.parent = panelNode;
    const btnGraphics = closeButton.addComponent(cc.Graphics);
    btnGraphics.fillColor = cc.color(51, 122, 183, 255);
    btnGraphics.rect(-100, -30, 200, 60);
    btnGraphics.fill();
    const btnLabelNode = new cc.Node("Label");
    const btnLabel = btnLabelNode.addComponent(cc.Label);
    btnLabel.string = "關閉";
    btnLabel.fontSize = 28;
    btnLabelNode.color = cc.Color.WHITE;
    btnLabelNode.position = cc.v2(0, 0);
    btnLabelNode.parent = closeButton;
  
    closeButton.on(cc.Node.EventType.TOUCH_END, () => {
      panelNode.destroy();
      maskNode.destroy();
    
      let leaderboardNode = cc.director.getScene().getChildByName('LeaderboardManager');
      if (leaderboardNode) {
        let leaderboardManager = leaderboardNode.getComponent('LeaderboardManager');
        if (leaderboardManager && leaderboardManager._restoreLoginButtons) {
          let canvas = cc.director.getScene().getComponentInChildren(cc.Canvas);
          leaderboardManager._restoreLoginButtons(canvas.node);
        }
      }
    });    
  
    // 計算 ScrollView 高度與位置 - 進一步增加滾動區域高度
    const scrollTopY = 320 - 40;      // title 下方
    const scrollBottomY = -320 + 40;  // 關閉按鈕上方，增加間距
    const scrollHeight = scrollTopY - scrollBottomY;
  
    // ScrollView 容器 - 使用最大可用空間
    const scrollNode = new cc.Node("ScrollView");
    scrollNode.width = 570; // 進一步增加寬度
    scrollNode.height = scrollHeight;
    scrollNode.position = cc.v2(0, scrollBottomY + scrollHeight / 2);
    scrollNode.parent = panelNode;
  
    const scrollView = scrollNode.addComponent(cc.ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;
    scrollView.inertia = true;
    scrollView.bounceEnabled = true;
    scrollView.scrollEvents = [];
    
    // 設置較低的滾動速度
    scrollView.brake = 0.3; // 較小的值使滾動更流暢
    scrollView.elasticity = 0.1; // 調低彈性值，使滾動結束時更平滑
  
    // Viewport
    const viewNode = new cc.Node("View");
    viewNode.width = scrollNode.width;
    viewNode.height = scrollNode.height;
    viewNode.anchorX = 0.5;
    viewNode.anchorY = 1;
    viewNode.y = scrollNode.height / 2;
    viewNode.parent = scrollNode;
    scrollView.viewport = viewNode;
    viewNode.addComponent(cc.Mask);
  
    // Content - 更大的內容區域
    const contentNode = new cc.Node("Content");
    contentNode.width = 550;
    contentNode.anchorX = 0.5;
    contentNode.anchorY = 1;
    contentNode.y = 0;
    contentNode.parent = viewNode;
    scrollView.content = contentNode;
  
    // 白色背景區塊 - 極大的背景高度以確保所有內容顯示
    const labelBg = new cc.Node("LabelBackground");
    labelBg.width = 550;
    labelBg.anchorY = 1;
    labelBg.y = 0;
    labelBg.parent = contentNode;
    const bgGraphics = labelBg.addComponent(cc.Graphics);
    bgGraphics.fillColor = cc.Color.WHITE;
    bgGraphics.rect(-275, -3000, 550, 3000); // 大幅增加背景高度
    bgGraphics.fill();
  
    // 文字 Label - 更小的字體和行距以容納更多內容
    const labelNode = new cc.Node("HowToPlayText");
    const label = labelNode.addComponent(cc.Label);
    label.string = this.getHowToPlayText();
    label.fontSize = 18; // 進一步減小字體
    label.lineHeight = 25; // 減小行高
    label.overflow = cc.Label.Overflow.RESIZE_HEIGHT;
    label.horizontalAlign = cc.Label.HorizontalAlign.LEFT;
    label.verticalAlign = cc.Label.VerticalAlign.TOP;
    labelNode.width = 550;
    labelNode.anchorY = 1;
    labelNode.y = 0;
    labelNode.color = cc.Color.BLACK;
    labelNode.parent = contentNode;
  
    // 滾動指示器 - 位置向上調整
    const scrollIndicator = new cc.Node("ScrollIndicator");
    const indicatorLabel = scrollIndicator.addComponent(cc.Label);
    indicatorLabel.string = "▼ 滑動查看更多 ▼";
    indicatorLabel.fontSize = 16;
    indicatorLabel.lineHeight = 16;
    scrollIndicator.color = cc.color(46, 204, 113);
    scrollIndicator.position = cc.v2(0, 295); // 位置往上調整，更接近標題
    scrollIndicator.parent = panelNode;

    // 讓指示器更加明顯
    scrollIndicator.opacity = 255;

    // 指示器閃爍效果 - 增強閃爍對比度
    const fadeOut = cc.fadeTo(0.8, 100); // 更快的淡出，更低的透明度
    const fadeIn = cc.fadeTo(0.8, 255);  // 更快的淡入
    const sequence = cc.sequence(fadeOut, fadeIn);
    scrollIndicator.runAction(cc.repeatForever(sequence));
  
    // 文字高度計算 - 更可靠的內容高度計算
    const calculateHeight = () => {
      try {
        const labelHeight = labelNode.getContentSize().height;
        const safeHeight = Math.max(labelHeight + 60, 500); // 確保最小高度
        contentNode.height = safeHeight;
        labelBg.height = safeHeight;
        
        // 滾動至頂部並顯示閃爍指示器
        scrollView.scrollToTop(0.1);
        
        // 監聽滾動事件，當用戶滾動到底部時移除指示器
        const onScrollEvent = new cc.Component.EventHandler();
        onScrollEvent.target = scrollNode;
        onScrollEvent.component = "cc.ScrollView";
        onScrollEvent.handler = "onScroll";
        
        // 添加自定義滾動監聽
        const originalOnScroll = scrollView.onScroll;
        scrollView.onScroll = function() {
          if (originalOnScroll) originalOnScroll.call(this);
          
          // 當滾動到底部附近時隱藏指示器
          const scrollRatio = this.getScrollOffset().y / (contentNode.height - viewNode.height);
          if (scrollRatio > 0.7) {
            scrollIndicator.opacity = 0;
          } else if (scrollRatio < 0.1) {
            scrollIndicator.opacity = 255; // 回到頂部時恢復指示器
          }
        };
        
        scrollView.scrollEvents.push(onScrollEvent);
      } catch (e) {
        console.error("計算高度時出錯:", e);
      }
    };
  
    // 延遲計算高度，確保文本完全渲染
    this.scheduleOnce(calculateHeight, 0.3);
    
    // 添加額外檢查，以防首次計算不夠準確
    this.scheduleOnce(() => {
      try {
        const actualHeight = labelNode.getContentSize().height;
        if (contentNode.height < actualHeight) {
          console.log("重新調整內容高度...");
          contentNode.height = actualHeight + 60;
          labelBg.height = actualHeight + 60;
        }
      } catch (e) {
        console.error("二次檢查高度時出錯:", e);
      }
    }, 1.0);
  },
  
  getHowToPlayText() {
    return `這是一款經典三消遊戲，玩家要在限制的時間內思考出最佳的消除策略，並在有限的步數中盡可能地取得更多的金幣。透過消除更多動物就能獲取金幣，並且盡可能取得高combo、完成任務目標、消除特殊方塊來獲得更多的金幣，在排行榜上打敗別人吧!

  【動物方塊種類】
  ● 一般：沒有特殊邊框。
  ● 直/橫向消除：有銀色邊框，直向消除的會點頭，橫向消除的會搖頭。
  ● 爆炸：有金色邊框，消除對角線五格長的菱形範圍。
  ● 鳥：
    - 與一般動物消除：清除全場同種類動物。
    - 與特殊方塊消除：將同種類轉換成該特殊方塊並觸發效果。
  
  【一般消除】
  ● 三個相同動物連成一線。
  
  【生成特殊動物的方式】
  1. 四個相同動物連成一線 → 生成直/橫向消除的動物（直線四顆產生橫向的、橫線四顆產生直向的）。
  2. 五個相同動物呈L型、十字形 → 生成爆炸消除動物。
  3. 五個相同動物連成一直線 → 生成鳥。
  
  【特殊消除組合】
  1. 直/橫 + 直/橫 → 十字消除。
  2. 直/橫 + 爆炸 → 三格寬十字消除。
  3. 直/橫 + 鳥 → 將該類動物全轉為直/橫消除並觸發。
  4. 爆炸 + 爆炸 → 範圍擴大為 5×5 消除。
  5. 爆炸 + 鳥 → 將該類動物轉為爆炸並觸發。
  6. 鳥 + 鳥 → 清除整個盤面。
  
  ───────────────────────────────

  【任務目標】
  每次遊玩都會隨機產生一種任務目標，完成後可獲得獎勵金幣(完成後會再給一個任務)：
  1. 消除特定動物種類 (100個)
  2. 消除直/橫特殊方塊 (10個)
  3. 消除爆炸型特殊方塊 (7個)
  4. 消除鳥型特殊方塊 (5個)
  5. 同時消除兩個直/橫特殊方塊 (4次)
  6. 同時消除直/橫和爆炸型特殊方塊 (3次)
  7. 同時消除直/橫和鳥型特殊方塊 (2次)
  8. 同時消除兩個爆炸型特殊方塊 (3次)
  9. 同時消除爆炸型和鳥型特殊方塊 (2次)
  10. 同時消除兩個鳥型特殊方塊 (1次)

  ───────────────────────────────
  
  【金幣獲取規則】
  ● 單次消除:
    - 3~5 顆：+10 金幣
    - 6~8 顆：+15 金幣
    - 9~11 顆：+25 金幣
    - 12~14 顆：+45 金幣
    - 15~17 顆：+85 金幣
    - 18~20 顆：+120 金幣
    - 21~ 顆：+150 金幣
  ● Combo額外獎勵：3*(combo^2) 金幣
  ● 特殊組合額外獎勵：
    - 直/橫 + 直/橫：+250 金幣
    - 直/橫 + 爆炸：+400 金幣
    - 直/橫 + 鳥：+600 金幣
    - 爆炸 + 爆炸：+500 金幣
    - 爆炸 + 鳥：+750 金幣
    - 鳥 + 鳥：+1000 金幣
  ● 任務目標額外獎勵：
    - 消除特定動物種類 (100個)：+100金幣
    - 消除直/橫特殊方塊 (10個)：+200金幣
    - 消除爆炸型特殊方塊 (7個)：+250金幣
    - 消除鳥型特殊方塊 (5個)：+400金幣
    - 同時消除兩個直/橫特殊方塊 (4次)：+300金幣
    - 同時消除直/橫和爆炸型特殊方塊 (3次)：+450金幣
    - 同時消除直/橫和鳥型特殊方塊 (2次)：+600金幣
    - 同時消除兩個爆炸型特殊方塊 (3次)：+600金幣
    - 同時消除爆炸型和鳥型特殊方塊 (2次)：+800金幣
    - 同時消除兩個鳥型特殊方塊 (1次)：+1000金幣`;
  },  
});