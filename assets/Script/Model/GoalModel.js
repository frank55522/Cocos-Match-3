import { CELL_TYPE, CELL_STATUS, CELL_TYPE_REVERSE, GOAL_TYPE, GOAL_TYPE_REVERSE, COMPLETE_COINS, CRUSH_QUANTITY } from "./ConstValue";

export class GoalModel {
    constructor() {
        this.goalType = GOAL_TYPE.NOPE;
        this.specifyColor = CELL_TYPE.EMPTY;
    }

    getGoalType() {
        return this.goalType;
    }

    getSpecifyColor() {
        return this.specifyColor;
    }

    resetGoalModel() {
        this.goalType = GOAL_TYPE.NOPE;
        this.specifyColor = CELL_TYPE.EMPTY;
    }

    getRandomGoalModel(cellTypeNum) {
        let randomNum = Math.floor(Math.random() * (COMPLETE_COINS.length - 1)) + 1;
        //randomNum = 2; // Testing

        this.goalType = randomNum;
        this.specifyColor = (this.goalType === GOAL_TYPE.SINGLE_COLOR) ? Math.floor(Math.random() * cellTypeNum) + 1 : CELL_TYPE.EMPTY;

        this.printGoalInfo();
        return [CRUSH_QUANTITY[randomNum], COMPLETE_COINS[randomNum]];
    }
    
    isConformGoal(model1, model2) {
        if (!model2) {
            if (this.goalType >= GOAL_TYPE.STRAIGHT_PLUS_STRAIGHT) return false;
        
            switch (this.goalType) {
            case GOAL_TYPE.SINGLE_COLOR:
                return model1.type === this.specifyColor;
            case GOAL_TYPE.STRAIGHT:
                return model1.status === CELL_STATUS.COLUMN || model1.status === CELL_STATUS.LINE;
            case GOAL_TYPE.WRAP:
                return model1.status === CELL_STATUS.WRAP;
            case GOAL_TYPE.BIRD:
                return model1.status === CELL_STATUS.BIRD;
            default:
                return false;
            }
        }
        else {
            if (this.goalType < GOAL_TYPE.STRAIGHT_PLUS_STRAIGHT) return false;
            if (!model1 || !model2) return false;

            let lineQuantity = 0, wrapQuantity = 0, birdQuantity = 0;
            lineQuantity += (model1.status == CELL_STATUS.LINE || model1.status == CELL_STATUS.COLUMN);
            lineQuantity += (model2.status == CELL_STATUS.LINE || model2.status == CELL_STATUS.COLUMN);
            wrapQuantity += (model1.status == CELL_STATUS.WRAP);
            wrapQuantity += (model2.status == CELL_STATUS.WRAP);
            birdQuantity += (model1.status == CELL_STATUS.BIRD);
            birdQuantity += (model2.status == CELL_STATUS.BIRD);
            switch (this.goalType) {
            case GOAL_TYPE.STRAIGHT_PLUS_STRAIGHT:
                return lineQuantity == 2;
            case GOAL_TYPE.STRAIGHT_PLUS_WRAP:
                return lineQuantity && wrapQuantity;
            case GOAL_TYPE.STRAIGHT_PLUS_BIRD:
                return lineQuantity && birdQuantity;
            case GOAL_TYPE.WRAP_PLUS_WRAP:
                return wrapQuantity == 2;
            case GOAL_TYPE.WRAP_PLUS_BIRD:
                return wrapQuantity && birdQuantity;
            case GOAL_TYPE.BIRD_PLUS_BIRD:
                return birdQuantity == 2;
            default:
                return false;
            }
        }
    }

    printGoalInfo() {
        console.log(`目標類型: ${GOAL_TYPE_REVERSE[this.goalType]}`);
        if (this.goalType === GOAL_TYPE.SINGLE_COLOR)
            console.log(`指定顏色: ${CELL_TYPE_REVERSE[this.specifyColor]}`);
    }
}