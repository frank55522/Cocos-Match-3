

cc.Class({
    extends: cc.Component,

    properties: {},

    onLoad: function() {
        this.label = this.getComponent(cc.Label);
        this.goalLeft = -1;
    },

    setGameController: function(gameController) {
        this.gameController = gameController;
    },

    updateLabel: function() {
        this.label.string = this.goalLeft;
    },

    setGoalLeft: function(num) {
        this.goalLeft = num;
        this.updateLabel();
    },
    getGoalLeft: function() {
        return this.goalLeft;
    },

    goalLeftMinus: function() {
        if (this.goalLeft <= 0)
            return;

        this.goalLeft--;
        this.updateLabel();

        if (this.goalLeft === 0) {
            this.gameController.goalComplete();
        }
    },
});
