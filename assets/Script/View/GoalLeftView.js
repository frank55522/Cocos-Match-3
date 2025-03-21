

cc.Class({
    extends: cc.Component,

    properties: {},

    onLoad() {
        this.label = this.getComponent(cc.Label);
        this.goalLeft = -1;
    },

    updateLabel() {
        this.label.string = this.goalLeft;
    },

    setGoalLeft(num) {
        this.goalLeft = num;
        this.updateLabel();
    },
    getGoalLeft() {
        return this.goalLeft;
    },

    goalLeftMinus() {
        if (this.goalLeft <= 0)
            return;
        this.goalLeft--;
        this.updateLabel();
    },
});
