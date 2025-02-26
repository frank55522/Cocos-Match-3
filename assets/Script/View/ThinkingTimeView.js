cc.Class({
    extends: cc.Component,

    properties: {
        gameScene: {
            type: cc.Node,
            default: null
        }
    },

    onLoad() {
        this.label = this.getComponent(cc.Label);
    },

    start () {
        if (!this.gameScene) {
            this.gameScene = cc.find("Canvas/GameScene");
            if (!this.gameScene) {
                console.error("[ThinkingTimeView] GameScene 節點找不到！");
                return;
            }
        }

        const gameController = this.gameScene.getComponent("GameController");
        if (gameController) {
            this.gameModel = gameController.getGameModel();
            this.updateThinkingTime();
        } else {
            console.error("[ThinkingTimeView] GameController 未找到！");
        }
    },

    update (dt) {
        if (this.gameModel) {
            this.updateThinkingTime();
        }
    },

    updateThinkingTime() {
        if (this.label) {
            this.label.string = `倒數時間: ${this.gameModel.currentThinkingTime} 秒`;
        }
    }
});