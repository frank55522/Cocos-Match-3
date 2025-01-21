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
                console.error("GameScene node not found!");
                return;
            }
        }

        const gameController = this.gameScene.getComponent("GameController");
        if (gameController) {
            this.gameModel = gameController.getGameModel();
            this.label.string = this.gameModel.getCoin();
        } else {
            console.error("GameController not found on gameScene.");
        }
    },

    update (dt) {
        if (this.gameModel) {
            this.label.string = this.gameModel.getCoin();
        }
    }
});
